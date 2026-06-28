import { api } from "./api";

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>();
  localStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];
  private iceServersFetchedAt = 0;
  private static readonly ICE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // Callbacks wired by voiceStore
  onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  onIceCandidate: ((targetUserId: string, candidate: any) => void) | null = null;
  onPeerDisconnected: ((userId: string) => void) | null = null;
  onNegotiationNeeded: ((userId: string, sdpOffer: string) => void) | null = null;

  /**
   * Fetch one-time STUN/TURN configurations from Backend key-mask endpoints.
   */
  async fetchIceServers(): Promise<void> {
    if (this.iceServers.length > 0 && Date.now() - this.iceServersFetchedAt < WebRTCManager.ICE_CACHE_TTL) {
      console.log("[WebRTC] Using cached ICE servers:", this.iceServers);
      return;
    }
    try {
      const response = await api.get("/voice/ice-servers");
      // Backend returns either dynamic Metered array or fallback Google list
      this.iceServers = response.data;
      this.iceServersFetchedAt = Date.now();
      console.log("[WebRTC] Successfully loaded ICE servers:", this.iceServers);
    } catch (error) {
      console.error("[WebRTC] Failed to fetch ICE servers, using local Google STUN fallback instead:", error);
      this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  async initLocalStream(requestVideo: boolean = false): Promise<MediaStream> {
    // Fetch ICE servers right before generating RTCPeerConnection instances
    await this.fetchIceServers();

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: requestVideo ? {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 }
      } : false,
    });

    // Disable video track by default, enabling it only upon user explicitly toggling camera
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = false;
    }

    return this.localStream;
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Always add audio track first, then video track second to guarantee consistent m-line order!
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack, this.localStream!);
    }
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      pc.addTrack(videoTrack, this.localStream!);
    }

    // Handle receiving tracks from target peer
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote stream from peer user ${userId}`);
      if (event.streams && event.streams[0]) {
        // Create a new MediaStream instance containing all active tracks.
        // This ensures the reference changes and triggers React/Zustand updates.
        const combinedStream = new MediaStream(event.streams[0].getTracks());
        this.onRemoteStream?.(userId, combinedStream);

        // Listen for future track additions/removals on the same stream to trigger UI updates
        event.streams[0].onaddtrack = () => {
          console.log(`[WebRTC] Track added to stream for peer user ${userId}`);
          this.onRemoteStream?.(userId, new MediaStream(event.streams[0]!.getTracks()));
        };
        event.streams[0].onremovetrack = () => {
          console.log(`[WebRTC] Track removed from stream for peer user ${userId}`);
          this.onRemoteStream?.(userId, new MediaStream(event.streams[0]!.getTracks()));
        };
      }
    };

    // Relay local ICE candidates to backend signaling broker
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(userId, event.candidate.toJSON());
      }
    };

    // Watch signaling and ice connection state changes to prune dead connections
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state change with peer ${userId}: ${pc.connectionState}`);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        this.onPeerDisconnected?.(userId);
      }
    };

    // Handle renegotiation needed triggers (e.g. when track enabled/disabled changes configuration)
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== "stable") {
          console.log(`[WebRTC] renegotiationneeded ignored for peer ${userId} because signalingState is: ${pc.signalingState}`);
          return;
        }
        console.log(`[WebRTC] onnegotiationneeded triggered for peer user: ${userId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.onNegotiationNeeded?.(userId, JSON.stringify(offer));
      } catch (error) {
        console.error(`[WebRTC] Failed to handle negotiationneeded event for peer ${userId}:`, error);
      }
    };

    this.peers.set(userId, pc);
    return pc;
  }

  async createOffer(targetUserId: string): Promise<string> {
    console.log(`[WebRTC] Initiating ICE Offer negotiation to target user ${targetUserId}`);
    const pc = this.createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return JSON.stringify(offer);
  }

  async handleOffer(fromUserId: string, sdpJson: string): Promise<string> {
    console.log(`[WebRTC] Received input Offer from sender user ${fromUserId}, returning Answer`);
    let pc = this.peers.get(fromUserId);
    if (!pc) {
      pc = this.createPeerConnection(fromUserId);
    }

    const offer = new RTCSessionDescription(JSON.parse(sdpJson));

    // Handle glare condition (Perfect Negotiation)
    if (pc.signalingState === "have-local-offer") {
      console.log(`[WebRTC] Glare detected on peer ${fromUserId}: signalingState is have-local-offer. Rolling back local offer...`);
      await pc.setLocalDescription({ type: "rollback" });
    }

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return JSON.stringify(answer);
  }

  async handleAnswer(fromUserId: string, sdpJson: string): Promise<void> {
    console.log(`[WebRTC] Processing incoming Answer from peer user ${fromUserId}`);
    const pc = this.peers.get(fromUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdpJson)));
    } else {
      console.warn(`[WebRTC] Peer connection for user ${fromUserId} not found when applying Answer`);
    }
  }

  async handleIceCandidate(fromUserId: string, candidateJson: string): Promise<void> {
    const pc = this.peers.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateJson)));
      } catch (error) {
        console.error(`[WebRTC] Failed to register ICE candidate from user ${fromUserId}:`, error);
      }
    } else {
      console.warn(`[WebRTC] Peer connection for user ${fromUserId} not found when applying candidate`);
    }
  }

  toggleMute(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // returns true if muted
    }
    return false;
  }

  async toggleCamera(enable: boolean): Promise<boolean> {
    if (!this.localStream) {
      console.warn("[WebRTC] Cannot toggle camera: No local stream.");
      return false;
    }

    let videoTrack = this.localStream.getVideoTracks()[0];

    // If enabling camera but no track exists, acquire it dynamically!
    if (enable && !videoTrack) {
      try {
        console.log("[WebRTC] Acquiring local video track dynamically...");
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          }
        });
        const track = media.getVideoTracks()[0];
        if (track) {
          this.localStream.addTrack(track);
          videoTrack = track;
          // Add this new track to all existing RTCPeerConnection instances, reusing transceivers if possible
          this.peers.forEach(async (pc) => {
            const transceiver = pc.getTransceivers().find(
              (t) => t.receiver.track.kind === "video" || t.sender.track?.kind === "video"
            );
            if (transceiver) {
              transceiver.direction = "sendrecv";
              await transceiver.sender.replaceTrack(track);
            } else {
              pc.addTrack(track, this.localStream!);
            }
          });
        }
      } catch (error) {
        console.error("[WebRTC] Failed to acquire video track dynamically:", error);
        return false;
      }
    }

    if (videoTrack) {
      videoTrack.enabled = enable;

      // If we are disabling, stop the track to release the hardware camera sensor and turn check light OFF!
      if (!enable) {
        videoTrack.stop();
        this.localStream.removeTrack(videoTrack);

        // Remove track from all peers to trigger clean renegotiation
        this.peers.forEach(async (pc) => {
          const senders = pc.getSenders();
          const sender = senders.find((s) => s.track?.id === videoTrack.id || s.track?.kind === "video");
          if (sender) {
            pc.removeTrack(sender);
          }
        });
      } else {
        // If enabling and track already exists, ensure it is set on all peers
        this.peers.forEach(async (pc) => {
          const transceiver = pc.getTransceivers().find(
            (t) => t.receiver.track.kind === "video" || t.sender.track?.kind === "video"
          );
          if (transceiver) {
            transceiver.direction = "sendrecv";
            await transceiver.sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, this.localStream!);
          }
        });
      }
      return enable;
    }

    return false;
  }

  disconnectPeer(userId: string): void {
    const pc = this.peers.get(userId);
    if (pc) {
      console.log(`[WebRTC] Disconnecting peer: ${userId}`);
      pc.close();
      this.peers.delete(userId);
    }
  }

  disconnectAll(): void {
    console.log("[WebRTC] Tearing down WebRTC Manager: closing all peer ports");
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }
}

export const webrtcManager = new WebRTCManager();

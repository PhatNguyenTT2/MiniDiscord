import { api } from "./api";

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];

  // Callbacks wired by voiceStore
  onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  onIceCandidate: ((targetUserId: string, candidate: any) => void) | null = null;
  onPeerDisconnected: ((userId: string) => void) | null = null;

  /**
   * Fetch one-time STUN/TURN configurations from Backend key-mask endpoints.
   */
  async fetchIceServers(): Promise<void> {
    try {
      const response = await api.get("/voice/ice-servers");
      // Backend returns either dynamic Metered array or fallback Google list
      this.iceServers = response.data;
      console.log("[WebRTC] Successfully loaded ICE servers:", this.iceServers);
    } catch (error) {
      console.error("[WebRTC] Failed to fetch ICE servers, using local Google STUN fallback instead:", error);
      this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  async initLocalStream(): Promise<MediaStream> {
    // Fetch ICE servers right before generating RTCPeerConnection instances
    await this.fetchIceServers();

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false, // Phase 7: Audio-only core
    });
    return this.localStream;
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Stream out local tracks to the target peer
    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    // Handle receiving tracks from target peer
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote stream from peer user ${userId}`);
      if (event.streams && event.streams[0]) {
        this.onRemoteStream?.(userId, event.streams[0]);
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
    const pc = this.createPeerConnection(fromUserId);
    await pc.setRemoteDescription(JSON.parse(sdpJson));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return JSON.stringify(answer);
  }

  async handleAnswer(fromUserId: string, sdpJson: string): Promise<void> {
    console.log(`[WebRTC] Processing incoming Answer from peer user ${fromUserId}`);
    const pc = this.peers.get(fromUserId);
    if (pc) {
      await pc.setRemoteDescription(JSON.parse(sdpJson));
    } else {
      console.warn(`[WebRTC] Peer connection for user ${fromUserId} not found when applying Answer`);
    }
  }

  async handleIceCandidate(fromUserId: string, candidateJson: string): Promise<void> {
    const pc = this.peers.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(JSON.parse(candidateJson));
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

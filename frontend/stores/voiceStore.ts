import { create } from "zustand";
import { api } from "@/lib/api";
import { webrtcManager } from "@/lib/webrtc";
import { getStompClient } from "@/lib/websocket";
import { useAuthStore } from "./authStore";
import { useRoomStore } from "./roomStore";
import { soundEngine } from "@/lib/soundEngine";

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  displayName?: string;
}

export interface VoiceCallEvent {
  eventType?: string;
  roomId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  targetUserId: string;
  action: "RING" | "ACCEPT" | "DECLINE" | "END" | "MISSED";
}

interface VoiceStoreState {
  currentChannel: { roomId: string; channelId: string } | null;
  isMuted: boolean;
  isDeafened: boolean;
  connectionDuration: number; // in seconds

  remoteStreams: Record<string, MediaStream>; // userId -> MediaStream
  channelParticipants: Record<string, VoiceParticipant[]>; // channelId -> VoiceParticipant[]

  incomingCall: VoiceCallEvent | null;
  activeCallRoomId: string | null;

  // Voice Channel Actions
  joinVoiceChannel: (roomId: string, channelId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;

  // DM call Actions
  startCall: (roomId: string, targetUserId: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;

  // Signaling & Sync hooks
  handleVoiceStateUpdate: (update: any) => void;
  handleSignal: (signal: any) => void;
  handleCallEvent: (event: VoiceCallEvent) => void;
  fetchVoiceStates: (roomId: string, channelIds: string[]) => Promise<void>;
}

let tickerInterval: ReturnType<typeof setInterval> | null = null;
let ringingSoundInterval: ReturnType<typeof setInterval> | null = null;

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  currentChannel: null,
  isMuted: false,
  isDeafened: false,
  connectionDuration: 0,
  remoteStreams: {},
  channelParticipants: {},
  incomingCall: null,
  activeCallRoomId: null,

  joinVoiceChannel: async (roomId: string, channelId: string) => {
    const activeChannel = get().currentChannel;
    if (activeChannel?.channelId === channelId) return;

    // Check if in another channel, force leave first
    if (activeChannel) {
      get().leaveVoiceChannel();
    }

    try {
      console.log(`[VoiceStore] Joining channel ${channelId} in room ${roomId}`);

      // 1. Initialise WebRTC manager stream & fetch dynamic TURN credentials
      const localStream = await webrtcManager.initLocalStream();

      // 2. Setup WebRTC callbacks
      webrtcManager.onRemoteStream = (userId, stream) => {
        console.log(`[VoiceStore] Wire remote stream callback for peer user ${userId}`);
        set((state) => ({
          remoteStreams: { ...state.remoteStreams, [userId]: stream }
        }));
      };

      webrtcManager.onIceCandidate = (targetUserId, candidate) => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        getStompClient(token).publish({
          destination: "/app/voice.signal",
          body: JSON.stringify({
            roomId,
            channelId,
            targetUserId,
            type: "ICE",
            payload: JSON.stringify(candidate)
          })
        });
      };

      webrtcManager.onPeerDisconnected = (userId) => {
        console.log(`[VoiceStore] Peer user ${userId} disconnected internally in WebRTC`);
        webrtcManager.disconnectPeer(userId);
        set((state) => {
          const updatedStreams = { ...state.remoteStreams };
          delete updatedStreams[userId];
          return { remoteStreams: updatedStreams };
        });
      };

      // 3. Inform backend via STOMP broker
      const token = useAuthStore.getState().token;
      if (token) {
        getStompClient(token).publish({
          destination: "/app/voice.join",
          body: JSON.stringify({ roomId, channelId })
        });
      }

      // 4. Set state & start duration ticking timer
      set({
        currentChannel: { roomId, channelId },
        connectionDuration: 0,
        isMuted: false,
        isDeafened: false,
        remoteStreams: {},
      });

      if (tickerInterval) clearInterval(tickerInterval);
      tickerInterval = setInterval(() => {
        set((state) => ({ connectionDuration: state.connectionDuration + 1 }));
      }, 1000);

      // Play connecting sound
      soundEngine?.play("voice_join");
    } catch (e) {
      console.error("[VoiceStore] Failed to acquire media block. Voice channel join denied: ", e);
      soundEngine?.play("voice_leave");
    }
  },

  leaveVoiceChannel: () => {
    const active = get().currentChannel;
    if (!active) return;

    console.log(`[VoiceStore] Leaving current channel ${active.channelId}`);

    // 1. Inform backend via STOMP
    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.leave",
        body: JSON.stringify({ roomId: active.roomId, channelId: active.channelId })
      });
    }

    // 2. Tear down WebRTC Manager singleton
    webrtcManager.disconnectAll();

    // 3. Clear ticking timer & state
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }

    set({
      currentChannel: null,
      connectionDuration: 0,
      isMuted: false,
      isDeafened: false,
      remoteStreams: {},
    });

    soundEngine?.play("voice_disconnect");
  },

  toggleMute: () => {
    const active = get().currentChannel;
    if (!active) return;

    const isCurrentlyMuted = get().isMuted;
    const isCurrentlyDeafened = get().isDeafened;

    // Toggle mute locally in media device
    const nowMuted = webrtcManager.toggleMute();

    set({ isMuted: nowMuted });

    // Send mute state event to servers
    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.mute",
        body: JSON.stringify({
          roomId: active.roomId,
          channelId: active.channelId,
          muted: nowMuted,
          deafened: isCurrentlyDeafened
        })
      });
    }

    soundEngine?.play(nowMuted ? "mute" : "unmute");
  },

  toggleDeafen: () => {
    const active = get().currentChannel;
    if (!active) return;

    const isCurrentlyDeafened = get().isDeafened;
    const nowDeafened = !isCurrentlyDeafened;

    // Discord style: deafening automatically forces mic mute
    let nowMuted = get().isMuted;
    const audioTrack = webrtcManager.initLocalStream; // dummy read check

    const localTrack = (webrtcManager as any).localStream?.getAudioTracks()[0];
    if (localTrack) {
      // If going deafen -> force mute local stream. If going undeafen -> restore to original mute status
      localTrack.enabled = !nowDeafened;
      nowMuted = nowDeafened;
    }

    // Adjust speaker volumes for all remote stream components if deafened
    Object.values(get().remoteStreams).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !nowDeafened;
      });
    });

    set({
      isDeafened: nowDeafened,
      isMuted: nowMuted
    });

    // Informs signaling server
    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.mute",
        body: JSON.stringify({
          roomId: active.roomId,
          channelId: active.channelId,
          muted: nowMuted,
          deafened: nowDeafened
        })
      });
    }

    soundEngine?.play(nowDeafened ? "deafen" : "undeafen");
  },

  startCall: (roomId: string, targetUserId: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    console.log(`[VoiceStore] Initiating DM direct call inside room ${roomId}`);
    set({ activeCallRoomId: roomId });

    // Send call ringing event over WebSocket
    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.call",
        body: JSON.stringify({
          roomId,
          targetUserId,
          callerId: currentUser.id,
          callerName: currentUser.username,
          callerAvatar: currentUser.avatarUrl || null,
          action: "RING"
        })
      });
    }

    // Start local ringing playback loop
    soundEngine?.playLoop("call_ringing");
  },

  acceptCall: async () => {
    const incoming = get().incomingCall;
    if (!incoming) return;

    soundEngine?.stopLoop("call_ringing");

    try {
      console.log(`[VoiceStore] Accepting call in room ${incoming.roomId}`);

      // Start local media stream for peer call
      await webrtcManager.initLocalStream();

      // Configure peer callback events
      webrtcManager.onRemoteStream = (userId, stream) => {
        set((state) => ({
          remoteStreams: { ...state.remoteStreams, [userId]: stream }
        }));
      };

      webrtcManager.onIceCandidate = (targetUserId, candidate) => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        getStompClient(token).publish({
          destination: "/app/voice.signal",
          body: JSON.stringify({
            roomId: incoming.roomId,
            channelId: "dm",
            targetUserId,
            type: "ICE",
            payload: JSON.stringify(candidate)
          })
        });
      };

      webrtcManager.onPeerDisconnected = (userId) => {
        get().endCall();
      };

      // Notify and accept over WebSocket
      const token = useAuthStore.getState().token;
      if (token) {
        getStompClient(token).publish({
          destination: "/app/voice.accept",
          body: JSON.stringify({ roomId: incoming.roomId })
        });
      }

      set({
        activeCallRoomId: incoming.roomId,
        incomingCall: null,
      });

      soundEngine?.play("voice_join");
    } catch (e) {
      console.error("[VoiceStore] Failed to mount audio resources for DM call:", e);
      get().declineCall();
    }
  },

  declineCall: () => {
    const incoming = get().incomingCall;
    if (!incoming) return;

    soundEngine?.stopLoop("call_ringing");

    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.decline",
        body: JSON.stringify({ roomId: incoming.roomId })
      });
    }

    set({ incomingCall: null });
    soundEngine?.play("voice_leave");
  },

  endCall: () => {
    const activeRoomId = get().activeCallRoomId;
    if (!activeRoomId) return;

    console.log(`[VoiceStore] Ending active call in room ${activeRoomId}`);

    soundEngine?.stopLoop("call_ringing");

    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.end",
        body: JSON.stringify({ roomId: activeRoomId })
      });
    }

    webrtcManager.disconnectAll();

    set({
      activeCallRoomId: null,
      incomingCall: null,
      remoteStreams: {},
    });

    soundEngine?.play("voice_disconnect");
  },

  handleVoiceStateUpdate: (update: any) => {
    const { channelId, userId, action, username, avatarUrl } = update;
    if (!channelId) return;

    console.log(`[VoiceStore] handleVoiceStateUpdate from user ${userId} context:`, update);

    set((state) => {
      const activeList = state.channelParticipants[channelId] || [];
      let updatedList = [...activeList];

      if (action === "JOIN") {
        if (!updatedList.some((p) => p.userId === userId)) {
          const channelsMap = useRoomStore.getState().channels;
          let foundRoomId = "";
          for (const [rId, cList] of Object.entries(channelsMap)) {
            if (cList.some((ch) => ch.id === channelId)) {
              foundRoomId = rId;
              break;
            }
          }
          const roomMembers = foundRoomId ? (useRoomStore.getState().members[foundRoomId] || []) : [];
          const details = roomMembers.find((m: any) => m.userId === userId);
          updatedList.push({
            userId,
            username: username || `User-${userId.substring(0, 4)}`,
            displayName: details?.displayName || details?.username || username || `User-${userId.substring(0, 4)}`,
            avatarUrl: avatarUrl || null,
            muted: false,
            deafened: false,
          });
        }

        // Play notification if in the same connected channel
        if (state.currentChannel?.channelId === channelId) {
          const currentUserId = useAuthStore.getState().user?.id;
          if (userId !== currentUserId) {
            soundEngine?.play("user_join_voice");
          }
        }
      } else if (action === "LEAVE") {
        updatedList = updatedList.filter((p) => p.userId !== userId);

        // Peer hook cleanup if someone index leaves our channel
        if (state.currentChannel?.channelId === channelId) {
          webrtcManager.disconnectPeer(userId);
          const currentUserId = useAuthStore.getState().user?.id;
          if (userId !== currentUserId) {
            soundEngine?.play("user_leave_voice");
          }
        }
      } else if (action === "MUTE" || action === "UNMUTE" || action === "DEAFEN") {
        updatedList = updatedList.map((p) => {
          if (p.userId === userId) {
            return {
              ...p,
              muted: action === "MUTE" || action === "DEAFEN",
              deafened: action === "DEAFEN",
            };
          }
          return p;
        });
      }

      return {
        channelParticipants: {
          ...state.channelParticipants,
          [channelId]: updatedList,
        },
      };
    });
  },

  handleSignal: async (signal: any) => {
    const active = get().currentChannel || get().activeCallRoomId;
    if (!active) return;

    const token = useAuthStore.getState().token;
    if (!token) return;

    const { type, peerId, fromUserId, payload } = signal;
    console.log(`[VoiceStore] handleSignal [${type}] from peer user: ${fromUserId || peerId}`);

    try {
      if (type === "INITIATE_OFFER") {
        const sdpOffer = await webrtcManager.createOffer(peerId);
        getStompClient(token).publish({
          destination: "/app/voice.signal",
          body: JSON.stringify({
            roomId: get().currentChannel?.roomId || get().activeCallRoomId,
            channelId: get().currentChannel?.channelId || "dm",
            targetUserId: peerId,
            type: "OFFER",
            payload: sdpOffer
          })
        });
      } else if (type === "SIGNAL_OFFER") {
        const sdpAnswer = await webrtcManager.handleOffer(fromUserId, payload);
        getStompClient(token).publish({
          destination: "/app/voice.signal",
          body: JSON.stringify({
            roomId: get().currentChannel?.roomId || get().activeCallRoomId,
            channelId: get().currentChannel?.channelId || "dm",
            targetUserId: fromUserId,
            type: "ANSWER",
            payload: sdpAnswer
          })
        });
      } else if (type === "SIGNAL_ANSWER") {
        await webrtcManager.handleAnswer(fromUserId, payload);
      } else if (type === "SIGNAL_ICE") {
        await webrtcManager.handleIceCandidate(fromUserId, payload);
      }
    } catch (e) {
      console.error("[VoiceStore] Failed during signal routing flow: ", e);
    }
  },

  handleCallEvent: (event: VoiceCallEvent) => {
    console.log("[VoiceStore] handleCallEvent received: ", event);
    const { action, roomId } = event;

    if (action === "RING") {
      set({ incomingCall: event });
      soundEngine?.playLoop("call_ringing");
    } else if (action === "ACCEPT") {
      soundEngine?.stopLoop("call_ringing");
      set({ activeCallRoomId: roomId, incomingCall: null });
      // Initiate WebRTC peer logic
      webrtcManager.initLocalStream().then(() => {
        webrtcManager.onRemoteStream = (userId, stream) => {
          set((state) => ({
            remoteStreams: { ...state.remoteStreams, [userId]: stream }
          }));
        };
        webrtcManager.onIceCandidate = (targetUserId, candidate) => {
          const token = useAuthStore.getState().token;
          if (!token) return;
          getStompClient(token).publish({
            destination: "/app/voice.signal",
            body: JSON.stringify({
              roomId,
              channelId: "dm",
              targetUserId,
              type: "ICE",
              payload: JSON.stringify(candidate)
            })
          });
        };
        webrtcManager.onPeerDisconnected = () => get().endCall();

        // Create offer to caller
        get().handleSignal({ type: "INITIATE_OFFER", peerId: event.callerId });
      });
      soundEngine?.play("voice_join");
    } else if (action === "DECLINE" || action === "MISSED") {
      soundEngine?.stopLoop("call_ringing");
      set({ incomingCall: null, activeCallRoomId: null });
      soundEngine?.play("voice_leave");
    } else if (action === "END") {
      soundEngine?.stopLoop("call_ringing");
      webrtcManager.disconnectAll();
      set({ activeCallRoomId: null, incomingCall: null, remoteStreams: {} });
      soundEngine?.play("voice_disconnect");
    }
  },

  fetchVoiceStates: async (roomId: string, channelIds: string[]) => {
    if (!channelIds || channelIds.length === 0) return;
    try {
      const res = await api.get(`/voice/rooms/${roomId}/states`, {
        params: { channelIds: channelIds.join(",") }
      });

      const payloadData = res.data?.data || {};
      const newParticipantsMap: Record<string, VoiceParticipant[]> = {};

      // Backend returns map {channelId -> Set<userId>}
      const roomMembers = useRoomStore.getState().members[roomId] || [];
      const userCachedMap = new Map<string, any>(roomMembers.map((m: any) => [m.userId, m]));

      Object.entries(payloadData).forEach(([chId, userIdsList]) => {
        const list = userIdsList as string[];
        newParticipantsMap[chId] = list.map((uid) => {
          const details = userCachedMap.get(uid);
          return {
            userId: uid,
            username: details?.username || `User-${uid.substring(0, 4)}`,
            displayName: details?.displayName || details?.username || `User-${uid.substring(0, 4)}`,
            avatarUrl: details?.avatarUrl || null,
            muted: false, // will update when state sync is done or lazy matching
            deafened: false,
          };
        });
      });

      set((state) => ({
        channelParticipants: {
          ...state.channelParticipants,
          ...newParticipantsMap
        }
      }));
      console.log("[VoiceStore] Successfully preloaded voice participants:", newParticipantsMap);
    } catch (e) {
      console.error("[VoiceStore] Failed fetching room voice states:", e);
    }
  }
}));

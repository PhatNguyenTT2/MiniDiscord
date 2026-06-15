import { create } from "zustand";
import { api } from "@/lib/api";
import { webrtcManager } from "@/lib/webrtc";
import { getStompClient } from "@/lib/websocket";
import { useAuthStore } from "./authStore";
import { useRoomStore } from "./roomStore";
import { soundEngine } from "@/lib/soundEngine";
import { resumeAudioContext } from "@/hooks/useAudioActivity";

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
  action: "RING" | "ACCEPT" | "DECLINE" | "END" | "MISSED" | "UNAVAILABLE";
}

interface VoiceStoreState {
  currentChannel: { roomId: string; channelId: string } | null;
  localStream: MediaStream | null;
  isMuted: boolean;
  isDeafened: boolean;
  connectionDuration: number; // in seconds

  remoteStreams: Record<string, MediaStream>; // userId -> MediaStream
  channelParticipants: Record<string, VoiceParticipant[]>; // channelId -> VoiceParticipant[]

  incomingCall: VoiceCallEvent | null;
  activeCallRoomId: string | null;
  callStatus: "RINGING" | "ACTIVE" | "DECLINED" | "UNAVAILABLE" | null;

  isRecoveringCall: boolean;
  recoveringCallPeerId: string | null;
  resumeRecoveredCall: () => Promise<void>;

  // Voice Channel Actions
  joinVoiceChannel: (roomId: string, channelId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;

  // DM call Actions
  startCall: (roomId: string, targetUserId: string, channelId?: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;

  // Signaling & Sync hooks
  handleVoiceStateUpdate: (update: Record<string, unknown>) => void;
  handleSignal: (signal: Record<string, unknown>) => void;
  handleCallEvent: (event: VoiceCallEvent) => void;
  fetchVoiceStates: (roomId: string, channelIds: string[]) => Promise<void>;
  checkActiveCall: () => Promise<void>;
}

let tickerInterval: ReturnType<typeof setInterval> | null = null;
let callTimeout: ReturnType<typeof setTimeout> | null = null;

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  currentChannel: null,
  localStream: null,
  isMuted: false,
  isDeafened: false,
  connectionDuration: 0,
  remoteStreams: {},
  channelParticipants: {},
  incomingCall: null,
  activeCallRoomId: null,
  callStatus: null,
  isRecoveringCall: false,
  recoveringCallPeerId: null,

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
      resumeAudioContext();
      const localStream = await webrtcManager.initLocalStream();
      set({ localStream });
      const startingMute = get().isMuted;
      const startingDeafen = get().isDeafened;
      const audioTrack = localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !startingMute && !startingDeafen;
      }

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
      const currentUser = useAuthStore.getState().user;
      const roomMembers = useRoomStore.getState().members[roomId] || [];
      const selfMember = roomMembers.find((m: any) => m.userId === currentUser?.id);

      set((state) => ({
        currentChannel: { roomId, channelId },
        connectionDuration: 0,
        remoteStreams: {},
        channelParticipants: {
          ...state.channelParticipants,
          [channelId]: [
            ...(state.channelParticipants[channelId] || []).filter(
              (p) => p.userId !== currentUser?.id
            ),
            ...(currentUser ? [{
              userId: currentUser.id,
              username: currentUser.username,
              displayName: selfMember?.displayName || currentUser.username,
              avatarUrl: selfMember?.avatarUrl || currentUser.avatarUrl || null,
              muted: state.isMuted,
              deafened: state.isDeafened,
            }] : []),
          ],
        },
      }));

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

    const currentUserId = useAuthStore.getState().user?.id;

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

    // 4. Eagerly remove self from channelParticipants
    set((state) => ({
      currentChannel: null,
      localStream: null,
      connectionDuration: 0,
      remoteStreams: {},
      channelParticipants: {
        ...state.channelParticipants,
        [active.channelId]: (state.channelParticipants[active.channelId] || []).filter(
          (p) => p.userId !== currentUserId
        ),
      },
    }));

    soundEngine?.play("voice_disconnect");
  },

  toggleMute: () => {
    resumeAudioContext();
    const isCurrentlyMuted = get().isMuted;
    const isCurrentlyDeafened = get().isDeafened;
    const nowMuted = !isCurrentlyMuted;

    // Toggle mute locally in media device track if exists
    const audioTrack = webrtcManager.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !nowMuted;
    }

    const currentUserId = useAuthStore.getState().user?.id;
    const activeChannel = get().currentChannel;
    const channelKey = activeChannel?.channelId || (get().activeCallRoomId ? "dm" : null);

    set((state) => {
      const updated: Partial<VoiceStoreState> = { isMuted: nowMuted };
      if (channelKey && currentUserId) {
        const list = state.channelParticipants[channelKey] || [];
        updated.channelParticipants = {
          ...state.channelParticipants,
          [channelKey]: list.map((p) =>
            p.userId === currentUserId ? { ...p, muted: nowMuted } : p
          ),
        };
      }
      return updated;
    });

    // Send mute state event to servers if inside any active calling room
    const active = get().currentChannel || get().activeCallRoomId;
    if (active) {
      const roomId = typeof active === "string" ? active : active.roomId;
      const channelId = typeof active === "string" ? "dm" : active.channelId;
      const token = useAuthStore.getState().token;
      if (token) {
        getStompClient(token).publish({
          destination: "/app/voice.mute",
          body: JSON.stringify({
            roomId,
            channelId,
            muted: nowMuted,
            deafened: isCurrentlyDeafened
          })
        });
      }
    }

    soundEngine?.play(nowMuted ? "mute" : "unmute");
  },

  toggleDeafen: () => {
    resumeAudioContext();
    const isCurrentlyDeafened = get().isDeafened;
    const nowDeafened = !isCurrentlyDeafened;

    // Discord style: deafening automatically forces mic mute
    let nowMuted = get().isMuted;
    if (nowDeafened) {
      nowMuted = true;
    }

    // Toggle local stream track if exists
    const localTrack = webrtcManager.localStream?.getAudioTracks()[0];
    if (localTrack) {
      localTrack.enabled = !nowDeafened;
    }

    // Adjust speaker volumes for all remote stream components if deafened
    Object.values(get().remoteStreams).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !nowDeafened;
      });
    });

    const currentUserId2 = useAuthStore.getState().user?.id;
    const activeChannel2 = get().currentChannel;
    const channelKey2 = activeChannel2?.channelId || (get().activeCallRoomId ? "dm" : null);

    set((state) => {
      const updated: Partial<VoiceStoreState> = { isDeafened: nowDeafened, isMuted: nowMuted };
      if (channelKey2 && currentUserId2) {
        const list = state.channelParticipants[channelKey2] || [];
        updated.channelParticipants = {
          ...state.channelParticipants,
          [channelKey2]: list.map((p) =>
            p.userId === currentUserId2 ? { ...p, muted: nowMuted, deafened: nowDeafened } : p
          ),
        };
      }
      return updated;
    });

    // Informs signaling server if inside any active calling room
    const active = get().currentChannel || get().activeCallRoomId;
    if (active) {
      const roomId = typeof active === "string" ? active : active.roomId;
      const channelId = typeof active === "string" ? "dm" : active.channelId;
      const token = useAuthStore.getState().token;
      if (token) {
        getStompClient(token).publish({
          destination: "/app/voice.mute",
          body: JSON.stringify({
            roomId,
            channelId,
            muted: nowMuted,
            deafened: nowDeafened
          })
        });
      }
    }

    soundEngine?.play(nowDeafened ? "deafen" : "undeafen");
  },

  startCall: (roomId: string, targetUserId: string, channelId?: string) => {
    resumeAudioContext();
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    console.log(`[VoiceStore] Initiating DM direct call inside room ${roomId} for channel ${channelId}`);
    set({ activeCallRoomId: roomId, callStatus: "RINGING" });

    // Send call ringing event over WebSocket
    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.call",
        body: JSON.stringify({
          roomId,
          channelId,
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

    // Timeout call after 60 seconds of outgoing ringing
    if (callTimeout) clearTimeout(callTimeout);
    callTimeout = setTimeout(() => {
      console.log("[VoiceStore] Outgoing call timed out after 60s.");
      get().endCall();
    }, 60000);
  },

  acceptCall: async () => {
    const incoming = get().incomingCall;
    if (!incoming) return;

    soundEngine?.stopLoop("call_ringing");
    if (callTimeout) {
      clearTimeout(callTimeout);
      callTimeout = null;
    }

    try {
      console.log(`[VoiceStore] Accepting call in room ${incoming.roomId}`);
      resumeAudioContext();

      // Start local media stream for peer call
      const localStream = await webrtcManager.initLocalStream();
      set({ localStream });
      const startingMute = get().isMuted;
      const startingDeafen = get().isDeafened;
      const audioTrack = localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !startingMute && !startingDeafen;
      }

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
        callStatus: "ACTIVE",
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
    if (callTimeout) {
      clearTimeout(callTimeout);
      callTimeout = null;
    }

    const token = useAuthStore.getState().token;
    if (token) {
      getStompClient(token).publish({
        destination: "/app/voice.decline",
        body: JSON.stringify({ roomId: incoming.roomId })
      });
    }

    set({ incomingCall: null, callStatus: null });
    soundEngine?.play("voice_leave");
  },

  endCall: () => {
    const activeRoomId = get().activeCallRoomId;
    if (!activeRoomId) return;

    console.log(`[VoiceStore] Ending active call in room ${activeRoomId}`);

    soundEngine?.stopLoop("call_ringing");
    if (callTimeout) {
      clearTimeout(callTimeout);
      callTimeout = null;
    }

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
      callStatus: null,
      incomingCall: null,
      localStream: null,
      remoteStreams: {},
    });

    soundEngine?.play("voice_disconnect");
  },

  handleVoiceStateUpdate: (update: Record<string, unknown>) => {
    const { channelId, userId, action, username, avatarUrl } = update as { channelId?: string; userId: string; action: string; username?: string; avatarUrl?: string | null };
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
            avatarUrl: details?.avatarUrl || avatarUrl || null,
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

          const updatedStreams = { ...state.remoteStreams };
          delete updatedStreams[userId];

          const currentUserId = useAuthStore.getState().user?.id;
          if (userId !== currentUserId) {
            soundEngine?.play("user_leave_voice");
          }

          return {
            channelParticipants: {
              ...state.channelParticipants,
              [channelId]: updatedList,
            },
            remoteStreams: updatedStreams,
          };
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

  handleSignal: async (signal: Record<string, unknown>) => {
    const active = get().currentChannel || get().activeCallRoomId;
    if (!active) return;

    const token = useAuthStore.getState().token;
    if (!token) return;

    const { type, peerId, fromUserId, payload } = signal as { type: string; peerId: string; fromUserId: string; payload: string };
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
      set({ incomingCall: event, callStatus: "RINGING" });
      soundEngine?.playLoop("call_ringing");

      // Timeout call after 60 seconds of incoming ringing
      if (callTimeout) clearTimeout(callTimeout);
      callTimeout = setTimeout(() => {
        console.log("[VoiceStore] Incoming call timed out after 60s.");
        get().declineCall();
      }, 60000);
    } else if (action === "ACCEPT") {
      soundEngine?.stopLoop("call_ringing");
      if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
      }
      set({ activeCallRoomId: roomId, callStatus: "ACTIVE", incomingCall: null });
      // Initiate WebRTC peer logic
      resumeAudioContext();
      webrtcManager.initLocalStream().then((localStream) => {
        set({ localStream });
        const startingMute = get().isMuted;
        const startingDeafen = get().isDeafened;
        const audioTrack = localStream?.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !startingMute && !startingDeafen;
        }
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
      if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
      }
      set({ callStatus: "DECLINED", incomingCall: null });
      soundEngine?.play("voice_leave");
      setTimeout(() => {
        if (get().activeCallRoomId === roomId) {
          set({ activeCallRoomId: null, callStatus: null });
        }
      }, 3000);
    } else if (action === "UNAVAILABLE") {
      soundEngine?.stopLoop("call_ringing");
      if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
      }
      set({ callStatus: "UNAVAILABLE", incomingCall: null });
      soundEngine?.play("voice_leave");
      console.warn("[VoiceStore] Target user is offline/unavailable.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("voice-call-unavailable"));
      }
      setTimeout(() => {
        if (get().activeCallRoomId === roomId) {
          set({ activeCallRoomId: null, callStatus: null });
        }
      }, 3000);
    } else if (action === "END") {
      soundEngine?.stopLoop("call_ringing");
      if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
      }
      webrtcManager.disconnectAll();
      set({ activeCallRoomId: null, incomingCall: null, callStatus: null, localStream: null, remoteStreams: {} });
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
      const userCachedMap = new Map<string, { userId: string; username: string; displayName?: string | null; avatarUrl?: string | null }>(
        roomMembers.map((m: { userId: string; username: string; displayName?: string | null; avatarUrl?: string | null }) => [m.userId, m])
      );

      Object.entries(payloadData).forEach(([chId, userIdsList]) => {
        const list = userIdsList as string[];
        newParticipantsMap[chId] = list.map((uid) => {
          const details = userCachedMap.get(uid);
          const existingParticipant = (get().channelParticipants[chId] || []).find((p) => p.userId === uid);
          return {
            userId: uid,
            username: details?.username || `User-${uid.substring(0, 4)}`,
            displayName: details?.displayName || details?.username || `User-${uid.substring(0, 4)}`,
            avatarUrl: details?.avatarUrl || null,
            muted: existingParticipant?.muted ?? false,
            deafened: existingParticipant?.deafened ?? false,
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
  },

  checkActiveCall: async () => {
    try {
      const res = await api.get<{ message: string; data: any }>("/voice/active-call");
      if (res.data && res.data.data) {
        const callState = res.data.data;
        const currentUserId = useAuthStore.getState().user?.id;

        // If status is RINGING and targetUserId is current user, we should show the incoming call modal!
        if (callState.status === "RINGING" && callState.targetUserId === currentUserId) {
          console.log("[VoiceStore] Active incoming call recovered:", callState);
          set({
            incomingCall: {
              roomId: callState.roomId,
              callerId: callState.callerId,
              callerName: callState.callerName || "User",
              callerAvatar: callState.callerAvatar || null,
              targetUserId: callState.targetUserId,
              action: "RING"
            },
            callStatus: "RINGING",
            activeCallRoomId: callState.roomId
          });
          soundEngine?.playLoop("call_ringing");
        } else if (callState.status === "ACTIVE" && (callState.callerId === currentUserId || callState.targetUserId === currentUserId)) {
          // If the call is already active, we should set the recovery flags to render a recovery UI
          if (!get().activeCallRoomId) {
            console.log("[VoiceStore] Active ongoing call recovered. Setting recovery flags:", callState);
            const otherParty = callState.callerId === currentUserId ? callState.targetUserId : callState.callerId;
            set({
              activeCallRoomId: callState.roomId,
              callStatus: "ACTIVE",
              isRecoveringCall: true,
              recoveringCallPeerId: otherParty
            });
          }
        }
      }
    } catch (err) {
      console.warn("[VoiceStore] Failed to check active call status:", err);
    }
  },

  resumeRecoveredCall: async () => {
    const roomId = get().activeCallRoomId;
    const targetUserId = get().recoveringCallPeerId;
    if (!roomId || !targetUserId) return;

    try {
      console.log(`[VoiceStore] Resuming recovered active call in room ${roomId} with user ${targetUserId}`);

      // 1. Initialise WebRTC manager stream
      await resumeAudioContext();
      const localStream = await webrtcManager.initLocalStream();
      set({ localStream, isRecoveringCall: false });

      const startingMute = get().isMuted;
      const startingDeafen = get().isDeafened;
      const audioTrack = localStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !startingMute && !startingDeafen;
      }

      // 2. Setup WebRTC callbacks
      webrtcManager.onRemoteStream = (userId, stream) => {
        console.log(`[VoiceStore] Wire remote stream callback for peer user ${userId}`);
        set((state) => ({
          remoteStreams: { ...state.remoteStreams, [userId]: stream }
        }));
      };

      webrtcManager.onIceCandidate = (tid, candidate) => {
        const token = useAuthStore.getState().token;
        if (!token) return;

        getStompClient(token).publish({
          destination: "/app/voice.signal",
          body: JSON.stringify({
            roomId,
            channelId: "dm",
            targetUserId: tid,
            type: "ICE",
            payload: JSON.stringify(candidate)
          })
        });
      };

      webrtcManager.onPeerDisconnected = (userId) => {
        console.log(`[VoiceStore] Peer user ${userId} disconnected. Ending DM call.`);
        webrtcManager.disconnectPeer(userId);
        get().endCall();
      };

      // 3. Re-negotiate: trigger offer to the peer
      get().handleSignal({ type: "INITIATE_OFFER", peerId: targetUserId });
      set({ recoveringCallPeerId: null });
      soundEngine?.play("voice_join");
    } catch (e) {
      console.error("[VoiceStore] Failed to resume recovered call audio/media: ", e);
      get().endCall();
    }
  }
}));

"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  getStompClient,
  activateClient,
  deactivateClient,
  type IMessage,
  type StompSubscription,
} from "@/lib/websocket";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { clearRoomCache } from "@/stores/roomStore";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUIStore } from "@/stores/uiStore";
import { useInboxStore } from "@/stores/inboxStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { soundEngine } from "@/lib/soundEngine";

/**
 * WebSocket lifecycle hook.
 *
 * - Connects STOMP when user is authenticated
 * - Subscribes to `/user/queue/notifications` for personal events
 *   (Spring auto-prepends `/user/` via convertAndSendToUser)
 * - Subscribes to `/topic/room.{roomId}` when roomId changes
 * - Tracks subscriptions via Map to avoid duplicates
 * - Cleans up on unmount (deactivate client)
 */
export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const rooms = useRoomStore((s) => s.rooms);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());

  // ── 1. Connect + subscribe personal notification channel ──────────
  useEffect(() => {
    if (!token) return;

    const client = getStompClient(token);

    client.onConnect = () => {
      useNetworkStore.getState().setWsStatus("connected");
      useAuthStore.getState().setOwnStatus("ONLINE");

      // Evict stale sessionStorage cache so the post-connect refresh
      // fetches fresh presence data from Redis, not stale cache
      clearRoomCache();

      // ── CRITICAL: Clear ALL stale subscription refs from previous connection ──
      // Old StompSubscription objects are dead after disconnect.
      // If we don't clear, the Map still has old keys and the re-subscribe
      // loop below will skip rooms thinking they're already subscribed.
      subscriptionsRef.current.clear();

      // Personal notification channel
      const notifKey = "/user/queue/notifications";
      const notifSub = client.subscribe(notifKey, handleNotification);
      subscriptionsRef.current.set(notifKey, notifSub);

      // ── Voice signaling subscription ──
      const voiceKey = "/user/queue/voice";
      const voiceSub = client.subscribe(voiceKey, handleVoiceMessage);
      subscriptionsRef.current.set(voiceKey, voiceSub);

      // Re-subscribe to ALL current rooms immediately to prevent message drop
      const currentRooms = useRoomStore.getState().rooms;
      currentRooms.forEach((room) => {
        const roomKey = `/topic/room.${room.id}`;
        const sub = client.subscribe(roomKey, handleRoomMessage);
        subscriptionsRef.current.set(roomKey, sub);
      });

      // Check active calls status (e.g. if we just connected/reconnected/reloaded while a call is active/ringing)
      const { useVoiceStore } = require("@/stores/voiceStore");
      useVoiceStore.getState().checkActiveCall();

      // ── Sync messages for the active channel after reconnection ──
      const activeChannelId = useUIStore.getState().activeChannelId;
      if (activeChannelId) {
        const roomsState = useRoomStore.getState();
        let activeRoomId = "";
        for (const [rId, cList] of Object.entries(roomsState.channels)) {
          if (cList.some((c) => c.id === activeChannelId)) {
            activeRoomId = rId;
            break;
          }
        }
        if (activeRoomId) {
          console.log(`[STOMP] Reconnected — syncing messages for channel ${activeChannelId} in room ${activeRoomId}`);
          useChatStore.getState().syncMessagesOnReconnect(activeRoomId, activeChannelId);
        }
      }
    };

    client.onStompError = (frame) => {
      console.error("[STOMP] Error:", frame.headers["message"], frame.body);
      useNetworkStore.getState().setWsStatus("connecting");
    };

    client.onWebSocketError = (event) => {
      console.error("[STOMP] WebSocket error:", event);
      useNetworkStore.getState().setWsStatus("connecting");
    };

    client.onWebSocketClose = () => {
      console.log("[STOMP] WebSocket closed — clearing stale subscriptions");
      // Clear all subscription refs so onConnect re-subscribes cleanly
      subscriptionsRef.current.clear();

      // Instantly fail all in-flight sending messages
      useChatStore.getState().markAllSendingAsFailed();

      const prevStatus = useNetworkStore.getState().wsStatus;

      useNetworkStore.getState().setWsStatus("connecting");
      useAuthStore.getState().setOwnStatus("OFFLINE");

      if (prevStatus === "connected") {
        soundEngine?.play("voice_disconnect");
      }
    };

    activateClient();

    return () => {
      // Unsubscribe all and disconnect
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current.clear();
      deactivateClient();
    };
  }, [token]);

  // ── 2. Room subscriptions (changes when user navigates rooms) ──────
  useEffect(() => {
    if (!token) return;
    const client = getStompClient(token);

    // Create new subscriptions
    rooms.forEach((room) => {
      const roomKey = `/topic/room.${room.id}`;
      if (!subscriptionsRef.current.has(roomKey)) {
        // Can only subscribe if client is already connected
        if (client.connected) {
          const sub = client.subscribe(roomKey, handleRoomMessage);
          subscriptionsRef.current.set(roomKey, sub);
        }
      }
    });

  }, [token, rooms, useNetworkStore.getState().wsStatus]); // Re-run if connection status changes or rooms change
}

// ── Room message handler ───────────────────────────────────────────
function handleRoomMessage(msg: IMessage) {
  try {
    const data = JSON.parse(msg.body);
    const eventType = data.type || data.eventType || "MESSAGE_NEW";

    if (eventType === "MESSAGE_EDITED") {
      useChatStore.getState().updateMessage(data.channelId, data.messageId, data.content, data.editedAt || new Date().toISOString());
      return;
    }

    if (eventType === "MESSAGE_PINNED") {
      useChatStore.getState().setPinnedState(data.channelId, data.messageId, data.isPinned);
      return;
    }

    if (eventType === "SYSTEM_MESSAGE_NEW") {
      useChatStore.getState().receiveMessage(data.channelId, {
        id: data.messageId,
        messageId: data.messageId,
        roomId: data.roomId,
        channelId: data.channelId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: null,
        type: "SYSTEM",
        content: data.content,
        fileKey: null,
        fileName: null,
        fileSize: null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        isForwarded: false,
        editedAt: null,
        createdAt: data.createdAt || new Date().toISOString(),
        replyTo: null,
        mentions: [],
      });
      return;
    }

    if (eventType === "VOICE_STATE_UPDATE") {
      console.log("[STOMP] VOICE_STATE_UPDATE:", data.data);
      useVoiceStore.getState().handleVoiceStateUpdate(data.data);
      return;
    }

    if (eventType === "VOICE_CALL") {
      const callData = data.data || data;
      console.log("[STOMP] VOICE_CALL via room:", callData);
      useVoiceStore.getState().handleCallEvent({
        action: callData.action,
        roomId: callData.roomId,
        callerId: callData.callerId || "",
        callerName: callData.callerName || "",
        callerAvatar: callData.callerAvatar || null,
        targetUserId: callData.targetUserId || "",
      });
      return;
    }

    if (eventType === "MESSAGE_DELETED") {
      useChatStore.getState().removeMessage(data.channelId, data.messageId);
      return;
    }

    if (eventType === "MESSAGE_REACTED") {
      console.log("[STOMP] MESSAGE_REACTED:", data.channelId, data.messageId, data.reactions?.length);
      useChatStore.getState().updateReactions(data.channelId, data.messageId, data.reactions);
      return;
    }

    if (eventType === "TYPING_START") {
      const currentUserId = useAuthStore.getState().user?.id;
      console.log("[STOMP] TYPING_START:", { channelId: data.channelId, userId: data.userId, username: data.username });
      if (data.userId === currentUserId) return; // Don't show own typing
      useChatStore.getState().setTyping(data.channelId, data.userId, data.username);
      return;
    }

    useChatStore.getState().receiveMessage(data.channelId, {
      id: data.id || data.messageId,
      messageId: data.messageId,
      nonce: data.nonce,
      roomId: data.roomId,
      channelId: data.channelId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar || null,
      type: data.type || "TEXT",
      content: data.content,
      fileKey: data.fileKey || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      reactions: [],
      isEdited: false,
      isDeleted: false,
      isPinned: data.isPinned || data.pinned || false,
      isForwarded: data.isForwarded || data.forwarded || false,
      editedAt: null,
      createdAt: data.createdAt || new Date().toISOString(),
      replyTo: data.replyTo || null,
      mentions: data.mentions || [],
    });

    // Increment unread count logic — skip own messages
    if (eventType === "TEXT" || eventType === "FILE" || eventType === "MESSAGE_NEW") {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.senderId === currentUserId) return; // Don't count own messages as unread

      const activeChannelId = useUIStore.getState().activeChannelId;
      const isFocused = typeof document !== 'undefined' && document.hasFocus();

      const isMentioned = currentUserId && (
        data.mentions?.includes(currentUserId) ||
        data.mentions?.includes("everyone")
      );

      // Increment unread if user is NOT looking at this channel, OR if the window is blurred
      if (data.channelId !== activeChannelId || !isFocused) {
        useNotificationStore.getState().incrementUnread(data.channelId);
      }

      if (isMentioned) {
        soundEngine?.play('message_mention');
      } else if (data.channelId !== activeChannelId || !isFocused) {
        soundEngine?.play('message_notification');
      }
    }

    // Track last activity for DM sidebar sort
    if (data.roomId) {
      useRoomStore.getState().touchRoomActivity(data.roomId);
    }
  } catch (e) {
    console.error("[STOMP] Failed to parse room message:", e);
  }
}

// ── Notification handler (Pattern 1: Ping + Re-fetch) ─────────────
function handleNotification(msg: IMessage) {
  try {
    const data = JSON.parse(msg.body);
    const type = data.type as string;

    switch (type) {
      case "FRIEND_REQUEST_SENT":
        useFriendStore.getState().handleWsEvent(type);
        break;
      case "FRIEND_ACCEPTED":
        useFriendStore.getState().handleWsEvent(type);
        break;
      case "FRIEND_REMOVED":
        useFriendStore.getState().handleWsEvent(type);
        break;
      case "PRESENCE_UPDATE":
        console.log("[STOMP] PRESENCE_UPDATE received:", data);
        if (data.fromUserId && data.status) {
          useFriendStore.getState().updateFriendStatus(data.fromUserId, data.status as string);
          useRoomStore.getState().updateMemberStatus(data.fromUserId, data.status as string);
        }
        break;
      case "MEMBER_JOINED":
        if (data.roomId) {
          useRoomStore.getState().fetchMembers(data.roomId);
        }
        break;
      case "ROOM_CREATED":
        useRoomStore.getState().fetchMyRooms(true); // Skip cache for new room
        break;
      case "INBOX_UPDATE":
        console.log("[STOMP] INBOX_UPDATE received — refetching notifications");
        useInboxStore.getState().fetchNotifications();
        break;
      default:
        console.log("[STOMP] Unknown notification type:", type);
    }
  } catch (e) {
    console.error("[STOMP] Failed to parse notification:", e);
  }
}

// ── Voice Message signaling handler ──────────────────────────────
function handleVoiceMessage(msg: IMessage) {
  try {
    const data = JSON.parse(msg.body);
    const type = data.type || data.eventType;
    console.log("[STOMP] handleVoiceMessage received:", type, data);

    switch (type) {
      case "VOICE_PEERS":
        if (data.peers && Array.isArray(data.peers)) {
          data.peers.forEach((peerId: string) => {
            useVoiceStore.getState().handleSignal({ type: "INITIATE_OFFER", peerId });
          });
        }
        break;
      case "SIGNAL_OFFER":
      case "OFFER":
        useVoiceStore.getState().handleSignal({
          type: "SIGNAL_OFFER",
          fromUserId: data.senderId || data.fromUserId,
          payload: data.payload,
        });
        break;
      case "SIGNAL_ANSWER":
      case "ANSWER":
        useVoiceStore.getState().handleSignal({
          type: "SIGNAL_ANSWER",
          fromUserId: data.senderId || data.fromUserId,
          payload: data.payload,
        });
        break;
      case "SIGNAL_ICE":
      case "ICE":
        useVoiceStore.getState().handleSignal({
          type: "SIGNAL_ICE",
          fromUserId: data.senderId || data.fromUserId,
          payload: data.payload,
        });
        break;
      case "VOICE_CALL":
        useVoiceStore.getState().handleCallEvent({
          action: data.action || data.data?.action,
          roomId: data.roomId || data.data?.roomId,
          callerId: data.callerId || data.data?.callerId,
          callerName: data.callerName || data.data?.callerName,
          callerAvatar: data.callerAvatar || data.data?.callerAvatar || null,
          targetUserId: data.targetUserId || data.data?.targetUserId,
        });
        break;
      case "CALL_INCOMING":
        useVoiceStore.getState().handleCallEvent({
          action: "RING",
          roomId: data.roomId,
          callerId: data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          targetUserId: data.targetUserId,
        });
        break;
      case "CALL_ACCEPTED":
        useVoiceStore.getState().handleCallEvent({
          action: "ACCEPT",
          roomId: data.roomId,
          callerId: data.acceptedBy || data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          targetUserId: data.targetUserId,
        });
        break;
      case "CALL_DECLINED":
        useVoiceStore.getState().handleCallEvent({
          action: "DECLINE",
          roomId: data.roomId,
          callerId: data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          targetUserId: data.targetUserId,
        });
        break;
      case "CALL_ENDED":
        useVoiceStore.getState().handleCallEvent({
          action: "END",
          roomId: data.roomId,
          callerId: data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          targetUserId: data.targetUserId,
        });
        break;
    }
  } catch (e) {
    console.error("[STOMP] Failed to parse voice message:", e);
  }
}

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

      // Clear stale room subscriptions from previous connection
      subscriptionsRef.current.forEach((sub, key) => {
        if (key !== "/user/queue/notifications") {
          subscriptionsRef.current.delete(key);
        }
      });

      // Personal notification channel
      const notifKey = "/user/queue/notifications";
      if (!subscriptionsRef.current.has(notifKey)) {
        const sub = client.subscribe(notifKey, handleNotification);
        subscriptionsRef.current.set(notifKey, sub);
      }

      // Re-subscribe to current rooms immediately to prevent message drop
      const currentRooms = useRoomStore.getState().rooms;
      currentRooms.forEach((room) => {
        const roomKey = `/topic/room.${room.id}`;
        if (!subscriptionsRef.current.has(roomKey)) {
          const sub = client.subscribe(roomKey, handleRoomMessage);
          subscriptionsRef.current.set(roomKey, sub);
        }
      });

      // Refresh ALL data after WebSocket connects to get accurate Redis presence.
      // Delay lets our own PRESENCE_UPDATE propagate through the pipeline first.
      setTimeout(() => {
        useFriendStore.getState().fetchFriends();
        useRoomStore.getState().refreshAllDmMembers();
      }, 2000);
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
      console.log("[STOMP] WebSocket closed");
      useNetworkStore.getState().setWsStatus("connecting");
      useAuthStore.getState().setOwnStatus("OFFLINE");
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

    if (eventType === "MESSAGE_DELETED") {
      useChatStore.getState().removeMessage(data.channelId, data.messageId);
      return;
    }

    if (eventType === "TYPING_START") {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.userId === currentUserId) return; // Don't show own typing
      useChatStore.getState().setTyping(data.channelId, data.userId, data.username);
      return;
    }

    useChatStore.getState().receiveMessage(data.channelId, {
      id: data.messageId,
      roomId: data.roomId,
      channelId: data.channelId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar || null,
      type: data.type || "TEXT",
      content: data.content,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      reactions: [],
      isEdited: false,
      isDeleted: false,
      editedAt: null,
      createdAt: data.createdAt || new Date().toISOString(),
      replyTo: data.replyTo || null,
    });

    // Increment unread count logic — skip own messages
    if (eventType === "TEXT" || eventType === "FILE" || eventType === "MESSAGE_NEW") {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.senderId === currentUserId) return; // Don't count own messages as unread

      const activeChannelId = useUIStore.getState().activeChannelId;
      const isFocused = typeof document !== 'undefined' && document.hasFocus();

      // Increment unread if user is NOT looking at this channel, OR if the window is blurred
      if (data.channelId !== activeChannelId || !isFocused) {
        useNotificationStore.getState().incrementUnread(data.channelId);
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
      default:
        console.log("[STOMP] Unknown notification type:", type);
    }
  } catch (e) {
    console.error("[STOMP] Failed to parse notification:", e);
  }
}

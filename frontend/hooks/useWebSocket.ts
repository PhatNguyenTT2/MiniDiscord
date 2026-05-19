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
import { useNetworkStore } from "@/stores/networkStore";

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
export function useWebSocket(roomId?: string) {
  const token = useAuthStore((s) => s.token);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());

  // ── 1. Connect + subscribe personal notification channel ──────────
  useEffect(() => {
    if (!token) return;

    const client = getStompClient(token);

    client.onConnect = () => {
      useNetworkStore.getState().setWsStatus("connected");
      useAuthStore.getState().setOwnStatus("ONLINE");
      // Personal notification channel
      const notifKey = "/user/queue/notifications";
      if (!subscriptionsRef.current.has(notifKey)) {
        const sub = client.subscribe(notifKey, handleNotification);
        subscriptionsRef.current.set(notifKey, sub);
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

  // ── 2. Room subscription (changes when user navigates rooms) ──────
  useEffect(() => {
    if (!token || !roomId) return;

    const client = getStompClient(token);
    if (!client.connected) return;

    const roomKey = `/topic/room.${roomId}`;

    // Already subscribed?
    if (subscriptionsRef.current.has(roomKey)) return;

    const sub = client.subscribe(roomKey, (msg: IMessage) => {
      try {
        const data = JSON.parse(msg.body);
        // Full payload push — append directly to chatStore (Pattern 2)
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
      } catch (e) {
        console.error("[STOMP] Failed to parse room message:", e);
      }
    });

    subscriptionsRef.current.set(roomKey, sub);

    // Cleanup: unsubscribe when leaving this room
    return () => {
      sub.unsubscribe();
      subscriptionsRef.current.delete(roomKey);
    };
  }, [token, roomId]);
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
        if (data.fromUserId && data.status) {
          useFriendStore.getState().updateFriendStatus(data.fromUserId, data.status as string);
        }
        break;
      case "MEMBER_JOINED":
        if (data.roomId) {
          useRoomStore.getState().fetchMembers(data.roomId);
        }
        break;
      case "ROOM_CREATED":
        useRoomStore.getState().fetchMyRooms();
        break;
      default:
        console.log("[STOMP] Unknown notification type:", type);
    }
  } catch (e) {
    console.error("[STOMP] Failed to parse notification:", e);
  }
}

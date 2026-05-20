import { create } from "zustand";
import type { Message, ReplyReference } from "@/types";
import { useAuthStore } from "./authStore";
import { api } from "@/lib/api";

// Local state has been removed for DM messages since it's now handled by the backend channels flow

export interface ReplyTarget {
  messageId: string;
  senderName: string;
  content: string;
}

export interface ReadReceipt {
  count: number;
  displayCount: string;
  hasMore: boolean;
}

interface ChatState {
  channelMessages: Record<string, Message[]>;
  unreadCounts: Record<string, ReadReceipt>;

  replyingTo: ReplyTarget | null;

  getChannelMessages: (channelId: string) => Message[];

  fetchUnreadCount: (roomId: string, channelId: string) => Promise<void>;
  markChannelAsRead: (roomId: string, channelId: string, lastMessageId: string) => Promise<void>;

  sendChannelMessage: (channelId: string, roomId: string, content: string) => void;
  addOptimisticMessage: (channelId: string, message: Message) => void;

  setReplyingTo: (target: ReplyTarget | null) => void;
  clearReplyingTo: () => void;
  addReaction: (channelId: string, messageId: string, emoji: string) => void;

  /* API: Fetch history */
  isLoading: boolean;
  error: string | null;
  fetchMessages: (roomId: string, channelId: string, before?: string, limit?: number) => Promise<void>;

  /* WebSocket: receive message from /topic/room.{roomId} */
  receiveMessage: (channelId: string, message: Message) => void;
}

let nextId = 1;
function generateId(): string {
  return `msg-${Date.now()}-${nextId++}`;
}

// Stable empty array to avoid creating new refs on every selector call
const EMPTY_MESSAGES: Message[] = [];

export const useChatStore = create<ChatState>((set, get) => ({
  channelMessages: {},
  unreadCounts: {},
  replyingTo: null,
  isLoading: false,
  error: null,

  getChannelMessages: (channelId) => get().channelMessages[channelId] ?? EMPTY_MESSAGES,

  fetchUnreadCount: async (roomId, channelId) => {
    try {
      const res = await api.get(`/messages/rooms/${roomId}/channels/${channelId}/unread`);
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [channelId]: res.data.data
        }
      }));
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  },

  markChannelAsRead: async (roomId, channelId, lastMessageId) => {
    try {
      await api.put(`/messages/rooms/${roomId}/channels/${channelId}/read`, { lastReadMessageId: lastMessageId });
      set((state) => {
        const nextUnread = { ...state.unreadCounts };
        delete nextUnread[channelId];
        return { unreadCounts: nextUnread };
      });
    } catch (err) {
      console.error("Failed to mark channel as read:", err);
    }
  },

  setReplyingTo: (target) => set({ replyingTo: target }),
  clearReplyingTo: () => set({ replyingTo: null }),

  fetchMessages: async (roomId, channelId, before, limit = 50) => {
    try {
      set({ isLoading: true, error: null });
      const { api } = await import("@/lib/api"); // dynamic import to avoid circular dependency
      const params: Record<string, any> = { limit };
      if (before) params.before = before;

      const res = await api.get<{ message: string; data: Message[] }>(
        `/messages/rooms/${roomId}/channels/${channelId}`,
        { params }
      );

      const fetchedMessages = res.data.data;

      set((state) => {
        const existing = state.channelMessages[channelId] || [];

        // If 'before' is provided, we are fetching older messages (scrolling up)
        // We prepend (unshift) history to existing messages.
        // If 'before' is omitted, it's initial load, replace entirely.
        const merged = before
          ? [...fetchedMessages, ...existing]
          : fetchedMessages;

        return {
          channelMessages: {
            ...state.channelMessages,
            [channelId]: merged,
          },
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Note: sendChannelMessage is now purely a placeholder. 
  // It should be removed, as the STOMP publish happens in MessageInput.tsx, 
  // and state mutation happens via receiveMessage.
  sendChannelMessage: (channelId, roomId, content) => {
    console.warn("sendChannelMessage in store is deprecated. Use STOMP client in component.");
  },

  addOptimisticMessage: (channelId, message) => {
    set((state) => {
      const existing = state.channelMessages[channelId] || [];
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: [...existing, message],
        },
      };
    });
  },

  addReaction: (channelId, messageId, emoji) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set((state) => {
      const msgs = state.channelMessages[channelId];
      if (!msgs) return state;

      const updated = msgs.map((msg) => {
        if (msg.id !== messageId) return msg;

        const existingIdx = msg.reactions.findIndex((r) => r.emoji === emoji);
        let newReactions = [...msg.reactions];

        if (existingIdx >= 0) {
          const existing = newReactions[existingIdx];
          const hasReacted = existing.userIds.includes(user.id);

          if (hasReacted) {
            const newUserIds = existing.userIds.filter((id) => id !== user.id);
            if (newUserIds.length === 0) {
              newReactions.splice(existingIdx, 1);
            } else {
              newReactions[existingIdx] = {
                ...existing,
                userIds: newUserIds,
                count: newUserIds.length,
              };
            }
          } else {
            newReactions[existingIdx] = {
              ...existing,
              userIds: [...existing.userIds, user.id],
              count: existing.count + 1,
            };
          }
        } else {
          newReactions.push({
            emoji,
            userIds: [user.id],
            count: 1,
          });
        }

        return { ...msg, reactions: newReactions };
      });

      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: updated,
        },
      };
    });
  },



  receiveMessage: (channelId, message) => {
    set((state) => {
      const existing = state.channelMessages[channelId] || [];

      // Prevent duplicates if server broadcast reaches us twice
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }

      // Replace matching optimistic message (id starts with "optimistic-")
      // Match by senderId + content + close timestamp
      const optimisticIdx = existing.findIndex(
        (m) =>
          m.id.startsWith("optimistic-") &&
          m.senderId === message.senderId &&
          m.content === message.content
      );

      if (optimisticIdx >= 0) {
        const updated = [...existing];
        updated[optimisticIdx] = message;
        return {
          channelMessages: {
            ...state.channelMessages,
            [channelId]: updated,
          },
        };
      }

      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: [...existing, message],
        },
      };
    });
  },
}));

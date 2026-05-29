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
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string, type: "FOR_ME" | "EVERYONE") => Promise<void>;

  // Handlers for WS events
  updateMessage: (channelId: string, messageId: string, content: string, editedAt: string) => void;
  removeMessage: (channelId: string, messageId: string) => void;

  typingUsers: Record<string, { userId: string; username: string; expiresAt: number }[]>;
  setTyping: (channelId: string, userId: string, username: string) => void;
  clearTyping: (channelId: string, userId: string) => void;

  setReplyingTo: (target: ReplyTarget | null) => void;
  clearReplyingTo: () => void;
  addReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  updateReactions: (channelId: string, messageId: string, reactions: any[]) => void;

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
  typingUsers: {},
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
      // Sync notification store
      const { useNotificationStore } = await import("./notificationStore");
      useNotificationStore.getState().markAsRead(channelId);
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

    // Auto-remove optimistic message if server hasn't broadcasted real message in 10s
    setTimeout(() => {
      set((state) => {
        const msgs = state.channelMessages[channelId] || [];
        if (msgs.some((m) => m.id === message.id)) {
          return {
            channelMessages: {
              ...state.channelMessages,
              [channelId]: msgs.filter((m) => m.id !== message.id),
            },
          };
        }
        return state;
      });
    }, 10000);
  },

  editMessage: async (channelId, messageId, content) => {
    const previousState = get().channelMessages[channelId] || [];

    // Optimistic update
    get().updateMessage(channelId, messageId, content, new Date().toISOString());

    try {
      await api.put(`/messages/${messageId}`, { content });
    } catch (err) {
      console.error("[chatStore] Failed to edit message, reverting", err);
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: previousState,
        },
      }));
    }
  },

  deleteMessage: async (channelId, messageId, type) => {
    const previousState = get().channelMessages[channelId] || [];
    const msgs = get().channelMessages[channelId] ?? [];

    // Optimistic update
    if (type === "FOR_ME") {
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: msgs.filter((m) => m.id !== messageId && m.messageId !== messageId) // remove entirely for UI
        }
      }));
    } else {
      get().removeMessage(channelId, messageId); // set isDeleted
    }

    try {
      await api.delete(`/messages/${messageId}?type=${type}`);
    } catch (err) {
      console.error("[chatStore] Failed to delete message, reverting", err);
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: previousState,
        },
      }));
    }
  },

  updateMessage: (channelId, messageId, content, editedAt) => {
    set((state) => {
      const msgs = state.channelMessages[channelId] ?? [];
      const updated = msgs.map(msg =>
        msg.id === messageId || msg.messageId === messageId
          ? { ...msg, content, isEdited: true, editedAt }
          : msg
      );
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: updated,
        }
      };
    });
  },

  removeMessage: (channelId, messageId) => {
    set((state) => {
      const msgs = state.channelMessages[channelId] ?? [];
      const updated = msgs.map(msg =>
        msg.id === messageId || msg.messageId === messageId
          ? { ...msg, isDeleted: true, content: "" }
          : msg
      );
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: updated,
        }
      };
    });
  },

  setTyping: (channelId, userId, username) => {
    set((state) => {
      const users = state.typingUsers[channelId] || [];
      const existing = users.find(u => u.userId === userId);
      const expiresAt = Date.now() + 5000; // Increased to 5s to overlap 3s emit throttle

      let nextUsers;
      if (existing) {
        nextUsers = users.map(u => u.userId === userId ? { ...u, expiresAt } : u);
      } else {
        nextUsers = [...users, { userId, username, expiresAt }];
      }

      // Schedule cleanup
      setTimeout(() => {
        useChatStore.getState().clearTyping(channelId, userId);
      }, 5000);

      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: nextUsers
        }
      };
    });
  },

  clearTyping: (channelId, userId) => {
    set((state) => {
      const users = state.typingUsers[channelId] || [];
      const validUsers = users.filter(u => u.userId !== userId && u.expiresAt > Date.now());
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: validUsers
        }
      };
    });
  },

  addReaction: async (channelId, messageId, emoji) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // 1. Snapshot previous state for rollback
    const previousState = get().channelMessages[channelId] || [];

    // 2. Optimistic update
    set((state) => {
      const msgs = state.channelMessages[channelId];
      if (!msgs) return state;

      const updated = msgs.map((msg) => {
        if (msg.id !== messageId && msg.messageId !== messageId) return msg;

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

    // 3. Persist to API
    try {
      await api.put(`/messages/${messageId}/reactions`, { emoji });
    } catch (err) {
      console.error("[chatStore] Failed to toggle reaction, reverting", err);
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: previousState,
        },
      }));
    }
  },

  updateReactions: (channelId, messageId, reactions) => {
    set((state) => {
      const msgs = state.channelMessages[channelId];
      if (!msgs) return state;
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: msgs.map((m) =>
            m.id === messageId || m.messageId === messageId
              ? { ...m, reactions: reactions.map((r: any) => ({ ...r, count: r.userIds.length })) }
              : m
          ),
        },
      };
    });
  },



  receiveMessage: (channelId, message) => {
    // Clear typing indicator instantly if this user was typing
    useChatStore.getState().clearTyping(channelId, message.senderId);

    set((state) => {
      const existing = state.channelMessages[channelId] || [];

      // Prevent duplicates if server broadcast reaches us twice
      if (existing.some((m) => m.id === message.id || (m.messageId && m.messageId === message.id) || (message.messageId && m.id === message.messageId))) {
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

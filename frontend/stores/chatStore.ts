import { create } from "zustand";
import type { Message, ReplyReference } from "@/types";
import { useAuthStore } from "./authStore";
import { useNotificationStore } from "./notificationStore";
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
  lastReadMessageId?: string;
}

interface ChatState {
  channelMessages: Record<string, Message[]>;
  unreadCounts: Record<string, ReadReceipt>;

  replyingTo: ReplyTarget | null;

  getChannelMessages: (channelId: string) => Message[];

  fetchUnreadCount: (roomId: string, channelId: string) => Promise<void>;
  markChannelAsRead: (roomId: string, channelId: string, lastMessageId: string) => Promise<void>;
  markChannelAsUnread: (roomId: string, channelId: string, messageId: string) => Promise<void>;

  sendChannelMessage: (channelId: string, roomId: string, content: string) => void;
  addOptimisticMessage: (channelId: string, message: Message) => void;
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string, type: "FOR_ME" | "EVERYONE") => Promise<void>;

  // Handlers for WS events
  updateMessage: (channelId: string, messageId: string, content: string, editedAt: string) => void;
  removeMessage: (channelId: string, messageId: string) => void;

  // New actions for Optimistic UI and Reconnect Sync
  markAllSendingAsFailed: (channelId?: string) => void;
  retryMessage: (channelId: string, messageId: string) => Message | null;
  removeFailedMessage: (channelId: string, messageId: string) => void;
  syncMessagesOnReconnect: (roomId: string, channelId: string) => Promise<void>;

  typingUsers: Record<string, { userId: string; username: string; expiresAt: number }[]>;
  setTyping: (channelId: string, userId: string, username: string) => void;
  clearTyping: (channelId: string, userId: string) => void;

  setReplyingTo: (target: ReplyTarget | null) => void;
  clearReplyingTo: () => void;
  addReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  updateReactions: (channelId: string, messageId: string, reactions: { emoji: string; userIds: string[] }[]) => void;

  pinnedMessages: Record<string, Message[]>;
  pinMessage: (channelId: string, messageId: string) => Promise<void>;
  unpinMessage: (channelId: string, messageId: string) => Promise<void>;
  fetchPinnedMessages: (roomId: string, channelId: string) => Promise<void>;
  setPinnedState: (channelId: string, messageId: string, isPinned: boolean) => void;

  /* API: Fetch history */
  isLoading: boolean;
  error: string | null;
  fetchMessages: (roomId: string, channelId: string, before?: string, limit?: number) => Promise<void>;
  fetchMessagesAround: (roomId: string, channelId: string, aroundId: string, limit?: number) => Promise<void>;
  searchMessages: (roomId: string, channelId: string, filters: {
    q?: string;
    from?: string;
    channel?: string;
    has?: string;
    mentions?: string;
  }) => Promise<Message[]>;

  searchResults: Record<string, Message[]>;
  searchFilters: Record<string, {
    q?: string;
    from?: string;
    channel?: string;
    has?: string;
    mentions?: string;
  } | null>;
  showSearchPanel: Record<string, boolean>;
  isSearching: Record<string, boolean>;
  searchSortOrder: Record<string, "NEWEST" | "OLDEST" | "RELEVANT">;
  setSearchSortOrder: (channelId: string, order: "NEWEST" | "OLDEST" | "RELEVANT") => void;
  setShowSearchPanel: (channelId: string, show: boolean) => void;
  clearSearchResults: (channelId: string) => void;
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
  pinnedMessages: {},
  unreadCounts: {},
  typingUsers: {},
  replyingTo: null,
  isLoading: false,
  error: null,

  searchResults: {},
  searchFilters: {},
  showSearchPanel: {},
  isSearching: {},
  searchSortOrder: {},
  setSearchSortOrder: (channelId, order) => set((state) => ({
    searchSortOrder: { ...state.searchSortOrder, [channelId]: order }
  })),
  setShowSearchPanel: (channelId, show) => set((state) => ({
    showSearchPanel: { ...state.showSearchPanel, [channelId]: show }
  })),
  clearSearchResults: (channelId) => set((state) => {
    const nextResults = { ...state.searchResults };
    const nextFilters = { ...state.searchFilters };
    const nextShow = { ...state.showSearchPanel };
    delete nextResults[channelId];
    delete nextFilters[channelId];
    delete nextShow[channelId];
    return {
      searchResults: nextResults,
      searchFilters: nextFilters,
      showSearchPanel: nextShow
    };
  }),

  getChannelMessages: (channelId) => get().channelMessages[channelId] ?? EMPTY_MESSAGES,

  fetchUnreadCount: async (roomId, channelId) => {
    try {
      const res = await api.get(`/messages/rooms/${roomId}/channels/${channelId}/unread`);
      // Hydrate notificationStore from backend watermark
      useNotificationStore.getState().setUnreadCount(channelId, res.data.data.count);
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
      useNotificationStore.getState().markAsRead(channelId);
    } catch (err) {
      console.error("Failed to mark channel as read:", err);
    }
  },

  markChannelAsUnread: async (roomId, channelId, messageId) => {
    try {
      const res = await api.put(`/messages/rooms/${roomId}/channels/${channelId}/mark-unread`, { messageId });
      const data = res.data.data;
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [channelId]: data }
      }));
      useNotificationStore.getState().setUnreadCount(channelId, data.count);
    } catch (err) {
      console.error("Failed to mark channel as unread:", err);
    }
  },

  setReplyingTo: (target) => set({ replyingTo: target }),
  clearReplyingTo: () => set({ replyingTo: null }),

  fetchMessages: async (roomId, channelId, before, limit = 50) => {
    try {
      set({ isLoading: true, error: null });
      const { api } = await import("@/lib/api"); // dynamic import to avoid circular dependency
      const params: Record<string, string | number> = { limit };
      if (before) params.before = before;

      const res = await api.get<{ message: string; data: Message[] }>(
        `/messages/rooms/${roomId}/channels/${channelId}`,
        { params }
      );

      const fetchedMessages = res.data.data;

      set((state) => {
        const existing = state.channelMessages[channelId] || [];

        // If 'before' is provided, we are fetching older messages (scrolling up)
        // $lt cursor is strict, no duplicates possible
        const merged = before
          ? [...fetchedMessages, ...existing]
          : fetchedMessages.length > 0
            ? fetchedMessages
            : existing.filter(m => m.id.startsWith('optimistic-'));

        return {
          channelMessages: {
            ...state.channelMessages,
            [channelId]: merged,
          },
          isLoading: false,
        };
      });
    } catch (error) {
      const err = error as { message?: string };
      set({ error: err.message || "Failed to fetch messages", isLoading: false });
    }
  },

  fetchMessagesAround: async (roomId, channelId, aroundId, limit = 25) => {
    try {
      set({ isLoading: true, error: null });
      const { api } = await import("@/lib/api");

      // Parallel fetch using Promise.all as per design review
      const [beforeRes, afterRes] = await Promise.all([
        api.get<{ message: string; data: Message[] }>(
          `/messages/rooms/${roomId}/channels/${channelId}`,
          { params: { before: aroundId, limit } }
        ),
        api.get<{ message: string; data: Message[] }>(
          `/messages/rooms/${roomId}/channels/${channelId}`,
          { params: { after: aroundId, limit } }
        )
      ]);

      // Deduplicate: $lte in before includes cursor msg, $gt in after excludes it,
      // but guard against any edge-case duplicates
      const all = [...beforeRes.data.data, ...afterRes.data.data];
      const seen = new Map<string, Message>();
      for (const msg of all) {
        if (!seen.has(msg.id)) seen.set(msg.id, msg);
      }

      set({
        channelMessages: {
          ...get().channelMessages,
          [channelId]: Array.from(seen.values())
        },
        isLoading: false
      });
    } catch (error) {
      const err = error as { message?: string };
      set({ error: err.message || "Failed to fetch messages", isLoading: false });
    }
  },

  searchMessages: async (roomId, channelId, filters) => {
    set((state) => ({
      isSearching: { ...state.isSearching, [channelId]: true },
      showSearchPanel: { ...state.showSearchPanel, [channelId]: true },
      searchFilters: { ...state.searchFilters, [channelId]: filters },
      searchResults: { ...state.searchResults, [channelId]: [] }
    }));
    try {
      const { api } = await import("@/lib/api"); // import dynamically to avoid circular dependencies
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.from) params.set("from", filters.from);
      if (filters.has) params.set("has", filters.has);

      let mentionsVal = filters.mentions;
      if (mentionsVal) {
        if (mentionsVal.toLowerCase() === "everyone") {
          mentionsVal = "everyone";
        } else {
          // Multi-level lookup:
          // 1. Check roomMembers
          const { useRoomStore } = await import("./roomStore");
          const roomMembers = useRoomStore.getState().members[roomId] || [];
          const matchMem = roomMembers.find(m => m.username.toLowerCase() === mentionsVal!.toLowerCase());
          if (matchMem) {
            mentionsVal = matchMem.userId;
          } else {
            // 2. Check current logged-in user
            const { useAuthStore } = await import("./authStore");
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.username.toLowerCase() === mentionsVal.toLowerCase()) {
              mentionsVal = currentUser.id;
            } else {
              // 3. Check friends
              const { useFriendStore } = await import("./friendStore");
              const friends = useFriendStore.getState().friends || [];
              const matchFriend = friends.find(f => f.user.username.toLowerCase() === mentionsVal!.toLowerCase());
              if (matchFriend) {
                mentionsVal = matchFriend.user.id;
              } else {
                // Not resolved
                mentionsVal = undefined;
              }
            }
          }
        }

        // Short-circuit: if a mentions filter was provided but could not resolve to a user or token,
        // no messages can possibly match. Short-circuit to avoid querying DB.
        if (!mentionsVal) {
          console.warn("[searchMessages] Unresolved user query filter:", filters.mentions);
          set((state) => ({
            searchResults: { ...state.searchResults, [channelId]: [] },
            isSearching: { ...state.isSearching, [channelId]: false }
          }));
          return [];
        }
      }
      if (mentionsVal) params.set("mentions", mentionsVal);

      const res = await api.get<{ message: string; data: Message[] }>(
        `/messages/rooms/${roomId}/channels/${channelId}/search?${params}`
      );
      set((state) => ({
        searchResults: { ...state.searchResults, [channelId]: res.data.data || [] },
        isSearching: { ...state.isSearching, [channelId]: false }
      }));
      return res.data.data || [];
    } catch (error) {
      console.error("Failed to search messages in chatStore:", error);
      set((state) => ({
        isSearching: { ...state.isSearching, [channelId]: false }
      }));
      return [];
    }
  },

  // Note: sendChannelMessage is now purely a placeholder. 
  // It should be removed, as the STOMP publish happens in MessageInput.tsx, 
  // and state mutation happens via receiveMessage.
  sendChannelMessage: (channelId, roomId, content) => {
    console.warn("sendChannelMessage in store is deprecated. Use STOMP client in component.");
  },

  addOptimisticMessage: (channelId, message) => {
    const msgWithStatus = { status: "SENDING" as const, ...message };
    set((state) => {
      const existing = state.channelMessages[channelId] || [];
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: [...existing, msgWithStatus],
        },
      };
    });

    if (msgWithStatus.status === "FAILED") return;

    // Mark as FAILED if no ACK within 15s (instead of deleting)
    setTimeout(() => {
      set((state) => {
        const msgs = state.channelMessages[channelId] || [];
        const idx = msgs.findIndex((m) => m.id === message.id && m.status === "SENDING");
        if (idx >= 0) {
          const updated = [...msgs];
          updated[idx] = { ...updated[idx], status: "FAILED" as const };
          return {
            channelMessages: {
              ...state.channelMessages,
              [channelId]: updated,
            },
          };
        }
        return state;
      });
    }, 15000);
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
        const newReactions = [...msg.reactions];

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
              ? { ...m, reactions: reactions.map((r: { emoji: string; userIds: string[] }) => ({ ...r, count: r.userIds.length })) }
              : m
          ),
        },
      };
    });
  },

  fetchPinnedMessages: async (roomId: string, channelId: string) => {
    try {
      const res = await api.get(`/messages/rooms/${roomId}/channels/${channelId}/pinned`);
      if (res.data) {
        // Wrap res.data inside ApiResponse data unwrapper helper: res.data itself might be ApiResponse
        const messages = (res.data as Record<string, unknown>).data || res.data;
        set((state) => ({
          pinnedMessages: {
            ...state.pinnedMessages,
            [channelId]: messages,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to fetch pinned messages:", error);
    }
  },

  pinMessage: async (channelId: string, messageId: string) => {
    let previousMessages: Message[] = [];
    set((state) => {
      const msgs = state.channelMessages[channelId] || [];
      previousMessages = msgs;
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: msgs.map((m) =>
            m.id === messageId || m.messageId === messageId
              ? { ...m, isPinned: true }
              : m
          ),
        },
      };
    });

    try {
      const senderName = useAuthStore.getState().user?.username || "User";
      await api.put(`/messages/${messageId}/pin`, null, {
        params: { senderName }
      });
      const roomId = useChatStore.getState().channelMessages[channelId]?.find(
        (m) => m.id === messageId || m.messageId === messageId
      )?.roomId;
      if (roomId) {
        await useChatStore.getState().fetchPinnedMessages(roomId, channelId);
      }
    } catch (error) {
      console.error("Failed to pin message:", error);
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: previousMessages,
        },
      }));
      throw error;
    }
  },

  unpinMessage: async (channelId: string, messageId: string) => {
    let previousMessages: Message[] = [];
    set((state) => {
      const msgs = state.channelMessages[channelId] || [];
      previousMessages = msgs;
      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: msgs.map((m) =>
            m.id === messageId || m.messageId === messageId
              ? { ...m, isPinned: false }
              : m
          ),
        },
      };
    });

    try {
      await api.put(`/messages/${messageId}/unpin`);
      const roomId = useChatStore.getState().channelMessages[channelId]?.find(
        (m) => m.id === messageId || m.messageId === messageId
      )?.roomId;
      if (roomId) {
        await useChatStore.getState().fetchPinnedMessages(roomId, channelId);
      }
    } catch (error) {
      console.error("Failed to unpin message:", error);
      set((state) => ({
        channelMessages: {
          ...state.channelMessages,
          [channelId]: previousMessages,
        },
      }));
      throw error;
    }
  },

  setPinnedState: (channelId: string, messageId: string, isPinned: boolean) => {
    set((state) => {
      const msgs = state.channelMessages[channelId] || [];
      const updatedFeed = msgs.map((m) =>
        m.id === messageId || m.messageId === messageId ? { ...m, isPinned } : m
      );

      const pinned = state.pinnedMessages[channelId] || [];
      let updatedPinned = [...pinned];
      if (isPinned) {
        const msg = msgs.find((m) => m.id === messageId || m.messageId === messageId);
        if (msg && !pinned.some((m) => m.id === messageId || m.messageId === messageId)) {
          updatedPinned = [{ ...msg, isPinned: true }, ...pinned].slice(0, 50);
        }
      } else {
        updatedPinned = pinned.filter((m) => m.id !== messageId && m.messageId !== messageId);
      }

      return {
        channelMessages: {
          ...state.channelMessages,
          [channelId]: updatedFeed,
        },
        pinnedMessages: {
          ...state.pinnedMessages,
          [channelId]: updatedPinned,
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
      if (
        existing.some((m) =>
          m.id === message.id ||
          (m.messageId && m.messageId === message.id) ||
          (message.messageId && m.id === message.messageId) ||
          (m.messageId && message.messageId && m.messageId === message.messageId)
        )
      ) {
        return state;
      }

      // Replace matching optimistic message
      const optimisticIdx = message.nonce
        ? existing.findIndex((m) => m.nonce === message.nonce && (m.status === "SENDING" || m.status === "FAILED"))
        : -1;

      if (optimisticIdx >= 0) {
        const updated = [...existing];
        updated[optimisticIdx] = { ...message, status: undefined };
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

  markAllSendingAsFailed: (channelId?: string) => {
    set((state) => {
      const updatedMessages = { ...state.channelMessages };

      const updateChannel = (cid: string) => {
        const msgs = updatedMessages[cid] || [];
        if (msgs.some((m) => m.status === "SENDING")) {
          updatedMessages[cid] = msgs.map((m) =>
            m.status === "SENDING" ? { ...m, status: "FAILED" as const } : m
          );
        }
      };

      if (channelId) {
        updateChannel(channelId);
      } else {
        Object.keys(updatedMessages).forEach(updateChannel);
      }

      return { channelMessages: updatedMessages };
    });
  },

  retryMessage: (channelId, messageId) => {
    let messageToRetry: Message | null = null;

    set((state) => {
      const msgs = state.channelMessages[channelId] || [];
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        const updated = [...msgs];
        // Change status back to SENDING
        const retriedMsg = { ...updated[idx], status: "SENDING" as const };
        updated[idx] = retriedMsg;
        messageToRetry = retriedMsg;

        // Re-arm timeout guard
        setTimeout(() => {
          set((s) => {
            const currentMsgs = s.channelMessages[channelId] || [];
            const freshIdx = currentMsgs.findIndex((m: Message) => m.id === messageId && m.status === "SENDING");
            if (freshIdx >= 0) {
              const freshUpdated = [...currentMsgs];
              freshUpdated[freshIdx] = { ...freshUpdated[freshIdx], status: "FAILED" as const };
              return {
                channelMessages: {
                  ...s.channelMessages,
                  [channelId]: freshUpdated,
                },
              };
            }
            return s;
          });
        }, 15000);

        return {
          channelMessages: {
            ...state.channelMessages,
            [channelId]: updated,
          },
        };
      }
      return state;
    });

    return messageToRetry;
  },

  removeFailedMessage: (channelId, messageId) => {
    set((state) => ({
      channelMessages: {
        ...state.channelMessages,
        [channelId]: (state.channelMessages[channelId] || []).filter((m) => m.id !== messageId),
      },
    }));
  },

  syncMessagesOnReconnect: async (roomId: string, channelId: string) => {
    try {
      // Lazy load api to prevent circular dependencies
      const { api } = await import("@/lib/api");
      const res = await api.get<{ message: string; data: Message[] }>(
        `/messages/rooms/${roomId}/channels/${channelId}`,
        { params: { limit: 50 } }
      );
      const fetched = res.data.data;

      set((state) => {
        const existing = state.channelMessages[channelId] || [];
        const tempExisting = [...existing];

        // Match and remove any optimistic / failed / sending messages that are now confirmed in DB
        fetched.forEach((dbMsg) => {
          const matchIdx = tempExisting.findIndex(
            (m) =>
              m.status !== undefined &&
              ((m.nonce && dbMsg.nonce && m.nonce === dbMsg.nonce) ||
                (m.senderId === dbMsg.senderId && m.content === dbMsg.content))
          );
          if (matchIdx >= 0) {
            tempExisting.splice(matchIdx, 1);
          }
        });

        // Split preserved items (pending or failed messages) and completed history
        const localStatusMsgs = tempExisting.filter((m) => m.status !== undefined);
        const completedExisting = tempExisting.filter((m) => m.status === undefined);

        // Deduplicate and merge completed messages
        const mergedMap = new Map<string, Message>();
        completedExisting.forEach((m) => mergedMap.set(m.id, m));
        fetched.forEach((m) => mergedMap.set(m.id, m));

        const mergedCompletedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Keep local pending/failed messages at the very end
        return {
          channelMessages: {
            ...state.channelMessages,
            [channelId]: [...mergedCompletedList, ...localStatusMsgs],
          },
        };
      });
    } catch (err) {
      console.error("[chatStore] Failed sync on reconnect:", err);
    }
  },
}));

import { create } from "zustand";
import { api } from "@/lib/api";

export interface InboxNotification {
  id: string;
  userId: string;
  type: "DM" | "MENTION" | "FRIEND_ACCEPTED" | "SERVER_INVITE";
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  roomId: string | null;
  roomName: string | null;
  channelId: string | null;
  channelName: string | null;
  content: string | null;
  isRead: boolean;
  isProcessed: boolean;
  createdAt: string;
}

interface InboxState {
  notifications: InboxNotification[];
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  processNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearChannel: (roomId: string, channelId?: string) => Promise<void>;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<any>("/users/notifications");
      // Handle both wrapped ApiResponse and raw array formats de-fensively
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data && Array.isArray(res.data.data) ? res.data.data : []);

      const mappedData = data.map((n: any) => ({
        ...n,
        isRead: n.isRead !== undefined ? n.isRead : (n.read !== undefined ? n.read : false),
        isProcessed: n.isProcessed !== undefined ? n.isProcessed : (n.processed !== undefined ? n.processed : false),
      }));

      set({ notifications: mappedData, error: null });
    } catch (err: any) {
      console.error("Failed to fetch notifications:", err);
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.post(`/users/notifications/${id}/read`);
      // Update local state isRead status
      set({
        notifications: get().notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
      });
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  },

  processNotification: async (id: string) => {
    try {
      await api.post(`/users/notifications/${id}/process`);
      // Update local state isRead & isProcessed status
      set({
        notifications: get().notifications.map((n) =>
          n.id === id ? { ...n, isRead: true, isProcessed: true } : n
        ),
      });
    } catch (err) {
      console.error(`Failed to process notification ${id}:`, err);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await api.delete(`/users/notifications/${id}`);
      // Remove local copy
      set({
        notifications: get().notifications.filter((n) => n.id !== id),
      });
    } catch (err) {
      console.error(`Failed to delete notification ${id}:`, err);
    }
  },

  clearChannel: async (roomId: string, channelId?: string) => {
    try {
      // Clear notifications on server side
      const params = new URLSearchParams();
      if (roomId) params.append("roomId", roomId);
      if (channelId) params.append("channelId", channelId);

      await api.post(`/users/notifications/clear-channel?${params.toString()}`);

      // Mark matching ones as read locally
      set({
        notifications: get().notifications.map((n) => {
          const roomMatch = n.roomId === roomId;
          const channelMatch = channelId ? n.channelId === channelId : true;
          if (roomMatch && channelMatch) {
            return { ...n, isRead: true };
          }
          return n;
        }),
      });
    } catch (err) {
      console.error(`Failed to clear notification channel:`, err);
    }
  },
}));


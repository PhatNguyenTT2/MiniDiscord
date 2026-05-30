import { create } from "zustand";

/** Format unread count: 999+ for large numbers */
export function formatUnreadCount(count: number): string {
  if (count > 999) return "999+";
  return String(count);
}

interface NotificationState {
  /** Unread counts keyed by recipientId (DM) or roomId (server) */
  unreadCounts: Record<string, number>;

  /** Mark a DM or server as read (reset to 0) */
  markAsRead: (id: string) => void;

  /** Set unread count for a specific id */
  setUnreadCount: (id: string, count: number) => void;

  /** Increment unread count by 1 */
  incrementUnread: (id: string) => void;

  /** Get unread count for a specific id */
  getUnreadCount: (id: string) => number;

  /** Get total unread across all DMs or specific ids */
  getTotalUnread: (ids?: string[]) => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCounts: {},

  markAsRead: (id) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [id]: 0,
      },
    }));
  },

  setUnreadCount: (id, count) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [id]: Math.max(0, count),
      },
    }));
  },

  incrementUnread: (id) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [id]: (state.unreadCounts[id] ?? 0) + 1,
      },
    }));
  },

  getUnreadCount: (id) => {
    return get().unreadCounts[id] ?? 0;
  },

  getTotalUnread: (ids) => {
    const counts = get().unreadCounts;
    if (ids) {
      return ids.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
    }
    return Object.values(counts).reduce((sum, c) => sum + c, 0);
  },
}));


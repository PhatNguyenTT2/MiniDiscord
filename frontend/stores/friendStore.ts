import { create } from "zustand";
import { api } from "@/lib/api";
import type { FriendResponse, PendingFriendResponse, DirectMessage } from "@/types/friend";

// ── Debounced re-fetch (Gotcha B: avoid burst API calls) ──────────
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let friendsTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedFetchPending() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    useFriendStore.getState().fetchPending();
  }, 300);
}

function debouncedFetchFriends() {
  if (friendsTimer) clearTimeout(friendsTimer);
  friendsTimer = setTimeout(() => {
    useFriendStore.getState().fetchFriends();
  }, 300);
}

interface FriendState {
  friends: FriendResponse[];
  pendingRequests: PendingFriendResponse[];
  dmList: DirectMessage[];
  isLoading: boolean;
  error: string | null;

  /* Actions */
  fetchFriends: () => Promise<void>;
  fetchPending: () => Promise<void>;
  sendRequest: (identifier: string) => Promise<void>;
  acceptFriend: (friendshipId: string) => Promise<void>;
  declineOrRemoveFriend: (friendshipId: string) => Promise<void>;
  updateFriendStatus: (userId: string, status: string) => void;

  /* WebSocket event handler */
  handleWsEvent: (type: string) => void;

  /* Computed helpers */
  getPendingCount: () => number;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  dmList: [],
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.get<FriendResponse[]>("/users/friends");
      set({ friends: res.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchPending: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.get<PendingFriendResponse[]>("/users/friends/pending");
      set({ pendingRequests: res.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  sendRequest: async (identifier: string) => {
    try {
      await api.post("/users/friends/request", { identifier });
      await get().fetchPending();
    } catch (error: any) {
      set({ error: error.response?.data?.message || error.message });
      throw error;
    }
  },

  acceptFriend: async (friendshipId: string) => {
    // Optimistic Update
    const pending = get().pendingRequests;
    const accepted = pending.find(p => p.friendshipId === friendshipId);

    if (accepted) {
      set({
        pendingRequests: pending.filter(p => p.friendshipId !== friendshipId),
        friends: [...get().friends, {
          friendshipId,
          // Default to OFFLINE, will be updated by WebSocket/API
          user: { ...accepted.user, status: "OFFLINE" },
          status: "ACCEPTED",
          since: new Date().toISOString()
        }],
      });
    }

    try {
      await api.put(`/users/friends/${friendshipId}/accept`);
      // Update from server to get true onlineStatus in background
      get().fetchFriends();
    } catch (error: any) {
      set({ error: error.message });
      // Rollback on error
      await Promise.all([get().fetchFriends(), get().fetchPending()]);
    }
  },

  declineOrRemoveFriend: async (friendshipId: string) => {
    // Optimistic Update
    const currentFriends = get().friends;
    const currentPending = get().pendingRequests;

    set({
      friends: currentFriends.filter(f => f.friendshipId !== friendshipId),
      pendingRequests: currentPending.filter(p => p.friendshipId !== friendshipId),
    });

    try {
      await api.delete(`/users/friends/${friendshipId}`);
    } catch (error: any) {
      set({ error: error.message });
      // Rollback on error
      await Promise.all([get().fetchFriends(), get().fetchPending()]);
    }
  },

  updateFriendStatus: (userId: string, status: string) => {
    set((state) => {
      const friends = state.friends.map(f =>
        f.user.id === userId ? { ...f, user: { ...f.user, status } } : f
      );
      const pendingRequests = state.pendingRequests.map(p =>
        p.user.id === userId ? { ...p, user: { ...p.user, status } } : p
      );
      return { friends, pendingRequests };
    });
  },

  handleWsEvent: (type: string) => {
    switch (type) {
      case "FRIEND_REQUEST_SENT":
        debouncedFetchPending();
        break;
      case "FRIEND_ACCEPTED":
        debouncedFetchFriends();
        debouncedFetchPending();
        break;
      case "FRIEND_REMOVED":
        debouncedFetchFriends();
        break;
    }
  },

  getPendingCount: () => {
    return get().pendingRequests.length;
  },
}));

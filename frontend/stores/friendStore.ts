import { create } from "zustand";
import { api } from "@/lib/api";
import type { FriendResponse, PendingFriendResponse, DirectMessage } from "@/types/friend";

const FRIEND_CACHE_KEY = "minidiscord_friends_cache";
const FRIEND_CACHE_TTL = 5 * 60 * 1000;
let friendsFetchPromise: Promise<void> | null = null;
let pendingFetchPromise: Promise<void> | null = null;

function loadFriendCache() {
  try {
    const raw = sessionStorage.getItem(FRIEND_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > FRIEND_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveFriendCache(friends: FriendResponse[], pendingRequests: PendingFriendResponse[]) {
  sessionStorage.setItem(FRIEND_CACHE_KEY, JSON.stringify({ friends, pendingRequests, ts: Date.now() }));
}

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
    if (friendsFetchPromise) return friendsFetchPromise;

    const cache = loadFriendCache();
    if (cache?.friends) {
      set({ friends: cache.friends, isLoading: false });
    }

    try {
      if (!cache?.friends) set({ isLoading: true, error: null });
      friendsFetchPromise = (async () => {
        const res = await api.get<any>("/users/friends");
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data && Array.isArray(res.data.data) ? res.data.data : []);
        set({ friends: data, isLoading: false });
        saveFriendCache(data, get().pendingRequests);
      })();
      await friendsFetchPromise;
    } catch (error: any) {
      if (!cache?.friends) set({ error: error.message, isLoading: false });
    } finally {
      friendsFetchPromise = null;
    }
  },

  fetchPending: async () => {
    if (pendingFetchPromise) return pendingFetchPromise;

    const cache = loadFriendCache();
    if (cache?.pendingRequests) {
      set({ pendingRequests: cache.pendingRequests, isLoading: false });
    }

    try {
      if (!cache?.pendingRequests) set({ isLoading: true, error: null });
      pendingFetchPromise = (async () => {
        const res = await api.get<any>("/users/friends/pending");
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data && Array.isArray(res.data.data) ? res.data.data : []);
        set({ pendingRequests: data, isLoading: false });
        saveFriendCache(get().friends, data);
      })();
      await pendingFetchPromise;
    } catch (error: any) {
      if (!cache?.pendingRequests) set({ error: error.message, isLoading: false });
    } finally {
      pendingFetchPromise = null;
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

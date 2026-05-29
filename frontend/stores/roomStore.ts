import { create } from "zustand";
import { api } from "@/lib/api";
import type { Room, Channel, MemberDetailResponse } from "@/types";

const CACHE_KEY = "minidiscord_rooms_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function saveCache(rooms: Room[], channels: Record<string, Channel[]>, members: Record<string, MemberDetailResponse[]>) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rooms, channels, members, ts: Date.now() }));
}

function clearCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export { clearCache as clearRoomCache };

interface RoomState {
  rooms: Room[];
  channels: Record<string, Channel[]>; // roomId -> channels
  members: Record<string, MemberDetailResponse[]>; // roomId -> members
  memberHasMore: Record<string, boolean>; // roomId -> hasMore
  lastActivityMap: Record<string, number>; // roomId -> timestamp (ms)
  isLoading: boolean;
  error: string | null;

  fetchMyRooms: (skipCache?: boolean) => Promise<void>;
  fetchChannels: (roomId: string) => Promise<void>;
  fetchMembers: (roomId: string, beforeJoinedAt?: string) => Promise<void>;
  createRoom: (name: string, type?: "GROUP" | "DM") => Promise<Room>;
  findOrCreateDmRoom: (userId: string) => Promise<Room>;
  getDmRoomForUser: (userId: string) => { roomId: string, channelId: string } | null;
  updateMemberStatus: (userId: string, status: string) => void;
  touchRoomActivity: (roomId: string) => void;
  createChannel: (roomId: string, name: string, type: "TEXT" | "VOICE") => Promise<Channel>;
  getMyRoleInRoom: (roomId: string, userId: string) => "OWNER" | "ADMIN" | "MEMBER" | null;
  refreshAllDmMembers: () => Promise<void>;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  channels: {},
  members: {},
  memberHasMore: {},
  lastActivityMap: {},
  isLoading: false,
  error: null,

  fetchMyRooms: async (skipCache?: boolean) => {
    try {
      set({ isLoading: true, error: null });

      // Show cached data for instant UI, but DON'T background refresh here.
      // The post-WS-connect refresh in useWebSocket.ts handles status updates
      // to avoid race conditions with real-time PRESENCE_UPDATE events.
      const cache = loadCache();
      if (cache && !skipCache) {
        set({ rooms: cache.rooms, channels: cache.channels, members: cache.members, isLoading: false });
        return;
      }

      const res = await api.get<{ message: string; data: Room[] }>("/rooms/my");
      const rooms = res.data.data;
      console.log("[roomStore] fetchMyRooms:", rooms.map(r => ({ id: r.id, type: r.type, name: r.name })));
      set({ rooms, isLoading: false });

      // Parallel fetch: channels for all rooms + members for DM rooms
      const fetchPromises = rooms.map(async (room) => {
        try {
          await get().fetchChannels(room.id);
          console.log("[roomStore] Auto-fetching members for room:", room.id);
          await get().fetchMembers(room.id);
          // Small delay between rooms to avoid rate limit (60 req / 10s);
        } catch (err) {
          console.warn("[roomStore] Skipping room", room.id, "due to error");
        }
      });

      // Execute in batches of 2 with delay to avoid backend timeouts
      for (let i = 0; i < fetchPromises.length; i += 2) {
        await Promise.all(fetchPromises.slice(i, i + 2));
        if (i + 2 < fetchPromises.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      saveCache(get().rooms, get().channels, get().members);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchChannels: async (roomId: string) => {
    try {
      const res = await api.get<{ message: string; data: Channel[] }>(`/rooms/${roomId}/channels`);
      set({
        channels: { ...get().channels, [roomId]: res.data.data },
      });
    } catch (error: any) {
      console.error("[roomStore] fetchChannels failed for", roomId, error.message);
    }
  },

  fetchMembers: async (roomId: string, beforeJoinedAt?: string) => {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const params: Record<string, any> = { limit: 50 };
        if (beforeJoinedAt) params.before = beforeJoinedAt;

        const res = await api.get<{ message: string; data: { members: MemberDetailResponse[]; hasMore: boolean } }>(
          `/rooms/${roomId}/members`,
          { params }
        );
        console.log("[roomStore] fetchMembers result for", roomId, ":", res.data.data);
        const { members: page, hasMore } = res.data.data;

        set((state) => ({
          members: {
            ...state.members,
            [roomId]: beforeJoinedAt ? [...(state.members[roomId] || []), ...page] : page,
          },
          memberHasMore: { ...state.memberHasMore, [roomId]: hasMore },
        }));
        return;
      } catch (error: any) {
        if (error.response?.status === 429 && attempt < MAX_RETRIES) {
          console.warn(`[roomStore] 429 for members ${roomId}, retrying in ${(attempt + 1) * 1000}ms...`);
          await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          continue;
        }
        console.error("[roomStore] fetchMembers failed for", roomId, error.message);
        set({ error: error.message });
        return;
      }
    }
  },

  createRoom: async (name: string, type = "GROUP") => {
    try {
      clearCache();
      set({ isLoading: true, error: null });
      const res = await api.post<{ message: string; data: Room }>("/rooms", { name, type });
      await get().fetchMyRooms();
      return res.data.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  findOrCreateDmRoom: async (userId: string) => {
    try {
      clearCache();
      set({ isLoading: true, error: null });
      const res = await api.post<{ message: string; data: Room }>("/rooms/dm", { targetUserId: userId });
      const room = res.data.data;

      // Eagerly add the room to the store so getDmRoomForUser can resolve
      const existingRooms = get().rooms;
      if (!existingRooms.some(r => r.id === room.id)) {
        set({ rooms: [...existingRooms, room] });
      }

      // Fetch channels + members for THIS room so roomId/channelId resolve immediately
      await get().fetchChannels(room.id);
      await get().fetchMembers(room.id);

      set({ isLoading: false });
      return room;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getDmRoomForUser: (userId: string) => {
    const { rooms, members, channels } = get();
    for (const room of rooms) {
      if (room.type === "DM") {
        const roomMembers = members[room.id];
        if (roomMembers && roomMembers.some(m => m.userId === userId)) {
          const roomChannels = channels[room.id];
          if (roomChannels && roomChannels.length > 0) {
            return { roomId: room.id, channelId: roomChannels[0].id };
          }
        }
      }
    }
    return null;
  },

  updateMemberStatus: (userId: string, status: string) => {
    set((state) => {
      const nextMembers = { ...state.members };
      for (const roomId in nextMembers) {
        nextMembers[roomId] = nextMembers[roomId].map((m) =>
          m.userId === userId ? { ...m, status } : m
        );
      }
      return { members: nextMembers };
    });
  },

  touchRoomActivity: (roomId: string) => {
    set((state) => ({
      lastActivityMap: { ...state.lastActivityMap, [roomId]: Date.now() },
    }));
  },

  createChannel: async (roomId: string, name: string, type: "TEXT" | "VOICE") => {
    try {
      clearCache();
      const res = await api.post<{ message: string; data: Channel }>(`/rooms/${roomId}/channels`, { name, type });
      await get().fetchChannels(roomId);
      return res.data.data;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  getMyRoleInRoom: (roomId: string, userId: string) => {
    const roomMembers = get().members[roomId] || [];
    const me = roomMembers.find(m => m.userId === userId);
    return me ? (me.role as "OWNER" | "ADMIN" | "MEMBER") : null;
  },

  refreshAllDmMembers: async () => {
    const dmRooms = get().rooms.filter(r => r.type === "DM");
    await Promise.all(dmRooms.map(r => get().fetchMembers(r.id)));
  },
}));

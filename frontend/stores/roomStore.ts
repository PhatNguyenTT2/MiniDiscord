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

interface RoomState {
  rooms: Room[];
  channels: Record<string, Channel[]>; // roomId -> channels
  members: Record<string, MemberDetailResponse[]>; // roomId -> members
  isLoading: boolean;
  error: string | null;

  fetchMyRooms: () => Promise<void>;
  fetchChannels: (roomId: string) => Promise<void>;
  fetchMembers: (roomId: string) => Promise<void>;
  createRoom: (name: string, type?: "GROUP" | "DM") => Promise<Room>;
  findOrCreateDmRoom: (userId: string) => Promise<Room>;
  getDmRoomForUser: (userId: string) => { roomId: string, channelId: string } | null;
  updateMemberStatus: (userId: string, status: string) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  channels: {},
  members: {},
  isLoading: false,
  error: null,

  fetchMyRooms: async () => {
    try {
      set({ isLoading: true, error: null });

      const cache = loadCache();
      if (cache) {
        set({ rooms: cache.rooms, channels: cache.channels, members: cache.members, isLoading: false });
        return;
      }

      const res = await api.get<{ message: string; data: Room[] }>("/rooms/my");
      const rooms = res.data.data;
      console.log("[roomStore] fetchMyRooms:", rooms.map(r => ({ id: r.id, type: r.type, name: r.name })));
      set({ rooms, isLoading: false });

      // Batch fetch with small delay between requests to avoid 429 rate limiting
      for (const room of rooms) {
        try {
          await get().fetchChannels(room.id);
          if (room.type === "DM") {
            console.log("[roomStore] Auto-fetching members for DM room:", room.id);
            await get().fetchMembers(room.id);
          }
          // Small delay between rooms to avoid rate limit (60 req / 10s)
          if (rooms.length > 3) {
            await new Promise(r => setTimeout(r, 150));
          }
        } catch (err) {
          // Continue to next room even if one fails
          console.warn("[roomStore] Skipping room", room.id, "due to error");
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

  fetchMembers: async (roomId: string) => {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await api.get<{ message: string; data: MemberDetailResponse[] }>(`/rooms/${roomId}/members`);
        console.log("[roomStore] fetchMembers result for", roomId, ":", res.data.data);
        set({
          members: { ...get().members, [roomId]: res.data.data },
        });
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

      // Sync to sessionStorage to prevent stale status on reload
      try {
        sessionStorage.setItem("room_members_cache", JSON.stringify({
          data: nextMembers,
          ts: Date.now()
        }));
      } catch (e) {
        console.warn("[ROOM_STORE] Failed to sync member status to sessionStorage", e);
      }

      return { members: nextMembers };
    });
  },
}));

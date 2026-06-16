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
  isFetchingMembers: Record<string, boolean>; // roomId -> isFetching
  isLoading: boolean;
  error: string | null;

  fetchMyRooms: (skipCache?: boolean) => Promise<void>;
  fetchChannels: (roomId: string) => Promise<void>;
  fetchMembers: (roomId: string, beforeJoinedAt?: string, force?: boolean) => Promise<void>;
  createRoom: (name: string, type?: "GROUP" | "DM") => Promise<Room>;
  findOrCreateDmRoom: (userId: string) => Promise<Room>;
  getDmRoomForUser: (userId: string) => { roomId: string, channelId: string } | null;
  updateMemberStatus: (userId: string, status: string) => void;
  touchRoomActivity: (roomId: string) => void;
  createChannel: (roomId: string, name: string, type: "TEXT" | "VOICE") => Promise<Channel>;
  updateChannel: (roomId: string, channelId: string, data: { name?: string; topic?: string | null; isPrivate?: boolean }) => Promise<Channel>;
  deleteChannel: (roomId: string, channelId: string) => Promise<void>;
  getMyRoleInRoom: (roomId: string, userId: string) => "OWNER" | "ADMIN" | "MEMBER" | null;
  refreshAllDmMembers: () => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
}


export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  channels: {},
  members: {},
  memberHasMore: {},
  lastActivityMap: {},
  isFetchingMembers: {},
  isLoading: false,
  error: null,

  fetchMyRooms: async (skipCache?: boolean) => {
    // A. Nạp nhanh từ Cache (Nếu có)
    const cache = loadCache();
    if (cache && !skipCache) {
      set({ rooms: cache.rooms, channels: cache.channels, members: cache.members, isLoading: false });
      return;
    }

    // B. Chỉ fetch danh sách phòng (Nhanh, chỉ 1 request)
    set({ isLoading: true });
    try {
      const res = await api.get<{ message: string; data: Room[] }>("/rooms/my");
      const rooms = res.data.data;

      // Gán rooms vào store ngay lập tức để UI render và WebSocket nhận diện được dependency
      set({ rooms, isLoading: false });

      // C. Khởi chạy luồng nạp dữ liệu ngầm (Fire-and-forget)
      // LƯU Ý: KHÔNG dùng await ở đây để tránh block hàm fetchMyRooms
      hydrateRoomDetails(rooms);
    } catch (error: any) {
      console.error("Failed to fetch rooms:", error);
      set({ error: error.message, isLoading: false });
    }
  },



  fetchChannels: async (roomId: string) => {
    try {
      const res = await api.get<{ message: string; data: Channel[] }>(`/rooms/${roomId}/channels`);
      const nextChannels = { ...get().channels, [roomId]: res.data.data };
      set({
        channels: nextChannels,
      });
      saveCache(get().rooms, nextChannels, get().members);
    } catch (error: any) {
      console.error("[roomStore] fetchChannels failed for", roomId, error.message);
    }
  },

  fetchMembers: async (roomId: string, beforeJoinedAt?: string, force?: boolean) => {
    if (!force && !beforeJoinedAt && get().isFetchingMembers[roomId]) {
      console.log("[roomStore] Duplicated fetchMembers call ignored for", roomId);
      return;
    }
    set(s => ({ isFetchingMembers: { ...s.isFetchingMembers, [roomId]: true } }));

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

        set((state) => {
          const nextMembers = {
            ...state.members,
            [roomId]: beforeJoinedAt ? [...(state.members[roomId] || []), ...page] : page,
          };
          saveCache(state.rooms, state.channels, nextMembers);
          return {
            members: nextMembers,
            memberHasMore: { ...state.memberHasMore, [roomId]: hasMore },
            isFetchingMembers: { ...state.isFetchingMembers, [roomId]: false }
          };
        });
        return;
      } catch (error: any) {
        if (error.response?.status === 429 && attempt < MAX_RETRIES) {
          console.warn(`[roomStore] 429 for members ${roomId}, retrying in ${(attempt + 1) * 1000}ms...`);
          await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
          continue;
        }
        console.error("[roomStore] fetchMembers failed for", roomId, error.message);
        set(s => ({ error: error.message, isFetchingMembers: { ...s.isFetchingMembers, [roomId]: false } }));
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
      let changed = false;
      for (const roomId in nextMembers) {
        nextMembers[roomId] = nextMembers[roomId].map((m) => {
          if (m.userId === userId && m.status !== status) {
            changed = true;
            return { ...m, status };
          }
          return m;
        });
      }
      if (changed) {
        saveCache(state.rooms, state.channels, nextMembers);
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

  updateChannel: async (roomId: string, channelId: string, data: { name?: string; topic?: string | null; isPrivate?: boolean }) => {
    try {
      clearCache();
      const res = await api.put<{ message: string; data: Channel }>(`/rooms/${roomId}/channels/${channelId}`, data);
      await get().fetchChannels(roomId);
      return res.data.data;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteChannel: async (roomId: string, channelId: string) => {
    try {
      clearCache();
      await api.delete(`/rooms/${roomId}/channels/${channelId}`);
      await get().fetchChannels(roomId);
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

  leaveRoom: async (roomId: string) => {
    try {
      clearCache();
      await api.delete(`/rooms/${roomId}/members/me`);
      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
}));

// 2. Định nghĩa hàm nạp dữ liệu chạy ngầm
async function hydrateRoomDetails(rooms: Room[]) {
  const store = useRoomStore.getState;

  // A. Ưu tiên nạp dữ liệu cho phòng đang Active (Đang xem)
  // Dùng Regex lấy ID phòng từ URL, loại trừ chuỗi "me"
  const activeRoomId = typeof window !== "undefined"
    ? window.location.pathname.match(/\/channels\/(?!me\b)([^/]+)/)?.[1]
    : null;
  const activeRoom = activeRoomId ? rooms.find(r => r.id === activeRoomId) : null;

  if (activeRoom) {
    // Đợi phòng active nạp xong kênh và thành viên
    await Promise.allSettled([
      store().fetchChannels(activeRoom.id),
      store().fetchMembers(activeRoom.id),
    ]);
  }

  // B. Nạp dữ liệu các phòng DM khác theo từng cụm (Batching)
  // Giới hạn 3 phòng / lượt để chừa băng thông cho WebSocket và tải ảnh
  const dmRooms = rooms.filter(r => r.type === "DM" && r.id !== activeRoom?.id);

  for (let i = 0; i < dmRooms.length; i += 3) {
    const batch = dmRooms.slice(i, i + 3);
    await Promise.allSettled(
      batch.flatMap(r => [
        store().fetchChannels(r.id),
        store().fetchMembers(r.id)
      ])
    );
  }

  // C. Lưu cache sau khi mọi dữ liệu đã nạp xong
  saveCache(store().rooms, store().channels, store().members);
}


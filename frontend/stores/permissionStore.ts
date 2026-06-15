import { create } from "zustand";
import { api } from "@/lib/api";

interface PermissionState {
  permissions: Record<string, string[]>; // roomId -> list of permission keys
  isLoading: boolean;
  error: string | null;

  fetchPermissions: (roomId: string) => Promise<void>;
  clearPermissions: (roomId: string) => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  isLoading: false,
  error: null,

  fetchPermissions: async (roomId: string) => {
    if (!roomId || roomId === "me") {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ message: string; data: string[] }>(`/rooms/${roomId}/permissions/my`);
      const list = res.data.data || [];
      set({
        permissions: {
          ...get().permissions,
          [roomId]: list,
        },
        isLoading: false,
      });
    } catch (err: any) {
      console.error(`[permissionStore] Failed to fetch permissions for room ${roomId}:`, err.message);
      set({ error: err.message, isLoading: false });
    }
  },

  clearPermissions: (roomId: string) => {
    const updated = { ...get().permissions };
    delete updated[roomId];
    set({ permissions: updated });
  },
}));

import { create } from "zustand";
import { api } from "@/lib/api";

const CACHE_KEY = "minidiscord_sticker_packs";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms

interface CachedData {
  timestamp: number;
  packs: StickerPack[];
}

let packsFetchPromise: Promise<void> | null = null;

export interface Sticker {
  id: string;
  name: string;
  fileKey: string;
  formatType: string;
}

export interface StickerPack {
  id: string;
  name: string;
  coverFileKey: string;
  stickers: Sticker[];
}

interface StickerState {
  packs: StickerPack[];
  isLoading: boolean;
  error: string | null;
  fetchPacks: () => Promise<void>;
  getStickerById: (id: string) => Sticker | null;
}

export const useStickerStore = create<StickerState>((set, get) => ({
  packs: [],
  isLoading: false,
  error: null,

  fetchPacks: async () => {
    // If already loaded and has elements, bypass fetch
    if (get().packs.length > 0) return;

    // Check sessionStorage cache
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedData;
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            set({ packs: parsed.packs, isLoading: false, error: null });
            return;
          }
        }
      } catch (e) {
        console.warn("[StickerStore] Failed to read from sessionStorage:", e);
      }
    }

    // Promise deduplication
    if (packsFetchPromise) {
      return packsFetchPromise;
    }

    set({ isLoading: true, error: null });

    packsFetchPromise = (async () => {
      try {
        const res = await api.get<{ message: string; data: StickerPack[] }>("/stickers/packs");
        const packsData = res.data?.data || [];

        // Save to sessionStorage cache
        if (typeof window !== "undefined") {
          try {
            const cacheObj: CachedData = {
              timestamp: Date.now(),
              packs: packsData,
            };
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
          } catch (e) {
            console.warn("[StickerStore] Failed to write to sessionStorage:", e);
          }
        }

        set({ packs: packsData, isLoading: false });
      } catch (err: any) {
        console.error("[StickerStore] Failed fetching sticker packs:", err);
        set({
          error: err.response?.data?.message || err.message || "Failed to fetch stickers",
          isLoading: false
        });
        throw err;
      } finally {
        packsFetchPromise = null;
      }
    })();

    return packsFetchPromise;
  },

  getStickerById: (id: string) => {
    for (const pack of get().packs) {
      const sticker = pack.stickers?.find((s) => s.id === id);
      if (sticker) return sticker;
    }
    return null;
  }
}));

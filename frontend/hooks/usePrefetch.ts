"use client";

import { useEffect, useRef } from "react";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";
import { useStickerStore } from "@/stores/stickerStore";

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

export function usePrefetch() {
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function prefetchWithRetry(attempt = 0) {
      // Clear errors before retry
      useFriendStore.setState({ error: null });
      useRoomStore.setState({ error: null });
      useStickerStore.setState({ error: null });

      await Promise.allSettled([
        useFriendStore.getState().fetchFriends(),
        useFriendStore.getState().fetchPending(),
        useRoomStore.getState().fetchMyRooms(),
        useStickerStore.getState().fetchPacks(),
      ]);

      const friendError = useFriendStore.getState().error;
      const roomError = useRoomStore.getState().error;
      const stickerError = useStickerStore.getState().error;

      const hasFailure = !!(friendError || roomError || stickerError);

      if (hasFailure && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY; // simple linear retry
        console.warn(`[Prefetch] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms due to:`, {
          friendError,
          roomError,
          stickerError,
        });
        setTimeout(() => prefetchWithRetry(attempt + 1), delay);
      }
    }

    prefetchWithRetry();
  }, []);
}

"use client";

import { useEffect, useRef } from "react";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";

/**
 * Prefetch critical data as soon as the user is authenticated.
 * This runs once at the AuthGuard level, so by the time
 * Dashboard/FriendsPage mounts, the data is already in Zustand.
 */
const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

export function usePrefetch() {
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function prefetchWithRetry(attempt = 0) {
      const results = await Promise.allSettled([
        useFriendStore.getState().fetchFriends(),
        useFriendStore.getState().fetchPending(),
        useRoomStore.getState().fetchMyRooms(),
      ]);

      const hasFailure = results.some((r) => r.status === "rejected");
      const { error: roomError } = useRoomStore.getState();
      const { error: friendError } = useFriendStore.getState();
      const hasStoreError = roomError !== null || friendError !== null;

      if ((hasFailure || hasStoreError) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`[Prefetch] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        setTimeout(() => prefetchWithRetry(attempt + 1), delay);
      }
    }

    prefetchWithRetry();
  }, []);
}

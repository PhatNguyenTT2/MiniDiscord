"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/stores/networkStore";

export function useNetworkStatus() {
  const setOnline = useNetworkStore((state) => state.setOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);
}

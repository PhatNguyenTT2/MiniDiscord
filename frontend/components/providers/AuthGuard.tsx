"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePrefetch } from "@/hooks/usePrefetch";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrate = useAuthStore((state) => state.hydrate);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // WebSocket connects only when authenticated, disconnects on unmount/logout
  useWebSocket();

  // Prefetch critical data (friends, rooms) as soon as auth is confirmed
  usePrefetch();

  useEffect(() => {
    // Attempt to load token from localStorage
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  // Show a loading skeleton/spinner while hydrating or if not authenticated (prevent flash)
  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Connecting to MiniDiscord...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

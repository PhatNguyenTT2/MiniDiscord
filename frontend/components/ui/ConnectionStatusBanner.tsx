"use client";

import { useEffect, useState, useRef } from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { useNetworkStore } from "@/stores/networkStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export function ConnectionStatusBanner() {
  const { t } = useTranslation();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const wsStatus = useNetworkStore((s) => s.wsStatus);
  const [showConnected, setShowConnected] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we were ever disconnected so we don't show "Connected" on first load
  useEffect(() => {
    if (!isOnline || wsStatus === "connecting" || wsStatus === "disconnected") {
      setWasDisconnected(true);
    }
  }, [isOnline, wsStatus]);

  // Determine actual status with priority: offline browser > websocket reconnecting > reconnected recently > connected
  const displayStatus = !isOnline
    ? "disconnected"
    : wsStatus === "disconnected" || wsStatus === "connecting"
      ? "connecting"
      : showConnected
        ? "connected"
        : "hidden";

  // Handle the "Connected!" auto-hide logic
  useEffect(() => {
    // Clear previous timeout if any
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isOnline && wsStatus === "connected") {
      if (wasDisconnected) {
        // Reconnected! Show the green banner
        setShowConnected(true);
        // Hide after 3s
        timeoutRef.current = setTimeout(() => {
          setShowConnected(false);
          setWasDisconnected(false); // Reset tracking so it doesn't trigger again until next disconnect
        }, 3000);
      }
    } else {
      setShowConnected(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOnline, wsStatus, wasDisconnected]);

  if (displayStatus === "hidden") return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center py-1.5 text-sm font-medium animate-in slide-in-from-top-2 duration-300 pointer-events-none text-white",
        {
          "bg-warning": displayStatus === "disconnected",
          "bg-accent": displayStatus === "connecting",
          "bg-success": displayStatus === "connected",
        }
      )}
    >
      <div className="flex items-center gap-2">
        {displayStatus === "disconnected" && (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{t("network.offline")}</span>
          </>
        )}
        {displayStatus === "connecting" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("network.connecting")}</span>
          </>
        )}
        {displayStatus === "connected" && (
          <>
            <Wifi className="h-4 w-4" />
            <span>{t("network.connected")}</span>
          </>
        )}
      </div>
    </div>
  );
}

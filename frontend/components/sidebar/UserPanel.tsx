"use client";

import { useState } from "react";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export function UserPanel() {
  const { t } = useTranslation();
  const openSettings = useUIStore((s) => s.openSettings);
  const user = useAuthStore((s) => s.user);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  if (!user) {
    return (
      <div
        className="absolute inset-x-0 z-20 px-3"
        style={{ bottom: "var(--floating-bar-gap)" }}
      >
        <div
          className="flex items-center gap-2 px-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
          style={{
            minHeight: "var(--floating-user-panel-height)",
            borderRadius: "var(--floating-bar-radius)",
            backgroundColor: "#232428",
          }}
        >
          {/* Skeleton avatar */}
          <div className="h-8 w-8 rounded-full bg-[#3f4147] animate-pulse shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="h-3 w-16 rounded bg-[#3f4147] animate-pulse mb-1.5" />
            <div className="h-2.5 w-12 rounded bg-[#3f4147] animate-pulse" />
          </div>

          <div className="flex items-center gap-0.5">
            {/* Settings button still accessible */}
            <button
              aria-label={t("userPanel.settings")}
              onClick={openSettings}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#b5bac1] hover:bg-[#3f4147] hover:text-[#dbdee1] transition-colors duration-150 cursor-pointer"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusKey = user.status.toLowerCase() as
    | "online"
    | "offline"
    | "idle"
    | "dnd";

  function toggleMute() {
    setIsMuted((prev) => !prev);
  }

  function toggleDeafen() {
    setIsDeafened((prev) => {
      const next = !prev;
      // Discord logic: deafen ON → force mute ON
      if (next) {
        setIsMuted(true);
      }
      return next;
    });
  }

  // Mic is visually muted if either isMuted or isDeafened
  const micActive = !isMuted;
  const headphoneActive = !isDeafened;

  return (
    <div
      className="absolute inset-x-0 z-20 px-3"
      style={{ bottom: "var(--floating-bar-gap)" }}
    >
      <div
        className="flex items-center gap-2 px-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
        style={{
          minHeight: "var(--floating-user-panel-height)",
          borderRadius: "var(--floating-bar-radius)",
          backgroundColor: "#232428",
        }}
      >
        <StatusAvatar
          src={user.avatarUrl}
          fallback={user.username}
          status={user.status}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground leading-tight">
            {user.username}
          </p>
          <p className="truncate text-[12px] text-muted-foreground leading-tight">
            {t(`status.${statusKey}`)}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Microphone */}
          <button
            aria-label={t("userPanel.muteMic")}
            onClick={toggleMute}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 cursor-pointer",
              micActive
                ? "text-[#b5bac1] hover:bg-[#3f4147] hover:text-[#dbdee1]"
                : "text-[#ed4245] bg-[#ed4245]/15 hover:bg-[#ed4245]/25"
            )}
          >
            {micActive ? (
              <Mic className="h-[18px] w-[18px]" />
            ) : (
              <MicOff className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* Headphones */}
          <button
            aria-label={t("userPanel.deafen")}
            onClick={toggleDeafen}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 cursor-pointer",
              headphoneActive
                ? "text-[#b5bac1] hover:bg-[#3f4147] hover:text-[#dbdee1]"
                : "text-[#ed4245] bg-[#ed4245]/15 hover:bg-[#ed4245]/25"
            )}
          >
            {headphoneActive ? (
              <Headphones className="h-[18px] w-[18px]" />
            ) : (
              <HeadphoneOff className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* Settings */}
          <button
            aria-label={t("userPanel.settings")}
            onClick={openSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#b5bac1] hover:bg-[#3f4147] hover:text-[#dbdee1] transition-colors duration-150 cursor-pointer"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

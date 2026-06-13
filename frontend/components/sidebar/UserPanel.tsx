"use client";

import { useState } from "react";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { cn } from "@/lib/utils";

/**
 * UserPanel — floating card at the bottom of SidebarWrapper.
 * Mirrors MessageInput's positioning pattern exactly:
 * - Outer: absolute inset-x-0, bottom: var(--floating-bar-gap), px-4, z-20
 * - Inner: bg-[#232428], borderRadius: var(--floating-bar-radius), shadow
 * Column backgrounds show through OUTSIDE the rounded card.
 */
export function UserPanel() {
  const { t } = useTranslation();
  const openSettings = useUIStore((s) => s.openSettings);
  const user = useAuthStore((s) => s.user);

  // Sync mute/deafen state directly with useVoiceStore
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const toggleMuteStore = useVoiceStore((s) => s.toggleMute);
  const toggleDeafenStore = useVoiceStore((s) => s.toggleDeafen);

  if (!user) {
    return (
      <div
        className="absolute inset-x-0 z-20 px-2"
        style={{ bottom: "var(--floating-bar-gap)" }}
      >
        <div
          className="flex items-center gap-2 px-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
          style={{
            minHeight: "var(--floating-user-panel-height)",
            borderRadius: "var(--floating-bar-radius)",
            backgroundColor: "#2b2d31",
          }}
        >
          <div className="h-8 w-8 rounded-full bg-[#3f4147] animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-16 rounded bg-[#3f4147] animate-pulse mb-1.5" />
            <div className="h-2.5 w-12 rounded bg-[#3f4147] animate-pulse" />
          </div>
          <div className="flex items-center gap-0.5">
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
    toggleMuteStore();
  }

  function toggleDeafen() {
    toggleDeafenStore();
  }

  const micActive = !isMuted;
  const headphoneActive = !isDeafened;

  // Read voice presence
  const currentChannel = useVoiceStore?.((s) => s.currentChannel);
  const activeCallRoomId = useVoiceStore?.((s) => s.activeCallRoomId);
  const isInVoice = currentChannel || activeCallRoomId;

  return (
    <div
      className="absolute inset-x-0 z-20 px-2"
      style={{ bottom: "var(--floating-bar-gap)" }}
    >
      <div
        className="flex items-center gap-2 px-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
        style={{
          minHeight: "var(--floating-user-panel-height)",
          borderRadius: "var(--floating-bar-radius)",
          backgroundColor: "#2b2d31",
        }}
      >
        <StatusAvatar
          src={user.avatarUrl}
          fallback={user.username}
          status={user.status}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground leading-tight">
            {user.displayName || user.username}
          </p>
          <p className="truncate text-[13px] leading-tight select-none mt-0.5">
            {isInVoice ? (
              <span className="flex items-center gap-1 text-[#23a55a] font-medium leading-none">
                <span className="inline-block w-2.5 h-2.5 shrink-0 bg-[#23a55a] rounded-full animate-pulse mr-0.5" />
                {t("voice.inVoiceChannel")}
              </span>
            ) : (
              <span className="text-muted-foreground">{t(`status.${statusKey}`)}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-0.5">
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

"use client";

import { useState, useEffect } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlBarProps {
  className?: string;
  size?: "sm" | "md";
}

export function VoiceControlBar({ className, size = "md" }: VoiceControlBarProps) {
  const { t } = useTranslation();

  const isMuted = useVoiceStore((s) => s.isMuted);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const leaveVoiceChannel = useVoiceStore((s) => s.leaveVoiceChannel);
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);
  const endCall = useVoiceStore((s) => s.endCall);

  // Sync with current user server-mute time
  const currentUser = useAuthStore((s) => s.user);
  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const roomId = currentChannel?.roomId;
  const members = useRoomStore((s) => roomId ? s.members[roomId] : undefined) || [];
  const me = members.find((m) => m.userId === currentUser?.id);
  const serverMutedUntil = me?.mutedUntil ? new Date(me.mutedUntil) : null;

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!serverMutedUntil) {
      setTimeLeft(0);
      return;
    }
    const calcTimeLeft = () => {
      const diff = Math.max(0, Math.ceil((serverMutedUntil.getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      return diff;
    };

    const initialDiff = calcTimeLeft();
    if (initialDiff <= 0) return;

    const interval = setInterval(() => {
      const diff = calcTimeLeft();
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [me?.mutedUntil]);

  const isServerMuted = timeLeft > 0;

  // Local state for mock Video/Camera on/off
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleDisconnect = () => {
    if (activeCallRoomId) {
      endCall();
    } else {
      leaveVoiceChannel();
    }
  };

  const isSmall = size === "sm";

  return (
    <div className={cn("flex items-center justify-center gap-3.5", className)}>
      {/* 1. Mic Trigger */}
      <button
        type="button"
        aria-label={isServerMuted ? t("voice.serverMuted") : isMuted ? t("voice.unmute") : t("voice.mute")}
        onClick={isServerMuted ? undefined : toggleMute}
        title={isServerMuted ? t("voice.serverMuted") : isMuted ? t("voice.unmute") : t("voice.mute")}
        disabled={isServerMuted}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-200 shadow-md border-none outline-none shrink-0",
          isSmall ? "h-9 w-9" : "h-11 w-11",
          isServerMuted
            ? "bg-[#d97706] text-white opacity-80 cursor-not-allowed"
            : isMuted
              ? "bg-[#ed4245] text-white hover:bg-[#c93b3e] cursor-pointer"
              : "bg-[#313338] text-[#dbdee1] hover:bg-[#3f4147] hover:text-[#f2f3f5] cursor-pointer"
        )}
      >
        {isServerMuted || isMuted ? (
          <MicOff className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
        ) : (
          <Mic className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
        )}
      </button>

      {/* 2. Deafen Trigger */}
      <button
        type="button"
        aria-label={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
        onClick={toggleDeafen}
        title={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-md border-none outline-none shrink-0",
          isSmall ? "h-9 w-9" : "h-11 w-11",
          isDeafened
            ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]"
            : "bg-[#313338] text-[#dbdee1] hover:bg-[#3f4147] hover:text-[#f2f3f5]"
        )}
      >
        {isDeafened ? (
          <HeadphoneOff className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
        ) : (
          <Headphones className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
        )}
      </button>

      {/* 2. Disconnect/End Call */}
      <button
        type="button"
        aria-label={t("voice.disconnect")}
        onClick={handleDisconnect}
        title={t("voice.disconnect")}
        className={cn(
          "flex items-center justify-center rounded-full bg-[#ed4245] text-white hover:bg-[#c93b3e] transition-all duration-200 scale-102 hover:scale-108 cursor-pointer shadow-md border-none outline-none shrink-0",
          isSmall ? "h-9 w-9" : "h-11 w-11"
        )}
      >
        <PhoneOff className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[19px] w-[19px]")} />
      </button>
    </div>
  );
}

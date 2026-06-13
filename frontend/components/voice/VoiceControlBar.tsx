"use client";

import { useState } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useTranslation } from "@/lib/i18n";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceControlBarProps {
  className?: string;
  size?: "sm" | "md";
}

export function VoiceControlBar({ className, size = "md" }: VoiceControlBarProps) {
  const { t } = useTranslation();

  const isMuted = useVoiceStore((s) => s.isMuted);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const leaveVoiceChannel = useVoiceStore((s) => s.leaveVoiceChannel);
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);
  const endCall = useVoiceStore((s) => s.endCall);

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
        aria-label={isMuted ? t("voice.unmute") : t("voice.mute")}
        onClick={toggleMute}
        title={isMuted ? t("voice.unmute") : t("voice.mute")}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-md border-none outline-none shrink-0",
          isSmall ? "h-9 w-9" : "h-11 w-11",
          isMuted
            ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]"
            : "bg-[#313338] text-[#dbdee1] hover:bg-[#3f4147] hover:text-[#f2f3f5]"
        )}
      >
        {isMuted ? (
          <MicOff className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
        ) : (
          <Mic className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
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

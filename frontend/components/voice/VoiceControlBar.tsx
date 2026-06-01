"use client";

import { useVoiceStore } from "@/stores/voiceStore";
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
  const isDeafened = useVoiceStore((s) => s.isDeafened);

  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const leaveVoiceChannel = useVoiceStore((s) => s.leaveVoiceChannel);
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);
  const endCall = useVoiceStore((s) => s.endCall);

  const handleDisconnect = () => {
    if (activeCallRoomId) {
      endCall();
    } else {
      leaveVoiceChannel();
    }
  };

  const isSmall = size === "sm";

  return (
    <div className={cn("flex items-center justify-center gap-2.5", className)}>
      {/* Mic Trigger */}
      <button
        aria-label={isMuted ? t("voice.unmute") : t("voice.mute")}
        onClick={toggleMute}
        title={isMuted ? t("voice.unmute") : t("voice.mute")}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-md",
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

      {/* Deafen Trigger */}
      <button
        aria-label={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
        onClick={toggleDeafen}
        title={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-md",
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

      {/* Disconnect/End Call */}
      <button
        aria-label={t("voice.disconnect")}
        onClick={handleDisconnect}
        title={t("voice.disconnect")}
        className={cn(
          "flex items-center justify-center rounded-full bg-[#ed4245] text-white hover:bg-[#c93b3e] transition-all duration-200 scale-102 hover:scale-108 cursor-pointer shadow-md border border-[#ed4245]/20",
          isSmall ? "h-9 w-9" : "h-11 w-11"
        )}
      >
        <PhoneOff className={cn(isSmall ? "h-[16px] w-[16px]" : "h-[20px] w-[20px]")} />
      </button>
    </div>
  );
}

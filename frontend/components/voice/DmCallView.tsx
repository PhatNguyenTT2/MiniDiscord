"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { VoiceControlBar } from "./VoiceControlBar";
import { MicOff, HeadphoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DmCallViewProps {
  roomId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
}

export function DmCallView({ roomId, recipientId, recipientName, recipientAvatar }: DmCallViewProps) {
  const { t } = useTranslation();

  const currentUser = useAuthStore((s) => s.user);

  const remoteStreams = useVoiceStore((s) => s.remoteStreams);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);

  const isConnected = !!remoteStreams[recipientId];
  const isRinging = !isConnected;

  return (
    <div className="w-full bg-[#111214]/60 backdrop-blur-md border-b border-[#35363c]/50 p-4 shrink-0 transition-all duration-300">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">

        {/* Card Grid Area */}
        <div className="flex-1 w-full grid grid-cols-2 gap-4">

          {/* Card 1: Current User */}
          <div className="flex flex-col items-center justify-center bg-[#2b2d31]/85 border border-[#35363c]/50 rounded-xl p-4 aspect-video relative shadow-lg">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover shadow-md border-2 border-transparent"
              />
            ) : (
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#5865f2] flex items-center justify-center shadow-md text-white font-bold text-lg uppercase">
                {currentUser?.username.substring(0, 2) || "ME"}
              </div>
            )}

            <span className="text-[13px] font-bold text-[#dbdee1] mt-2 max-w-[85%] truncate">
              {currentUser?.username || "You"}
            </span>

            {/* Mic / Deafen overlays */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
              {isDeafened && (
                <div className="bg-[#ed4245] text-white p-1 rounded-full shadow">
                  <HeadphoneOff className="h-3.5 w-3.5" />
                </div>
              )}
              {isMuted && !isDeafened && (
                <div className="bg-[#ed4245] text-white p-1 rounded-full shadow">
                  <MicOff className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Recipient (The Friend) */}
          <div className={cn(
            "flex flex-col items-center justify-center bg-[#2b2d31]/85 border rounded-xl p-4 aspect-video relative shadow-lg transition-all duration-300",
            isRinging ? "border-[#23a55a] animate-pulse" : "border-[#35363c]/50"
          )}>
            <div className="relative">
              {isRinging && (
                <span className="absolute inset-0 rounded-full bg-[#23a55a]/20 animate-ping" />
              )}
              {recipientAvatar ? (
                <img
                  src={recipientAvatar}
                  alt={recipientName}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover shadow-md relative z-10 border border-[#23a55a]/10"
                />
              ) : (
                <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#5865f2]/85 flex items-center justify-center shadow-md relative z-10 text-white font-bold text-lg uppercase border border-[#23a55a]/10">
                  {recipientName.substring(0, 2)}
                </div>
              )}
            </div>

            <span className="text-[13px] font-bold text-[#dbdee1] mt-2 max-w-[85%] truncate relative z-10">
              {recipientName}
            </span>

            {/* Ringing / Connected label */}
            <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider relative z-10">
              {isRinging && <span className="text-[#23a55a]">{t("voice.incomingCall")}...</span>}
              {isConnected && <span className="text-[#5865f2]">Connected</span>}
            </div>
          </div>

        </div>

        {/* Media Controls Sidebar Column */}
        <div className="shrink-0 flex items-center justify-center border-t md:border-t-0 md:border-l border-[#35363c]/40 pt-3 md:pt-0 md:pl-4">
          <VoiceControlBar size="sm" className="gap-3" />
        </div>

      </div>
    </div>
  );
}

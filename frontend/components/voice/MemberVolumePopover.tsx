"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useVoiceStore } from "@/stores/voiceStore";
import { useTranslation } from "@/lib/i18n";
import { Volume2, VolumeX, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemberVolumePopoverProps {
  userId: string;
  username: string;
  displayName?: string | null;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
}

export function MemberVolumePopover({
  userId,
  username,
  displayName,
  children,
  side = "top",
  align = "center",
}: MemberVolumePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const volume = useVoiceStore((s) => s.memberVolumes[userId] ?? 100);
  const isMuted = useVoiceStore((s) => s.memberMuted[userId] ?? false);
  const setMemberVolume = useVoiceStore((s) => s.setMemberVolume);
  const toggleMemberMute = useVoiceStore((s) => s.toggleMemberMute);

  const resolvedName = displayName || username || "User";

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          className="z-[110] w-64 bg-[#1e1f22] border border-[#2b2d31] rounded-lg p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 outline-none select-none font-sans"
        >
          <div className="flex flex-col gap-3.5">
            {/* Header info */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-[#949ba4] tracking-wider">
                {t("music.memberVolume")}
              </span>
              <span className="text-sm font-extrabold text-white truncate mt-0.5">
                {resolvedName}
              </span>
            </div>

            <hr className="border-[#2b2d31] my-0.5" />

            {/* Volume range slider */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-[#dbdee1] font-semibold">
                <div className="flex items-center gap-1.5">
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-[#ed4245]" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#23a55a]" />
                  )}
                  <span>{t("music.volume")}</span>
                </div>
                <span className="text-white font-mono">{isMuted ? "0" : volume}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="200"
                value={isMuted ? 0 : volume}
                disabled={isMuted}
                onChange={(e) => setMemberVolume(userId, parseInt(e.target.value))}
                className={cn(
                  "w-full h-1.5 rounded-lg appearance-none cursor-pointer outline-none bg-[#4e5058] transition",
                  "accent-[#5865f2] disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                style={{
                  background: isMuted
                    ? "#313338"
                    : `linear-gradient(to right, #5865f2 0%, #5865f2 ${volume / 2}%, #313338 ${volume / 2}%, #313338 100%)`
                }}
              />

              <div className="flex justify-between text-[10px] text-[#949ba4] font-semibold px-0.5">
                <span>0%</span>
                <span>100%</span>
                <span>200%</span>
              </div>
            </div>

            {/* Mute component checkmark row toggler */}
            <button
              type="button"
              onClick={() => toggleMemberMute(userId)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2.5 rounded text-xs font-semibold cursor-pointer border-none outline-none select-none transition duration-150",
                isMuted
                  ? "bg-[#ed4245]/10 text-[#f23f43] hover:bg-[#ed4245]/20"
                  : "bg-[#2b2d31]/50 text-[#dbdee1] hover:bg-[#35373c]"
              )}
            >
              <span>{t("music.muteMember")}</span>
              {isMuted && <Check className="h-4 w-4 text-[#f23f43] stroke-[3]" />}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

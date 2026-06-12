"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useRoomStore } from "@/stores/roomStore";
import { useTranslation } from "@/lib/i18n";
import { VoiceControlBar } from "./VoiceControlBar";
import { Signal, Info } from "lucide-react";
import Link from "next/link";

export function VoiceConnectedPanel() {
  const { t } = useTranslation();

  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);

  const rooms = useRoomStore((s) => s.rooms);
  const channels = useRoomStore((s) => s.channels);

  // If not in voice channel and not in active call, don't show the panel
  if (!currentChannel && !activeCallRoomId) return null;

  let title = t("voice.incomingCall");
  let subTitle = "MiniDiscord";
  let targetUrl = "";

  if (currentChannel) {
    const activeRoom = rooms.find((r) => r.id === currentChannel.roomId);
    const roomChannels = channels[currentChannel.roomId] || [];
    const activeChannelObj = roomChannels.find((c) => c.id === currentChannel.channelId);

    title = activeChannelObj?.name ? `🔊 ${activeChannelObj.name}` : "🔊 Voice Channel";
    subTitle = activeRoom?.name || "Server Room";
    targetUrl = `/channels/${currentChannel.roomId}/${currentChannel.channelId}`;
  } else if (activeCallRoomId) {
    const activeRoom = rooms.find((r) => r.id === activeCallRoomId);
    title = t("voice.connectedStatus");
    subTitle = activeRoom?.name ? `📞 ${activeRoom.name}` : "Direct DM Call";
    targetUrl = `/channels/me/${activeCallRoomId}`;
  }

  const PanelContent = (
    <div
      className="flex flex-col gap-2 p-2.5 shadow-[0_-8px_20px_rgba(0,0,0,0.15)]"
      style={{
        borderRadius: "var(--floating-bar-radius)",
        backgroundColor: "#232428",
        border: "1px border-[#1f2023]",
      }}
    >
      <div className="flex items-center justify-between gap-1.5 px-1.5">
        {/* Info panel click to navigate */}
        <Link
          href={targetUrl || "#"}
          className="flex flex-1 flex-col min-w-0 hover:opacity-85 transition-opacity"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[#23a55a] animate-pulse shrink-0" />
            <p className="text-[13px] font-bold text-[#23a55a] truncate leading-tight uppercase tracking-wide">
              {t("voice.connectedStatus")}
            </p>
          </div>
          <p className="text-[12px] font-medium text-[#dbdee1] truncate leading-snug mt-0.5">
            {title}
          </p>
          <p className="text-[10.5px] text-[#949ba4] truncate leading-none mt-0.5">
            {subTitle}
          </p>
        </Link>

        {/* Signal Metric & Info Trigger */}
        <div className="flex items-center gap-1 shrink-0 text-[#23a55a]">
          <Signal className="h-[15px] w-[15px]" />
          <Info className="h-[14px] w-[14px] text-[#949ba4] hover:text-[#dbdee1] cursor-pointer" />
        </div>
      </div>

      {/* Control Bar (Mute, Deafen, Disconnect) */}
      <div className="flex items-center justify-end border-t border-[#3f4147]/40 pt-2 px-1">
        <VoiceControlBar size="sm" className="w-full justify-between" />
      </div>
    </div>
  );

  return (
    <div
      className="absolute inset-x-0 z-20 px-2"
      style={{
        bottom: "calc(var(--floating-bar-gap) + var(--floating-user-panel-height) + 8px)",
      }}
    >
      {PanelContent}
    </div>
  );
}

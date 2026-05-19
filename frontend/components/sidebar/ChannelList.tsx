"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Hash, Volume2, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useRoomStore } from "@/stores/roomStore";
import { useChatStore } from "@/stores/chatStore";
import type { Channel } from "@/types";

function ChannelItem({
  roomId,
  channel,
  isActive,
  onClick,
}: {
  roomId: string;
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  const { fetchUnreadCount, unreadCounts } = useChatStore();

  useEffect(() => {
    // Only fetch if we don't already have it
    if (!unreadCounts[channel.id]) {
      fetchUnreadCount(roomId, channel.id);
    }
  }, [roomId, channel.id]); // Removed fetchUnreadCount to prevent re-fetch loop if function reference changes

  const unreadData = unreadCounts[channel.id];
  const hasUnread = unreadData && unreadData.count > 0 && !isActive;

  const Icon = channel.type === "TEXT" ? Hash : Volume2;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[15px] transition-colors duration-150 cursor-pointer",
        isActive
          ? "bg-secondary text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
        hasUnread && !isActive && "text-foreground font-medium"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", hasUnread ? "text-foreground opacity-100" : "opacity-60")} />
        <span className="truncate">{channel.name}</span>
      </div>

      {hasUnread && (
        <div className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none">
          {unreadData.displayCount}
        </div>
      )}
    </button>
  );
}

function ChannelCategory({
  roomId,
  title,
  channels,
  activeChannelId,
  onChannelClick,
}: {
  roomId: string;
  title: string;
  channels: Channel[];
  activeChannelId: string | null;
  onChannelClick: (channelId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1 px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="space-y-0.5 px-1">
          {channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              roomId={roomId}
              channel={ch}
              isActive={ch.id === activeChannelId}
              onClick={() => onChannelClick(ch.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChannelList() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const { rooms, channels } = useRoomStore();

  // Derive active channel from URL params
  const activeChannelId = (params?.channelId as string) || null;
  let activeRoomId: string | null = null;

  if (activeChannelId) {
    for (const [rId, cList] of Object.entries(channels)) {
      if (cList.some((c) => c.id === activeChannelId)) {
        activeRoomId = rId;
        break;
      }
    }
  }

  // If on dashboard or no active room, fallback to empty or first room
  const displayRoomId = activeRoomId || (rooms.length > 0 ? rooms[0].id : null);
  const room = rooms.find((r) => r.id === displayRoomId);
  const roomChannels = displayRoomId ? (channels[displayRoomId] || []) : [];

  const textChannels = roomChannels.filter((c) => c.type === "TEXT");
  const voiceChannels = roomChannels.filter((c) => c.type === "VOICE");

  function handleChannelClick(channelId: string) {
    router.push(`/channels/${channelId}`);
  }

  return (
    <div
      className="flex h-full flex-col bg-[#2b2d31]"
      style={{ width: sidebarWidth }}
    >
      {/* Server Name Header */}
      <button className="flex h-12 items-center justify-between px-4 text-[15px] font-semibold text-foreground hover:bg-secondary/50 transition-colors cursor-pointer shadow-sm">
        <span className="truncate">{room?.name || "Server"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {/* Channel List */}
      <ScrollArea className="flex-1 px-3 pt-4">
        {displayRoomId && (
          <>
            <ChannelCategory
              roomId={displayRoomId}
              title={t("channels.textChannels")}
              channels={textChannels}
              activeChannelId={activeChannelId}
              onChannelClick={handleChannelClick}
            />
            <ChannelCategory
              roomId={displayRoomId}
              title={t("channels.voiceChannels")}
              channels={voiceChannels}
              activeChannelId={activeChannelId}
              onChannelClick={handleChannelClick}
            />
          </>
        )}
      </ScrollArea>
    </div>
  );
}

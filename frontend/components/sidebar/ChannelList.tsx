"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Hash, Volume2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useRoomStore } from "@/stores/roomStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";
import { CreateChannelModal } from "../server/CreateChannelModal";
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
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const count = getUnreadCount(channel.id);
  const hasUnread = count > 0 && !isActive;

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
          {count > 99 ? "99+" : count}
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
  onAddClick,
}: {
  roomId: string;
  title: string;
  channels: Channel[];
  activeChannelId: string | null;
  onChannelClick: (channelId: string) => void;
  onAddClick?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between group/category px-1 py-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-1 items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-[#dbdee1] transition-colors cursor-pointer"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="truncate">{title}</span>
        </button>
        {onAddClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
            className="text-[#949ba4] hover:text-white transition-colors duration-150 cursor-pointer hidden group-hover/category:block"
            aria-label="Create Channel"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
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
  const { rooms, channels, getMyRoleInRoom } = useRoomStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<"TEXT" | "VOICE">("TEXT");

  // Derive active channel and room from URL params
  const activeChannelId = (params?.channelId as string) || null;
  const activeRoomId = (params?.serverId as string) || null;

  // If on dashboard or no active room, fallback to empty or first room
  const displayRoomId = activeRoomId || (rooms.length > 0 ? rooms[0].id : null);
  const room = rooms.find((r) => r.id === displayRoomId);
  const roomChannels = displayRoomId ? (channels[displayRoomId] || []) : [];

  const textChannels = roomChannels.filter((c) => c.type === "TEXT");
  const voiceChannels = roomChannels.filter((c) => c.type === "VOICE");

  const myRole = displayRoomId && currentUserId ? getMyRoleInRoom(displayRoomId, currentUserId) : null;
  const canCreateChannel = myRole === "OWNER" || myRole === "ADMIN";

  function handleChannelClick(channelId: string) {
    if (displayRoomId) {
      router.push(`/channels/${displayRoomId}/${channelId}`);
    } else {
      router.push(`/channels/${channelId}`);
    }
  }

  function handleAddChannel(type: "TEXT" | "VOICE") {
    setCreateDefaultType(type);
    setIsCreateOpen(true);
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
              onAddClick={canCreateChannel ? () => handleAddChannel("TEXT") : undefined}
            />
            <ChannelCategory
              roomId={displayRoomId}
              title={t("channels.voiceChannels")}
              channels={voiceChannels}
              activeChannelId={activeChannelId}
              onChannelClick={handleChannelClick}
              onAddClick={canCreateChannel ? () => handleAddChannel("VOICE") : undefined}
            />
          </>
        )}
      </ScrollArea>

      {isCreateOpen && displayRoomId && (
        <CreateChannelModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          roomId={displayRoomId}
          defaultType={createDefaultType}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Hash, Volume2, ChevronDown, ChevronRight, Plus, Settings, MicOff, HeadphoneOff, UserPlus, Sparkles, FolderPlus, Calendar, Compass, Shield, Pencil, EyeOff, Bell } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useRoomStore } from "@/stores/roomStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { soundEngine } from "@/lib/soundEngine";
import { CreateChannelModal } from "@/components/server/CreateChannelModal";
import { EditChannelModal } from "@/components/server/EditChannelModal";
import { InviteModal } from "@/components/server/InviteModal";
import { ServerSettingsModal } from "@/components/server/ServerSettingsModal";
import { NotificationSettingsModal } from "@/components/server/NotificationSettingsModal";
import type { Channel } from "@/types";



interface ChannelItemProps {
  roomId: string;
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  onSettingsClick?: (channel: Channel) => void;
  onInviteClick?: () => void;
  canEdit: boolean;
}

const EMPTY_PARTICIPANTS: unknown[] = [];

function ChannelItem({
  roomId,
  channel,
  isActive,
  onClick,
  onSettingsClick,
  onInviteClick,
  canEdit,
}: ChannelItemProps) {
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const count = getUnreadCount(channel.id);
  const hasUnread = count > 0 && !isActive;

  const participants = useVoiceStore((s) => s.channelParticipants[channel.id] || EMPTY_PARTICIPANTS);
  const Icon = channel.type === "TEXT" ? Hash : Volume2;

  return (
    <div className="flex flex-col">
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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon className={cn("h-4 w-4 shrink-0", hasUnread ? "text-foreground opacity-100" : "opacity-60")} />
          <span className="truncate text-[14px]">{channel.name}</span>
        </div>

        {hasUnread && (
          <div className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none group-hover:hidden">
            {count > 99 ? "99+" : count}
          </div>
        )}

        <div className="hidden group-hover:flex items-center gap-1.5 ml-2 select-none duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInviteClick?.();
            }}
            className="text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            aria-label="Invite to channel"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSettingsClick?.(channel);
              }}
              className="text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
              aria-label="Channel Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </button>

      {/* Voice Participants List */}
      {channel.type === "VOICE" && participants.length > 0 && (
        <div className="space-y-0.5 mt-0.5 mb-1.5 pl-6 pr-2">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 py-0.5 rounded transition-colors group/participant cursor-default"
            >
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.username}
                  className="h-5 w-5 rounded-full shrink-0 object-cover"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-[#5865f2]/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[#5865f2] uppercase">
                    {p.username.substring(0, 2)}
                  </span>
                </div>
              )}
              <span className="text-[13px] text-[#949ba4] font-medium truncate select-none">
                {p.username}
              </span>
              <div className="flex items-center gap-0.5 ml-auto shrink-0">
                {p.deafened && <HeadphoneOff className="h-3.5 w-3.5 text-[#ed4245]" />}
                {p.muted && !p.deafened && <MicOff className="h-3.5 w-3.5 text-[#ed4245]" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChannelCategoryProps {
  roomId: string;
  title: string;
  channels: Channel[];
  activeChannelId: string | null;
  onChannelClick: (channelId: string) => void;
  onAddClick?: () => void;
  onSettingsClick?: (channel: Channel) => void;
  onInviteClick?: (channel: Channel) => void;
  canEdit: boolean;
}

function ChannelCategory({
  roomId,
  title,
  channels,
  activeChannelId,
  onChannelClick,
  onAddClick,
  onSettingsClick,
  onInviteClick,
  canEdit,
}: ChannelCategoryProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between group/category px-1 py-1.5 select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-[#dbdee1] transition-colors cursor-pointer min-w-0"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
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
            className="text-[#949ba4] hover:text-white transition-colors duration-150 cursor-pointer block shrink-0"
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
              onSettingsClick={onSettingsClick}
              onInviteClick={() => onInviteClick?.(ch)}
              canEdit={canEdit}
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
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  const { rooms, channels, getMyRoleInRoom } = useRoomStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<"TEXT" | "VOICE">("TEXT");
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteChannelName, setInviteChannelName] = useState("");
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);

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
  const canEditChannel = myRole === "OWNER" || myRole === "ADMIN";

  useEffect(() => {
    if (displayRoomId && voiceChannels.length > 0) {
      useVoiceStore.getState().fetchVoiceStates(displayRoomId, voiceChannels.map(c => c.id));
    }
  }, [displayRoomId, voiceChannels.length]);

  function handleChannelClick(channelId: string) {
    const channel = roomChannels.find(c => c.id === channelId);
    if (channel?.type === "VOICE") {
      useVoiceStore.getState().joinVoiceChannel(displayRoomId!, channelId);
    }
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
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex h-12 w-full items-center justify-between px-4 text-[15px] font-semibold text-foreground hover:bg-secondary/50 transition-colors cursor-pointer shadow-sm"
        >
          <span className="truncate">{room?.name || "Server"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>

        {isDropdownOpen && (
          <>
            <div
              onClick={() => setIsDropdownOpen(false)}
              className="fixed inset-0 z-40 bg-transparent"
            />
            <div className="absolute top-[48px] left-2 right-2 z-50 rounded-md bg-[#111214] p-1.5 shadow-xl flex flex-col gap-0.5 text-[13px] border border-[#2b2d31]/80 w-[220px] select-none">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsServerSettingsOpen(true);
                }}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                <span>{t("serverDropdown.settings")}</span>
                <Settings className="h-4 w-4 shrink-0 opacity-60" />
              </button>

              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setInviteChannelName("");
                  setIsInviteOpen(true);
                }}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                <span>{t("serverDropdown.invite")}</span>
                <UserPlus className="h-4 w-4 shrink-0 opacity-60" />
              </button>

              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleAddChannel("TEXT");
                }}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                <span>{t("serverDropdown.createChannel")}</span>
                <Plus className="h-4 w-4 shrink-0 opacity-60" />
              </button>

              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsNotificationSettingsOpen(true);
                }}
                className="w-full flex items-center justify-between rounded px-2 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                <span>{t("serverDropdown.notificationSettings")}</span>
                <Bell className="h-4 w-4 shrink-0 opacity-60" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Channel List */}
      <ScrollArea className="flex-1 px-3 pt-4">
        {displayRoomId && (
          <div className="pb-[var(--floating-user-panel-offset)]">
            <ChannelCategory
              roomId={displayRoomId}
              title={t("channels.textChannels")}
              channels={textChannels}
              activeChannelId={activeChannelId}
              onChannelClick={handleChannelClick}
              onAddClick={() => handleAddChannel("TEXT")}
              onSettingsClick={setEditChannel}
              onInviteClick={(ch) => {
                setInviteChannelName(ch.name);
                setIsInviteOpen(true);
              }}
              canEdit={true}
            />
            <ChannelCategory
              roomId={displayRoomId}
              title={t("channels.voiceChannels")}
              channels={voiceChannels}
              activeChannelId={activeChannelId}
              onChannelClick={handleChannelClick}
              onAddClick={() => handleAddChannel("VOICE")}
              onSettingsClick={setEditChannel}
              onInviteClick={(ch) => {
                setInviteChannelName(ch.name);
                setIsInviteOpen(true);
              }}
              canEdit={true}
            />
          </div>
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

      {editChannel && displayRoomId && (
        <EditChannelModal
          isOpen={!!editChannel}
          onClose={() => setEditChannel(null)}
          roomId={displayRoomId}
          channel={editChannel}
        />
      )}

      {isInviteOpen && displayRoomId && (
        <InviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          roomId={displayRoomId}
          roomName={room?.name || "Server"}
          channelName={inviteChannelName || roomChannels.find(c => c.type === "TEXT")?.name || "general"}
        />
      )}

      {isServerSettingsOpen && displayRoomId && (
        <ServerSettingsModal
          isOpen={isServerSettingsOpen}
          onClose={() => setIsServerSettingsOpen(false)}
          roomId={displayRoomId}
        />
      )}

      {isNotificationSettingsOpen && displayRoomId && (
        <NotificationSettingsModal
          isOpen={isNotificationSettingsOpen}
          onClose={() => setIsNotificationSettingsOpen(false)}
          roomId={displayRoomId}
          roomName={room?.name || "Server"}
        />
      )}
    </div>
  );
}


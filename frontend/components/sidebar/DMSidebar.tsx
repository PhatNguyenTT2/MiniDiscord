"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Users, Plus, X } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { NewMessageModal } from "@/components/dm/NewMessageModal";
import { UnreadBadge } from "@/components/ui/UnreadBadge";

interface DmEntry {
  roomId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  recipientStatus: string;
  channelId: string | null;
  createdAt: string;
}

function DMItem({
  dm,
  isActive,
  unreadCount,
  onClick,
}: {
  dm: DmEntry;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer",
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      )}
    >
      <StatusAvatar
        src={dm.recipientAvatar}
        fallback={dm.recipientName}
        status={dm.recipientStatus as any}
        size="md"
      />
      <span className="flex-1 truncate text-left text-[15px] font-medium">
        {dm.recipientName}
      </span>
      {unreadCount > 0 && (
        <UnreadBadge count={unreadCount} variant="inline" className="group-hover:hidden" />
      )}
      <span
        onClick={(e) => {
          e.stopPropagation();
          // TODO: remove DM from list
        }}
        className="hidden h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground group-hover:flex"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </span>
    </button>
  );
}

export function DMSidebar({ activeUserId }: { activeUserId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const unreadCounts = useNotificationStore((s) => s.unreadCounts);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);

  const isDashboard = pathname?.startsWith("/channels/me");

  // Derive DM list from roomStore
  const rooms = useRoomStore((s) => s.rooms);
  const channels = useRoomStore((s) => s.channels);
  const members = useRoomStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const lastActivityMap = useRoomStore((s) => s.lastActivityMap);

  const dmEntries = useMemo<DmEntry[]>(() => {
    const dmRooms = rooms.filter(r => r.type === "DM");
    console.log("[DMSidebar] computing dmEntries:", { currentUserId, dmRooms: dmRooms.length, membersKeys: Object.keys(members) });
    if (!currentUserId) return [];

    const entries: DmEntry[] = [];
    for (const room of rooms) {
      if (room.type !== "DM") continue;

      const roomMembers = members[room.id];
      if (!roomMembers) continue;

      // Find the OTHER user in this DM room
      const otherUser = roomMembers.find(m => m.userId !== currentUserId);
      if (!otherUser) continue;

      const channelId = channels[room.id]?.[0]?.id || null;

      entries.push({
        roomId: room.id,
        recipientId: otherUser.userId,
        recipientName: otherUser.username,
        recipientAvatar: otherUser.avatarUrl,
        recipientStatus: otherUser.status || "OFFLINE",
        channelId,
        createdAt: room.createdAt,
      });
    }

    // De-duplicate by recipientId — keep only the room with the latest activity
    const deduped = new Map<string, DmEntry>();
    for (const entry of entries) {
      const existing = deduped.get(entry.recipientId);
      if (!existing) {
        deduped.set(entry.recipientId, entry);
      } else {
        const existingTime = lastActivityMap[existing.roomId] || new Date(existing.createdAt).getTime();
        const entryTime = lastActivityMap[entry.roomId] || new Date(entry.createdAt).getTime();
        if (entryTime > existingTime) {
          deduped.set(entry.recipientId, entry);
        }
      }
    }

    // Sort by newest activity first (last message time), fallback to room creation
    return Array.from(deduped.values()).sort((a, b) => {
      const aTime = lastActivityMap[a.roomId] || new Date(a.createdAt).getTime();
      const bTime = lastActivityMap[b.roomId] || new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [rooms, members, currentUserId, lastActivityMap]);

  function handleCreateDM(userIds: string[]) {
    if (userIds.length > 0) {
      router.push(`/channels/me/${userIds[0]}`);
    }
  }

  return (
    <>
      <div
        className="flex h-full flex-col bg-[#2b2d31]"
        style={{ width: sidebarWidth }}
      >
        {/* Search bar */}
        <div className="flex h-12 items-center px-3">
          <button className="flex h-7 w-full items-center rounded-md bg-background-tertiary px-2 text-[13px] text-muted-foreground transition-colors hover:bg-background-tertiary/80 cursor-pointer">
            {t("sidebar.searchOrStart")}
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 pt-3 pb-[var(--floating-user-panel-offset)]">
            {/* Friends nav */}
            <button
              onClick={() => router.push("/channels/me")}
              className={cn(
                "flex w-full items-center gap-4 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors cursor-pointer",
                isDashboard && !activeUserId
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Users className="h-5 w-5 shrink-0" />
              <span>{t("sidebar.friends")}</span>
            </button>

            {/* DM Header */}
            <div className="mt-6 mb-1 flex items-center justify-between px-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("sidebar.directMessages")}
              </h3>
              <button
                onClick={() => setIsNewMessageModalOpen(true)}
                aria-label={t("sidebar.createDM")}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* DM list — derived from backend DM rooms */}
            <div className="mt-1 space-y-0.5">
              {dmEntries.map((dm) => (
                <DMItem
                  key={dm.roomId}
                  dm={dm}
                  unreadCount={dm.channelId ? (unreadCounts[dm.channelId] ?? 0) : 0}
                  isActive={activeUserId === dm.recipientId}
                  onClick={() => {
                    router.push(`/channels/me/${dm.recipientId}`);
                  }}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* New Message Modal */}
      {isNewMessageModalOpen && (
        <NewMessageModal
          onClose={() => setIsNewMessageModalOpen(false)}
          onCreateDM={handleCreateDM}
        />
      )}
    </>
  );
}


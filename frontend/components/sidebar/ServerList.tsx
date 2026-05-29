"use client";

import { useState } from "react";

import { useRouter, useParams, usePathname } from "next/navigation";
import { ServerIcon } from "@/components/ui/ServerIcon";
import { Separator } from "@/components/ui/Separator";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Plus, MessageCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { useEffect } from "react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CreateServerModal } from "@/components/server/CreateServerModal";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRoomStore } from "@/stores/roomStore";

export function ServerList() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [showCreateServer, setShowCreateServer] = useState(false);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);

  const { rooms, channels } = useRoomStore();

  // Derive active room from current URL
  const activeRoomId = (params?.serverId as string) || null;
  const isDashboard = pathname?.includes("/channels/@me") || pathname?.startsWith("/channels/me") || pathname === "/channels";

  function handleServerClick(roomId: string) {
    const roomChannels = channels[roomId] || [];
    if (roomChannels.length > 0) {
      const defaultChannel = roomChannels.find((c) => c.type === "TEXT") || roomChannels[0];
      router.push(`/channels/${roomId}/${defaultChannel.id}`);
    }
  }

  return (
    <div className="flex h-full w-[72px] flex-col items-center bg-background-tertiary py-3">
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center gap-2 px-3">
          {/* DM Button — navigates to /channels/@me */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push("/channels/@me")}
                className={cn(
                  "flex h-12 w-12 items-center justify-center transition-all duration-200 cursor-pointer",
                  isDashboard
                    ? "rounded-[16px] bg-accent"
                    : "rounded-full bg-background-secondary hover:rounded-[16px] hover:bg-accent"
                )}
              >
                <MessageCircle className="h-6 w-6 text-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("sidebar.directMessages")}
            </TooltipContent>
          </Tooltip>

          <Separator className="mx-auto w-8" />

          {/* Server icons (exclude DM rooms — those belong in DMSidebar) */}
          {rooms.filter(room => room.type !== "DM").map((room) => {
            const roomChannels = channels[room.id] || [];
            const roomUnreadCount = roomChannels.reduce((sum, ch) => sum + getUnreadCount(ch.id), 0);
            return (
              <ServerIcon
                key={room.id}
                name={room.name}
                iconUrl={room.iconUrl}
                isActive={activeRoomId === room.id}
                hasNotification={roomUnreadCount > 0}
                unreadCount={roomUnreadCount}
                onClick={() => handleServerClick(room.id)}
              />
            );
          })}

          <Separator className="mx-auto w-8" />

          {/* Add Server */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowCreateServer(true)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full bg-background-secondary transition-all duration-200 cursor-pointer",
                  "hover:rounded-[16px] hover:bg-success"
                )}
              >
                <Plus className="h-6 w-6 text-success group-hover:text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("sidebar.addServer")}
            </TooltipContent>
          </Tooltip>
        </div>
      </ScrollArea>

      <CreateServerModal
        isOpen={showCreateServer}
        onClose={() => setShowCreateServer(false)}
      />
    </div>
  );
}

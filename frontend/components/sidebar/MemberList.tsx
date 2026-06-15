"use client";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MemberDetailResponse } from "@/types";
import { MemberProfilePopover } from "@/components/chat/MemberProfilePopover";

export function MemberList() {
  const { t } = useTranslation();
  const params = useParams();
  const { members, fetchMembers, memberHasMore } = useRoomStore();

  const activeRoomId = (params?.serverId as string) || null;

  // Initial load
  useEffect(() => {
    if (activeRoomId) {
      fetchMembers(activeRoomId);
    }
  }, [activeRoomId, fetchMembers]);

  const roomMembers = activeRoomId ? (members[activeRoomId] || []) : [];
  const hasMore = activeRoomId ? (memberHasMore[activeRoomId] ?? true) : false;

  const online = roomMembers.filter((u) => u.status !== "OFFLINE");
  const offline = roomMembers.filter((u) => u.status === "OFFLINE");

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || !activeRoomId) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && roomMembers.length > 0) {
        const lastMember = roomMembers[roomMembers.length - 1];
        fetchMembers(activeRoomId, lastMember.joinedAt);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeRoomId, hasMore, roomMembers, fetchMembers]);

  if (!activeRoomId) return null;

  return (
    <div className="flex h-full w-[240px] flex-col bg-[#2b2d31] border-l border-border relative">
      <ScrollArea className="flex-1 px-2 pt-4">
        <MemberSection
          title={`${t("members.online")} — ${online.length}`}
          users={online}
          roomId={activeRoomId}
        />
        <MemberSection
          title={`${t("members.offline")} — ${offline.length}`}
          users={offline}
          roomId={activeRoomId}
        />
        {hasMore && <div ref={sentinelRef} className="h-4" />}
      </ScrollArea>
    </div>
  );
}

function MemberSection({
  title,
  users,
  roomId,
}: {
  title: string;
  users: MemberDetailResponse[];
  roomId: string;
}) {
  return (
    <div className="mb-6 font-sans">
      <h3 className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5 px-2">
        {users.map((user) => (
          <MemberProfilePopover
            key={user.userId}
            userId={user.userId}
            username={user.username}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            status={user.status}
            roomId={roomId}
            side="left"
            align="center"
          >
            <button
              className="group flex w-full items-center gap-3 rounded-md px-3 py-1.5 transition-colors duration-150 hover:bg-secondary/50 cursor-pointer text-left outline-none"
            >
              <StatusAvatar
                src={user.avatarUrl}
                fallback={user.username}
                status={user.status as "ONLINE" | "OFFLINE" | "IDLE" | "DND"}
                size="md"
              />
              <span className="truncate text-[15px] font-medium text-[#dbdee1] group-hover:text-white transition-colors">
                {user.displayName || user.username}
              </span>
            </button>
          </MemberProfilePopover>
        ))}
      </div>
    </div>
  );
}

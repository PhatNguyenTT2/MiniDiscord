"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import {
  X,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
  Calendar,
} from "lucide-react";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/lib/api";

function formatDate(dateStr: string, locale: string = "vi-VN") {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getMutualServers(userId: string): { id: string; name: string; description: string; iconUrl?: string }[] {
  const { rooms, members } = useRoomStore.getState();
  return rooms
    .filter(r => r.type === "GROUP")
    .filter(r => members[r.id]?.some(m => m.userId === userId))
    .map(r => ({ id: r.id, name: r.name, description: "", iconUrl: r.iconUrl || undefined }));
}

/* ─── Full Profile Modal (2-column layout) ─────────────────────────── */
function UserProfileModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "activity" | "mutual" | "servers"
  >("activity");
  const [note, setNote] = useState("");
  const mutualServers = getMutualServers(user.id);
  const isFriend = true;
  const { t } = useTranslation();

  const TABS = [
    { key: "activity" as const, label: t("dm.activity") },
    { key: "mutual" as const, label: t("dm.noMutualFriends") },
    {
      key: "servers" as const,
      label: t("dm.mutualServersCount").replace("{count}", mutualServers.length.toString()),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 flex w-[880px] max-w-[90vw] h-[560px] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl border border-border/50 bg-background-secondary animate-in fade-in zoom-in-95 duration-200">
        {/* ─── Column 1: Profile Info ─── */}
        <div className="flex w-[300px] shrink-0 flex-col">
          {/* Banner */}
          <div className="h-[120px] bg-accent shrink-0" />

          {/* Profile content */}
          <div className="flex flex-1 flex-col px-4">
            {/* Avatar overlapping banner */}
            <div className="relative -mt-12 mb-2">
              <StatusAvatar
                src={user.avatarUrl}
                fallback={user.username}
                status={user.status}
                size="xl"
              />
            </div>

            <h2 className="text-xl font-bold text-foreground">
              {user.displayName || user.username}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user.username}
            </p>

            <div className="mt-3 flex items-center gap-2">
              {isFriend ? (
                <Button size="sm" className="text-xs h-8 gap-1.5 bg-success hover:bg-success/80">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t("dm.messageAction")}
                </Button>
              ) : (
                <Button size="sm" className="text-xs h-8 gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  {t("dm.addFriendAction")}
                </Button>
              )}
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <UserPlus className="h-4 w-4" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="my-3 border-t border-border" />

            <div className="mb-3">
              <p className="text-xs font-bold text-foreground">{t("dm.memberSince")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-foreground">
                {t("dm.note")}
              </p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("dm.notePlaceholder")}
                className="mt-1 w-full rounded-md bg-background-tertiary px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none border border-transparent focus:border-accent transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ─── Column 2: Tabs Content ─── */}
        <div className="flex flex-1 flex-col min-w-0 bg-background">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-4 border-b border-border px-4 pt-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "pb-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px",
                  activeTab === tab.key
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {activeTab === "activity" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t("dm.noActivity").replace("{username}", user.displayName || user.username)}
                  </p>
                  <p className="mt-2 max-w-[280px] text-xs text-muted-foreground leading-relaxed">
                    {t("dm.noActivityDesc")}
                  </p>
                </div>
              )}

              {activeTab === "mutual" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t("dm.noMutualFriendsDesc")}
                  </p>
                  <p className="mt-2 max-w-[280px] text-xs text-muted-foreground leading-relaxed">
                    {t("dm.noMutualFriendsDetail")}
                  </p>
                </div>
              )}

              {activeTab === "servers" && (
                <div className="space-y-1">
                  {mutualServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center gap-3 rounded-md p-2.5 hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-accent text-sm font-semibold text-foreground shrink-0">
                        {server.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {t("dm.serverOf").replace("{serverName}", server.name)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {server.description}
                        </p>
                      </div>
                    </div>
                  ))}
                  {mutualServers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        {t("dm.noMutualServers")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

/* ─── Column 4: DM User Info Panel (Discord-accurate) ──────────────── */
export function DmUserPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [showProfile, setShowProfile] = useState(false);
  const [apiUser, setApiUser] = useState<User | null>(null);

  const friends = useFriendStore((s) => s.friends);
  const { members: allMembers, getDmRoomForUser } = useRoomStore();

  useEffect(() => {
    // Lazy fetch full user profile to get `createdAt` and fresh data when panel mounts
    let isMounted = true;
    api.get<{ data: User }>(`/users/${userId}`)
      .then(res => {
        if (isMounted) setApiUser(res.data.data);
      })
      .catch(console.error);
    return () => { isMounted = false; };
  }, [userId]);

  // Resolve user from multiple sources
  const friendEntry = friends.find((f) => f.user.id === userId);
  const dmRoom = getDmRoomForUser(userId);
  const roomMember = dmRoom?.roomId
    ? allMembers[dmRoom.roomId]?.find((m) => m.userId === userId)
    : null;

  const resolvedDisplayName = apiUser?.displayName || friendEntry?.user.displayName || roomMember?.displayName || apiUser?.username || friendEntry?.user.username || roomMember?.username;
  const resolvedUsername = apiUser?.username || friendEntry?.user.username || roomMember?.username;
  if (!resolvedDisplayName || !resolvedUsername) return null;

  const user = {
    id: userId,
    username: resolvedUsername,
    displayName: resolvedDisplayName,
    avatarUrl: apiUser?.avatarUrl || friendEntry?.user.avatarUrl || roomMember?.avatarUrl || null,
    status: (friendEntry?.user.status || roomMember?.status || "OFFLINE") as User["status"],
    createdAt: apiUser?.createdAt || new Date().toISOString(),
  } as User;

  const mutualServers = getMutualServers(userId);

  return (
    <>
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-border bg-[#2b2d31]">
        {/* ─── Banner (Color Header) ─── */}
        <div className="relative h-[120px] shrink-0">
          {/* Banner gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800" />

          {/* Avatar: overlap banner → inner card boundary */}
          <div className="absolute -bottom-[40px] left-4 z-10">
            <div className="rounded-full border-[6px] border-[#111214]">
              <StatusAvatar
                src={user.avatarUrl}
                fallback={user.username}
                status={user.status}
                size="xl"
              />
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1">
          {/* ─── Inner Profile Card (Dark card) ─── */}
          <div className="mx-4 mt-2 rounded-xl bg-[#111214] p-4">
            {/* Spacer for avatar overlap */}
            <div className="h-[28px]" />

            {/* Username + tag */}
            <h3 className="text-xl font-bold text-white leading-tight">
              {user.displayName || user.username}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-0.5">
              {user.username}
            </p>

            {/* Separator */}
            <div className="my-3 h-px bg-white/10" />

            {/* ── GIỚI THIỆU VỀ TÔI (About Me) ── */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white mb-1">
                {t("dm.aboutMeUpper")}
              </p>
              <p className="text-[13px] text-[#dbdee1] leading-relaxed">
                {t("dm.hello").replace("{username}", user.displayName || user.username)}
              </p>
            </div>

            {/* Separator */}
            <div className="my-3 h-px bg-white/10" />

            {/* ── GIA NHẬP TỪ (Member Since) ── */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white mb-1.5">
                {t("dm.memberSince")}
              </p>
              <p className="flex items-center gap-1.5 text-[13px] text-[#b5bac1]">
                <Calendar className="h-3.5 w-3.5 text-[#b5bac1]" />
                {formatDate(user.createdAt)}
              </p>
            </div>

            {/* Separator */}
            <div className="my-3 h-px bg-white/10" />

            {/* ── MÁY CHỦ CHUNG (Mutual Servers) ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-white mb-2">
                {t("dm.mutualServersCount").replace("{count}", mutualServers.length.toString())}
              </p>
              <div className="space-y-1">
                {mutualServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-indigo-500 text-[11px] font-bold text-white shrink-0">
                      {server.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <span className="text-[13px] text-[#dbdee1] truncate">
                      {server.name}
                    </span>
                  </div>
                ))}
                {mutualServers.length === 0 && (
                  <p className="text-[13px] text-[#b5bac1] py-2">
                    {t("dm.noMutualServers")}
                  </p>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="my-3 h-px bg-white/10" />

            {/* ── GHI CHÚ (Note) ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-white mb-1.5">
                {t("dm.note")}
              </p>
              <input
                type="text"
                placeholder={t("dm.notePlaceholder")}
                className="w-full rounded-[4px] bg-transparent px-1 py-1 text-[13px] text-[#dbdee1] placeholder:text-[#b5bac1]/50 outline-none border border-transparent focus:border-white/20 transition-colors"
              />
            </div>
          </div>
        </ScrollArea>

        {/* ─── Bottom: View Full Profile ─── */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full rounded-[4px] bg-[#4e5058]/50 px-3 py-2 text-[13px] font-medium text-[#dbdee1] hover:bg-[#4e5058]/70 hover:text-white transition-colors cursor-pointer"
          >
            {t("dm.viewFullProfile")}
          </button>
        </div>
      </aside>

      {/* Full profile modal */}
      {showProfile &&
        typeof document !== "undefined" &&
        createPortal(
          <UserProfileModal user={user} onClose={() => setShowProfile(false)} />,
          document.body
        )}
    </>
  );
}

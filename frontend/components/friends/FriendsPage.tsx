"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { InboxPopover } from "../inbox/InboxPopover";
import {
  Users,
  MessageCircle,
  MoreVertical,
  Search,
  Check,
  X,
  Video,
  Phone,
  UserX,
  Inbox,
} from "lucide-react";
import { FriendUser, FriendResponse, PendingFriendResponse } from "@/types/friend";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FriendsTab = "online" | "all" | "pending" | "add";

/* ─── Context menu for friend "three dots" ─────────────────────────── */
function FriendContextMenu({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const items = [
    {
      icon: Video,
      label: t("friends.startVideoCall"),
      onClick: () => onClose(),
    },
    {
      icon: Phone,
      label: t("friends.startVoiceCall"),
      onClick: () => onClose(),
    },
    {
      icon: UserX,
      label: t("friends.removeFriendAction"),
      danger: true,
      onClick: () => onClose(),
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-20 mt-1 min-w-[220px] whitespace-nowrap rounded-md bg-background-floating border border-border p-1.5 shadow-xl"
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={item.onClick}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors cursor-pointer",
              item.danger
                ? "text-destructive hover:bg-destructive hover:text-white"
                : "text-foreground hover:bg-accent hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Header ───────────────────────────────────────────────────────── */
function FriendsHeader({
  activeTab,
  onTabChange,
  pendingCount,
}: {
  activeTab: FriendsTab;
  onTabChange: (tab: FriendsTab) => void;
  pendingCount: number;
}) {
  const { t } = useTranslation();

  const TABS: { key: FriendsTab; label: string; highlight?: boolean }[] = [
    { key: "online", label: t("friends.online") },
    { key: "all", label: t("friends.all") },
    { key: "pending", label: t("friends.pending") },
    { key: "add", label: t("friends.addFriend"), highlight: true },
  ];

  return (
    <div className="flex h-12 items-center gap-3 border-b border-border px-4">
      <div className="flex items-center gap-2 text-[15px] text-foreground font-semibold">
        <Users className="h-5 w-5" />
        <span>{t("friends.title")}</span>
      </div>

      <div className="mx-2 h-5 w-px bg-border" />

      <div className="flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "relative rounded-md px-3 py-1 text-[14px] font-medium transition-colors cursor-pointer",
              tab.highlight && activeTab !== tab.key
                ? "bg-success text-white hover:bg-success/80"
                : activeTab === tab.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center">
        <InboxPopover />
      </div>

    </div>
  );
}

function FriendItem({
  user,
  friendshipId,
  isPending,
  isIncoming,
  onAccept,
  onDecline,
}: {
  user: FriendUser;
  friendshipId?: string;
  isPending?: boolean;
  isIncoming?: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const statusKey = user.status.toLowerCase() as
    | "online"
    | "offline"
    | "idle"
    | "dnd";

  async function handleNavigate() {
    if (!isPending) {
      // Lazy DM: navigate immediately — room creation happens on first message send
      router.push(`/channels/me/${user.id}`);
    }
  }

  return (
    <div
      onClick={handleNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors border-t border-border/30",
        isPending
          ? "hover:bg-secondary/50"
          : "hover:bg-secondary/50 cursor-pointer"
      )}
    >
      <StatusAvatar
        src={user.avatarUrl}
        fallback={user.username}
        status={user.status as any}
        size="lg"
      />

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[15px] font-semibold text-foreground truncate leading-snug">
          {user.displayName || user.username}
        </p>
        <p className="text-[13px] text-muted-foreground leading-snug">
          {isPending
            ? isIncoming
              ? t("friends.incomingRequest")
              : t("friends.outgoingRequest")
            : t(`status.${statusKey}`)}
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-2",
          isPending
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <>
            {isIncoming && (
              <button
                onClick={() => friendshipId && onAccept?.(friendshipId)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-success transition-colors cursor-pointer"
                aria-label="Accept"
              >
                <Check className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => friendshipId && onDecline?.(friendshipId)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              aria-label="Reject"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleNavigate}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Message"
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="More"
              >
                <MoreVertical className="h-[18px] w-[18px]" />
              </button>
              {showMenu && (
                <FriendContextMenu
                  userId={user.id}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Online friends tab ───────────────────────────────────────────── */
function OnlineFriends({ friends }: { friends: FriendResponse[] }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const onlineFriends = friends.filter((f) => f.user.status !== "OFFLINE");

  const filteredFriends = onlineFriends.filter((f) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const nameMatches = f.user.username?.toLowerCase().includes(query) || false;
    const displayNameMatches = f.user.displayName?.toLowerCase().includes(query) || false;
    return nameMatches || displayNameMatches;
  });

  return (
    <div>
      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("friends.search")}
            className="h-8 w-full rounded-md bg-background-tertiary pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>
      <div className="px-6 mt-4">
        <h3 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("friends.onlineCount")} — {filteredFriends.length}
        </h3>
        {filteredFriends.map((f) => (
          <FriendItem key={f.friendshipId} user={f.user} friendshipId={f.friendshipId} />
        ))}
        {filteredFriends.length === 0 && (
          <p className="py-8 text-center text-[14px] text-muted-foreground">
            {t("friends.noOnline")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── All friends tab ──────────────────────────────────────────────── */
function AllFriends({ friends }: { friends: FriendResponse[] }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFriends = friends.filter((f) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const nameMatches = f.user.username?.toLowerCase().includes(query) || false;
    const displayNameMatches = f.user.displayName?.toLowerCase().includes(query) || false;
    return nameMatches || displayNameMatches;
  });

  return (
    <div>
      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("friends.search")}
            className="h-8 w-full rounded-md bg-background-tertiary pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>
      <div className="px-6 mt-4">
        <h3 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("friends.allCount")} — {filteredFriends.length}
        </h3>
        {filteredFriends.map((f) => (
          <FriendItem key={f.friendshipId} user={f.user} friendshipId={f.friendshipId} />
        ))}
      </div>
    </div>
  );
}

/* ─── Pending friends tab ──────────────────────────────────────────── */
function PendingFriends({
  pendingRequests,
  onAccept,
  onDecline,
}: {
  pendingRequests: PendingFriendResponse[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="px-6 pt-8">
      <h3 className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("friends.pendingCount")} — {pendingRequests.length}
      </h3>
      {pendingRequests.map((req) => (
        <FriendItem
          key={req.friendshipId}
          user={req.user}
          friendshipId={req.friendshipId}
          isPending
          isIncoming={req.incoming}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ))}
      {pendingRequests.length === 0 && (
        <p className="py-8 text-center text-[14px] text-muted-foreground">
          {t("friends.noPending")}
        </p>
      )}
    </div>
  );
}

/* ─── Add friend tab ───────────────────────────────────────────────── */
function AddFriend() {
  const [username, setUsername] = useState("");
  const { sendRequest } = useFriendStore();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSend() {
    if (!username.trim()) return;
    const name = username.trim();
    setFeedback(null);
    try {
      setIsSubmitting(true);
      await sendRequest(name);
      setFeedback({
        type: "success",
        message: t("friends.requestSent").replace("{name}", name),
      });
      setUsername("");
    } catch (err: any) {
      const serverMsg: string =
        err?.response?.data?.message || err?.message || "";

      let msg = t("friends.requestError");
      if (serverMsg.includes("not found")) {
        msg = t("friends.userNotFound");
      } else if (serverMsg.includes("already exists")) {
        msg = t("friends.alreadyExists");
      } else if (serverMsg.includes("yourself")) {
        msg = t("friends.cannotSelf");
      }

      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="px-6 pt-4">
      <h2 className="text-[16px] font-bold text-foreground">
        {t("friends.addTitle")}
      </h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {t("friends.addDescription")}
      </p>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (feedback) setFeedback(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={t("friends.addPlaceholder")}
            className={cn(
              "h-12 bg-background-tertiary border-accent/30 focus-visible:ring-accent transition-colors",
              feedback?.type === "success" && "border-green-500/50",
              feedback?.type === "error" && "border-red-500/50"
            )}
          />
        </div>
        <Button
          disabled={!username.trim() || isSubmitting}
          onClick={handleSend}
          className="h-12 px-6 text-[14px] font-medium cursor-pointer"
        >
          {isSubmitting ? "..." : t("friends.sendRequest")}
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <p
          className={cn(
            "mt-3 text-[14px] font-medium transition-all animate-in fade-in slide-in-from-top-1 duration-200",
            feedback.type === "success" ? "text-green-400" : "text-red-400"
          )}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */
export function FriendsPage() {
  const [activeTab, setActiveTab] = useState<FriendsTab>("online");
  const {
    friends,
    pendingRequests,
    isLoading,
    acceptFriend,
    declineOrRemoveFriend,
    getPendingCount
  } = useFriendStore();

  // No useEffect fetch here — data is prefetched in AuthGuard via usePrefetch hook

  return (
    <div className="flex h-full flex-col">
      <FriendsHeader activeTab={activeTab} onTabChange={setActiveTab} pendingCount={getPendingCount()} />

      <ScrollArea className="flex-1">
        {isLoading && friends.length === 0 ? (
          <div className="px-6 pt-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-secondary/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 rounded bg-secondary/60" />
                  <div className="h-3 w-16 rounded bg-secondary/40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {activeTab === "online" && <OnlineFriends friends={friends} />}
            {activeTab === "all" && <AllFriends friends={friends} />}
            {activeTab === "pending" && (
              <PendingFriends
                pendingRequests={pendingRequests}
                onAccept={acceptFriend}
                onDecline={declineOrRemoveFriend}
              />
            )}
            {activeTab === "add" && <AddFriend />}
          </>
        )}
      </ScrollArea>
    </div>
  );
}

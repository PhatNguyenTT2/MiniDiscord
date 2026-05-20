"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { DMSidebar } from "@/components/sidebar/DMSidebar";
import { DmUserPanel } from "@/components/dm/DmUserPanel";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageActions } from "@/components/chat/MessageActions";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Phone, Video, Pin, User, Reply, Server, UserPlus, FileIcon } from "lucide-react";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { SlidingPanel } from "@/components/ui/SlidingPanel";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";
import { getStompClient } from "@/lib/websocket";
import { type Message } from "@/types";

function getMutualServersCount(userId: string) {
  // TODO: Implement mutual servers logic with real API
  return 0;
}

import { cn } from "@/lib/utils";
import { useTranslation, getDateLocale } from "@/lib/i18n";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { useNotificationStore } from "@/stores/notificationStore";

// Stable empty array to prevent React getSnapshot caching issues
const EMPTY_DM: Message[] = [];

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 pb-0 space-y-6 overflow-hidden opacity-50">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-10 w-10 shrink-0 rounded-full bg-secondary" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-secondary rounded" />
              <div className="h-3 w-16 bg-secondary/50 rounded" />
            </div>
            <div className="h-4 bg-secondary rounded w-3/4" />
            <div className="h-4 bg-secondary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DmMessageItem({
  message,
  isGrouped,
  isBeingReplied,
  onReply,
  onReaction,
  currentUserId,
  memberAvatarMap,
  memberStatusMap,
}: {
  message: Message;
  isGrouped: boolean;
  isBeingReplied: boolean;
  onReply: () => void;
  onReaction?: (emoji: string) => void;
  currentUserId?: string;
  memberAvatarMap?: Record<string, string | null>;
  memberStatusMap?: Record<string, string>;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(getDateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fallback = message.senderName;
  // Avatar: prefer message payload, then fall back to roomStore member data
  const avatarSrc = message.senderAvatar || memberAvatarMap?.[message.senderId] || null;

  if (isGrouped) {
    return (
      <div
        className={cn(
          "group relative flex items-start gap-4 px-4 py-0 transition-colors",
          isBeingReplied
            ? "bg-accent/8 hover:bg-accent/12"
            : "hover:bg-secondary/30"
        )}
      >
        <span className="w-10 text-center text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 pt-0.5 leading-[1.375rem]">
          {time}
        </span>
        <div className="flex-1 min-w-0">
          {/* Reply reference */}
          {message.replyTo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <Reply className="h-3 w-3 rotate-180" />
              <span className="font-semibold text-accent cursor-pointer hover:underline">
                @{message.replyTo.senderName}
              </span>
              <span className="truncate">{message.replyTo.content}</span>
            </div>
          )}
          <p className="text-[0.9375rem] leading-[1.375rem] text-foreground">
            {message.content.trim()}
          </p>
          {/* Attachment */}
          {message.fileUrl && (
            <div className="mt-2">
              {message.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.fileUrl}
                    alt={message.fileName || "attachment"}
                    className="max-w-full sm:max-w-[400px] max-h-[300px] object-cover rounded-md shadow-sm border border-border/50"
                    loading="lazy"
                  />
                </a>
              ) : (
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded bg-secondary/50 border border-border/50 max-w-[400px] hover:bg-secondary/80 transition-colors"
                >
                  <FileIcon className="h-8 w-8 text-accent shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium text-blue-400 hover:underline truncate">
                      {message.fileName || "Unknown file"}
                    </span>
                    {message.fileSize && (
                      <span className="text-[12px] text-muted-foreground mt-0.5">
                        {Math.round(message.fileSize / 1024)} KB
                      </span>
                    )}
                  </div>
                </a>
              )}
            </div>
          )}
          {/* Reaction badges */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((reaction, i) => {
                const hasReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
                return (
                  <button
                    key={`${reaction.emoji}-${i}`}
                    onClick={() => onReaction?.(reaction.emoji)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs transition-colors cursor-pointer",
                      hasReacted
                        ? "bg-[#5865F2]/20 border border-[#5865F2]"
                        : "bg-[#2b2d31] border border-transparent hover:border-border"
                    )}
                  >
                    <span>{reaction.emoji}</span>
                    <span className={cn("font-medium", hasReacted ? "text-[#5865F2]" : "text-muted-foreground")}>
                      {reaction.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <MessageActions onReply={onReply} onReaction={onReaction} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 px-4 pt-4 pb-0 transition-colors",
        isBeingReplied
          ? "bg-accent/8 hover:bg-accent/12"
          : "hover:bg-secondary/30"
      )}
    >
      <StatusAvatar
        src={avatarSrc}
        fallback={fallback}
        status={(message.senderId === currentUserId ? "ONLINE" : (memberStatusMap?.[message.senderId] || "OFFLINE")) as any}
        size="lg"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.9375rem] font-semibold text-foreground leading-[1.375rem] hover:underline cursor-pointer">
            {message.senderName}
          </span>
          <span className="text-[0.75rem] text-muted-foreground leading-[1.375rem]">
            {time}
          </span>
        </div>
        {/* Reply reference */}
        {message.replyTo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <Reply className="h-3 w-3 rotate-180" />
            <span className="font-semibold text-accent cursor-pointer hover:underline">
              @{message.replyTo.senderName}
            </span>
            <span className="truncate">{message.replyTo.content}</span>
          </div>
        )}
        <p className="text-[0.9375rem] leading-[1.375rem] text-foreground">
          {message.content.trim()}
        </p>
        {/* Attachment */}
        {message.fileUrl && (
          <div className="mt-2">
            {message.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.fileUrl}
                  alt={message.fileName || "attachment"}
                  className="max-w-full sm:max-w-[400px] max-h-[300px] object-cover rounded-md shadow-sm border border-border/50"
                  loading="lazy"
                />
              </a>
            ) : (
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded bg-secondary/50 border border-border/50 max-w-[400px] hover:bg-secondary/80 transition-colors"
              >
                <FileIcon className="h-8 w-8 text-accent shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium text-blue-400 hover:underline truncate">
                    {message.fileName || "Unknown file"}
                  </span>
                  {message.fileSize && (
                    <span className="text-[12px] text-muted-foreground mt-0.5">
                      {Math.round(message.fileSize / 1024)} KB
                    </span>
                  )}
                </div>
              </a>
            )}
          </div>
        )}
        {/* Reaction badges */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, i) => {
              const hasReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
              return (
                <button
                  key={`${reaction.emoji}-${i}`}
                  onClick={() => onReaction?.(reaction.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs transition-colors cursor-pointer",
                    hasReacted
                      ? "bg-[#5865F2]/20 border border-[#5865F2]"
                      : "bg-[#2b2d31] border border-transparent hover:border-border"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className={cn("font-medium", hasReacted ? "text-[#5865F2]" : "text-muted-foreground")}>
                    {reaction.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <MessageActions onReply={onReply} onReaction={onReaction} />
    </div>
  );
}

export default function DmChatPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { t } = useTranslation();
  const showDmUserPanel = useUIStore((s) => s.showDmUserPanel);
  const toggleDmUserPanel = useUIStore((s) => s.toggleDmUserPanel);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const handleResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  const friends = useFriendStore((s) => s.friends);
  const currentUser = useAuthStore((s) => s.user);

  // Get Room Mapping
  const { getDmRoomForUser, members: allMembers, findOrCreateDmRoom, isLoading: isLoadingRoom } = useRoomStore();
  const dmRoom = getDmRoomForUser(userId);
  const roomId = dmRoom?.roomId || "";
  const channelId = dmRoom?.channelId || "";

  // Resolve friend name from multiple sources
  const friend = friends.find((f) => f.user.id === userId);
  const roomMember = roomId
    ? allMembers[roomId]?.find((m) => m.userId === userId)
    : null;
  const friendName = friend?.user.username || roomMember?.username || "User";
  const friendAvatar = friend?.user.avatarUrl || roomMember?.avatarUrl || null;
  // Prefer friendStore (real-time PRESENCE_UPDATE), then roomStore.members (also synced)
  const friendStatus = friend?.user.status ?? roomMember?.status ?? "OFFLINE";

  // Build avatar lookup map for chat messages (covers both current user + recipient)
  const memberAvatarMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (roomId && allMembers[roomId]) {
      for (const m of allMembers[roomId]) {
        map[m.userId] = m.avatarUrl;
      }
    }
    // Also include current user's avatar
    if (currentUser?.id) {
      map[currentUser.id] = currentUser.avatarUrl || null;
    }
    return map;
  }, [roomId, allMembers, currentUser]);

  // Build status lookup map for chat messages (covers both current user + recipient)
  const memberStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (roomId && allMembers[roomId]) {
      for (const m of allMembers[roomId]) {
        map[m.userId] = m.status || "OFFLINE";
      }
    }
    // Also sync from friendStore for more accurate presence
    if (friend?.user) {
      map[friend.user.id] = friend.user.status || "OFFLINE";
    }
    return map;
  }, [roomId, allMembers, friend]);

  const [modalType, setModalType] = useState<"REMOVE_FRIEND" | "BLOCK" | null>(null);
  const [relationship, setRelationship] = useState<"friend" | "none" | "blocked">("friend");

  // Chat store — Read messages from global channel storage
  const messages = useChatStore((s) => s.getChannelMessages(channelId));
  const addReaction = useChatStore((s) => s.addReaction);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);
  const markChannelAsRead = useChatStore((s) => s.markChannelAsRead);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const isLoadingMessages = useChatStore((s) => s.isLoading);

  const token = useAuthStore((s) => s.token);

  const lastMarkedMsgRef = useRef<string | null>(null);

  // Auto-resolve DM room on mount
  useEffect(() => {
    if (!roomId && userId) {
      findOrCreateDmRoom(userId).catch(err => {
        console.error("Failed to find or create DM room:", err);
      });
    }
  }, [userId, roomId, findOrCreateDmRoom]);

  // Fetch message history when room/channel are available
  useEffect(() => {
    if (roomId && channelId) {
      fetchMessages(roomId, channelId).catch(err => {
        console.error("Failed to fetch messages:", err);
      });
    }
  }, [roomId, channelId, fetchMessages]);

  // Auto mask as read when viewing this channel
  useEffect(() => {
    if (messages.length > 0 && roomId && channelId) {
      const lastMessage = messages[messages.length - 1];
      if (lastMarkedMsgRef.current !== lastMessage.id) {
        lastMarkedMsgRef.current = lastMessage.id;
        markChannelAsRead(roomId, channelId, lastMessage.id);
      }
    }
  }, [messages, roomId, channelId, markChannelAsRead]);

  const handleSend = useCallback(
    (content: string, attachment?: { fileUrl: string; fileName: string; fileSize: number } | null) => {
      if (!roomId || !channelId) {
        console.error("[DM] Cannot send: roomId or channelId missing", { roomId, channelId });
        return;
      }
      if (!token) {
        console.error("[DM] Cannot send: no token");
        return;
      }
      const client = getStompClient(token);
      if (!client.connected) {
        console.error("[DM] Cannot send: STOMP not connected");
        return;
      }

      const payload = {
        roomId,
        channelId,
        content,
        senderName: currentUser?.username,
        senderAvatar: currentUser?.avatarUrl,
        fileUrl: attachment?.fileUrl,
        fileName: attachment?.fileName,
        fileSize: attachment?.fileSize,
        replyTo: replyingTo
          ? {
            messageId: replyingTo.messageId,
            content: replyingTo.content.slice(0, 100),
            senderName: replyingTo.senderName,
          }
          : null,
      };

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify(payload),
      });

      clearReplyingTo();
    },
    [channelId, roomId, token, replyingTo, clearReplyingTo]
  );

  // Auto-mark DM as read when entering
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  useEffect(() => {
    markAsRead(userId);
  }, [userId, markAsRead]);

  // Auto-scroll to bottom
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <>
      {/* Left shell combines columns 1 + 2 and keeps a bottom lane free for the floating user panel. */}
      <div
        className="relative flex shrink-0 flex-col bg-background-tertiary border-r border-border"
        style={{ paddingBottom: "var(--floating-user-panel-offset)" }}
      >
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ServerList />
          <DMSidebar activeUserId={userId} />
        </div>
        <UserPanel />
      </div>

      <ResizeHandle onResize={handleResize} />

      {/* Column 3 is the positioning context for the floating message composer. */}
      <main className="relative flex flex-1 min-w-0 flex-col bg-[#313338]">
        {/* DM Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-[#313338] px-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              @ {friendName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Phone className="h-5 w-5" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Video className="h-5 w-5" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Pin className="h-5 w-5" />
            </button>
            <button
              onClick={toggleDmUserPanel}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                showDmUserPanel
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Toggle user panel"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div
            className="flex min-h-full flex-col"
            style={{ paddingBottom: "var(--floating-message-input-offset)" }}
          >
            {/* ─── Welcome Header (Discord-accurate) ─── */}
            <div className="px-4 pt-4 pb-4">
              {/* Large Avatar */}
              <div className="mb-3">
                <StatusAvatar
                  src={friendAvatar}
                  fallback={friendName}
                  status={friendStatus as any}
                  size="xl"
                />
              </div>

              {/* Display Name */}
              <h2 className="text-[2rem] font-bold text-foreground leading-tight">
                {friendName}
              </h2>

              {/* Secondary Username */}
              <p className="text-[15px] text-muted-foreground mt-0.5">
                {friendName.toLowerCase()}
              </p>

              {/* Description */}
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {t("dm.welcomeMessage")}{" "}
                <strong className="font-semibold text-foreground">{friendName}</strong>.
              </p>

              {/* Mutual Servers + Action Buttons Row */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {/* Mutual Servers Badge */}
                {getMutualServersCount(userId) > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-[13px] text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    <span>{getMutualServersCount(userId)} {t("dm.mutualServers")}</span>
                  </div>
                )}

                {/* Relationship: friend → show Remove + Block */}
                {relationship === "friend" && (
                  <>
                    <button
                      onClick={() => setModalType("REMOVE_FRIEND")}
                      className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                    >
                      {t("dm.removeFriend")}
                    </button>
                    <button
                      onClick={() => setModalType("BLOCK")}
                      className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                    >
                      {t("dm.block")}
                    </button>
                  </>
                )}

                {/* Relationship: none → show Add Friend */}
                {relationship === "none" && (
                  <button
                    onClick={() => setRelationship("friend")}
                    className="flex items-center gap-1.5 rounded-[3px] bg-accent px-4 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors duration-150 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("dm.addFriend")}
                  </button>
                )}

                {/* Relationship: blocked → show Unblock + Report Spam */}
                {relationship === "blocked" && (
                  <>
                    <button
                      onClick={() => setRelationship("none")}
                      className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                    >
                      {t("dm.unblock")}
                    </button>
                    <button
                      className="rounded-[3px] bg-destructive px-4 py-1.5 text-[13px] font-medium text-white hover:bg-destructive/80 transition-colors duration-150 cursor-pointer"
                    >
                      {t("dm.reportSpam")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Date Divider */}
            <div className="relative mx-4 mb-3">
              <div className="h-px bg-border" />
            </div>

            {/* Messages */}
            {(isLoadingMessages && messages.length === 0) ? (
              <MessagesSkeleton />
            ) : (
              <div className="pb-2">
                {messages.map((msg, i) => {
                  const prev = messages[i - 1];

                  // Date separator check
                  const msgDate = new Date(msg.createdAt);
                  const prevDate = prev ? new Date(prev.createdAt) : null;
                  const showDateSeparator =
                    i === 0 ||
                    !prevDate ||
                    msgDate.getFullYear() !== prevDate.getFullYear() ||
                    msgDate.getMonth() !== prevDate.getMonth() ||
                    msgDate.getDate() !== prevDate.getDate();

                  const isGrouped =
                    !!prev &&
                    prev.senderId === msg.senderId &&
                    !showDateSeparator &&
                    msgDate.getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <DateSeparator date={msgDate} />
                      )}
                      <DmMessageItem
                        message={msg}
                        currentUserId={currentUser?.id}
                        isGrouped={isGrouped}
                        isBeingReplied={replyingTo?.messageId === msg.id}
                        memberAvatarMap={memberAvatarMap}
                        memberStatusMap={memberStatusMap}
                        onReply={() =>
                          setReplyingTo({
                            messageId: msg.id,
                            senderName: msg.senderName,
                            content: msg.content,
                          })
                        }
                        onReaction={(emoji) => {
                          if (channelId) {
                            addReaction(channelId, msg.id, emoji);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Bottom bar: MessageInput or Blocked bar */}
        {relationship === "blocked" ? (
          <div
            className="absolute inset-x-0 z-20 px-4"
            style={{ bottom: "var(--floating-bar-gap)" }}
          >
            <div
              className="flex items-center justify-between px-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
              style={{
                minHeight: "var(--floating-user-panel-height)",
                borderRadius: "var(--floating-bar-radius)",
                backgroundColor: "#383a40",
              }}
            >
              <span className="text-sm font-semibold text-zinc-200">
                {t("dm.blockedMessage")}
              </span>
              <button
                onClick={() => setRelationship("none")}
                className="shrink-0 rounded bg-[#2b2d31] px-4 py-1.5 text-sm text-white hover:bg-[#1e1f22] transition-colors cursor-pointer"
              >
                {t("dm.unblock")}
              </button>
            </div>
          </div>
        ) : (
          <MessageInput channelName={friendName} isDm onSend={handleSend} />
        )}
      </main>

      <SlidingPanel show={showDmUserPanel} width={340}>
        <DmUserPanel userId={userId} />
      </SlidingPanel>

      {/* Confirm Modal (Remove Friend / Block) */}
      {modalType && (
        <ConfirmModal
          title={
            modalType === "REMOVE_FRIEND"
              ? `${t("modal.removeFriendTitle")} ${friendName}`
              : `${t("modal.blockTitle")} ${friendName}`
          }
          description={
            modalType === "REMOVE_FRIEND" ? (
              <p>
                {t("modal.removeFriendDesc").split("{name}")[0]}
                <strong className="font-semibold text-white">{friendName}</strong>
                {t("modal.removeFriendDesc").split("{name}")[1]}
              </p>
            ) : (
              <p>
                {t("modal.blockDesc").split("{name}")[0]}
                <strong className="font-semibold text-white">{friendName}</strong>
                {t("modal.blockDesc").split("{name}")[1]}
              </p>
            )
          }
          confirmText={
            modalType === "REMOVE_FRIEND"
              ? t("modal.removeFriendConfirm")
              : t("modal.blockConfirm")
          }
          onClose={() => setModalType(null)}
          onConfirm={() => {
            if (modalType === "REMOVE_FRIEND") {
              setRelationship("none");
            } else {
              setRelationship("blocked");
            }
          }}
        />
      )}
    </>
  );
}

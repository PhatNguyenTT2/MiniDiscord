"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { DMSidebar } from "@/components/sidebar/DMSidebar";
import { DmUserPanel } from "@/components/dm/DmUserPanel";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import { ScrollToBottomBanner } from "@/components/chat/ScrollToBottomBanner";
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
  const addOptimisticMessage = useChatStore((s) => s.addOptimisticMessage);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);
  const markChannelAsRead = useChatStore((s) => s.markChannelAsRead);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const isLoadingMessages = useChatStore((s) => s.isLoading);

  const token = useAuthStore((s) => s.token);

  const lastMarkedMsgRef = useRef<string | null>(null);

  // Fetch message history when room/channel are available
  useEffect(() => {
    if (roomId && channelId) {
      fetchMessages(roomId, channelId).catch(err => {
        console.error("Failed to fetch messages:", err);
      });
    }
  }, [roomId, channelId, fetchMessages]);

  // Auto mark as read when viewing this channel
  useEffect(() => {
    if (messages.length > 0 && roomId && channelId) {
      const lastMessage = messages[messages.length - 1];
      if (lastMarkedMsgRef.current !== lastMessage.id) {
        lastMarkedMsgRef.current = lastMessage.id;
        markChannelAsRead(roomId, channelId, lastMessage.id);
      }
    }
  }, [messages, roomId, channelId, markChannelAsRead]);

  // Dynamically auto-hide DM User Panel when viewport drops below 1024px (minimized/narrow screens)
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.innerWidth < 1024) {
        // Direct state mutation of zustand store to dynamically close panel without forcing redundant store action updates logic
        if (useUIStore.getState().showDmUserPanel) {
          useUIStore.setState({ showDmUserPanel: false });
        }
      }
    };

    handleViewportResize(); // run on mount
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  const handleSend = useCallback(
    async (content: string, attachment?: { fileUrl: string; fileName: string; fileSize: number } | null) => {
      let activeRoomId = roomId;
      let activeChannelId = channelId;

      if (!activeRoomId || !activeChannelId) {
        try {
          const newRoom = await findOrCreateDmRoom(userId);
          activeRoomId = newRoom.id;
          const { channels: updatedChannels } = useRoomStore.getState();
          const newChannels = updatedChannels[newRoom.id] || [];
          const defaultCh = newChannels.find(c => c.type === "TEXT") || newChannels[0];
          if (!defaultCh) {
            console.error("Failed to find text channel after creating lazy room", newRoom.id);
            return;
          }
          activeChannelId = defaultCh.id;

          // Eager Stomp subscribe to avoid any messaging race condition before React renders
          const activeToken = useAuthStore.getState().token;
          if (activeToken) {
            const client = getStompClient(activeToken);
            if (client.connected) {
              client.subscribe(`/topic/room.${activeRoomId}`, (msg) => {
                try {
                  const data = JSON.parse(msg.body);
                  useChatStore.getState().receiveMessage(data.channelId, {
                    id: data.messageId,
                    roomId: data.roomId,
                    channelId: data.channelId,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    senderAvatar: data.senderAvatar || null,
                    type: data.type || "TEXT",
                    content: data.content,
                    fileUrl: data.fileUrl || null,
                    fileName: data.fileName || null,
                    fileSize: data.fileSize || null,
                    reactions: [],
                    isEdited: false,
                    isDeleted: false,
                    editedAt: null,
                    createdAt: data.createdAt || new Date().toISOString(),
                    replyTo: data.replyTo || null,
                  });
                } catch (e) {
                  console.error("Failed to parse lazy room message", e);
                }
              });
              // Wait for broker to bind the queue before publishing first message
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (err) {
          console.error("Lazy DM creation failed", err);
          return;
        }
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

      // Optimistic insert — show message immediately with faded style
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        roomId: activeRoomId,
        channelId: activeChannelId,
        senderId: currentUser?.id || "",
        senderName: currentUser?.username || "",
        senderAvatar: currentUser?.avatarUrl || null,
        type: attachment ? "FILE" : "TEXT",
        content,
        fileUrl: attachment?.fileUrl || null,
        fileName: attachment?.fileName || null,
        fileSize: attachment?.fileSize || null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        replyTo: replyingTo
          ? {
            messageId: replyingTo.messageId,
            content: replyingTo.content.slice(0, 100),
            senderName: replyingTo.senderName,
          }
          : null,
      };
      addOptimisticMessage(activeChannelId, optimisticMsg);

      const payload = {
        roomId: activeRoomId,
        channelId: activeChannelId,
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
    [channelId, roomId, token, replyingTo, clearReplyingTo, currentUser, addOptimisticMessage, userId, findOrCreateDmRoom]
  );



  const handleTyping = useCallback(() => {
    if (!token || !roomId || !channelId) return;
    const client = getStompClient(token);
    if (!client.connected) return;

    const username = useAuthStore.getState().user?.username;
    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ roomId, channelId, username }),
    });
  }, [channelId, roomId, token]);

  // Auto-scroll to bottom state
  const messageListRef = useRef<MessageListHandle>(null);
  const [showJumpBanner, setShowJumpBanner] = useState(false);

  const handleScrollStateChange = useCallback((isAtBottom: boolean) => {
    setShowJumpBanner(!isAtBottom);
  }, []);

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
        {(isLoadingMessages && messages.length === 0) ? (
          <div className="flex-1 overflow-y-auto">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-secondary mb-3 mt-16 mx-4">
              <User className="h-10 w-10 text-foreground" />
            </div>
            <MessagesSkeleton />
          </div>
        ) : (
          <MessageList
            ref={messageListRef}
            messages={messages}
            channelName={friendName}
            channelId={channelId}
            roomId={roomId}
            memberAvatarMap={memberAvatarMap}
            memberStatusMap={memberStatusMap}
            onScrollStateChange={handleScrollStateChange}
            welcomeHeader={
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
            }
          />
        )}

        {/* Input wrapper — relative context for floating banner */}
        <div className="relative">
          <ScrollToBottomBanner
            visible={showJumpBanner}
            onJumpToPresent={() => messageListRef.current?.scrollToBottom()}
          />
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
            <MessageInput
              channelId={channelId || "pending"}
              channelName={friendName}
              isDm
              onSend={handleSend}
              onTyping={handleTyping}
            />
          )}
        </div>
      </main>

      <SlidingPanel show={showDmUserPanel} width={340}>
        <DmUserPanel userId={userId} />
      </SlidingPanel>

      {/* Confirm Modal (Remove Friend / Block) */}
      {
        modalType && (
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
        )
      }
    </>
  );
}

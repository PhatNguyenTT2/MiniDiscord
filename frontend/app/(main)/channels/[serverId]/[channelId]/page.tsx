"use client";

import { SidebarWrapper } from "@/components/sidebar/SidebarWrapper";
import { ChannelList } from "@/components/sidebar/ChannelList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { MemberList } from "@/components/sidebar/MemberList";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { SlidingPanel } from "@/components/ui/SlidingPanel";
import { SearchResultsPanel } from "@/components/chat/SearchResultsPanel";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRoomStore } from "@/stores/roomStore";
import { getStompClient } from "@/lib/websocket";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState, useEffect } from "react";
import { type Message } from "@/types";
import { VoiceChannelView } from "@/components/voice/VoiceChannelView";
import { Lock } from "lucide-react";
import { InviteModal } from "@/components/server/InviteModal";
import { useTranslation } from "@/lib/i18n";

const EMPTY_MEMBERS: any[] = [];

export default function ChannelPage() {
  const { t } = useTranslation();
  const params = useParams();
  const channelId = params?.channelId as string;
  const roomId = params?.serverId as string;
  const showMemberList = useUIStore((s) => s.showMemberList);
  const showSearchPanel = useChatStore((s) => s.showSearchPanel[channelId] || false);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const { rooms, channels, fetchMembers } = useRoomStore();
  const members = useRoomStore((s) => s.members[roomId] ?? EMPTY_MEMBERS);

  const [isInviteOpen, setIsInviteOpen] = useState(false);

  let channelName = "general";

  for (const [rId, cList] of Object.entries(channels)) {
    const ch = cList.find((c) => c.id === channelId);
    if (ch) {
      channelName = ch.name;
      break;
    }
  }

  // Cover 'hard refresh' cases by ensuring we load the members for the current server
  useEffect(() => {
    if (roomId) {
      fetchMembers(roomId);
    }
  }, [roomId, fetchMembers]);

  // Read messages from in-memory store
  const messages = useChatStore((s) => s.getChannelMessages(channelId));
  const replyingTo = useChatStore((s) => s.replyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);
  const markChannelAsRead = useChatStore((s) => s.markChannelAsRead);
  const token = useAuthStore((s) => s.token);

  const handleSend = useCallback(
    (
      content: string,
      attachment?: { fileKey: string; fileName: string; fileSize: number } | null,
      mentions?: string[],
      stickerIds?: string[]
    ) => {
      if (!token) return;
      const client = getStompClient(token);

      const currentUser = useAuthStore.getState().user;
      const nonce = crypto.randomUUID();

      const payload = {
        id: nonce,
        messageId: nonce,
        nonce,
        roomId,
        channelId,
        content,
        type: attachment ? "FILE" : "TEXT",
        senderName: currentUser?.displayName || currentUser?.username || "User",
        senderAvatar: currentUser?.avatarUrl || null,
        fileKey: attachment?.fileKey,
        fileName: attachment?.fileName,
        fileSize: attachment?.fileSize,
        replyTo: replyingTo
          ? {
            messageId: replyingTo.messageId,
            content: replyingTo.content.slice(0, 100),
            senderName: replyingTo.senderName,
          }
          : null,
        mentions,
        stickerIds,
      };

      // Optimistic message
      const optimisticMsg: Message = {
        id: nonce,
        messageId: nonce,
        nonce,
        roomId,
        channelId,
        senderId: currentUser?.id || "",
        senderName: currentUser?.displayName || currentUser?.username || "User",
        senderAvatar: currentUser?.avatarUrl || null,
        type: attachment ? "FILE" : "TEXT",
        content,
        fileKey: attachment?.fileKey || null,
        fileName: attachment?.fileName || null,
        fileSize: attachment?.fileSize || null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        replyTo: payload.replyTo,
        mentions,
        stickerIds,
        status: client.connected ? "SENDING" : "FAILED",
      };

      useChatStore.getState().addOptimisticMessage(channelId, optimisticMsg);

      if (!client.connected) {
        console.warn("[chat] Cannot send: STOMP not connected. Message marked FAILED.");
        return;
      }

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify(payload),
      });

      // Sending a message implicitly marks channel as read
      if (channelId) {
        useNotificationStore.getState().markAsRead(channelId);
      }
      const lastRealId = useChatStore.getState().getChannelMessages(channelId).slice(-1)[0]?.id;
      if (roomId && channelId && lastRealId && !lastRealId.startsWith('optimistic-')) {
        useChatStore.getState().markChannelAsRead(roomId, channelId, lastRealId);
      }

      clearReplyingTo();
    },
    [channelId, roomId, token, replyingTo, clearReplyingTo]
  );

  const handleTyping = useCallback(() => {
    if (!token) return;
    const client = getStompClient(token);
    if (!client.connected) return;

    const currentUser = useAuthStore.getState().user;
    const username = currentUser?.displayName || currentUser?.username;
    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ roomId, channelId, username }),
    });
  }, [channelId, roomId, token]);

  const handleResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  // Ref to MessageList for scroll control
  const messageListRef = useRef<MessageListHandle>(null);
  const [showJumpBanner, setShowJumpBanner] = useState(false);

  useEffect(() => {
    setShowJumpBanner(false);
  }, [channelId]);

  const handleScrollStateChange = useCallback((isAtBottom: boolean) => {
    setShowJumpBanner(!isAtBottom);
  }, []);

  // Auto-hide MemberList when viewport is narrow
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024 && useUIStore.getState().showMemberList) {
        useUIStore.setState({ showMemberList: false });
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const roomChannels = roomId ? (channels[roomId] || []) : [];
  const currentChannelObj = roomChannels.find((c) => c.id === channelId);
  const isVoiceChannel = currentChannelObj?.type === "VOICE";

  return (
    <>
      {/* Column 1+2: ServerList + Channel Sidebar + UserPanel */}
      <SidebarWrapper>
        <ChannelList />
      </SidebarWrapper>

      {/* Resize Handle */}
      <ResizeHandle onResize={handleResize} />

      {/* Column 3 is the positioning context for the floating message composer. */}
      {isVoiceChannel ? (
        <VoiceChannelView
          channelId={channelId}
          roomId={roomId}
          channelName={channelName}
        />
      ) : (
        <main className="relative flex flex-1 min-w-0 flex-col bg-[#313338]">
          <ChatHeader channelName={channelName} />
          <MessageList
            ref={messageListRef}
            messages={messages}
            channelName={channelName}
            channelId={channelId}
            roomId={roomId}
            onMarkAsReadBackend={markChannelAsRead}
            onScrollStateChange={handleScrollStateChange}
            welcomeHeader={currentChannelObj?.isPrivate ? (
              <div className="px-4 pt-16 pb-4 select-none">
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-secondary mb-3">
                  <Lock className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-[1.5rem] font-bold text-foreground leading-snug">
                  {t("channelSettings.privateWelcomeTitle", { name: channelName })}
                </h2>
                <p className="mt-1 text-sm text-[#949ba4] leading-relaxed max-w-[480px]">
                  {t("channelSettings.privateWelcomeDesc", { name: channelName })}
                </p>
                <button
                  onClick={() => setIsInviteOpen(true)}
                  className="mt-4 px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-semibold transition-colors cursor-pointer"
                >
                  {t("channelSettings.privateWelcomeInvite")}
                </button>
              </div>
            ) : undefined}
          />

          {/* Input wrapper — relative context for floating banner */}
          <div className="relative">
            {/* Opaque bottom overlay to prevent chat messages from showing below the floating composer */}
            <div className="absolute bottom-0 left-0 right-0 h-[88px] bg-[#313338] z-10 pointer-events-none" />
            <MessageInput
              channelId={channelId}
              channelName={channelName}
              onSend={handleSend}
              onTyping={handleTyping}
              members={members}
              showScrollDown={showJumpBanner}
              onScrollDown={() => messageListRef.current?.scrollToBottom()}
            />
          </div>
        </main>
      )}

      {/* Column 4: Member List (toggleable with slide animation) */}
      <SlidingPanel show={showMemberList && !showSearchPanel} width={240}>
        <MemberList />
      </SlidingPanel>

      {/* Column 4: Search Results Panel */}
      <SlidingPanel show={showSearchPanel} width={400}>
        <SearchResultsPanel channelId={channelId} />
      </SlidingPanel>

      {/* Invite Modal for channel welcome panel action trigger */}
      {isInviteOpen && roomId && (
        <InviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          roomId={roomId}
          roomName={rooms.find((r) => r.id === roomId)?.name || "Server"}
          channelName={channelName}
        />
      )}
    </>
  );
}

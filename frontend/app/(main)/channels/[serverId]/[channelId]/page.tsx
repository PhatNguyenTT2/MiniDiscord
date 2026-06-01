"use client";

import { SidebarWrapper } from "@/components/sidebar/SidebarWrapper";
import { ChannelList } from "@/components/sidebar/ChannelList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { ScrollToBottomBanner } from "@/components/chat/ScrollToBottomBanner";
import { MemberList } from "@/components/sidebar/MemberList";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { SlidingPanel } from "@/components/ui/SlidingPanel";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRoomStore } from "@/stores/roomStore";
import { getStompClient } from "@/lib/websocket";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState, useEffect } from "react";
import { type Message } from "@/types";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params?.channelId as string;
  const roomId = params?.serverId as string;
  const showMemberList = useUIStore((s) => s.showMemberList);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const { channels, fetchMembers } = useRoomStore();

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
    (content: string, attachment?: { fileUrl: string; fileName: string; fileSize: number } | null) => {
      if (!token) return;
      const client = getStompClient(token);
      if (!client.connected) return;

      const currentUser = useAuthStore.getState().user;
      const payload = {
        roomId,
        channelId,
        content,
        type: attachment ? "FILE" : "TEXT",
        senderName: currentUser?.username || "User",
        senderAvatar: currentUser?.avatarUrl || null,
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

      // Optimistic message
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        messageId: `optimistic-${Date.now()}`, // fallback to avoid errors
        roomId,
        channelId,
        senderId: currentUser?.id || "",
        senderName: currentUser?.username || "User",
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
        replyTo: payload.replyTo,
      };

      useChatStore.getState().addOptimisticMessage(channelId, optimisticMsg);

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

    const username = useAuthStore.getState().user?.username;
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

  return (
    <>
      {/* Column 1+2: ServerList + Channel Sidebar + UserPanel */}
      <SidebarWrapper>
        <ChannelList />
      </SidebarWrapper>

      {/* Resize Handle */}
      <ResizeHandle onResize={handleResize} />

      {/* Column 3 is the positioning context for the floating message composer. */}
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
        />

        {/* Input wrapper — relative context for floating banner */}
        <div className="relative">
          <ScrollToBottomBanner
            visible={showJumpBanner}
            onJumpToPresent={() => messageListRef.current?.scrollToBottom()}
          />
          <MessageInput
            channelId={channelId}
            channelName={channelName}
            onSend={handleSend}
            onTyping={handleTyping}
          />
        </div>
      </main>

      {/* Column 4: Member List (toggleable with slide animation) */}
      <SlidingPanel show={showMemberList} width={240}>
        <MemberList />
      </SlidingPanel>
    </>
  );
}

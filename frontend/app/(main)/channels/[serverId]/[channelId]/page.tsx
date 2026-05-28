"use client";

import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
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
import { useRoomStore } from "@/stores/roomStore";
import { getStompClient } from "@/lib/websocket";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState, useEffect } from "react";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params?.channelId as string;
  const showMemberList = useUIStore((s) => s.showMemberList);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const { channels } = useRoomStore();

  let channelName = "general";
  let roomId = "r1";

  for (const [rId, cList] of Object.entries(channels)) {
    const ch = cList.find((c) => c.id === channelId);
    if (ch) {
      channelName = ch.name;
      roomId = rId;
      break;
    }
  }

  // Read messages from in-memory store
  const messages = useChatStore((s) => s.getChannelMessages(channelId));
  const replyingTo = useChatStore((s) => s.replyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);
  const markChannelAsRead = useChatStore((s) => s.markChannelAsRead);
  const token = useAuthStore((s) => s.token);

  const lastMarkedMsgRef = useRef<string | null>(null);

  // Auto mask as read when viewing this channel
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMarkedMsgRef.current !== lastMessage.id) {
        lastMarkedMsgRef.current = lastMessage.id;
        markChannelAsRead(roomId, channelId, lastMessage.id);
      }
    }
  }, [messages, roomId, channelId, markChannelAsRead]);

  const handleSend = useCallback(
    (content: string, attachment?: { fileUrl: string; fileName: string; fileSize: number } | null) => {
      if (!token) return;
      const client = getStompClient(token);
      if (!client.connected) return;

      const payload = {
        roomId,
        channelId,
        content,
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

  const handleTyping = useCallback(() => {
    if (!token) return;
    const client = getStompClient(token);
    if (!client.connected) return;

    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ roomId, channelId }),
    });
  }, [channelId, roomId, token]);

  const handleResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  // Ref to MessageList for scroll control
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
          {/* Column 1: Server List */}
          <ServerList />
          {/* Column 2: Channel List */}
          <ChannelList />
        </div>
        {/* UserPanel spanning columns 1+2 */}
        <UserPanel />
      </div>

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

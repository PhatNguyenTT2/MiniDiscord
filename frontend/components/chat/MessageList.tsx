"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { MessageItem } from "@/components/chat/MessageItem";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { UnreadBanner, NewMessageDivider } from "@/components/chat/UnreadBanner";
import { Hash } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useNotificationStore } from "@/stores/notificationStore";
import { useChatStore } from "@/stores/chatStore";
import type { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  channelName: string;
  channelId?: string;
  roomId?: string;
  /** Called when scroll-at-bottom state changes */
  onScrollStateChange?: (isAtBottom: boolean) => void;
}

/** Exposed imperative handle for parent components */
export interface MessageListHandle {
  scrollToBottom: () => void;
  isAtBottom: boolean;
}

/** Check if two dates are on different calendar days */
function isDifferentDay(a: string, b: string): boolean {
  const dA = new Date(a);
  const dB = new Date(b);
  return (
    dA.getFullYear() !== dB.getFullYear() ||
    dA.getMonth() !== dB.getMonth() ||
    dA.getDate() !== dB.getDate()
  );
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(
  function MessageList({ messages, channelName, channelId, roomId, onScrollStateChange }, ref) {
    const { t } = useTranslation();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const unreadDividerRef = useRef<HTMLDivElement>(null);
    const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
    const markAsRead = useNotificationStore((s) => s.markAsRead);
    const fetchMessages = useChatStore((s) => s.fetchMessages);
    const isLoading = useChatStore((s) => s.isLoading);

    // Determine unread state for this channel
    const unreadCount = channelId ? getUnreadCount(channelId) : 0;

    // The first unread message is calculated from the end of the list
    const firstUnreadIndex = unreadCount > 0
      ? Math.max(0, messages.length - unreadCount)
      : -1;
    const firstUnreadMessageId = firstUnreadIndex >= 0
      ? messages[firstUnreadIndex]?.id ?? null
      : null;

    // Track whether unread banner is dismissed
    const [isDismissed, setIsDismissed] = useState(false);

    // Track scroll position
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Reset dismissed state when channelId changes
    useEffect(() => {
      setIsDismissed(false);
      setIsAtBottom(true);

      // Initial fetch when switching to a channel
      if (roomId && channelId) {
        fetchMessages(roomId, channelId);
      }
    }, [roomId, channelId, fetchMessages]);

    // Auto-dismiss: mark as read after 5s of viewing the channel
    useEffect(() => {
      if (!channelId || unreadCount <= 0 || isDismissed) return;

      const timer = setTimeout(() => {
        markAsRead(channelId);
        setIsDismissed(true);
      }, 5000);

      return () => clearTimeout(timer);
    }, [channelId, unreadCount, isDismissed, markAsRead]);

    // Scroll to first unread divider
    const scrollToFirstUnread = useCallback(() => {
      unreadDividerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, []);

    // Handle "Mark as Read"
    const handleMarkAsRead = useCallback(() => {
      if (channelId) {
        markAsRead(channelId);
        setIsDismissed(true);
      }
    }, [channelId, markAsRead]);

    // Scroll to bottom (Jump to Present)
    const scrollToBottom = useCallback(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Expose isAtBottom + scrollToBottom to parent
    useImperativeHandle(ref, () => ({
      scrollToBottom,
      isAtBottom,
    }), [scrollToBottom, isAtBottom]);

    // Detect scroll position
    const handleScroll = useCallback(() => {
      const el = scrollContainerRef.current;
      if (!el) return;

      // Bottom detection
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distanceFromBottom < 100;
      setIsAtBottom(atBottom);
      onScrollStateChange?.(atBottom);

      // Top detection (Infinite scroll up)
      if (el.scrollTop < 100 && !isLoading && messages.length > 0 && roomId && channelId) {
        const oldestMessageId = messages[0].id;

        // Save current scroll height to prevent jump
        const prevScrollHeight = el.scrollHeight;

        fetchMessages(roomId, channelId, oldestMessageId).then(() => {
          // Adjust scroll position after prepending new items so viewport doesn't jump
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              const newScrollHeight = scrollContainerRef.current.scrollHeight;
              scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
            }
          });
        });
      }
    }, [onScrollStateChange, isLoading, messages, roomId, channelId, fetchMessages]);

    // Auto-scroll to bottom when messages change (only if already at bottom)
    useEffect(() => {
      if (isAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [messages.length, isAtBottom]);

    return (
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
      >
        {/* Sticky unread banner at top of scroll area */}
        {unreadCount > 0 && !isDismissed && firstUnreadIndex >= 0 && (
          <UnreadBanner
            unreadCount={unreadCount}
            since={new Date(messages[firstUnreadIndex]?.createdAt ?? Date.now())}
            onMarkAsRead={handleMarkAsRead}
            onClickBanner={scrollToFirstUnread}
          />
        )}

        {/* Reserve bottom space so the floating composer never covers the final messages. */}
        <div
          className="flex min-h-full flex-col justify-end"
          style={{ paddingBottom: "var(--floating-message-input-offset)" }}
        >
          {/* Welcome header */}
          <div className="px-4 pt-16 pb-4">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-secondary mb-3">
              <Hash className="h-10 w-10 text-foreground" />
            </div>
            <h2 className="text-[1.5rem] font-bold text-foreground leading-snug">
              {t("chat.welcomeTitle", { channelName })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-[480px]">
              {t("chat.welcomeDesc", { channelName })}
            </p>
          </div>

          {/* Messages with date separators and unread divider */}
          <div className="pb-2">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const isGrouped =
                !!prev &&
                prev.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() -
                new Date(prev.createdAt).getTime() <
                5 * 60 * 1000 &&
                !isDifferentDay(prev.createdAt, msg.createdAt);

              // Show date separator if first message or different day
              const showDateSeparator =
                i === 0 || isDifferentDay(prev!.createdAt, msg.createdAt);

              // Show NEW divider before first unread message
              const showUnreadDivider =
                !isDismissed && msg.id === firstUnreadMessageId;

              return (
                <div key={msg.id}>
                  {showDateSeparator && (
                    <DateSeparator date={new Date(msg.createdAt)} />
                  )}
                  {showUnreadDivider && (
                    <div ref={unreadDividerRef}>
                      <NewMessageDivider />
                    </div>
                  )}
                  <MessageItem
                    message={msg}
                    isGrouped={isGrouped && !showDateSeparator}
                    channelId={channelId}
                  />
                </div>
              );
            })}
          </div>

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }
);

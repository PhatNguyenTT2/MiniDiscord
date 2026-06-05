"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, memo } from "react";
import { MessageItem } from "@/components/chat/MessageItem";
import { DateSeparator } from "@/components/chat/DateSeparator";
import { UnreadBanner, NewMessageDivider } from "@/components/chat/UnreadBanner";
import { Hash } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useNotificationStore } from "@/stores/notificationStore";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  channelName: string;
  channelId?: string;
  roomId?: string;
  /** Called when scroll-at-bottom state changes */
  onScrollStateChange?: (isAtBottom: boolean) => void;
  /** Called to sync read status to backend */
  onMarkAsReadBackend?: (roomId: string, channelId: string, lastMessageId: string) => void;
  memberAvatarMap?: Record<string, string | null>;
  memberStatusMap?: Record<string, string>;
  welcomeHeader?: React.ReactNode;
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

export const MessageList = memo(forwardRef<MessageListHandle, MessageListProps>(
  function MessageList({
    messages,
    channelName,
    channelId,
    roomId,
    onScrollStateChange,
    onMarkAsReadBackend,
    memberAvatarMap,
    memberStatusMap,
    welcomeHeader
  }, ref) {
    const { t } = useTranslation();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const unreadDividerRef = useRef<HTMLDivElement>(null);
    const bottomDetectorRef = useRef<HTMLDivElement>(null);
    // REACTIVE selector: subscribes to THIS channel's unread count only
    const unreadCount = useNotificationStore((s) => channelId ? (s.unreadCounts[channelId] ?? 0) : 0);
    const markAsRead = useNotificationStore((s) => s.markAsRead);
    const fetchMessages = useChatStore((s) => s.fetchMessages);
    const fetchUnreadCount = useChatStore((s) => s.fetchUnreadCount);
    const isLoading = useChatStore((s) => s.isLoading);

    // Gate initial scroll behind backend unread fetch
    const [isUnreadReady, setIsUnreadReady] = useState(false);

    // Gate visibility — hide scroll container until positioned to prevent flash
    const [isPositioned, setIsPositioned] = useState(false);

    // unreadCount is computed reactively by the Zustand selector above (line 63)

    // The first unread message is calculated from the end of the list
    const firstUnreadIndex = unreadCount > 0
      ? Math.max(0, messages.length - unreadCount)
      : -1;
    const firstUnreadMessageId = firstUnreadIndex >= 0
      ? messages[firstUnreadIndex]?.id ?? null
      : null;

    // Track whether unread banner is dismissed
    const [isDismissed, setIsDismissed] = useState(false);

    // ── Refs (zero re-render) ──
    const isAtBottomRef = useRef(false);
    const hasReachedBottomRef = useRef(false);
    const manuallyMarkedUnreadRef = useRef(false);
    const isReadyToDetectRef = useRef(false);
    const hasInitialScrolledRef = useRef<string | null>(null);
    const isFetchingOlderRef = useRef(false);
    const isProgrammaticScrollRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Refs to avoid stale closures in cleanup without adding deps
    const roomIdRef = useRef(roomId);
    roomIdRef.current = roomId;
    const channelIdRef = useRef(channelId);
    channelIdRef.current = channelId;

    const latestMessageIdRef = useRef<string | null>(null);
    useEffect(() => {
      if (messages.length > 0) {
        latestMessageIdRef.current = messages[messages.length - 1].id;
      }
    }, [messages]);

    // Reset state when channelId changes + initial fetch
    useEffect(() => {
      setIsDismissed(false);
      isAtBottomRef.current = false;
      setIsUnreadReady(false);

      if (typeof window !== "undefined" && channelId) {
        try {
          const recents = JSON.parse(localStorage.getItem("recent_channels") || "[]");
          const filtered = recents.filter((id: string) => id !== channelId);
          filtered.unshift(channelId);
          localStorage.setItem("recent_channels", JSON.stringify(filtered.slice(0, 20)));
        } catch (e) {
          console.error("Failed to update recent channels", e);
        }
      }
      setIsPositioned(false);
      manuallyMarkedUnreadRef.current = false;
      hasInitialScrolledRef.current = null;
      hasReachedBottomRef.current = false;
      isReadyToDetectRef.current = false;

      // Track active channel for notification logic
      useUIStore.getState().setActiveChannelId(channelId || null);

      // Initial fetch when switching to a channel
      const rid = roomIdRef.current;
      if (rid && channelId) {
        const store = useChatStore.getState();
        store.fetchUnreadCount(rid, channelId).then(() => {
          const state = useChatStore.getState();
          const unreadInfo = state.unreadCounts[channelId];

          if (unreadInfo && unreadInfo.count > 0 && unreadInfo.lastReadMessageId) {
            return store.fetchMessagesAround(rid, channelId, unreadInfo.lastReadMessageId);
          } else {
            return store.fetchMessages(rid, channelId);
          }
        }).finally(() => {
          setIsUnreadReady(true);
        });
      } else {
        setIsUnreadReady(true);
      }

      return () => {
        useUIStore.getState().setActiveChannelId(null);
        const cid = channelIdRef.current;
        const rId = roomIdRef.current;
        // Only mark-as-read if:
        // 1. User scrolled to bottom (hasReachedBottomRef)
        // 2. AND user did NOT manually mark-as-unread (manuallyMarkedUnreadRef)
        if (cid && rId && hasReachedBottomRef.current && !manuallyMarkedUnreadRef.current) {
          useNotificationStore.getState().markAsRead(cid);
          if (latestMessageIdRef.current) {
            onMarkAsReadBackend?.(rId, cid, latestMessageIdRef.current);
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    // Instant scroll positioning — useLayoutEffect fires BEFORE browser paint
    useLayoutEffect(() => {
      if (!isUnreadReady) return;
      const storeState = useChatStore.getState();
      const cid = channelIdRef.current;
      if (!cid || storeState.isLoading) return;

      const msgs = storeState.getChannelMessages(cid);
      if (msgs.length === 0) {
        // Empty channel (e.g. just created): show welcome header, scroll to bottom to prevent composer cover overlap
        setIsPositioned(true);
        isAtBottomRef.current = true;
        hasReachedBottomRef.current = true;
        onScrollStateChange?.(true);

        // Align bottom spacer
        bottomRef.current?.scrollIntoView({ behavior: "instant" });

        setTimeout(() => { isReadyToDetectRef.current = true; }, 300);
        return;
      }

      if (hasInitialScrolledRef.current !== cid) {
        hasInitialScrolledRef.current = cid;

        const currentUnread = useNotificationStore.getState().getUnreadCount(cid);

        if (currentUnread > 0 && currentUnread <= msgs.length) {
          if (unreadDividerRef.current) {
            unreadDividerRef.current.scrollIntoView({ behavior: "instant", block: "center" });
            isAtBottomRef.current = false;
            onScrollStateChange?.(false);
          } else {
            bottomRef.current?.scrollIntoView({ behavior: "instant" });
            isAtBottomRef.current = true;
            onScrollStateChange?.(true);
            hasReachedBottomRef.current = true;
          }
        } else if (currentUnread > msgs.length) {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            isAtBottomRef.current = false;
            onScrollStateChange?.(false);
          }
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
          isAtBottomRef.current = true;
          onScrollStateChange?.(true);
          hasReachedBottomRef.current = true;
        }

        setIsPositioned(true);
        // Open the immunity gate AFTER initial scroll positioning completes
        setTimeout(() => { isReadyToDetectRef.current = true; }, 300);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, isUnreadReady]);

    // ── IntersectionObserver: bottom detection (zero re-render) ──
    useEffect(() => {
      const el = bottomDetectorRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(([entry]) => {
        if (!isReadyToDetectRef.current) return;

        if (entry.isIntersecting) {
          hasReachedBottomRef.current = true;
          isAtBottomRef.current = true;
          onScrollStateChange?.(true);

          // IMMUNITY GATE: Block auto mark-as-read during initial mount
          if (!isReadyToDetectRef.current) return;

          const cid = channelIdRef.current;
          if (cid && !manuallyMarkedUnreadRef.current) {
            const currentUnread = useNotificationStore.getState().getUnreadCount(cid);
            if (currentUnread > 0) {
              markAsRead(cid);
              setIsDismissed(true);
              const rId = roomIdRef.current;
              if (rId && latestMessageIdRef.current) {
                onMarkAsReadBackend?.(rId, cid, latestMessageIdRef.current);
              }
            }
          }
        } else {
          if (isProgrammaticScrollRef.current) return;
          isAtBottomRef.current = false;
          onScrollStateChange?.(false);
        }
      }, { threshold: 0.1 });

      observer.observe(el);
      return () => observer.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    // Listen to jump-to-message scroll events
    useEffect(() => {
      const handleJump = async (e: Event) => {
        const detail = (e as CustomEvent).detail || {};
        const id = detail.id || detail.messageId;
        const messageId = detail.messageId || detail.id;

        if (!id) return;

        let el = document.getElementById(`msg-${id}`) ||
          document.getElementById(`msg-${messageId}`) ||
          (messageId ? document.querySelector(`[data-message-id="${messageId}"]`) : null);

        const highlightElement = (targetEl: HTMLElement) => {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          targetEl.classList.add("bg-[#5865f2]/15", "transition-colors", "duration-500");
          setTimeout(() => {
            targetEl.classList.remove("bg-[#5865f2]/15");
          }, 2000);
        };

        if (el) {
          highlightElement(el as HTMLElement);
        } else {
          if (roomId && channelId) {
            await useChatStore.getState().fetchMessagesAround(roomId, channelId, id);
            setTimeout(() => {
              const loaded = document.getElementById(`msg-${id}`) ||
                document.getElementById(`msg-${messageId}`) ||
                (messageId ? document.querySelector(`[data-message-id="${messageId}"]`) : null);
              if (loaded) {
                highlightElement(loaded as HTMLElement);
              }
            }, 500);
          }
        }
      };

      window.addEventListener("jump-to-message", handleJump);
      return () => window.removeEventListener("jump-to-message", handleJump);
    }, [roomId, channelId]);

    // Scroll to first unread divider
    const scrollToFirstUnread = useCallback(() => {
      unreadDividerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, []);

    // Handle "Mark as Read" — sync both frontend + backend
    const handleMarkAsRead = useCallback(() => {
      if (channelId) {
        markAsRead(channelId);
        setIsDismissed(true);
        const rId = roomIdRef.current;
        if (rId && latestMessageIdRef.current) {
          onMarkAsReadBackend?.(rId, channelId, latestMessageIdRef.current);
        }
      }
    }, [channelId, markAsRead, onMarkAsReadBackend]);

    // Scroll to bottom (Jump to Present)
    const scrollToBottom = useCallback(() => {
      isProgrammaticScrollRef.current = true;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 800);
    }, []);

    // Expose isAtBottom + scrollToBottom to parent
    useImperativeHandle(ref, () => ({
      scrollToBottom,
      get isAtBottom() { return isAtBottomRef.current; },
    }), [scrollToBottom]);

    // Ref for messages to avoid stale closures in handleScroll
    const messagesRef = useRef(messages);
    useEffect(() => {
      messagesRef.current = messages;
    }, [messages]);

    // Scroll handler — ONLY infinite scroll up (no auto-dismiss)
    const handleScroll = useCallback(() => {
      const el = scrollContainerRef.current;
      if (!el || !isReadyToDetectRef.current) return;

      // Top detection (Infinite scroll up) — skip during programmatic scroll
      if (el.scrollTop < 100 && !isLoading && !isFetchingOlderRef.current && !isProgrammaticScrollRef.current && messagesRef.current.length > 0 && roomId && channelId) {
        isFetchingOlderRef.current = true;
        const oldestMessageId = messagesRef.current[0].id;
        const prevScrollTop = el.scrollTop;
        const prevScrollHeight = el.scrollHeight;

        fetchMessages(roomId, channelId, oldestMessageId).then(() => {
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              const newScrollHeight = scrollContainerRef.current.scrollHeight;
              const heightDiff = newScrollHeight - prevScrollHeight;
              // Preserve user's visual position: add prepended content height to their scroll offset
              if (heightDiff > 0) {
                scrollContainerRef.current.scrollTop = prevScrollTop + heightDiff;
              }
              // If heightDiff === 0, no new messages were prepended — keep user's position as-is
            }
            isFetchingOlderRef.current = false;
          });
        }).catch(() => {
          isFetchingOlderRef.current = false;
        });
      }
    }, [isLoading, roomId, channelId, fetchMessages]);

    // Auto-scroll to bottom when NEW messages arrive (only if user was already at bottom)
    const prevMessagesLenRef = useRef(messages.length);
    useEffect(() => {
      if (messages.length > prevMessagesLenRef.current && isAtBottomRef.current) {
        isProgrammaticScrollRef.current = true;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 800);
      }
      prevMessagesLenRef.current = messages.length;
    }, [messages.length]);

    return (
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        style={{ opacity: isPositioned ? 1 : 0 }}
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
        <div className="flex min-h-full flex-col justify-end">
          {/* Welcome header */}
          {welcomeHeader || (
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
          )}

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
                <div key={msg.id} id={`msg-${msg.id}`} data-message-id={msg.messageId}>
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
                    memberAvatarMap={memberAvatarMap}
                    memberStatusMap={memberStatusMap}
                    onMarkUnread={async () => {
                      if (channelId && roomId) {
                        manuallyMarkedUnreadRef.current = true;
                        setIsDismissed(false);
                        await useChatStore.getState().markChannelAsUnread(roomId, channelId, msg.id);
                        // Wait for React to render the new divider, then scroll to it
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            if (unreadDividerRef.current) {
                              unreadDividerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                            }
                          }, 100);
                        });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Spacer to prevent chatbox from covering content — outside flex wrapper */}
        <div style={{ height: "var(--floating-message-input-offset)" }} className="shrink-0" />

        {/* Bottom detector for IntersectionObserver (1px invisible element) */}
        <div ref={bottomDetectorRef} style={{ height: '1px' }} />

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    );
  }
));

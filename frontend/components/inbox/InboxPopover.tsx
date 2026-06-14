"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, Check, Trash2, Bell, MessageSquare, AlertCircle, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useInboxStore } from "@/stores/inboxStore";
import { useRouter } from "next/navigation";
import { ScrollArea } from "../ui/ScrollArea";
import { cn } from "@/lib/utils";

export function InboxPopover() {
  const { t } = useTranslation();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { notifications, fetchNotifications, markAsRead, deleteNotification, clearChannel } = useInboxStore();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch immediately on mount, and pull periodic updates
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000); // Poll every 10s fallback (in case WS fluctuates)
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    // Sequentially mark all unread locally/remotely
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  const handleNotificationClick = async (n: any) => {
    // Mark as read first
    if (!n.isRead) {
      await markAsRead(n.id);
    }

    setIsOpen(false);

    if (n.type === "DM") {
      router.push(`/channels/me/${n.senderId}`);
      if (n.roomId) {
        await clearChannel(n.roomId);
      }
    } else if (n.type === "MENTION") {
      router.push(`/channels/${n.roomId}/${n.channelId}`);
      if (n.roomId && n.channelId) {
        await clearChannel(n.roomId, n.channelId);
      }
    } else if (n.type === "FRIEND_ACCEPTED") {
      router.push("/channels/me");
      await deleteNotification(n.id);
    } else if (n.type === "SERVER_INVITE") {
      router.push(`/channels/${n.roomId}`);
      if (n.roomId) {
        await clearChannel(n.roomId);
      }
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative">
      {/* Inbox Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("inbox.title")}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 cursor-pointer",
          isOpen
            ? "text-foreground bg-secondary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Inbox className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f23f43] px-1 text-[9px] font-bold text-white leading-none border-2 border-[#313338]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover overlay dropdown container */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-10 z-[100] w-[420px] rounded-lg bg-[#313338] shadow-[0_8px_16px_rgba(0,0,0,0.24)] border border-[#232428]/50 overflow-hidden flex flex-col animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#232428] px-4 py-3 bg-[#2b2d31]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-[15px]">{t("inbox.title")}</span>
              {unreadCount > 0 && (
                <span className="bg-[#5865f2] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full select-none">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#949ba4] hover:text-white transition flex items-center gap-1 cursor-pointer select-none"
              >
                <Check className="h-3.5 w-3.5" />
                {t("inbox.markAllRead")}
              </button>
            )}
          </div>

          {/* List scrollable section */}
          <ScrollArea className="max-h-[360px] min-h-[120px] flex flex-col pr-1 pr-2">
            <div className="p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center select-none text-[#949ba4]">
                  <Inbox className="h-10 w-10 text-[#4e5058] mb-3 stroke-[1.5]" />
                  <p className="text-[13px] font-semibold text-white mb-1">
                    {t("inbox.empty")}
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex gap-3 p-2.5 rounded-md hover:bg-[#35373c] transition duration-150 cursor-pointer text-left border-l-2",
                      n.isRead ? "border-transparent opacity-70" : "border-[#5865f2] bg-[#35373c]/50"
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Event icon or Avatar */}
                    {n.senderAvatar ? (
                      <img
                        src={n.senderAvatar}
                        alt={n.senderName}
                        className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-[#5865f2]/10 flex items-center justify-center shrink-0 mt-0.5 text-[#5865f2] font-semibold text-xs uppercase border border-[#5865f2]/15">
                        {n.senderName.substring(0, 2)}
                      </div>
                    )}

                    {/* Metadata Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1 pr-12">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-[13px] truncate max-w-[120px]">
                          {n.senderName}
                        </span>

                        <span className="text-[11px] text-[#b5bac1] leading-none shrink-0 font-medium">
                          {n.type === "DM" && t("inbox.dm")}
                          {n.type === "MENTION" && t("inbox.mention")}
                          {n.type === "FRIEND_ACCEPTED" && t("inbox.friendAccepted")}
                          {n.type === "SERVER_INVITE" && t("inbox.serverInvite")}
                        </span>

                        {n.type === "MENTION" && n.channelName && (
                          <span className="text-[#949ba4] text-[11px] font-semibold">
                            #{n.channelName}
                          </span>
                        )}
                        {n.type === "SERVER_INVITE" && n.roomName && (
                          <span className="text-white text-[11px] font-bold">
                            {n.roomName}
                          </span>
                        )}
                      </div>

                      {n.content && (
                        <p className="text-[12px] text-[#dbdee1] truncate leading-tight mt-0.5">
                          {n.content}
                        </p>
                      )}

                      <span className="text-[10px] text-[#949ba4] font-medium leading-none mt-1">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>

                    {/* Floating Hover Controls */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition duration-150 bg-inherit pl-2">
                      {!n.isRead && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await markAsRead(n.id);
                          }}
                          className="h-8 w-8 rounded-full flex items-center justify-center bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] hover:text-white transition cursor-pointer"
                          title={t("inbox.markAllRead")}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteNotification(n.id);
                        }}
                        className="h-8 w-8 rounded-full flex items-center justify-center bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] hover:text-white transition cursor-pointer"
                        title={t("inbox.clear")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

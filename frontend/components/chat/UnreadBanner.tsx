"use client";

import { Check } from "lucide-react";
import { useTranslation, getDateLocale } from "@/lib/i18n";

interface UnreadBannerProps {
  unreadCount: number;
  /** Timestamp of the first unread message */
  since: Date;
  onMarkAsRead?: () => void;
  /** Called when clicking the banner body (scrolls to unread) */
  onClickBanner?: () => void;
}

export function UnreadBanner({
  unreadCount,
  since,
  onMarkAsRead,
  onClickBanner,
}: UnreadBannerProps) {
  const { t } = useTranslation();

  const timeStr = since.toLocaleTimeString(getDateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = since.toLocaleDateString(getDateLocale(), {
    day: "numeric",
    month: "numeric",
  });

  return (
    <div className="sticky top-0 z-30">
      <div
        className="flex items-center justify-between bg-[#5865F2] px-4 py-1 cursor-pointer hover:bg-[#4752c4] transition-colors"
        onClick={onClickBanner}
      >
        <span className="text-[13px] font-medium text-white">
          {t("chat.unreadBanner", {
            count: String(unreadCount),
            time: timeStr,
            date: dateStr,
          })}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead?.();
          }}
          className="flex items-center gap-1 text-[13px] font-medium text-white hover:underline cursor-pointer"
        >
          {t("chat.markAsRead")}
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Red "NEW" divider line rendered inline with messages */
export function NewMessageDivider() {
  const { t } = useTranslation();

  return (
    <div className="relative flex items-center mx-4 my-1">
      <div className="flex-1 border-t border-[#f23f42]" />
      <span className="ml-1 rounded bg-[#f23f42] px-1 py-px text-[10px] font-bold uppercase text-white leading-none">
        {t("chat.newLabel")}
      </span>
    </div>
  );
}

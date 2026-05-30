"use client";

import { ArrowDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ScrollToBottomBannerProps {
  visible: boolean;
  onJumpToPresent: () => void;
}

export function ScrollToBottomBanner({ visible, onJumpToPresent }: ScrollToBottomBannerProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-3 rounded-full bg-[#2b2d31]/95 px-4 py-2 shadow-lg whitespace-nowrap">
        <span className="text-[13px] font-medium text-[#dbdee1]">
          {t("chat.viewingOldMessages")}
        </span>
        <button
          onClick={onJumpToPresent}
          className="flex items-center gap-1.5 rounded-full bg-[#5865F2] px-3 py-1 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors cursor-pointer"
        >
          {t("chat.jumpToPresent")}
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

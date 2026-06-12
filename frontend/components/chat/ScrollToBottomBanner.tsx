"use client";

import { ArrowDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ScrollToBottomBannerProps {
  visible: boolean;
  onJumpToPresent: () => void;
}

export function ScrollToBottomBanner({ visible, onJumpToPresent }: ScrollToBottomBannerProps) {
  if (!visible) return null;

  return (
    <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-30">
      <button
        onClick={onJumpToPresent}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95 duration-150 cursor-pointer"
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
      >
        <ArrowDown className="h-5 w-5" />
      </button>
    </div>
  );
}

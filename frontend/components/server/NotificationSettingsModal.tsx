"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

type NotificationPreference = "all" | "mentions" | "nothing";

export function NotificationSettingsModal({
  isOpen,
  onClose,
  roomId,
  roomName,
}: NotificationSettingsModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // States
  const [isMuted, setIsMuted] = useState(false);
  const [preference, setPreference] = useState<NotificationPreference>("all");

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center font-sans text-[#dbdee1]"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className="relative z-10 w-[440px] max-h-[90vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 fade-in duration-200 border border-[#1f2023]/10"
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-white leading-tight">
            {t("notificationSettingsModal.title")}
          </h2>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 pb-5 overflow-y-auto space-y-6">
          {/* Section 1: Mute Server */}
          <div className="flex items-center justify-between gap-4 py-2 border-b border-[#35373c]/50 pb-4">
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-white text-[15px] truncate">
                {t("notificationSettingsModal.muteServer").replace("{serverName}", roomName)}
              </span>
              <span className="text-[12px] text-[#949ba4] leading-relaxed mt-1">
                {t("notificationSettingsModal.muteServerDesc")}
              </span>
            </div>

            {/* Custom toggle */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isMuted}
                onChange={(e) => setIsMuted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#80848e] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865f2]"></div>
            </label>
          </div>

          {/* Section 2: Preference Radios */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
              {t("notificationSettingsModal.serverNotificationsTitle")}
            </h3>

            <div className="space-y-2.5">
              {/* Option All */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="radio"
                  name="notificationPref"
                  checked={preference === "all"}
                  onChange={() => setPreference("all")}
                  className="sr-only peer"
                />
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#b5bac1] group-hover:border-white transition-colors peer-checked:border-[#5865f2] peer-checked:bg-[#5865f2]">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#313338] opacity-0 peer-checked:opacity-100" style={{ display: preference === "all" ? "block" : "none" }} />
                </div>
                <span className="text-sm font-medium text-[#dbdee1] group-hover:text-white transition-colors">
                  {t("notificationSettingsModal.allMessages")}
                </span>
              </label>

              {/* Option Mentions Only */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="radio"
                  name="notificationPref"
                  checked={preference === "mentions"}
                  onChange={() => setPreference("mentions")}
                  className="sr-only peer"
                />
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#b5bac1] group-hover:border-white transition-colors peer-checked:border-[#5865f2] peer-checked:bg-[#5865f2]">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#313338] opacity-0 peer-checked:opacity-100" style={{ display: preference === "mentions" ? "block" : "none" }} />
                </div>
                <span className="text-sm font-medium text-[#dbdee1] group-hover:text-white transition-colors">
                  {t("notificationSettingsModal.onlyMentions")}
                </span>
              </label>

              {/* Option Nothing */}
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="radio"
                  name="notificationPref"
                  checked={preference === "nothing"}
                  onChange={() => setPreference("nothing")}
                  className="sr-only peer"
                />
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#b5bac1] group-hover:border-white transition-colors peer-checked:border-[#5865f2] peer-checked:bg-[#5865f2]">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#313338] opacity-0 peer-checked:opacity-100" style={{ display: preference === "nothing" ? "block" : "none" }} />
                </div>
                <span className="text-sm font-medium text-[#dbdee1] group-hover:text-white transition-colors">
                  {t("notificationSettingsModal.nothing")}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#2b2d31] px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4] py-2.5 text-sm font-medium text-white transition-colors cursor-pointer select-none font-sans shadow-md text-center"
          >
            {t("notificationSettingsModal.done")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

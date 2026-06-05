"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Reply, Forward, Copy, Pin, MailWarning, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface ContextMenuDropdownProps {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  messageContent: string;
  isOwnMessage: boolean;
  isPinned?: boolean;
  onEdit?: () => void;
  onReply?: () => void;
  onMarkUnread?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onForward?: () => void;
}

export function ContextMenuDropdown({
  isOpen,
  anchorRef,
  onClose,
  messageContent,
  isOwnMessage,
  isPinned = false,
  onEdit,
  onReply,
  onMarkUnread,
  onDelete,
  onPin,
  onForward,
}: ContextMenuDropdownProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, align: "right" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && anchorRef.current && menuRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      // Default: position below anchor, aligned to right edge
      let top = anchorRect.bottom + 8;
      let left = anchorRect.right - menuRect.width;

      // Flip up if it overflows bottom
      if (top + menuRect.height > window.innerHeight) {
        top = anchorRect.top - menuRect.height - 8;
      }

      // Ensure it doesn't go off-screen left
      if (left < 0) {
        left = anchorRect.left;
      }

      setPosition({ top, left: Math.max(8, left), align: "right" });
    }
  }, [isOpen, anchorRef]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    // Use capturing to avoid immediate close from the trigger click
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    document.addEventListener("keydown", handleEsc, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
      document.removeEventListener("keydown", handleEsc, { capture: true });
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !mounted) return null;

  const handleAction = (action?: () => void) => {
    if (action) {
      action();
      onClose();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent)
      .then(() => onClose())
      .catch(err => console.error("Could not copy text: ", err));
  };

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999, // ensures it floats above practically everything
      }}
      className="w-48 rounded-md border border-[#1e1f22] bg-[#111214] py-2 shadow-xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex flex-col px-2 gap-0.5">

        {isOwnMessage && (
          <button
            onClick={() => handleAction(onEdit)}
            className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
          >
            {t("chat.editMessage")}
            <Pencil className="h-4 w-4 opacity-70 group-hover:opacity-100" />
          </button>
        )}

        <button
          onClick={() => handleAction(onReply)}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
        >
          {t("chat.reply")}
          <Reply className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </button>

        <button
          onClick={() => handleAction(onForward)}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
        >
          {t("chat.forward")}
          <Forward className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
        >
          {t("chat.copyText")}
          <Copy className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </button>

        <button
          onClick={() => handleAction(onPin)}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
        >
          {isPinned ? t("chat.unpinMessage") : t("chat.pinMessage")}
          <Pin className={cn("h-4 w-4 opacity-70 group-hover:opacity-100", isPinned && "fill-current text-[#f5c211]")} />
        </button>

        <button
          onClick={() => handleAction(onMarkUnread)}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors group cursor-pointer"
        >
          {t("chat.markAsUnread")}
          <MailWarning className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </button>

        <div className="my-1 h-px w-full bg-[#1e1f22]" />

        <button
          onClick={() => handleAction(onDelete)}
          className="flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm font-medium text-[#da373c] hover:bg-[#da373c] hover:text-white transition-colors group cursor-pointer"
        >
          {t("chat.deleteMessage")}
          <Trash2 className="h-4 w-4 opacity-70 group-hover:opacity-100" />
        </button>

      </div>
    </div>
  );

  return createPortal(menu, document.body);
}

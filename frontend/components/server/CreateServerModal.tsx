"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateServerModal({ isOpen, onClose }: CreateServerModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { createRoom } = useRoomStore();

  const [serverName, setServerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setServerName("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
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
      className="fixed inset-0 z-[9999] flex items-center justify-center font-sans"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        className="relative z-10 w-[440px] max-h-[90vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 fade-in duration-200"
      >
        {/* ─── Header ─── */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-bold text-white">
            {t("createServer.title")}
          </h2>
          <p className="mt-2 text-[13px] text-[#b5bac1] leading-relaxed">
            {t("createServer.subtitle")}
          </p>
        </div>

        {/* ─── Body Form ─── */}
        <div className="px-6 pb-6 pt-2">
          <label className="text-xs font-bold uppercase tracking-wide text-[#b5bac1] block">
            {t("createServer.serverNameLabel")}
          </label>
          <input
            type="text"
            autoFocus
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="mt-2 w-full rounded-[4px] bg-[#1e1f22] p-2.5 text-white outline-none border border-transparent focus:border-[#5865f2] transition-colors text-sm"
            placeholder="My Awesome Server"
            disabled={isSubmitting}
          />
        </div>

        {/* ─── Footer Options ─── */}
        <div className="flex items-center justify-between bg-[#2b2d31] px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-medium text-white hover:underline cursor-pointer transition-colors"
          >
            {t("createServer.back")}
          </button>
          <button
            onClick={async () => {
              if (!serverName.trim()) return;
              try {
                setIsSubmitting(true);
                const newRoom = await createRoom(serverName.trim());
                // Fetch channels for the new room, then navigate
                const { fetchChannels } = useRoomStore.getState();
                await fetchChannels(newRoom.id);
                const newChannels = useRoomStore.getState().channels[newRoom.id] || [];
                const defaultCh = newChannels.find(c => c.type === "TEXT") || newChannels[0];
                onClose();
                if (defaultCh) {
                  router.push(`/channels/${newRoom.id}/${defaultCh.id}`);
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={!serverName.trim() || isSubmitting}
            className="rounded-[3px] bg-[#5865f2] hover:bg-[#4752c4] px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md select-none font-sans"
          >
            {isSubmitting ? t("createServer.creating") : t("createServer.create")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Hash, Volume2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  defaultType?: "TEXT" | "VOICE";
}

export function CreateChannelModal({ isOpen, onClose, roomId, defaultType = "TEXT" }: CreateChannelModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { createChannel } = useRoomStore();

  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE">(defaultType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setChannelName("");
      setChannelType(defaultType);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultType]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      setIsSubmitting(true);
      // Discord channels are usually lowercase without spaces
      const formattedName = channelName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      const newChannel = await createChannel(roomId, formattedName, channelType);

      onClose();
      // Navigate to new channel
      router.push(`/channels/${newChannel.id}`);
    } catch (err) {
      console.error("[CreateChannelModal] Error creating channel:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal container */}
      <form
        onSubmit={handleSubmit}
        ref={modalRef}
        className="relative z-10 w-[460px] max-h-[90vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 fade-in duration-200 text-[#dbdee1]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-bold text-foreground">
            Create Channel
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Channel Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
              Channel Type
            </label>
            <div className="space-y-2">
              {/* Text Channel Option */}
              <label
                className={cn(
                  "flex items-center gap-3 rounded-md bg-[#2b2d31] p-3 cursor-pointer border border-transparent transition-all hover:bg-[#35373c]",
                  channelType === "TEXT" && "border-brand bg-[#35373c] text-white"
                )}
              >
                <input
                  type="radio"
                  name="channelType"
                  value="TEXT"
                  checked={channelType === "TEXT"}
                  onChange={() => setChannelType("TEXT")}
                  className="sr-only"
                />
                <Hash className="h-6 w-6 text-[#80848e] shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Text</span>
                  <span className="text-xs text-[#949ba4]">Post messages, images, opinions, and puns</span>
                </div>
              </label>

              {/* Voice Channel Option */}
              <label
                className={cn(
                  "flex items-center gap-3 rounded-md bg-[#2b2d31] p-3 cursor-pointer border border-transparent transition-all hover:bg-[#35373c]",
                  channelType === "VOICE" && "border-brand bg-[#35373c] text-white"
                )}
              >
                <input
                  type="radio"
                  name="channelType"
                  value="VOICE"
                  checked={channelType === "VOICE"}
                  onChange={() => setChannelType("VOICE")}
                  className="sr-only"
                />
                <Volume2 className="h-6 w-6 text-[#80848e] shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Voice</span>
                  <span className="text-xs text-[#949ba4]">Hang out together with voice, video, and screen share</span>
                </div>
              </label>
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-lg text-[#80848e] font-semibold">#</span>
              <input
                type="text"
                autoFocus
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-md bg-[#1e1f22] pl-8 pr-3 py-2.5 text-sm text-foreground outline-none border border-transparent focus:border-brand transition-colors"
                placeholder="new-channel"
                disabled={isSubmitting}
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 bg-[#2b2d31] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-medium hover:underline cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!channelName.trim() || isSubmitting}
            className="rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/80 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

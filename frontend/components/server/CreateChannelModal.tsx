"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Hash, Volume2, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";
import { useRouter } from "next/navigation";

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
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setChannelName("");
      setChannelType(defaultType);
      setIsPrivate(false);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultType]);

  // Escape key close
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      setIsSubmitting(true);
      const formattedName = channelName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      const newChannel = await createChannel(roomId, formattedName, channelType);

      if (isPrivate) {
        // Double-action: chain updates to set the channel as private
        await useRoomStore.getState().updateChannel(roomId, newChannel.id, {
          name: formattedName,
          isPrivate: true,
        });
      }

      onClose();
      router.push(`/channels/${roomId}/${newChannel.id}`);
    } catch (err) {
      console.error("[CreateChannelModal] Error creating channel:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabel = channelType === "TEXT" ? t("channelSettings.textChannel") : t("channelSettings.voiceChannel");

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 transition-all duration-200"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        ref={modalRef}
        className="relative w-[460px] max-h-[90vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 duration-200 text-[#dbdee1]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-bold text-white">
            {t("channelSettings.createAction")}
          </h2>
          <p className="text-xs text-[#949ba4] mt-0.5">
            {t("channelSettings.inCategory", { category: categoryLabel })}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Channel Type */}
          <div className="space-y-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#b5bac1]">
              {t("channelSettings.channelType")}
            </span>
            <div className="space-y-2">
              {/* Text Option */}
              <label
                className={cn(
                  "flex items-center gap-3 rounded-md bg-[#2b2d31] p-3.5 cursor-pointer border border-transparent transition-all hover:bg-[#35373c]",
                  channelType === "TEXT" && "bg-[#35373c] text-white"
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
                <Hash className="h-6 w-6 text-[#b5bac1] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm">{t("channelSettings.textOption")}</span>
                  <span className="text-xs text-[#949ba4] leading-relaxed mt-0.5">
                    {t("channelSettings.textOptionDesc")}
                  </span>
                </div>
                <div className={cn(
                  "ml-auto h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  channelType === "TEXT" ? "border-[#5865f2] bg-[#5865f2]" : "border-[#80848e]"
                )}>
                  {channelType === "TEXT" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </label>

              {/* Voice Option */}
              <label
                className={cn(
                  "flex items-center gap-3 rounded-md bg-[#2b2d31] p-3.5 cursor-pointer border border-transparent transition-all hover:bg-[#35373c]",
                  channelType === "VOICE" && "bg-[#35373c] text-white"
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
                <Volume2 className="h-6 w-6 text-[#b5bac1] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm">{t("channelSettings.voiceOption")}</span>
                  <span className="text-xs text-[#949ba4] leading-relaxed mt-0.5">
                    {t("channelSettings.voiceOptionDesc")}
                  </span>
                </div>
                <div className={cn(
                  "ml-auto h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  channelType === "VOICE" ? "border-[#5865f2] bg-[#5865f2]" : "border-[#80848e]"
                )}>
                  {channelType === "VOICE" && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </label>
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold uppercase tracking-wider text-[#b5bac1]">
              {t("channelSettings.channelName")}
            </label>
            <div className="relative flex items-center">
              {channelType === "TEXT" ? (
                <Hash className="absolute left-3 h-4 w-4 text-[#80848e] shrink-0" />
              ) : (
                <Volume2 className="absolute left-3 h-4 w-4 text-[#80848e] shrink-0" />
              )}
              <input
                type="text"
                autoFocus
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-md bg-[#1e1f22] pl-10 pr-3 py-2.5 text-sm text-white outline-none border border-transparent focus:border-brand transition-colors"
                placeholder={t("channelSettings.newChannelPlaceholder")}
                disabled={isSubmitting}
                maxLength={100}
              />
            </div>
          </div>

          {/* Private Channel Toggle Switch */}
          <div className="rounded-md bg-[#2b2d31]/50 p-4 flex items-center justify-between gap-4 border border-[#1f2023]/10">
            <div className="flex gap-3 min-w-0">
              <Lock className="h-5 w-5 text-[#80848e] shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-white text-sm">
                  {t("channelSettings.privateChannel")}
                </span>
                <span className="text-xs text-[#949ba4] leading-relaxed mt-1">
                  {t("channelSettings.privateDesc")}
                </span>
              </div>
            </div>

            {/* Custom Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#80848e] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865f2]"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-6 bg-[#2b2d31] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-semibold hover:underline cursor-pointer text-white"
          >
            {t("modal.cancel")}
          </button>
          <button
            type="submit"
            disabled={!channelName.trim() || isSubmitting}
            className="rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white px-5 py-2 text-sm font-semibold shadow transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? t("channelSettings.creating") : t("channelSettings.createAction")}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

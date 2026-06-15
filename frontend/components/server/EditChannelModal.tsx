"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Hash, Volume2, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";
import { useRouter, useParams } from "next/navigation";
import { ConfirmModal } from "../ui/ConfirmModal";
import type { Channel } from "@/types";

interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channel: Channel;
}

type SettingsTab = "overview";

export function EditChannelModal({ isOpen, onClose, roomId, channel }: EditChannelModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();

  const { channels: channelsMap, updateChannel, deleteChannel } = useRoomStore();
  const serverChannels = channelsMap[roomId] || [];

  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
  const [channelName, setChannelName] = useState(channel.name);
  const [channelTopic, setChannelTopic] = useState(channel.topic || "");
  const [isPrivateChannel, setIsPrivateChannel] = useState(channel.isPrivate || false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if anything has been modified to show saved changes bar
  const hasChanges =
    channelName !== channel.name ||
    channelTopic !== (channel.topic || "") ||
    isPrivateChannel !== (channel.isPrivate || false);

  // Reset inputs when modal or channel changes
  useEffect(() => {
    if (isOpen) {
      setChannelName(channel.name);
      setChannelTopic(channel.topic || "");
      setIsPrivateChannel(channel.isPrivate || false);
      setActiveTab("overview");
      setErrorMessage(null);
    }
  }, [isOpen, channel]);

  // Escape key support
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !showDeleteConfirm) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showDeleteConfirm, onClose]);

  // Lock scroll
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

  const handleReset = () => {
    setChannelName(channel.name);
    setChannelTopic(channel.topic || "");
    setIsPrivateChannel(channel.isPrivate || false);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!channelName.trim()) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const formattedName = channelName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

      await updateChannel(roomId, channel.id, {
        name: formattedName,
        topic: channelTopic.trim() || null,
        isPrivate: isPrivateChannel,
      });

      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("[EditChannelModal] Save failed:", err);
      setErrorMessage(err.message || "Failed to update channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const activeChannelId = params?.channelId as string;
      const isViewingDeleted = activeChannelId === channel.id;

      if (isViewingDeleted) {
        // Find safe peer landing point
        const remaining = serverChannels.filter((c) => c.id !== channel.id);
        const target = remaining[0];
        if (target) {
          router.push(`/channels/${roomId}/${target.id}`);
        } else {
          router.push(`/channels/${roomId}`);
        }
      }

      await deleteChannel(roomId, channel.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("[EditChannelModal] Delete failed:", err);
      setErrorMessage(err.message || "Failed to delete channel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isText = channel.type === "TEXT";
  const channelTypeLabel = isText
    ? t("channelSettings.textChannel")
    : t("channelSettings.voiceChannel");

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex bg-[#313338] text-[#dbdee1] animate-in fade-in duration-200">
      {/* 2-Column Main Layout (Centered) */}
      <div className="flex h-full w-full justify-center overflow-hidden">
        {/* Left Navigation Sidebar Column Wrapper */}
        <div className="flex-[0.8_0_260px] bg-[#2b2d31] flex justify-end border-r border-[#1f2023]/20 select-none">
          <div className="w-[260px] flex flex-col justify-between p-6 pr-4 shrink-0 pt-10">
            <div className="space-y-4">
              {/* Category header */}
              <div className="px-2 pb-1">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#949ba4] flex items-center gap-1.5 select-none">
                  {isText ? (
                    <Hash className="h-3.5 w-3.5 text-[#949ba4] shrink-0" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-[#949ba4] shrink-0" />
                  )}
                  <span className="truncate">{channel.name}</span>
                  <span className="text-[#949ba4]/50 ml-0.5 font-bold text-[10px]">
                    {channelTypeLabel}
                  </span>
                </span>
              </div>

              {/* Links list */}
              <nav className="space-y-0.5">
                <div
                  className="w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium bg-[#35373c] text-white select-none"
                >
                  {t("channelSettings.overview")}
                </div>
              </nav>

              <div className="border-t border-[#35373c]/60 my-2 mx-2" />

              {/* Destructive Action option */}
              {serverChannels.length > 1 ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left font-medium text-[#f23f43] hover:bg-[#f23f43]/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("channelSettings.deleteChannel")}
                </button>
              ) : (
                <div
                  title={t("channelSettings.cannotDeleteLast")}
                  className="px-2.5 py-1.5 text-xs text-[#949ba4] opacity-50 cursor-not-allowed"
                >
                  {t("channelSettings.cannotDeleteLast")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Tab Content Workspace Column Wrapper */}
        <div className="flex-[1.8_1_800px] bg-[#313338] flex justify-start relative min-w-0">
          {/* Main scroll workspace */}
          <div className="flex-1 overflow-y-auto px-[40px] md:px-[60px] lg:px-[80px] py-[60px]">
            {/* ESC close bubble */}
            <div className="absolute right-[40px] top-[40px] md:right-[60px] z-[9995]">
              <div className="flex flex-col items-center">
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#b5bac1] hover:border-white text-[#b5bac1] hover:text-white transition-all cursor-pointer rotate-0 hover:rotate-90"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
                <span className="text-[12px] font-semibold text-[#b5bac1] mt-2 select-none uppercase">
                  ESC
                </span>
              </div>
            </div>

            {/* Error Message display banner */}
            {errorMessage && (
              <div className="mb-6 rounded-md bg-[#f23f43]/15 border border-[#f23f43]/30 p-3 text-sm text-[#f23f43]">
                {errorMessage}
              </div>
            )}

            {/* Switch Active Screen */}
            {activeTab === "overview" && (
              <div className="max-w-[800px] w-full space-y-6 animate-in fade-in duration-300">
                <h2 className="text-xl font-bold text-white mb-6">
                  {t("channelSettings.overview")}
                </h2>

                {/* Name field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
                    {t("channelSettings.channelName")}
                  </label>
                  <div className="relative flex items-center">
                    {isText ? (
                      <Hash className="absolute left-3 h-4 w-4 text-[#80848e] shrink-0" />
                    ) : (
                      <Volume2 className="absolute left-3 h-4 w-4 text-[#80848e] shrink-0" />
                    )}
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      className="w-full rounded-md bg-[#1e1f22] pl-9 pr-3 py-2.5 text-sm text-foreground outline-none border border-transparent focus:border-brand-primary transition-colors text-white"
                      placeholder={t("channelSettings.newChannelPlaceholder")}
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Topic field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
                    {t("channelSettings.channelTopic")}
                  </label>
                  <textarea
                    rows={4}
                    value={channelTopic}
                    onChange={(e) => setChannelTopic(e.target.value)}
                    className="w-full rounded-md bg-[#1e1f22] px-3 py-2.5 text-sm text-foreground outline-none border border-transparent focus:border-brand-primary transition-colors text-white resize-none"
                    placeholder={t("channelSettings.topicPlaceholder")}
                    maxLength={1024}
                  />
                  <div className="text-right text-[11px] text-[#949ba4]">
                    {1024 - channelTopic.length} / 1024
                  </div>
                </div>
              </div>
            )}

            {/* Active Tab screens */}
          </div>

          {/* Bottom Floating Sticky Saves Changes Bar */}
          {hasChanges && (
            <div className="absolute bottom-4 left-6 right-6 z-[9990] flex items-center justify-between bg-[#111214] px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-5 duration-300 border border-[#1e1f22]/50">
              <span className="text-xs font-semibold text-[#dbdee1]">
                {t("channelSettings.unsavedWarning")}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-white hover:underline cursor-pointer disabled:opacity-50"
                >
                  {t("channelSettings.reset")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting || !channelName.trim()}
                  className="rounded bg-[#248046] hover:bg-[#1a6535] text-white px-4 py-1.5 text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "..." : t("channelSettings.saveChanges")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Trigger (using reusable ConfirmModal) */}
      {showDeleteConfirm && (
        <ConfirmModal
          title={`${t("channelSettings.deleteAction")} ${channel.name}`}
          description={
            <p>
              {t("channelSettings.deleteConfirm")}{" "}
              <strong className="text-white">#{channel.name}</strong>{" "}
              {t("channelSettings.deleteConfirmSuffix")}
            </p>
          }
          confirmText={t("channelSettings.deleteChannel")}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>,
    document.body
  );
}

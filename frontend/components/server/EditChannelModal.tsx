"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Hash, Volume2, Lock, Trash2 } from "lucide-react";
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

type SettingsTab = "overview" | "permissions";

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
    } catch (err: any) {
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
    } catch (err: any) {
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
      {/* 2-Column Main Layout */}
      <div className="flex h-full w-full max-w-[1920px] mx-auto overflow-hidden">
        {/* Left Navigation Sidebar (1/3rd width or 280px minimum) */}
        <div className="w-[280px] bg-[#2b2d31] flex flex-col justify-between p-6 pr-2 shrink-0 border-r border-[#1f2023]/20 select-none">
          <div className="space-y-4 pt-10">
            {/* Category header */}
            <div className="px-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block truncate">
                #{channel.name} {channelTypeLabel}
              </span>
            </div>

            {/* Links list */}
            <nav className="space-y-0.5">
              <button
                onClick={() => setActiveTab("overview")}
                className={cn(
                  "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left transition-colors font-medium cursor-pointer",
                  activeTab === "overview"
                    ? "bg-[#35373c] text-white"
                    : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                )}
              >
                {t("channelSettings.overview")}
              </button>

              <button
                onClick={() => setActiveTab("permissions")}
                className={cn(
                  "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left transition-colors font-medium cursor-pointer",
                  activeTab === "permissions"
                    ? "bg-[#35373c] text-white"
                    : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                )}
              >
                {t("channelSettings.permissions")}
              </button>
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

        {/* Right Tab Content Workspace */}
        <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
          {/* Main scroll workspace */}
          <div className="flex-1 overflow-y-auto px-[40px] md:px-[60px] lg:px-[100px] py-[60px]">
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
              <div className="max-w-[660px] space-y-6 animate-in fade-in duration-300">
                <h2 className="text-xl font-bold text-white mb-6">
                  {t("channelSettings.overview")}
                </h2>

                {/* Name field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
                    {t("channelSettings.channelName")}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[#80848e] font-semibold">#</span>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      className="w-full rounded-md bg-[#1e1f22] pl-8 pr-3 py-2.5 text-sm text-foreground outline-none border border-transparent focus:border-brand-primary transition-colors text-white"
                      placeholder="new-channel"
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

            {activeTab === "permissions" && (
              <div className="max-w-[660px] space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {t("channelSettings.permissionsTitle")}
                  </h2>
                  <p className="text-sm text-[#949ba4]">
                    {t("channelSettings.permissionsDesc")}
                  </p>
                </div>

                <div className="border-t border-[#35373c]/60 my-2" />

                {/* Private Channel Toggler Card (Matching images) */}
                <div className="rounded-md bg-[#2b2d31] p-4 flex items-center justify-between gap-4 border border-[#1f2023]/20 shadow">
                  <div className="flex gap-3 min-w-0">
                    <Lock className="h-6 w-6 text-[#ef3f43]/80 shrink-0 mt-0.5" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-white text-sm">
                        {t("channelSettings.privateChannel")}
                      </span>
                      <span className="text-xs text-[#949ba4] leading-relaxed mt-1">
                        {t("channelSettings.privateDesc")}
                      </span>
                    </div>
                  </div>

                  {/* HTML Custom Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isPrivateChannel}
                      onChange={(e) => setIsPrivateChannel(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#80848e] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            )}
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

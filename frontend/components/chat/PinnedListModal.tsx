"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X, CornerUpRight, Trash2, FileIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useChatStore } from "@/stores/chatStore";
import { getResolvedFileUrl } from "@/lib/fileResolver";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";

const EMPTY_MEMBERS: any[] = [];

interface PinnedListModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  onJumpToMessage: (messageId: string) => void;
}

function PinnedMessageItem({
  msg,
  avatarSrc,
  status,
  channelId,
  onJumpToMessage,
  unpinMessage,
}: {
  msg: any;
  avatarSrc?: string | null;
  status?: string | null;
  channelId: string;
  onJumpToMessage: (id: string) => void;
  unpinMessage: (channelId: string, id: string) => void;
}) {
  const { t } = useTranslation();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!msg.fileKey) {
      setResolvedUrl(null);
      return;
    }

    let isMounted = true;
    getResolvedFileUrl(msg.fileKey)
      .then((url) => {
        if (isMounted) setResolvedUrl(url);
      })
      .catch((err) => {
        console.error("Failed to resolve pin attachment presigned URL", err);
      });
    return () => {
      isMounted = false;
    };
  }, [msg.fileKey]);

  const hasAttachment = !!msg.fileKey;

  const isImage =
    resolvedUrl?.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ||
    msg.fileName?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);

  const isVideo =
    resolvedUrl?.match(/\.(mp4|webm|mov)($|\?)/i) ||
    msg.fileName?.match(/\.(mp4|webm|mov)$/i);

  const isAudio =
    resolvedUrl?.match(/\.(mp3|wav|ogg)($|\?)/i) ||
    msg.fileName?.match(/\.(mp3|wav|ogg)$/i);

  return (
    <div className="group relative rounded-md border border-[#1e1f22] bg-[#111214] p-3 transition hover:border-[#35363c]">
      {/* Actions overlay */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150 z-10">
        <button
          onClick={() => onJumpToMessage(msg.id || msg.messageId || "")}
          title={t("chat.jumpToMessage")}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c] hover:text-white transition cursor-pointer"
        >
          <CornerUpRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => unpinMessage(channelId, msg.messageId || msg.id || "")}
          title={t("chat.unpinMessage")}
          className="flex h-7 w-7 items-center justify-center rounded bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c] hover:text-white transition cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Msg Author & Info */}
      <div className="flex items-start gap-2.5">
        <StatusAvatar
          src={avatarSrc}
          fallback={msg.senderName}
          size="md"
          status={status as any}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">{msg.senderName}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(msg.createdAt).toLocaleDateString()}
            </span>
          </div>

          {msg.content && (
            <div className="mt-1 text-sm text-[#dbdee1] break-words whitespace-normal">
              {msg.content}
            </div>
          )}

          {/* Attachment preview */}
          {hasAttachment && (
            <div className="mt-2" style={{ overflowAnchor: "none" }}>
              {!resolvedUrl ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded max-w-sm">
                  <div className="h-3.5 w-3.5 rounded-full border border-primary border-t-transparent animate-spin shrink-0" />
                  <span>Loading...</span>
                </div>
              ) : isImage ? (
                <div className="relative max-w-full">
                  <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={resolvedUrl}
                      alt={msg.fileName || "attachment"}
                      className="max-h-[160px] max-w-full object-contain rounded-md shadow-sm border border-border/50 hover:brightness-95 hover:shadow-md transition duration-150 cursor-pointer"
                      loading="lazy"
                    />
                  </a>
                </div>
              ) : isVideo ? (
                <video
                  src={resolvedUrl}
                  controls
                  className="max-h-[160px] max-w-full rounded border border-border/50"
                  preload="metadata"
                />
              ) : isAudio ? (
                <audio src={resolvedUrl} controls className="w-full mt-1" />
              ) : (
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[#00a8fc] hover:underline"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-accent" />
                  <span className="truncate">{msg.fileName || "Unknown file"}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_PINNED_MESSAGES: any[] = [];

export function PinnedListModal({
  isOpen,
  onClose,
  roomId,
  channelId,
  onJumpToMessage,
}: PinnedListModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const pinnedMessages = useChatStore((s) => s.pinnedMessages[channelId] || EMPTY_PINNED_MESSAGES);
  const fetchPinned = useChatStore((s) => s.fetchPinnedMessages);
  const unpinMessage = useChatStore((s) => s.unpinMessage);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const members = useRoomStore((s) => s.members[roomId] ?? EMPTY_MEMBERS);

  // Build avatar lookup map for pinned messages
  const memberAvatarMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (members) {
      for (const m of members) {
        map[m.userId] = m.avatarUrl || null;
      }
    }
    if (currentUserId) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id === currentUserId) {
        map[currentUserId] = currentUser.avatarUrl || null;
      }
    }
    return map;
  }, [members, currentUserId]);

  const memberStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (members) {
      for (const m of members) {
        map[m.userId] = m.status || "OFFLINE";
      }
    }
    if (currentUserId) {
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id === currentUserId) {
        map[currentUserId] = currentUser.status || "OFFLINE";
      }
    }
    return map;
  }, [members, currentUserId]);

  useEffect(() => {
    if (isOpen && roomId && channelId) {
      fetchPinned(roomId, channelId);
    }
  }, [isOpen, roomId, channelId, fetchPinned]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="absolute right-4 top-14 z-50 flex w-[480px] max-h-[80vh] flex-col rounded-md border border-[#1e1f22] bg-[#2b2d31] shadow-2xl animate-in slide-in-from-top-2 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1f2023] px-4 py-3 bg-[#1e1f22] rounded-t-md">
        <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-1.5">
          {t("chat.pinnedMessages")}
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-[#35373c]/50 p-1.5 rounded-full transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-[#949ba4]">{t("chat.noPinnedMessages")}</p>
          </div>
        ) : (
          pinnedMessages.map((msg) => {
            const avatarSrc = memberAvatarMap[msg.senderId] !== undefined ? memberAvatarMap[msg.senderId] : msg.senderAvatar;
            const status = memberStatusMap[msg.senderId] as any;
            return (
              <PinnedMessageItem
                key={msg.id}
                msg={msg}
                avatarSrc={avatarSrc}
                status={status}
                channelId={channelId}
                onJumpToMessage={onJumpToMessage}
                unpinMessage={unpinMessage}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

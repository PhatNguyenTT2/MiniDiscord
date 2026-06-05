"use client";

import { useEffect, useRef, useState } from "react";
import { X, CornerUpRight, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useChatStore } from "@/stores/chatStore";
import { api } from "@/lib/api";

interface PinnedListModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  onJumpToMessage: (messageId: string) => void;
}

function PinnedAttachment({ fileKey, fileName }: { fileKey: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchUrl = async () => {
      try {
        const res = await api.get<{ data: { url: string; expiresIn: number } }>(
          `/files/url?key=${encodeURIComponent(fileKey)}`
        );
        if (isMounted) setUrl(res.data.data.url);
      } catch (err) {
        console.error("Failed to resolve pin attachment presigned URL", err);
      }
    };
    fetchUrl();
    return () => {
      isMounted = false;
    };
  }, [fileKey]);

  if (!url) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#949ba4] bg-secondary/50 p-2 rounded">
        <div className="h-3.5 w-3.5 rounded-full border border-primary border-t-transparent animate-spin shrink-0" />
        <span>Loading...</span>
      </div>
    );
  }

  const isImage =
    url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ||
    fileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);

  if (isImage) {
    return (
      <div className="max-h-[160px] overflow-hidden rounded">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={fileName}
            className="max-h-[160px] max-w-full object-contain cursor-zoom-in animate-in fade-in"
          />
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-[#00a8fc] hover:underline"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="truncate">{fileName}</span>
    </a>
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
            const hasAttachment = msg.fileKey && (msg.type === "IMAGE" || msg.type === "FILE" || msg.fileName);

            return (
              <div
                key={msg.id}
                className="group relative rounded-md border border-[#1e1f22] bg-[#111214] p-3 transition hover:border-[#35363c]"
              >
                {/* Actions overlay */}
                <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
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
                  <div className="h-8 w-8 rounded-full bg-[#35363c] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                    {msg.senderAvatar ? (
                      <img src={msg.senderAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      msg.senderName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-[#dbdee1] break-words whitespace-normal">
                      {msg.content}
                    </div>

                    {/* Attachment preview */}
                    {hasAttachment && (
                      <div className="mt-2 rounded-md border border-[#1e1f22] bg-[#2b2d31] p-2 max-w-sm">
                        <PinnedAttachment fileKey={msg.fileKey!} fileName={msg.fileName!} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

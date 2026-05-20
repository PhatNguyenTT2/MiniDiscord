"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Smile, Gift, Sticker, X, Reply, FileUp, Image as ImageIcon, Video, Loader2, FileIcon, AlertTriangle } from "lucide-react";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { useChatStore } from "@/stores/chatStore";
import { useFileStore } from "@/stores/fileStore";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AttachmentData = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
};

interface MessageInputProps {
  channelName: string;
  isDm?: boolean;
  onSend?: (content: string, attachment?: AttachmentData | null) => void;
  onTyping?: () => void;
}

function GifIcon() {
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[3px] border-2 border-current text-[10px] font-bold leading-none">
      GIF
    </span>
  );
}

export function MessageInput({ channelName, isDm, onSend, onTyping }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingTime = useRef<number>(0);
  const sendTimestamps = useRef<number[]>([]);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useTranslation();

  const RATE_LIMIT_MAX = 5; // max messages
  const RATE_LIMIT_WINDOW = 3000; // within 3 seconds
  const RATE_LIMIT_COOLDOWN = 3; // cooldown in seconds

  const replyingTo = useChatStore((s) => s.replyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);

  const { isUploading, uploadProgress, uploadFile } = useFileStore();

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  // Auto-focus input when reply mode activates
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!message.trim() && !attachment) || isUploading) return;

    // Rate limit check
    if (rateLimitCooldown > 0) return;

    const now = Date.now();
    sendTimestamps.current = sendTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW
    );
    sendTimestamps.current.push(now);

    if (sendTimestamps.current.length > RATE_LIMIT_MAX) {
      // Trigger cooldown
      setRateLimitCooldown(RATE_LIMIT_COOLDOWN);
      cooldownTimer.current = setInterval(() => {
        setRateLimitCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
            sendTimestamps.current = [];
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    onSend?.(message.trim(), attachment);
    setMessage("");
    setAttachment(null);
  }

  function handleEmojiSelect(emoji: string) {
    setMessage((prev) => prev + emoji);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsAttachOpen(false);

    try {
      const res = await uploadFile(file);
      setAttachment({
        fileUrl: res.fileUrl,
        fileName: res.fileName,
        fileSize: res.fileSize,
      });
      // Focus input after upload
      inputRef.current?.focus();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      // Reset input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Click-outside to close attachment menu
  useEffect(() => {
    if (!isAttachOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setIsAttachOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAttachOpen]);

  const ATTACH_ITEMS = [
    { icon: FileUp, label: t("chat.uploadFile"), accept: "*" },
    { icon: ImageIcon, label: t("chat.uploadImage"), accept: "image/*" },
    { icon: Video, label: t("chat.uploadVideo"), accept: "video/*" },
  ];

  const placeholder = isDm
    ? t("chat.messagePlaceholderDm", { userName: channelName })
    : t("chat.messagePlaceholderChannel", { channelName });

  return (
    <div
      className="absolute inset-x-0 z-20 px-4"
      style={{ bottom: "var(--floating-bar-gap)" }}
    >
      {/* Floating shell keeps the composer inside column 3 and visually detached from the screen edges. */}
      <div
        className="shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
        style={{
          borderRadius: "var(--floating-bar-radius)",
          backgroundColor: "#383a40",
        }}
      >
        {/* Rate limit warning */}
        {rateLimitCooldown > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-warning bg-warning/10 rounded-t-[var(--floating-bar-radius)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t("chat.rateLimited")}{" "}
              {t("chat.rateLimitWait", { seconds: rateLimitCooldown })}
            </span>
          </div>
        )}
        {/* Reply content lives inside the same shell so the whole composer reads as one floating bar. */}
        {replyingTo && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <Reply className="h-3.5 w-3.5 shrink-0 rotate-180 text-accent" />
              <span className="text-sm text-muted-foreground">
                Đang trả lời{" "}
                <strong className="font-semibold text-foreground">
                  {replyingTo.senderName}
                </strong>
              </span>
              <span className="max-w-[300px] truncate text-xs text-muted-foreground/60">
                — {replyingTo.content}
              </span>
            </div>
            <button
              type="button"
              onClick={clearReplyingTo}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              aria-label="Hủy trả lời"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Attachment Preview/Progress UI */}
        {(isUploading || attachment || uploadError) && (
          <div className="px-4 pt-3 pb-1 border-b border-border/20 flex gap-3 overflow-x-auto">
            {isUploading && (
              <div className="relative flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded bg-[#2b2d31] p-2 border border-border/50">
                <Loader2 className="h-8 w-8 animate-spin text-accent mb-2" />
                <span className="text-xs font-medium text-muted-foreground">{uploadProgress}%</span>
              </div>
            )}

            {uploadError && (
              <div className="relative flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded bg-[#2b2d31] p-2 border border-destructive/50">
                <span className="text-xs font-semibold text-destructive text-center">{uploadError}</span>
                <button
                  onClick={() => setUploadError(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md hover:bg-destructive/80 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {attachment && !isUploading && (
              <div className="relative group flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded bg-[#2b2d31] p-2 border border-border/50">
                {attachment.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <img src={attachment.fileUrl} alt={attachment.fileName} className="h-full w-full object-cover rounded shadow-sm" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileIcon className="h-10 w-10 text-accent" />
                    <span className="text-[10px] text-muted-foreground text-center truncate w-full px-2" title={attachment.fileName}>
                      {attachment.fileName}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setAttachment(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 scale-0 items-center justify-center rounded-full bg-background-tertiary text-foreground shadow-md transition-all group-hover:scale-100 hover:bg-destructive border border-border cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={cn(
            "message-input-wrapper flex items-center gap-2 px-4 text-foreground",
            replyingTo ? "pb-3 pt-1.5" : "py-2.5"
          )}
        >
          <div className="relative" ref={attachRef}>
            <button
              type="button"
              onClick={() => setIsAttachOpen((v) => !v)}
              aria-label="Đính kèm file"
              className={cn(
                "flex h-[40px] w-7 shrink-0 items-center justify-center transition-colors cursor-pointer",
                isAttachOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-[22px] w-[22px]" />
            </button>

            {/* Attachment Popover */}
            {isAttachOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 w-48 rounded-lg bg-[#2b2d31] p-1.5 shadow-xl border border-border/30 z-30">
                {ATTACH_ITEMS.map(({ icon: Icon, label, accept }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = accept;
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded px-2.5 py-2 text-[14px] text-[#dbdee1] hover:bg-[#4752c4] hover:text-white transition-colors cursor-pointer"
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              const now = Date.now();
              if (now - lastTypingTime.current > 3000) {
                lastTypingTime.current = now;
                onTyping?.();
              }
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-[11px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:outline-none"
          />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Gift / Nitro"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <Gift className="h-[22px] w-[22px]" />
            </button>
            <button
              type="button"
              aria-label="GIF"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <GifIcon />
            </button>
            <button
              type="button"
              aria-label="Sticker"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <Sticker className="h-[22px] w-[22px]" />
            </button>

            <EmojiPicker onEmojiSelect={handleEmojiSelect} position="top">
              <button
                type="button"
                aria-label="Emoji"
                className="flex h-[34px] w-[34px] items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                <Smile className="h-[22px] w-[22px]" />
              </button>
            </EmojiPicker>
          </div>
        </form>
      </div>
    </div>
  );
}

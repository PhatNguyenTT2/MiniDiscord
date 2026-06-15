"use client";
import { useState, useRef, useEffect } from "react";
import { FileUp, ImageIcon, Video, AlertTriangle, Smile, Plus, X, Reply, ArrowDown, Sticker as StickerIcon } from "lucide-react";
import { useTranslation, getDateLocale } from "@/lib/i18n";
import { ExpressionPicker } from "@/components/ui/ExpressionPicker";
import { useFileStore } from "@/stores/fileStore";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import type { MemberDetailResponse } from "@/types/room";
import { MentionPicker } from "./MentionPicker";
import { useAuthStore } from "@/stores/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";
import { useParams } from "next/navigation";

export type AttachmentData = {
  fileName: string;
  fileSize: number;
  fileKey: string;
};

interface MessageInputProps {
  channelId: string;
  channelName: string;
  isDm?: boolean;
  onSend?: (content: string, attachment: AttachmentData | null, mentions?: string[], stickerIds?: string[]) => void;
  onTyping?: () => void;
  typingUsers?: { userId: string; username: string }[];
  members?: MemberDetailResponse[];
  showScrollDown?: boolean;
  onScrollDown?: () => void;
}

const EMPTY_TYPING: { userId: string; username: string }[] = [];

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function MessageInput({
  channelId,
  channelName,
  isDm,
  onSend,
  onTyping,
  typingUsers = EMPTY_TYPING,
  members = [],
  showScrollDown,
  onScrollDown
}: MessageInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  const params = useParams();
  const roomId = params?.serverId as string;
  const canMention = useHasPermission("ALLOW_MENTION", roomId || undefined);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const me = members?.find((m) => m.userId === currentUserId);
  const [timeLeft, setTimeLeft] = useState(0);

  console.log("[E2E DEBUG MessageInput] currentUserId:", currentUserId, "me:", me, "timeLeft:", timeLeft);

  useEffect(() => {
    if (!me?.mutedUntil) {
      setTimeLeft(0);
      return;
    }

    const targetTime = new Date(me.mutedUntil).getTime();
    const calcTimeLeft = () => {
      const diff = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setTimeLeft(diff);
      return diff;
    };

    const initialDiff = calcTimeLeft();
    if (initialDiff <= 0) return;

    const interval = setInterval(() => {
      const diff = calcTimeLeft();
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [me?.mutedUntil]);

  const formatTimeLeft = (secCount: number) => {
    const h = Math.floor(secCount / 3600);
    const m = Math.floor((secCount % 3600) / 60);
    const s = secCount % 60;
    const pad = (num: number) => String(num).padStart(2, "0");
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  };

  const getFormattedMutedUntil = () => {
    if (!me?.mutedUntil) return "";
    try {
      const date = new Date(me.mutedUntil);
      return date.toLocaleString(getDateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  const isMuted = timeLeft > 0;

  // Mention states
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  const { isUploading, uploadProgress, uploadFile } = useFileStore();
  const replyingTo = useChatStore((s) => s.replyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);

  // Auto-focus input when reply mode activates
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleTypingText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    onTyping?.();

    // Trigger pattern detection
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursor);
    const lastTriggerIndex = textBeforeCursor.lastIndexOf("@");

    if (lastTriggerIndex !== -1) {
      const charBeforeTrigger = lastTriggerIndex > 0 ? textBeforeCursor[lastTriggerIndex - 1] : "";
      const isWordStart = charBeforeTrigger === "" || /\s/.test(charBeforeTrigger);
      const queryText = textBeforeCursor.slice(lastTriggerIndex + 1);
      const isQueryValid = !/\s/.test(queryText);

      if (isWordStart && isQueryValid) {
        setShowMentionPicker(true);
        setMentionQuery(queryText);
        setMentionTriggerIndex(lastTriggerIndex);
        return;
      }
    }

    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionTriggerIndex(-1);
  };

  const handleMentionSelect = (userId: string, username: string) => {
    if (mentionTriggerIndex === -1) return;
    const value = message;
    const before = value.slice(0, mentionTriggerIndex);
    const cursor = inputRef.current?.selectionStart || 0;
    const after = value.slice(cursor);

    const replacement = `@${username} `;
    setMessage(before + replacement + after);

    setShowMentionPicker(false);
    setMentionQuery("");
    setMentionTriggerIndex(-1);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = before.length + replacement.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const submitMessage = () => {
    if (isUploading) return;
    if (rateLimitCooldown > 0) return;
    if (message.trim().length === 0 && !attachment) return;

    if (message.length > 2000) {
      setRateLimitCooldown(3);
      const timer = setInterval(() => {
        setRateLimitCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    // Convert display @everyone / @here and @username to structured <@userId> tokens
    let content = message.trim();
    const mentionsList: string[] = [];

    const everyonePattern = /@everyone\b/g;
    if (everyonePattern.test(content)) {
      content = content.replace(everyonePattern, "<@everyone>");
      mentionsList.push("everyone");
    }

    if (members && members.length > 0) {
      const sortedMembers = [...members].sort((a, b) => b.username.length - a.username.length);
      sortedMembers.forEach((member) => {
        const pattern = new RegExp(`@${escapeRegExp(member.username)}\\b`, "g");
        if (pattern.test(content)) {
          content = content.replace(pattern, `<@${member.userId}>`);
          if (!mentionsList.includes(member.userId)) {
            mentionsList.push(member.userId);
          }
        }
      });
    }

    const hasEveryoneMention = mentionsList.includes("everyone");
    if (hasEveryoneMention && !canMention) {
      alert(t("chat.noMentionPermission") || "You do not have permission to mention @everyone");
      return;
    }

    onSend?.(content, attachment, mentionsList);
    setMessage("");
    setAttachment(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  function handleEmojiSelect(emoji: string) {
    setMessage((prev) => prev + emoji);
  }

  const handleStickerSelect = (stickerId: string) => {
    onSend?.("", null, [], [stickerId]);
  };

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setIsAttachOpen(false);

    let localBlobUrl: string | null = null;

    if (file.type.startsWith("image/")) {
      localBlobUrl = URL.createObjectURL(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(localBlobUrl);
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    try {
      const res = await uploadFile(file);
      setAttachment({
        fileName: res.fileName,
        fileSize: res.fileSize,
        fileKey: res.fileKey,
      });
      inputRef.current?.focus();
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
      setPreviewUrl(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileUpload(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (isUploading || attachment) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;

        const ext = blob.type.split("/")[1] || "png";
        const file = new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type });
        handleFileUpload(file);
        return;
      }
    }
  }

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

  const placeholder = isMuted
    ? t("chat.mutedPlaceholder", { time: formatTimeLeft(timeLeft) })
    : isDm
      ? t("chat.messagePlaceholderDm", { userName: channelName })
      : t("chat.messagePlaceholderChannel", { channelName });

  return (
    <div
      className="absolute inset-x-0 z-20 px-4"
      style={{ bottom: "var(--floating-bar-gap)" }}
    >
      <div
        className="relative shadow-[0_12px_30px_rgba(0,0,0,0.24)] message-input-wrapper overflow-visible"
        style={{
          borderRadius: "var(--floating-bar-radius)",
          backgroundColor: "#383a40",
        }}
      >
        <div
          className={`absolute -top-11 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 transform ${showScrollDown
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-75 translate-y-2 pointer-events-none"
            }`}
        >
          <button
            onClick={onScrollDown}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95 duration-150 cursor-pointer"
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
            type="button"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
        {isMuted && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#da373c]/10 text-[#f23f43] rounded-t-[var(--floating-bar-radius)] border-b border-[#da373c]/20 leading-tight">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#f23f43]" />
            <span className="text-xs font-semibold">
              {t("chat.mutedBanner", { time: getFormattedMutedUntil() })}
            </span>
          </div>
        )}
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#202225]/30 bg-[#2b2d31] rounded-t-[var(--floating-bar-radius)] animate-in slide-in-from-bottom-[6px] duration-150">
            <div className="flex min-w-0 items-center gap-2">
              <Reply className="h-3.5 w-3.5 shrink-0 rotate-180 text-[#b5bac1]" />
              <span className="text-[13px] text-[#b5bac1]">
                {t("chat.replyingTo")}{" "}
                <strong className="font-semibold text-white">
                  {replyingTo.senderName}
                </strong>
              </span>
              <span className="max-w-[400px] truncate text-[13px] text-[#b5bac1] opacity-60">
                — {replyingTo.content}
              </span>
            </div>
            <button
              type="button"
              onClick={clearReplyingTo}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#111214]/30 hover:bg-[#111214]/60 text-[#b5bac1] hover:text-[#dbdee1] transition-all cursor-pointer"
              aria-label={t("chat.cancelReply")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showMentionPicker && (
          <MentionPicker
            members={members}
            query={mentionQuery}
            isDm={isDm}
            onSelect={handleMentionSelect}
            onClose={() => {
              setShowMentionPicker(false);
              setMentionQuery("");
              setMentionTriggerIndex(-1);
            }}
          />
        )}

        {rateLimitCooldown > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-warning bg-warning/10 rounded-t-[var(--floating-bar-radius)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t("chat.rateLimited")}{" "}
              {t("chat.rateLimitWait", { seconds: rateLimitCooldown })}
            </span>
          </div>
        )}

        {(isUploading || previewUrl || attachment || uploadError) && (
          <div className={cn(
            "flex flex-col gap-2 p-4 border-b border-border/50 bg-[#2b2d31]",
            !replyingTo && "rounded-t-[var(--floating-bar-radius)]"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {uploadError ? (
                  <span className="text-destructive font-bold">{uploadError}</span>
                ) : isUploading ? (
                  `${t("chat.uploading")} ${uploadProgress}%`
                ) : (
                  t("chat.readyToSend")
                )}
              </span>
              {!isUploading && (
                <button
                  onClick={() => {
                    setAttachment(null);
                    setUploadError(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-white transition-colors p-1"
                  type="button"
                >
                  {t("common.remove")}
                </button>
              )}
            </div>

            {uploadError && (
              <div className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded border border-destructive/20 leading-relaxed">
                <p><strong>{t("common.error")}:</strong> 1. {t("chat.errSize")}</p>
                <p>2. {t("chat.errExecutable")}</p>
                <p className="mt-1">
                  <em>{t("chat.tryAgainOrCompress")}</em>
                </p>
              </div>
            )}

            {isUploading && (
              <div className="w-full bg-[#1e1f22] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#5865F2] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {!uploadError && (
              <div className="flex items-center gap-3 bg-[#1e1f22] p-2 rounded max-w-full">
                {previewUrl ? (
                  <div className="h-16 w-16 relative bg-black/20 rounded overflow-hidden flex items-center justify-center shrink-0">
                    <img src={previewUrl} className={cn("max-h-full max-w-full object-contain", isUploading && "opacity-50 blur-[2px]")} alt="Preview" />
                    {isUploading && <div className="absolute inset-0 flex items-center justify-center"><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                  </div>
                ) : (
                  <div className="h-12 w-12 bg-black/20 rounded flex items-center justify-center shrink-0 text-muted-foreground">
                    <FileUp size={24} />
                  </div>
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate w-[200px]" title={attachment?.fileName || t("chat.processing")}>
                    {attachment?.fileName || t("chat.processing")}
                  </span>
                  {attachment?.fileSize && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(attachment.fileSize / 1024)} KB
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="flex items-center gap-3 px-4"
          style={{ minHeight: "var(--floating-user-panel-height)" }}
        >
          {/* Left Attachment Icon */}
          <div className="relative shrink-0 flex items-center self-center" ref={attachRef}>
            <button
              onClick={() => setIsAttachOpen(!isAttachOpen)}
              className="w-6 h-6 flex items-center justify-center text-[#b5bac1] hover:text-[#dbdee1] transition-colors disabled:opacity-50 bg-[#404249] hover:bg-[#4e5058] rounded-full shrink-0 cursor-pointer"
              disabled={isUploading || isMuted}
              aria-label="Add attachment"
              type="button"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            {isAttachOpen && (
              <div className="absolute bottom-full left-0 mb-3 w-56 bg-[#2b2d31] border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col p-2 animate-in slide-in-from-bottom-2 z-50">
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                {ATTACH_ITEMS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = item.accept;
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex text-[15px] items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-white hover:bg-[#5865F2] hover:shadow-sm leading-tight transition-all rounded cursor-pointer animate-in fade-in duration-100"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Input area with Dashboard icons inline on the right */}
          <div className="relative flex-1 min-w-0 flex items-center">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleTypingText}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (showMentionPicker) return;
                  submitMessage();
                }
              }}
              placeholder={placeholder}
              className="w-full bg-transparent text-[#dbdee1] py-[7px] pl-1 pr-[82px] focus:outline-none focus:ring-0 resize-none min-h-[36px] max-h-[50vh] text-[15px] font-medium leading-[22px] placeholder:text-[#6d6f78] self-center"
              disabled={isUploading || isMuted}
              rows={Math.min(10, Math.max(1, message.split("\n").length))}
            />

            {/* Dashboard launcher right icons (Only GIF and Emoji Picker are kept) */}
            <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1.5 select-none shrink-0 z-10">

              {/* Sticker launcher button */}
              <ExpressionPicker
                onEmojiSelect={handleEmojiSelect}
                onStickerSelect={handleStickerSelect}
                defaultTab="sticker"
              >
                <button
                  type="button"
                  disabled={isUploading || isMuted}
                  className="p-[5px] text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#4e5058]/40 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer flex items-center justify-center"
                  title="Stickers"
                >
                  <StickerIcon className="h-5 w-5" />
                </button>
              </ExpressionPicker>

              {/* Emoji Picker launcher */}
              <ExpressionPicker
                onEmojiSelect={handleEmojiSelect}
                onStickerSelect={handleStickerSelect}
                defaultTab="emoji"
              >
                <button
                  type="button"
                  disabled={isUploading || isMuted}
                  className="p-[5px] text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#4e5058]/40 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer flex items-center justify-center"
                  title={t("chat.emoji")}
                >
                  <Smile className="h-5 w-5" />
                </button>
              </ExpressionPicker>
            </div>
          </div>
        </div>

        {typingUsers.length > 0 && (
          <div className="absolute -bottom-6 left-0 px-1 font-semibold">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in duration-300">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground animate-[bounce_1.4s_infinite_.2s]" />
                <span className="w-1 h-1 rounded-full bg-muted-foreground animate-[bounce_1.4s_infinite_.4s]" />
                <span className="w-1 h-1 rounded-full bg-muted-foreground animate-[bounce_1.4s_infinite_.6s]" />
              </span>
              {typingUsers.length === 1 && (
                <span>
                  {(() => {
                    const template = t("chat.typingSingle");
                    const parts = template.split(/(\{username\})/);
                    return parts.map((part, i) => {
                      if (part === "{username}") {
                        return <strong key={i} className="text-foreground">{typingUsers[0].username}</strong>;
                      }
                      return part;
                    });
                  })()}
                </span>
              )}
              {typingUsers.length === 2 && (
                <span>
                  {(() => {
                    const template = t("chat.typingDouble");
                    const parts = template.split(/(\{username1\}|\{username2\})/);
                    return parts.map((part, i) => {
                      if (part === "{username1}") {
                        return <strong key={i} className="text-foreground">{typingUsers[0].username}</strong>;
                      }
                      if (part === "{username2}") {
                        return <strong key={i} className="text-foreground">{typingUsers[1].username}</strong>;
                      }
                      return part;
                    });
                  })()}
                </span>
              )}
              {typingUsers.length > 2 && <span>{t("chat.typingMultiple")}</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

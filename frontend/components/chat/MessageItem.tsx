"use client";

import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { MessageActions } from "@/components/chat/MessageActions";
import { Reply, FileIcon, Pin, CornerUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { ForwardModal } from "@/components/chat/ForwardModal";
import { ImageViewerModal } from "@/components/chat/ImageViewerModal";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import type { Message } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTranslation, getDateLocale } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";

// Outside component to survive re-renders (cache)
const resolvedUrlsMap = new Map<string, { url: string; expiresAt: number }>();

interface MessageItemProps {
  message: Message;
  isGrouped?: boolean;
  channelId?: string;
  onMarkUnread?: () => void;
  memberAvatarMap?: Record<string, string | null>;
  memberStatusMap?: Record<string, string>;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(getDateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(getDateLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_MEMBERS: any[] = [];

export function MessageItem({
  message,
  isGrouped = false,
  channelId = message.channelId,
  onMarkUnread,
  memberAvatarMap,
  memberStatusMap
}: MessageItemProps) {
  const { t } = useTranslation();
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const addReaction = useChatStore((s) => s.addReaction);
  const editMessage = useChatStore((s) => s.editMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (message.fileKey) {
      const cached = resolvedUrlsMap.get(message.fileKey);
      if (cached && Date.now() < cached.expiresAt) return cached.url;
    }
    return null;
  });

  useEffect(() => {
    if (!message.fileKey) return;

    let isMounted = true;
    const cached = resolvedUrlsMap.get(message.fileKey);

    if (cached && Date.now() < cached.expiresAt - 15 * 60 * 1000) {
      if (resolvedUrl !== cached.url) setResolvedUrl(cached.url);
      return;
    }

    const fetchUrl = async () => {
      try {
        const res = await api.get<{ data: { url: string; expiresIn: number } }>(
          `/files/url?key=${encodeURIComponent(message.fileKey!)}`
        );
        const { url, expiresIn } = res.data.data;

        if (url) {
          resolvedUrlsMap.set(message.fileKey!, {
            url,
            expiresAt: Date.now() + (expiresIn * 1000)
          });
          if (isMounted) setResolvedUrl(url);
        }
      } catch (err) {
        console.error("Failed to resolve presigned URL", err);
      }
    };

    fetchUrl();
    return () => { isMounted = false; };
  }, [message.fileKey]);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const members = useRoomStore((s) => s.members[message.roomId] ?? EMPTY_MEMBERS);
  const senderMember = members.find((m) => m.userId === message.senderId);

  const getMemberUsername = (uid: string) => {
    const m = members.find((member) => member.userId === uid);
    return m ? m.username : null;
  };

  const isSelfMention = !!(
    currentUserId &&
    (message.mentions?.includes(currentUserId) ||
      message.mentions?.includes("everyone"))
  );

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(<@[^>]+>)/g);
    return parts.map((part, index) => {
      const match = part.match(/^<@([^>]+)>$/);
      if (match) {
        const mentionId = match[1];
        let username = getMemberUsername(mentionId);
        if (!username && mentionId === "everyone") {
          username = mentionId;
        }
        return (
          <span
            key={index}
            className={cn(
              "inline-flex items-center px-1.5 py-[0.5px] rounded font-medium transition-all select-all align-baseline text-[15px] cursor-pointer",
              "bg-[#5865f2]/30 text-[#dee0fc] hover:bg-[#5865f2] hover:text-white"
            )}
          >
            @{username || "Unknown User"}
          </span>
        );
      }
      return part;
    });
  };

  const pinMessage = useChatStore((s) => s.pinMessage);
  const unpinMessage = useChatStore((s) => s.unpinMessage);

  const handlePinToggle = async () => {
    try {
      if (message.isPinned) {
        await unpinMessage(channelId || message.channelId, apiId);
      } else {
        await pinMessage(channelId || message.channelId, apiId);
      }
    } catch (e: any) {
      console.error("Failed to toggle pin message:", e);
      alert(e.response?.data?.message || e.message || "Failed to toggle pin");
    }
  };

  const apiId = message.messageId || message.id;

  const status = message.senderId === currentUserId
    ? "ONLINE"
    : (memberStatusMap?.[message.senderId] || senderMember?.status || "OFFLINE");

  const avatarSrc = memberAvatarMap ? memberAvatarMap[message.senderId] : message.senderAvatar;
  const resolvedSenderName = senderMember?.username || message.senderName;
  const isBeingReplied = replyingTo?.messageId === message.id;

  function handleReply() {
    setReplyingTo({
      messageId: apiId,
      senderName: resolvedSenderName,
      content: message.content,
    });
  }

  function handleReaction(emoji: string) {
    if (channelId) addReaction(channelId, apiId, emoji);
  }

  function handleReactionBadgeClick(emoji: string) {
    if (channelId) addReaction(channelId, apiId, emoji);
  }

  function handleSaveEdit() {
    if (!channelId || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    if (editContent.trim() === "") {
      setIsEditing(false);
      return;
    }
    editMessage(channelId, apiId, editContent.trim());
    setIsEditing(false);
  }

  function handleDelete() {
    if (channelId) {
      const type = message.senderId === currentUserId ? "EVERYONE" : "FOR_ME";
      deleteMessage(channelId, apiId, type);
    }
  }

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  const isOwnMessage = message.senderId === currentUserId;
  const parentMessage = useChatStore((s) => s.channelMessages[channelId || ""]?.find(m => m.id === message.replyTo?.messageId));
  const replyContent = parentMessage?.isDeleted ? t("chat.replyDeleted") : message.replyTo?.content;
  const isReplyDeleted = parentMessage?.isDeleted || false;

  if (message.isDeleted) {
    return (
      <div className={cn("group flex gap-4 px-4 py-1 transition-colors hover:bg-background-secondary/30", !isGrouped && "mt-3 pt-1")}>
        <div className="w-10 shrink-0">
          {!isGrouped && <StatusAvatar src={avatarSrc} fallback={message.senderName} status={status as any} size="lg" />}
        </div>
        <div className="flex-1 min-w-0">
          {!isGrouped && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-semibold text-foreground text-[15px]">{message.senderName}</span>
              <time className="text-[12px] text-muted-foreground">{formatFullDate(message.createdAt)}</time>
            </div>
          )}
          <p className="text-[14px] text-muted-foreground italic">{t("chat.messageDeleted")}</p>
        </div>
      </div>
    );
  }

  if (message.type === "SYSTEM") {
    const isPinnedNotification = message.content === "pinned_message";
    return (
      <div className="group relative flex gap-4 px-4 py-1.5 transition-colors hover:bg-background-secondary/30 my-1">
        <div className="w-10 shrink-0 flex items-center justify-center">
          <Pin className="h-4 w-4 text-[#b5bac1]" />
        </div>
        <div className="flex-1 min-w-0 pr-12 text-[14.5px] leading-relaxed text-[#b5bac1]">
          <span className="font-semibold text-white hover:underline cursor-pointer mr-1.5 inline-block">
            {resolvedSenderName}
          </span>
          {isPinnedNotification ? (
            <>
              {t("chat.pinnedMessageNotification")}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-pinned-list"));
                }}
                className="font-semibold text-white hover:underline cursor-pointer select-none border-none bg-transparent p-0 outline-none hover:text-[#dbdee1] transition"
              >
                {t("chat.viewPinnedMessages")}
              </button>
            </>
          ) : (
            <span>{message.content}</span>
          )}
          <time className="text-[11px] text-muted-foreground ml-2 select-none">
            {formatTime(message.createdAt)}
          </time>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex gap-4 pr-4 py-0 transition-colors",
        isSelfMention
          ? "bg-[#f5c211]/8 hover:bg-[#f5c211]/10 border-l-2 border-[#f5c211] pl-[14px]"
          : "pl-4 hover:bg-background-secondary/30",
        !isGrouped && "mt-3 pt-1",
        isBeingReplied && (isSelfMention ? "bg-[#f5c211]/12 hover:bg-[#f5c211]/15" : "bg-accent/8 hover:bg-accent/12"),
        message.id.startsWith("optimistic-") && "opacity-50"
      )}
    >
      <div className="w-10 shrink-0">
        {!isGrouped ? (
          <StatusAvatar
            src={avatarSrc}
            fallback={resolvedSenderName}
            status={status as any}
            size="lg"
          />
        ) : (
          <div className="flex items-center justify-end w-full relative">
            {message.isPinned && (
              <Pin className="h-3.5 w-3.5 text-[#f5c211] fill-current absolute right-0 top-1 group-hover:opacity-0 transition-opacity" />
            )}
            <span className="hidden group-hover:block text-[11px] text-muted-foreground leading-[22px] text-right w-full whitespace-nowrap">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-[15px] hover:underline cursor-pointer">
              {resolvedSenderName}
            </span>
            <time className="text-[12px] text-muted-foreground">
              {formatFullDate(message.createdAt)}
            </time>
            {message.isPinned && (
              <span className="inline-flex items-center text-[#f5c211]" title={t("chat.pinnedMessage")}>
                <Pin className="h-3.5 w-3.5 fill-current" />
              </span>
            )}
          </div>
        )}

        {message.replyTo && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <Reply className="h-3 w-3 rotate-180" />
            <span className="font-semibold text-accent cursor-pointer hover:underline">
              @{message.replyTo.senderName}
            </span>
            <span className={cn("truncate", isReplyDeleted && "italic")}>
              {replyContent}
            </span>
          </div>
        )}

        {message.isForwarded && (
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground/70 italic mb-1.5 select-none pl-0">
            <CornerUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{t("chat.forwarded")}</span>
          </div>
        )}

        {isEditing ? (
          <div className="mt-1">
            <textarea
              ref={editInputRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
              className="w-full bg-[#383a40] text-white p-3 rounded-md border-none focus:outline-none focus:ring-0 resize-none min-h-[40px] text-[15px]"
              rows={Math.min(10, editContent.split("\n").length)}
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              {t("chat.editEsc")} <span className="text-accent cursor-pointer hover:underline" onClick={() => { setIsEditing(false); setEditContent(message.content); }}>{t("chat.editCancel")}</span> • {t("chat.editEnter")} <span className="text-accent cursor-pointer hover:underline" onClick={handleSaveEdit}>{t("chat.editSave")}</span>
            </div>
          </div>
        ) : (
          <p className="text-[15px] text-foreground leading-relaxed break-words whitespace-pre-line">
            {renderMessageContent(message.content)}
            {message.isEdited && (
              <span className="text-[10px] text-muted-foreground ml-1 inline-block select-none whitespace-nowrap">
                {t("chat.edited")}
              </span>
            )}
          </p>
        )}

        {(resolvedUrl || message.fileKey) && (
          <div className="mt-2">
            {!resolvedUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-3 rounded max-w-[400px]">
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Loading attachment...
              </div>
            ) : (resolvedUrl?.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || message.fileName?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) ? (
              <div className="relative">
                <img
                  src={resolvedUrl}
                  alt={message.fileName || "attachment"}
                  onClick={() => setIsImageViewerOpen(true)}
                  className="max-w-full sm:max-w-[400px] max-h-[300px] object-cover rounded-md shadow-sm border border-border/50 hover:brightness-95 hover:shadow-md transition duration-150 cursor-pointer"
                  loading="lazy"
                />
              </div>
            ) : (resolvedUrl?.match(/\.(mp4|webm|mov)($|\?)/i) || message.fileName?.match(/\.(mp4|webm|mov)$/i)) ? (
              <video
                src={resolvedUrl}
                controls
                className="max-w-full sm:max-w-[400px] max-h-[300px] rounded-md shadow-sm border border-border/50"
                preload="metadata"
              />
            ) : (resolvedUrl?.match(/\.(mp3|wav|ogg)($|\?)/i) || message.fileName?.match(/\.(mp3|wav|ogg)$/i)) ? (
              <audio src={resolvedUrl} controls className="mt-1 max-w-[400px]" />
            ) : (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded bg-secondary/50 border border-border/50 max-w-[400px] hover:bg-secondary/80 transition-colors"
                title={message.fileName || "Download file"}
              >
                <FileIcon className="h-8 w-8 text-accent shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium text-blue-400 hover:underline truncate">
                    {message.fileName || "Unknown file"}
                  </span>
                  {message.fileSize && (
                    <span className="text-[12px] text-muted-foreground mt-0.5">
                      {Math.round(message.fileSize / 1024)} KB
                    </span>
                  )}
                </div>
              </a>
            )}
          </div>
        )}

        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, i) => {
              const hasReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
              const reactorNames = reaction.userIds.map((uid) => {
                if (uid === currentUserId) return t("chat.you");
                const member = members.find((m) => m.userId === uid);
                return member?.username || uid.substring(0, 6);
              });
              const tooltipText = reactorNames.length <= 5
                ? reactorNames.join(", ")
                : `${reactorNames.slice(0, 4).join(", ")} ${t("chat.othersCount").replace("{count}", (reactorNames.length - 4).toString())}`;

              return (
                <button
                  key={`${reaction.emoji}-${i}`}
                  onClick={() => handleReactionBadgeClick(reaction.emoji)}
                  title={`${reaction.emoji} ${tooltipText}`}
                  className={cn(
                    "group/reaction relative flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs transition-all duration-200 cursor-pointer",
                    hasReacted
                      ? "bg-[#5865F2]/20 border border-[#5865F2] hover:bg-[#5865F2]/30"
                      : "bg-[#2b2d31] border border-transparent hover:border-border hover:bg-[#2b2d31]/80"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span
                    key={`count-${reaction.emoji}-${reaction.count}`}
                    className={cn(
                      "font-medium inline-block animate-[flipIn_0.3s_ease-out]",
                      hasReacted ? "text-[#5865F2]" : "text-muted-foreground"
                    )}
                  >
                    {reaction.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isEditing && (
        <MessageActions
          onReaction={handleReaction}
          onReply={handleReply}
          onEdit={() => { setIsEditing(true); setEditContent(message.content); }}
          onDelete={() => setIsDeleteModalOpen(true)}
          canEdit={isOwnMessage}
          canDelete={true}
          messageContent={message.content}
          isOwnMessage={isOwnMessage}
          onMarkUnread={onMarkUnread}
          isPinned={message.isPinned}
          onPin={handlePinToggle}
          onForward={() => setIsForwardModalOpen(true)}
        />
      )}

      {isForwardModalOpen && (
        <ForwardModal
          isOpen={isForwardModalOpen}
          onClose={() => setIsForwardModalOpen(false)}
          message={message}
        />
      )}

      {isImageViewerOpen && resolvedUrl && (
        <ImageViewerModal
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrl={resolvedUrl}
          fileName={message.fileName || "image.png"}
        />
      )}

      {isDeleteModalOpen && (
        <ConfirmModal
          title={isOwnMessage ? t("chat.deleteMessage") : t("chat.hideMessage")}
          description={
            isOwnMessage
              ? t("chat.deleteConfirmPrompt")
              : t("chat.hideConfirmPrompt")
          }
          confirmText={t("chat.delete")}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

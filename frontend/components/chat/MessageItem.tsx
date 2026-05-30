"use client";

import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { MessageActions } from "@/components/chat/MessageActions";
import { Reply, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { CURRENT_USER } from "@/lib/mock-data";
import type { Message } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTranslation, getDateLocale } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";

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
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const members = useRoomStore((s) => s.members[message.roomId] ?? EMPTY_MEMBERS);
  const senderMember = members.find((m) => m.userId === message.senderId);

  // Always prefer UUID (messageId) over MongoDB ObjectId (id) for API calls
  const apiId = message.messageId || message.id;

  // Prefer memberStatusMap/memberAvatarMap if provided (DM context), else fallback to roomStore (Group context)
  const status = message.senderId === currentUserId
    ? "ONLINE"
    : (memberStatusMap?.[message.senderId] || senderMember?.status || "OFFLINE");

  const avatarSrc = memberAvatarMap ? memberAvatarMap[message.senderId] : message.senderAvatar;

  // Dynamically resolve senderName: prioritize real-time cached room member username over historical DB 'User-xxxx' placeholder
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
    if (channelId) {
      addReaction(channelId, apiId, emoji);
    }
  }

  function handleReactionBadgeClick(emoji: string) {
    if (channelId) {
      addReaction(channelId, apiId, emoji);
    }
  }

  function handleSaveEdit() {
    if (!channelId || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    if (editContent.trim() === "") {
      setIsEditing(false); // Can't edit to empty, could delete instead but simple cancel is safer
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
      // move cursor to end
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

  return (
    <div
      className={cn(
        "group relative flex gap-4 px-4 py-0 transition-colors",
        !isGrouped && "mt-3 pt-1",
        isBeingReplied
          ? "bg-accent/8 hover:bg-accent/12"
          : "hover:bg-background-secondary/30",
        message.id.startsWith("optimistic-") && "opacity-50"
      )}
    >
      {/* Avatar or timestamp gutter */}
      <div className="w-10 shrink-0">
        {!isGrouped ? (
          <StatusAvatar
            src={avatarSrc}
            fallback={resolvedSenderName}
            status={status as any}
            size="lg"
          />
        ) : (
          <span className="hidden group-hover:block text-[11px] text-muted-foreground leading-[22px] text-right w-full whitespace-nowrap">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground text-[15px] hover:underline cursor-pointer">
              {resolvedSenderName}
            </span>
            <time className="text-[12px] text-muted-foreground">
              {formatFullDate(message.createdAt)}
            </time>
            {message.isEdited && (
              <span className="text-[10px] text-muted-foreground">{t("chat.edited")}</span>
            )}
          </div>
        )}

        {/* Reply reference */}
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
            {message.content}
          </p>
        )}

        {/* Attachment */}
        {message.fileUrl && (
          <div className="mt-2">
            {message.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.fileUrl}
                  alt={message.fileName || "attachment"}
                  className="max-w-full sm:max-w-[400px] max-h-[300px] object-cover rounded-md shadow-sm border border-border/50"
                  loading="lazy"
                />
              </a>
            ) : (
              <a
                href={message.fileUrl}
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

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, i) => {
              const hasReacted = currentUserId ? reaction.userIds.includes(currentUserId) : false;
              // Resolve usernames from member list for tooltip
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
                  {/* Calendar-flip animation for count */}
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

      {/* Action bar on hover */}
      {!isEditing && (
        <MessageActions
          onReaction={handleReaction}
          onReply={handleReply}
          onEdit={() => { setIsEditing(true); setEditContent(message.content); }}
          onDelete={() => setIsDeleteModalOpen(true)}
          canEdit={isOwnMessage}
          canDelete={true} // Anyone can delete (either for themselves or everyone)
          messageContent={message.content}
          isOwnMessage={isOwnMessage}
          onMarkUnread={onMarkUnread}
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

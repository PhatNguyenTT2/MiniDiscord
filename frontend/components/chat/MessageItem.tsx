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
import { useTranslation } from "@/lib/i18n";
import { getDateLocale } from "@/lib/i18n";

interface MessageItemProps {
  message: Message;
  isGrouped?: boolean;
  channelId?: string;
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

export function MessageItem({ message, isGrouped = false, channelId }: MessageItemProps) {
  const { t } = useTranslation();
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const addReaction = useChatStore((s) => s.addReaction);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const members = useRoomStore((s) => s.members[message.roomId] || []);
  const senderMember = members.find((m) => m.userId === message.senderId);
  const status = message.senderId === currentUserId
    ? "ONLINE"
    : (senderMember?.status || "OFFLINE");

  const isBeingReplied = replyingTo?.messageId === message.id;

  function handleReply() {
    setReplyingTo({
      messageId: message.id,
      senderName: message.senderName,
      content: message.content,
    });
  }

  function handleReaction(emoji: string) {
    if (channelId) {
      addReaction(channelId, message.id, emoji);
    }
  }

  function handleReactionBadgeClick(emoji: string) {
    if (channelId) {
      addReaction(channelId, message.id, emoji);
    }
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
            src={message.senderAvatar}
            fallback={message.senderName}
            status={status as any}
            size="lg"
          />
        ) : (
          <span className="hidden group-hover:block text-[11px] text-muted-foreground leading-[22px] text-right w-full">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-foreground text-[15px] hover:underline cursor-pointer">
              {message.senderName}
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
            <span className="truncate">{message.replyTo.content}</span>
          </div>
        )}

        <p className="text-[15px] text-foreground leading-relaxed break-words whitespace-pre-line">
          {message.content}
        </p>

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
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, i) => {
              const hasReacted = reaction.userIds.includes(CURRENT_USER.id);
              return (
                <button
                  key={`${reaction.emoji}-${i}`}
                  onClick={() => handleReactionBadgeClick(reaction.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs transition-colors cursor-pointer",
                    hasReacted
                      ? "bg-[#5865F2]/20 border border-[#5865F2]"
                      : "bg-[#2b2d31] border border-transparent hover:border-border"
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className={cn(
                    "font-medium",
                    hasReacted ? "text-[#5865F2]" : "text-muted-foreground"
                  )}>
                    {reaction.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action bar on hover */}
      <MessageActions onReaction={handleReaction} onReply={handleReply} />
    </div>
  );
}

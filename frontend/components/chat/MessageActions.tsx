"use client";

import { Smile, Reply, Forward, Bookmark, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { ContextMenuDropdown } from "@/components/chat/ContextMenuDropdown";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";

function ActionButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded",
        "text-muted-foreground hover:text-foreground hover:bg-background-tertiary",
        "transition-colors cursor-pointer"
      )}
    >
      {children}
    </button>
  );
}

interface MessageActionsProps {
  onReaction?: (emoji: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  messageContent?: string;
  isOwnMessage?: boolean;
  onMarkUnread?: () => void;
}

export function MessageActions({
  onReaction,
  onReply,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  messageContent = "",
  isOwnMessage = false,
  onMarkUnread
}: MessageActionsProps) {
  const { t } = useTranslation();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  function handleEmojiSelect(emoji: string) {
    onReaction?.(emoji);
  }

  return (
    <div className="absolute -top-3 right-4 hidden group-hover:flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-md z-10">
      {/* Emoji Picker for reactions */}
      <EmojiPicker onEmojiSelect={handleEmojiSelect} position="bottom">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded",
            "text-muted-foreground hover:text-foreground hover:bg-background-tertiary",
            "transition-colors cursor-pointer"
          )}
          aria-label={t("chat.addReaction")}
        >
          <Smile className="h-4 w-4" />
        </div>
      </EmojiPicker>

      <ActionButton label={t("chat.reply")} onClick={onReply}>
        <Reply className="h-4 w-4" />
      </ActionButton>
      <ActionButton label={t("chat.forward")}>
        <Forward className="h-4 w-4" />
      </ActionButton>
      {canEdit && (
        <ActionButton label={t("settings.edit")} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </ActionButton>
      )}
      {canDelete && (
        <ActionButton label={t("chat.delete")} onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
        </ActionButton>
      )}

      <button
        ref={moreButtonRef}
        aria-label={t("chat.more")}
        onClick={(e) => {
          e.stopPropagation();
          setIsDropdownOpen((prev) => !prev);
        }}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded",
          "text-muted-foreground hover:text-foreground hover:bg-background-tertiary",
          "transition-colors cursor-pointer",
          isDropdownOpen && "bg-background-tertiary text-foreground"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <ContextMenuDropdown
        isOpen={isDropdownOpen}
        anchorRef={moreButtonRef}
        onClose={() => setIsDropdownOpen(false)}
        messageContent={messageContent}
        isOwnMessage={isOwnMessage}
        onEdit={canEdit ? onEdit : undefined}
        onReply={onReply}
        onMarkUnread={onMarkUnread}
        onDelete={canDelete ? onDelete : undefined}
      />
    </div>
  );
}

"use client";

import { Smile, Reply, Forward, Bookmark, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { cn } from "@/lib/utils";

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
}

export function MessageActions({ onReaction, onReply, onEdit, onDelete, canEdit, canDelete }: MessageActionsProps) {
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
          aria-label="Thêm reaction"
        >
          <Smile className="h-4 w-4" />
        </div>
      </EmojiPicker>

      <ActionButton label="Trả lời" onClick={onReply}>
        <Reply className="h-4 w-4" />
      </ActionButton>
      <ActionButton label="Chuyển tiếp">
        <Forward className="h-4 w-4" />
      </ActionButton>
      {canEdit && (
        <ActionButton label="Chỉnh sửa" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </ActionButton>
      )}
      {canDelete && (
        <ActionButton label="Xóa" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
        </ActionButton>
      )}
      <ActionButton label="Thêm">
        <MoreHorizontal className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}

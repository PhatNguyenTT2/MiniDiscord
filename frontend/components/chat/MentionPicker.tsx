"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { MemberDetailResponse } from "@/types/room";

import { StatusAvatar } from "@/components/ui/StatusAvatar";

type MentionItem =
  | { type: "everyone" }
  | { type: "member"; member: MemberDetailResponse };

interface MentionPickerProps {
  members: MemberDetailResponse[];
  query: string;
  isDm?: boolean;
  onSelect: (userId: string, username: string) => void;
  onClose: () => void;
}

export function MentionPicker({
  members,
  query,
  isDm = false,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const { t } = useTranslation();

  // Build list of items
  const items: MentionItem[] = [];
  if (!isDm) {
    items.push({ type: "everyone" });
  }
  members.forEach((m) => {
    items.push({ type: "member", member: m });
  });

  // Filter items based on query
  const filtered = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (item.type === "everyone") return "everyone".includes(q);
    return item.member.username.toLowerCase().includes(q);
  });

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard events (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const target = filtered[selectedIndex];
        if (target) {
          if (target.type === "everyone") {
            onSelect("everyone", "everyone");
          } else {
            onSelect(target.member.userId, target.member.username);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Click outside to close helper
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 w-full max-h-[220px] overflow-y-auto bg-[#2b2d31] border border-[#1e1f22] rounded shadow-xl z-50 p-1 scrollbar-thin flex flex-col gap-0.5 animate-in slide-in-from-bottom-2 duration-100"
    >
      <div className="text-[10px] text-[#949ba4] uppercase font-bold px-2 py-1 select-none">
        {t("members")} ({filtered.length})
      </div>
      {filtered.map((item, idx) => {
        const isSelected = idx === selectedIndex;

        let avatarNode: React.ReactNode;
        let displayName: string;
        let rightText: string;
        let onClickAction: () => void;

        if (item.type === "everyone") {
          avatarNode = null;
          displayName = "@everyone";
          rightText = t("everyoneDesc");
          onClickAction = () => onSelect("everyone", "everyone");
        } else {
          const { member } = item;
          avatarNode = (
            <StatusAvatar
              src={member.avatarUrl}
              fallback={member.username}
              size="sm"
              status={member.status as any}
              className="shrink-0 animate-none"
            />
          );
          displayName = member.username;
          rightText = member.username.toLowerCase().replace(/\s+/g, "");
          onClickAction = () => onSelect(member.userId, member.username);
        }

        return (
          <button
            key={item.type === "member" ? item.member.userId : item.type}
            type="button"
            onClick={onClickAction}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded text-left transition-colors text-xs select-none cursor-pointer",
              isSelected ? "bg-[#5865f2] text-white" : "hover:bg-[#35373c]/60 text-[#dbdee1]"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {avatarNode ? (
                avatarNode
              ) : (
                <div className="w-5 h-5 shrink-0" />
              )}
              <span className="truncate font-semibold leading-none">{displayName}</span>
            </div>

            <span
              className={cn(
                "text-[10px] font-normal truncate max-w-[170px]",
                isSelected ? "text-[#dbdee1]" : "text-[#949ba4]"
              )}
            >
              {rightText}
            </span>
          </button>
        );
      })}
    </div>
  );
}

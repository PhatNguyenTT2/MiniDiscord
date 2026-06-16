"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Disc, Music, Square, FastForward } from "lucide-react";

export interface CommandDef {
  name: string;
  description: string;
  args?: string;
  botName: string;
  icon: React.ComponentType<any>;
}

interface CommandPickerProps {
  query: string;
  onSelect: (commandName: string) => void;
  onClose: () => void;
}

export function CommandPicker({
  query,
  onSelect,
  onClose,
}: CommandPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const { t } = useTranslation();

  const commands: CommandDef[] = [
    {
      name: "play",
      description: t("music.slashPlay") || "Summon the bot to join voice channel and play music or search YouTube",
      args: "link-or-query",
      botName: "Music Bot",
      icon: Music,
    },
    {
      name: "skip",
      description: t("music.slashSkip") || "Bỏ qua bài hát hiện tại và phát bài tiếp theo",
      botName: "Music Bot",
      icon: FastForward,
    },
    {
      name: "stop",
      description: t("music.slashStop") || "Dừng phát nhạc, xóa hàng đợi và Bot rời phòng",
      botName: "Music Bot",
      icon: Square,
    },
    {
      name: "queue",
      description: t("music.slashQueue") || "Hiển thị danh sách hàng đợi các bài hát",
      botName: "Music Bot",
      icon: Disc,
    },
  ];

  // Filter commands based on query text
  const filtered = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase().replace(/^\//, "");
    return cmd.name.includes(q);
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
          onSelect(target.name);
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

  // Click outside helper
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
      className="absolute bottom-full left-0 right-0 mb-2 w-full max-h-[260px] overflow-y-auto bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-2xl z-50 p-1.5 scrollbar-thin flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-120 select-none"
    >
      <div className="text-[10px] text-[#949ba4] uppercase font-bold px-2 py-1 select-none flex items-center justify-between border-b border-[#1f2023]/40 pb-1.5 mb-1">
        <span>{t("chat.matchingCommands") || "CÂU LỆNH KHỚP VỚI"} /{query.toUpperCase()}</span>
        <span className="text-[9px] text-[#949ba4]/60 font-semibold uppercase">Music commands</span>
      </div>

      {filtered.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        const Icon = cmd.icon;

        return (
          <button
            key={cmd.name}
            type="button"
            onClick={() => onSelect(cmd.name)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2 rounded text-left transition-all text-xs font-sans cursor-pointer outline-none border-none",
              isSelected ? "bg-[#5865f2] text-white" : "hover:bg-[#35373c]/60 text-[#dbdee1]"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "w-7 h-7 rounded flex items-center justify-center transition-colors shadow-sm",
                isSelected ? "bg-white/15 text-white" : "bg-[#1e1f22] text-[#949ba4]"
              )}>
                <Icon className="h-4.5 w-4.5 shrink-0" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="text-[13px] font-bold">/{cmd.name}</span>
                  {cmd.args && (
                    <span className={cn(
                      "text-[10px] px-1 py-0.5 rounded font-mono font-medium",
                      isSelected ? "bg-white/20 text-white" : "bg-[#1e1f22]/60 text-[#949ba4]"
                    )}>
                      {cmd.args}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[11px] truncate mt-0.5 max-w-[450px]",
                  isSelected ? "text-[#dbdee1]" : "text-[#949ba4]"
                )}>
                  {cmd.description}
                </span>
              </div>
            </div>

            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-sm select-none shrink-0",
                isSelected ? "bg-white/10 text-white" : "bg-[#111214]/40 text-[#949ba4]"
              )}
            >
              {cmd.botName}
            </span>
          </button>
        );
      })}
    </div>
  );
}

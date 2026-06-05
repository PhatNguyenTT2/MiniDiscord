"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowUpDown, SlidersHorizontal, Settings, FileIcon, ShieldAlert } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Message } from "@/types";
import { useAuthStore } from "@/stores/authStore";

interface SearchResultsPanelProps {
  channelId: string;
}

const EMPTY_SEARCH_RESULTS: Message[] = [];
const EMPTY_MEMBERS: any[] = [];

function SearchResultAttachment({ message }: { message: Message }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!message.fileKey) return;
    let isMounted = true;

    const fetchUrl = async () => {
      try {
        const res = await api.get<{ data: { url: string; expiresIn: number } }>(
          `/files/url?key=${encodeURIComponent(message.fileKey!)}`
        );
        if (isMounted && res.data?.data?.url) {
          setResolvedUrl(res.data.data.url);
        }
      } catch (err) {
        console.error("Failed to resolve URL in SearchResultAttachment:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUrl();
    return () => {
      isMounted = false;
    };
  }, [message.fileKey]);

  if (!message.fileKey) return null;

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-[#2b2d31]/50 p-2 rounded max-w-full">
        <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-[11px]">Loading attachment...</span>
      </div>
    );
  }

  if (!resolvedUrl) return null;

  const isImage =
    resolvedUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ||
    message.fileName?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);

  if (isImage) {
    return (
      <div className="mt-2 rounded overflow-hidden max-w-full max-h-[160px] border border-[#1e1f22]">
        <img
          src={resolvedUrl}
          alt={message.fileName || "image"}
          className="object-contain max-w-full max-h-[160px] bg-black/10 hover:brightness-95 transition cursor-pointer"
          onClick={() => {
            window.open(resolvedUrl, "_blank");
          }}
        />
      </div>
    );
  }

  return (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2.5 p-2 rounded bg-[#2b2d31] border border-[#1e1f22] max-w-full hover:bg-secondary/80 transition-colors"
      title={message.fileName || "Download file"}
    >
      <FileIcon className="h-7 w-7 text-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#00b0f4] hover:underline truncate font-medium">
          {message.fileName || "File"}
        </p>
        <p className="text-[10px] text-muted-foreground whitespace-nowrap font-normal">
          {message.fileSize
            ? `${(message.fileSize / (1024 * 1024)).toFixed(2)} MB`
            : "File"}
        </p>
      </div>
    </a>
  );
}

export function SearchResultsPanel({ channelId }: SearchResultsPanelProps) {
  const { t } = useTranslation();
  const searchResults = useChatStore((s) => s.searchResults[channelId] || EMPTY_SEARCH_RESULTS);
  const isSearching = useChatStore((s) => s.isSearching[channelId] || false);
  const searchFilters = useChatStore((s) => s.searchFilters[channelId] || null);
  const searchSortOrder = useChatStore((s) => s.searchSortOrder[channelId] || "NEWEST");
  const setSearchSortOrder = useChatStore((s) => s.setSearchSortOrder);
  const setShowSearchPanel = useChatStore((s) => s.setShowSearchPanel);
  const clearSearchResults = useChatStore((s) => s.clearSearchResults);

  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const activeRoomId = searchResults?.[0]?.roomId || "";
  const members = useRoomStore((s) => s.members[activeRoomId] ?? EMPTY_MEMBERS);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const getMemberUsername = (uid: string) => {
    const m = members.find((member) => member.userId === uid);
    return m ? m.username : null;
  };

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
              "inline-flex items-center px-1.5 py-[0.5px] rounded font-medium transition-all select-all align-baseline text-[14px]",
              "bg-[#5865f2]/30 text-[#dee0fc] hover:bg-[#5865f2] hover:text-white cursor-pointer"
            )}
          >
            @{username || "Unknown User"}
          </span>
        );
      }
      return part;
    });
  };

  // Get active filter count
  const activeFilterCount = Object.keys(searchFilters || {}).filter(
    (key) => searchFilters?.[key as keyof typeof searchFilters]
  ).length;

  const handleClear = () => {
    clearSearchResults(channelId);
    // Dispatch event to clear parent inputs
    window.dispatchEvent(new CustomEvent("clear-search-value"));
  };

  // Date formatter
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const min = String(d.getMinutes()).padStart(2, "0");
      const hr = String(d.getHours()).padStart(2, "0");
      const date = d.getDate();
      const month = d.getMonth() + 1;
      const year = String(d.getFullYear()).slice(-2);
      return `${hr}:${min} ${date}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Score relevance factor client-side
  const getRelevanceScore = (msg: Message) => {
    const q = searchFilters?.q || "";
    if (!q) return 0;
    let score = 0;
    try {
      const content = msg.content.toLowerCase();
      const term = q.toLowerCase();
      if (content === term) score += 10;
      else if (content.startsWith(term)) score += 5;
      else if (content.includes(term)) {
        score += (content.split(term).length - 1) * 2;
      }
    } catch {
      // safe fallback
    }
    return score;
  };

  // Perform sorting
  const getSortedResults = () => {
    if (!searchResults) return [];
    const list = [...searchResults];

    if (searchSortOrder === "NEWEST") {
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    if (searchSortOrder === "OLDEST") {
      return list.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    if (searchSortOrder === "RELEVANT") {
      return list.sort((a, b) => {
        const scoreA = getRelevanceScore(a);
        const scoreB = getRelevanceScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return list;
  };

  const sortedResults = getSortedResults();

  // Determine section name (e.g. "@ Name" for DM, or "# Channel" for servers)
  // Since messages have roomId and channelId, we can find room name in roomStore.
  const currentRoom = useRoomStore((s) => s.rooms.find((r) => r.id === activeRoomId));
  const sectionHeader = currentRoom?.type === "GROUP"
    ? `# ${currentRoom.name}`
    : currentRoom?.name
      ? `@ ${currentRoom.name}`
      : "@ chat";

  return (
    <div className="flex h-full flex-col bg-[#2b2d31] border-l border-border select-none text-[#dbdee1]">
      {/* Header bar */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3.5 border-b border-border bg-[#2b2d31]">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-xs font-semibold text-white whitespace-nowrap">
            {isSearching
              ? t("chat.searching")
              : `${searchResults.length} ${t("chat.results")}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 relative">
          {/* Filters badge */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[#35373c]/60 border border-border text-[#dbdee1] font-medium select-none">
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
              <span>
                {t("chat.filtersShort")} ({activeFilterCount})
              </span>
            </div>
          )}

          {/* Sort button */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[#35373c]/60 hover:bg-[#35373c] border border-border transition text-[#dbdee1] font-medium cursor-pointer"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>{t("chat.sort")}</span>
            </button>

            {showSortDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-[#1e1f22] border border-border rounded-md shadow-2xl p-1 z-50 flex flex-col gap-0.5 text-left text-xs text-[#dbdee1]">
                  <button
                    onClick={() => {
                      setSearchSortOrder(channelId, "NEWEST");
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded hover:bg-[#35373c] font-medium transition cursor-pointer flex items-center justify-between",
                      searchSortOrder === "NEWEST" && "bg-[#35373c] text-white"
                    )}
                  >
                    <span>{t("chat.sortNewest")}</span>
                    {searchSortOrder === "NEWEST" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSearchSortOrder(channelId, "OLDEST");
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded hover:bg-[#35373c] font-medium transition cursor-pointer flex items-center justify-between",
                      searchSortOrder === "OLDEST" && "bg-[#35373c] text-white"
                    )}
                  >
                    <span>{t("chat.sortOldest")}</span>
                    {searchSortOrder === "OLDEST" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSearchSortOrder(channelId, "RELEVANT");
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded hover:bg-[#35373c] font-medium transition cursor-pointer flex items-center justify-between",
                      searchSortOrder === "RELEVANT" && "bg-[#35373c] text-white"
                    )}
                  >
                    <span>{t("chat.sortRelevant")}</span>
                    {searchSortOrder === "RELEVANT" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Settings Icon */}
          <button
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#35373c]/50 text-muted-foreground hover:text-white transition cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Close Panel Button */}
          <button
            onClick={() => setShowSearchPanel(channelId, false)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#35373c]/50 text-muted-foreground hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-[#949ba4] font-medium">{t("chat.searching")}</p>
          </div>
        ) : sortedResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <ShieldAlert className="h-10 w-10 text-muted-foreground opacity-40 mb-1" />
            <p className="text-sm text-[#949ba4] font-medium">{t("chat.noResults")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Context location badge header */}
            <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider px-1 mb-2">
              {sectionHeader}
            </div>

            {sortedResults.map((msg) => {
              const hasAttachment =
                msg.fileKey &&
                (msg.type === "IMAGE" || msg.type === "FILE" || msg.fileName);
              const isSelfMention = !!(
                currentUserId &&
                (msg.mentions?.includes(currentUserId) ||
                  msg.mentions?.includes("everyone"))
              );

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "group relative rounded-md border p-3 transition",
                    isSelfMention
                      ? "border-[#f5c211]/30 bg-[#f5c211]/5 hover:bg-[#f5c211]/8 hover:border-[#f5c211]/50 border-l-2 border-l-[#f5c211]"
                      : "border-[#202225] bg-transparent hover:bg-[#35373c]/20 hover:border-[#3f4147]"
                  )}
                >
                  {/* Actions overlay JUMP */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition duration-150 z-10">
                    <button
                      onClick={() => {
                        const event = new CustomEvent("jump-to-message", {
                          detail: {
                            id: msg.id,
                            messageId: msg.messageId
                          },
                        });
                        window.dispatchEvent(event);
                      }}
                      className="flex px-2 py-1 text-[11px] rounded bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c] hover:text-white transition cursor-pointer font-semibold border border-border"
                    >
                      {t("chat.jump")}
                    </button>
                  </div>

                  {/* Msg Author & Info */}
                  <div className="flex items-start gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#35363c] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                      {msg.senderAvatar ? (
                        <img
                          src={msg.senderAvatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        msg.senderName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-sm text-[#dbdee1] mt-1 break-words leading-relaxed whitespace-pre-wrap">
                        {renderMessageContent(msg.content)}
                      </p>

                      {/* Attachment rendering */}
                      {msg.fileKey && (
                        <SearchResultAttachment message={msg} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { SearchDropdown, type ActiveFilter } from "./SearchDropdown";
import { PinnedListModal } from "./PinnedListModal";
import { InboxPopover } from "../inbox/InboxPopover";

import {
  Hash,
  Pin,
  Users,
  Search,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/Separator";
import { useUIStore } from "@/stores/uiStore";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useRoomStore } from "@/stores/roomStore";
import { useChatStore } from "@/stores/chatStore";
import { parseSearchFilters } from "@/lib/searchParser";

interface ChatHeaderProps {
  channelName: string;
  channelDescription?: string;
}

function HeaderIcon({
  children,
  label,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 cursor-pointer",
        isActive
          ? "text-foreground bg-secondary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function ChatHeader({
  channelName,
  channelDescription,
}: ChatHeaderProps) {
  const { t } = useTranslation();
  const params = useParams();
  const roomId = params?.serverId as string;
  const channelId = params?.channelId as string;

  const showMemberList = useUIStore((s) => s.showMemberList);
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showPinnedModal, setShowPinnedModal] = useState(false);

  useEffect(() => {
    function handleOpenPinnedList() {
      setShowPinnedModal(true);
    }
    window.addEventListener("open-pinned-list", handleOpenPinnedList);
    return () => window.removeEventListener("open-pinned-list", handleOpenPinnedList);
  }, []);

  useEffect(() => {
    function handleClearSearch() {
      setSearchValue("");
    }
    window.addEventListener("clear-search-value", handleClearSearch);
    return () => window.removeEventListener("clear-search-value", handleClearSearch);
  }, []);

  const membersMap = useRoomStore((s) => s.members);
  const channelsMap = useRoomStore((s) => s.channels);

  const serverMembers = roomId ? membersMap[roomId] || [] : [];
  const serverChannels = roomId ? channelsMap[roomId] || [] : [];

  const searchMessagesAction = useChatStore((s) => s.searchMessages);

  // Token-based multi-filter active state detection
  const getActiveFilterAndQuery = (value: string): { activeFilter: ActiveFilter; filterQuery: string } => {
    if (!value.trim()) {
      return { activeFilter: "filters", filterQuery: "" };
    }

    const tokens = value.split(/\s+/);
    const lastToken = tokens[tokens.length - 1];

    if (!lastToken) {
      return { activeFilter: "filters", filterQuery: "" };
    }

    if (lastToken.startsWith("từ:") || lastToken.startsWith("from:")) {
      return { activeFilter: "from-user", filterQuery: lastToken.slice(lastToken.indexOf(":") + 1) };
    }
    if (lastToken.startsWith("trong:") || lastToken.startsWith("in:")) {
      return { activeFilter: "in-channel", filterQuery: lastToken.slice(lastToken.indexOf(":") + 1) };
    }
    if (lastToken.startsWith("có:") || lastToken.startsWith("has:")) {
      return { activeFilter: "has-data", filterQuery: lastToken.slice(lastToken.indexOf(":") + 1) };
    }
    if (lastToken.startsWith("đề cập:") || lastToken.startsWith("mentions:")) {
      return { activeFilter: "mentions", filterQuery: lastToken.slice(lastToken.indexOf(":") + 1) };
    }

    return { activeFilter: "general", filterQuery: lastToken };
  };

  const [showDropdown, setShowDropdown] = useState(false);
  const { activeFilter, filterQuery } = getActiveFilterAndQuery(searchValue);

  const submitSearch = async (val: string) => {
    if (!roomId || !channelId) return;
    const parsedFilters = parseSearchFilters(val);
    await searchMessagesAction(roomId, channelId, parsedFilters);
  };

  const handleSelectFilter = (prefix: string) => {
    setSearchValue((prev) => {
      const trimmed = prev.trim();
      const updated = trimmed ? `${trimmed} ${prefix}` : `${prefix}`;
      // Keep dropdown open for completing the selected filter
      setShowDropdown(true);
      return updated;
    });
  };

  const handleSelectUser = (userId: string, username: string) => {
    const prev = searchValue;
    let updated = prev;
    const tokens = prev.split(/\s+/);
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const colonIdx = lastToken.indexOf(":");
      if (colonIdx >= 0) {
        const prefix = lastToken.slice(0, colonIdx);
        tokens[tokens.length - 1] = `${prefix}:${username}`;
        updated = tokens.join(" ") + " ";
      } else {
        updated = prev + ` ${username} `;
      }
    } else {
      updated = prev + ` ${username} `;
    }
    setSearchValue(updated);
    setShowDropdown(false);
    submitSearch(updated);
  };

  const handleSelectChannel = (chanId: string, chanName: string) => {
    const prev = searchValue;
    let updated = prev;
    const tokens = prev.split(/\s+/);
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const colonIdx = lastToken.indexOf(":");
      if (colonIdx >= 0) {
        const prefix = lastToken.slice(0, colonIdx);
        tokens[tokens.length - 1] = `${prefix}:${chanName}`;
        updated = tokens.join(" ") + " ";
      } else {
        updated = prev + ` ${chanName} `;
      }
    } else {
      updated = prev + ` ${chanName} `;
    }
    setSearchValue(updated);
    setShowDropdown(false);
    submitSearch(updated);
  };

  const handleSelectDataType = (dataType: string) => {
    const prev = searchValue;
    let updated = prev;
    const tokens = prev.split(/\s+/);
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const colonIdx = lastToken.indexOf(":");
      if (colonIdx >= 0) {
        const prefix = lastToken.slice(0, colonIdx);
        tokens[tokens.length - 1] = `${prefix}:${dataType}`;
        updated = tokens.join(" ") + " ";
      } else {
        updated = prev + ` ${dataType} `;
      }
    } else {
      updated = prev + ` ${dataType} `;
    }
    setSearchValue(updated);
    setShowDropdown(false);
    submitSearch(updated);
  };

  const handleSearchSubmit = async () => {
    if (!roomId || !channelId) return;
    setIsSearchFocused(false);
    setShowDropdown(false);
    await submitSearch(searchValue);
  };

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-border bg-[#313338] px-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Hash className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="text-[15px] font-semibold text-foreground">{channelName}</span>
        {channelDescription && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <span className="truncate text-[13px] text-muted-foreground">
              {channelDescription}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 relative">
        <HeaderIcon
          label={t("chat.pin")}
          isActive={showPinnedModal}
          onClick={() => setShowPinnedModal(!showPinnedModal)}
        >
          <Pin className={cn("h-5 w-5", showPinnedModal && "fill-current text-[#f5c211]")} />
        </HeaderIcon>
        <PinnedListModal
          isOpen={showPinnedModal}
          onClose={() => setShowPinnedModal(false)}
          roomId={roomId}
          channelId={channelId}
          onJumpToMessage={(messageId) => {
            const event = new CustomEvent("jump-to-message", { detail: { messageId } });
            window.dispatchEvent(event);
            setShowPinnedModal(false);
          }}
        />
        <HeaderIcon
          label={t("chat.memberList")}
          isActive={showMemberList}
          onClick={toggleMemberList}
        >
          <Users className="h-5 w-5" />
        </HeaderIcon>

        <InboxPopover />

        <div className="relative mx-1">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => {
              setIsSearchFocused(true);
              setShowDropdown(true);
            }}
            onClick={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            placeholder={t("chat.search")}
            className="h-7 w-36 rounded-md bg-background-tertiary pr-6 pl-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:w-56 transition-all duration-200 outline-none"
          />
          {searchValue ? (
            <button
              onClick={() => {
                setSearchValue("");
                useChatStore.getState().clearSearchResults(channelId);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-white transition cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <Search className="absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          )}
          <SearchDropdown
            type="channel"
            isOpen={isSearchFocused && showDropdown}
            activeFilter={activeFilter}
            filterQuery={filterQuery}
            members={serverMembers}
            channels={serverChannels}
            onSelectFilter={handleSelectFilter}
            onSelectUser={handleSelectUser}
            onSelectChannel={handleSelectChannel}
            onSelectDataType={handleSelectDataType}
            onSearchSubmit={handleSearchSubmit}
          />
        </div>
      </div>
    </div>
  );
}

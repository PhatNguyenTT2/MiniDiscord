"use client";

import { useState } from "react";
import { SearchDropdown, type ActiveFilter } from "./SearchDropdown";
import {
  Hash,
  Pin,
  Users,
  Search,
  Inbox,
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

  const membersMap = useRoomStore((s) => s.members);
  const channelsMap = useRoomStore((s) => s.channels);

  const serverMembers = roomId ? membersMap[roomId] || [] : [];
  const serverChannels = roomId ? channelsMap[roomId] || [] : [];

  const searchMessagesAction = useChatStore((s) => s.searchMessages);

  // Active filter state detection
  const getActiveFilter = (value: string): ActiveFilter => {
    if (!value.trim()) return "filters";
    if (value.startsWith("từ:") || value.startsWith("from:")) return "from-user";
    if (value.startsWith("trong:") || value.startsWith("in:")) return "in-channel";
    if (value.startsWith("có:") || value.startsWith("has:")) return "has-data";
    if (value.startsWith("đề cập:") || value.startsWith("mentions:")) return "mentions";
    return "general";
  };

  const getFilterQuery = (value: string) => {
    const colonIdx = value.indexOf(":");
    return colonIdx >= 0 ? value.slice(colonIdx + 1).trim() : value.trim();
  };

  const activeFilter = getActiveFilter(searchValue);
  const filterQuery = getFilterQuery(searchValue);

  const handleSelectFilter = (prefix: string) => {
    setSearchValue(prefix + " ");
  };

  const handleSelectUser = (userId: string, username: string) => {
    if (searchValue.startsWith("đề cập:") || searchValue.startsWith("mentions:")) {
      const prefix = searchValue.startsWith("m") ? "mentions:" : "đề cập:";
      setSearchValue(`${prefix}${username} `);
    } else {
      const prefix = searchValue.startsWith("f") ? "from:" : "từ:";
      setSearchValue(`${prefix}${username} `);
    }
  };

  const handleSelectChannel = (chanId: string, chanName: string) => {
    const prefix = searchValue.startsWith("i") ? "in:" : "trong:";
    setSearchValue(`${prefix}${chanName} `);
  };

  const handleSelectDataType = (dataType: string) => {
    const prefix = searchValue.startsWith("h") ? "has:" : "có:";
    setSearchValue(`${prefix}${dataType} `);
  };

  const handleSearchSubmit = async () => {
    if (!roomId || !channelId) return;
    setIsSearchFocused(false);

    const parsedFilters = parseSearchFilters(searchValue);
    console.log("[ChatHeader] Unified query parsed filters: ", parsedFilters);

    // Call store search action
    const results = await searchMessagesAction(roomId, channelId, parsedFilters);
    console.log("[ChatHeader] Results found: ", results);
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

      <div className="flex items-center gap-1">
        <HeaderIcon label={t("chat.pin")}>
          <Pin className="h-5 w-5" />
        </HeaderIcon>
        <HeaderIcon
          label={t("chat.memberList")}
          isActive={showMemberList}
          onClick={toggleMemberList}
        >
          <Users className="h-5 w-5" />
        </HeaderIcon>
        <div className="relative mx-1">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            placeholder={t("chat.search")}
            className="h-7 w-36 rounded-md bg-background-tertiary px-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:w-56 transition-all duration-200 outline-none"
          />
          <Search className="absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <SearchDropdown
            type="channel"
            isOpen={isSearchFocused}
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
        <HeaderIcon label={t("chat.inbox")}>
          <Inbox className="h-5 w-5" />
        </HeaderIcon>
      </div>
    </div>
  );
}

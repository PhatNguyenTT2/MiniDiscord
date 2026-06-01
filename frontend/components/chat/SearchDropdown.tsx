"use client";

import { User, Hash, Paperclip, AtSign, Search, Trash2, Image, Video, Link as LinkIcon, FileIcon, Music, Smile } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import type { MemberDetailResponse, Channel } from "@/types";

export type ActiveFilter = "filters" | "general" | "from-user" | "in-channel" | "has-data" | "mentions";

interface SearchDropdownProps {
  type: "dm" | "channel";
  isOpen: boolean;
  activeFilter: ActiveFilter;
  filterQuery: string;
  members: MemberDetailResponse[];
  channels?: Channel[];
  onSelectFilter?: (filterPrefix: string) => void;
  onSelectUser?: (userId: string, username: string) => void;
  onSelectChannel?: (channelId: string, channelName: string) => void;
  onSelectDataType?: (dataType: string) => void;
  onSearchSubmit?: () => void;
  history?: string[];
  onClearHistory?: () => void;
}

export function SearchDropdown({
  type,
  isOpen,
  activeFilter,
  filterQuery,
  members = [],
  channels = [],
  onSelectFilter,
  onSelectUser,
  onSelectChannel,
  onSelectDataType,
  onSearchSubmit,
  history = [],
  onClearHistory,
}: SearchDropdownProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Filter lists based on target queries
  const normalizedQuery = filterQuery.toLowerCase().trim();

  const filteredMembers = members.filter((m) =>
    m.username.toLowerCase().includes(normalizedQuery)
  );

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(normalizedQuery)
  );

  // Render components helper for members list
  const renderMemberRow = (member: MemberDetailResponse, prefixType: "from" | "mentions") => {
    const displayPrefix = prefixType === "from" ? "từ:" : "đề cập:";
    return (
      <button
        key={member.userId}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onSelectUser?.(member.userId, member.username);
        }}
        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
      >
        <StatusAvatar
          src={member.avatarUrl}
          fallback={member.username}
          size="sm"
          status={member.status as any}
          className="shrink-0"
        />
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <span className="text-[13px] font-semibold text-[#dbdee1] truncate">
            {member.username}
          </span>
          <span className="text-[11px] text-[#949ba4] truncate">
            {displayPrefix} {member.username}
          </span>
        </div>
      </button>
    );
  };

  // Render components helper for channels list
  const renderChannelRow = (chan: Channel) => {
    return (
      <button
        key={chan.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onSelectChannel?.(chan.id, chan.name);
        }}
        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
      >
        <Hash className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <span className="text-[13px] font-semibold text-[#dbdee1] truncate">
            {chan.name}
          </span>
          <span className="text-[11px] text-[#949ba4] truncate">
            trong: # {chan.name}
          </span>
        </div>
      </button>
    );
  };

  // 1. Initial filters selection view
  if (activeFilter === "filters") {
    return (
      <div className="absolute right-0 top-full mt-2 w-[340px] bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] select-none text-[#dbdee1]">
        <div>
          <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
            {t("chat.searchFilters")}
          </div>

          <div className="flex flex-col gap-0.5">
            {/* Filter: From User */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectFilter?.(t("chat.searchFromUserSub").split(":")[0] + ":");
              }}
              className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
            >
              <User className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[#dbdee1]">
                  {t("chat.searchFromUserTitle")}
                </span>
                <span className="text-[11px] text-[#949ba4]">
                  <span className="font-semibold text-[#dbdee1]">{t("chat.searchFromUserSub").split(":")[0]}:</span>
                  {t("chat.searchFromUserSub").split(":")[1]}
                </span>
              </div>
            </button>

            {/* Filter: In Channel */}
            {type === "channel" && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectFilter?.(t("chat.searchInChannelSub").split(":")[0] + ":");
                }}
                className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
              >
                <Hash className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-[#dbdee1]">
                    {t("chat.searchInChannelTitle")}
                  </span>
                  <span className="text-[11px] text-[#949ba4]">
                    <span className="font-semibold text-[#dbdee1]">{t("chat.searchInChannelSub").split(":")[0]}:</span>
                    {t("chat.searchInChannelSub").split(":")[1]}
                  </span>
                </div>
              </button>
            )}

            {/* Filter: Has data */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectFilter?.(t("chat.searchHasDataSub").split(":")[0] + ":");
              }}
              className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
            >
              <Paperclip className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[#dbdee1]">
                  {t("chat.searchHasDataTitle")}
                </span>
                <span className="text-[11px] text-[#949ba4]">
                  <span className="font-semibold text-[#dbdee1]">{t("chat.searchHasDataSub").split(":")[0]}:</span>
                  {t("chat.searchHasDataSub").split(":")[1]}
                </span>
              </div>
            </button>

            {/* Filter: Mentions */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectFilter?.(t("chat.searchMentionsUserSub").split(":")[0] + ":");
              }}
              className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
            >
              <AtSign className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[#dbdee1]">
                  {t("chat.searchMentionsUserTitle")}
                </span>
                <span className="text-[11px] text-[#949ba4]">
                  <span className="font-semibold text-[#dbdee1]">{t("chat.searchMentionsUserSub").split(":")[0]}:</span>
                  {t("chat.searchMentionsUserSub").split(":")[1]}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* History Section */}
        {history && history.length > 0 && (
          <>
            <div className="h-[1px] bg-[#1f2023] my-2 mx-1" />
            <div>
              <div className="flex justify-between items-center text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
                <span>{t("chat.searchHistory")}</span>
                <Trash2
                  onClick={onClearHistory}
                  className="h-3.5 w-3.5 text-[#949ba4] hover:opacity-100 opacity-60 cursor-pointer transition select-none"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                {history.map((item) => (
                  <div
                    key={item}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectFilter?.(item);
                    }}
                    className="flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 cursor-pointer transition duration-150"
                  >
                    <Search className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
                    <span className="text-[13px] text-[#dbdee1] truncate">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 2. Focused filter menus ("from-user")
  if (activeFilter === "from-user") {
    return (
      <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[360px] overflow-y-auto bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] custom-scrollbar text-[#dbdee1]">
        <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
          {t("searchFromUserHeader")}
        </div>
        <div className="flex flex-col gap-0.5">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((m) => renderMemberRow(m, "from"))
          ) : (
            <div className="text-xs text-[#949ba4] px-2 py-1.5 italic">
              No matching members found
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Focused filter menus ("in-channel")
  if (activeFilter === "in-channel") {
    return (
      <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[360px] overflow-y-auto bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] custom-scrollbar text-[#dbdee1]">
        <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
          {t("searchInChannelHeader")}
        </div>
        <div className="flex flex-col gap-0.5">
          {type === "channel" ? (
            filteredChannels.length > 0 ? (
              filteredChannels.map((c) => renderChannelRow(c))
            ) : (
              <div className="text-xs text-[#949ba4] px-2 py-1.5 italic">
                No matching channels found
              </div>
            )
          ) : (
            <div className="text-xs text-[#949ba4] px-2 py-1.5 italic">
              Channel search is only available in server view
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Focused filter menus ("has-data")
  if (activeFilter === "has-data") {
    const dataTypes = [
      { key: "image", local: t("searchHasImage"), icon: Image },
      { key: "video", local: t("searchHasVideo"), icon: Video },
      { key: "link", local: t("searchHasLink"), icon: LinkIcon },
      { key: "file", local: t("searchHasFile"), icon: FileIcon },
      { key: "audio", local: t("searchHasAudio"), icon: Music },
      { key: "sticker", local: t("searchHasSticker"), icon: Smile },
    ];

    return (
      <div className="absolute right-0 top-full mt-2 w-[340px] bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] text-[#dbdee1]">
        <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
          {t("searchHasDataHeader")}
        </div>
        <div className="flex flex-col gap-0.5">
          {dataTypes.map((dt) => {
            const IconComponent = dt.icon;
            return (
              <button
                key={dt.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectDataType?.(dt.local);
                }}
                className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
              >
                <IconComponent className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
                <span className="text-[13px] font-semibold text-[#dbdee1]">
                  {dt.local}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 5. Focused filter menus ("mentions")
  if (activeFilter === "mentions") {
    return (
      <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[360px] overflow-y-auto bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] custom-scrollbar text-[#dbdee1]">
        <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
          {t("searchMentionsHeader")}
        </div>
        <div className="flex flex-col gap-0.5">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((m) => renderMemberRow(m, "mentions"))
          ) : (
            <div className="text-xs text-[#949ba4] px-2 py-1.5 italic">
              No matching users found
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. Unified General Search view ("general")
  // Shows Search Action Row + top 3 users + top 3 channels + top 3 mentions
  return (
    <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[380px] overflow-y-auto bg-[#111214] rounded-md shadow-2xl border border-[#1f2023] p-3 z-[100] custom-scrollbar text-[#dbdee1] flex flex-col gap-1 select-none">

      {/* Action Row: Search for query text */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onSearchSubmit?.();
        }}
        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md hover:bg-[#2b2d31]/60 text-left transition duration-150 cursor-pointer outline-none border-none"
      >
        <Search className="h-[18px] w-[18px] text-[#949ba4] shrink-0" />
        <span className="text-[13px] font-semibold text-[#dbdee1] truncate">
          {t("searchAction").replace("{query}", filterQuery)}
        </span>
      </button>

      {/* Group 1: From Matching Users */}
      {filteredMembers.length > 0 && (
        <>
          <div className="h-[1px] bg-[#1f2023] my-1" />
          <div>
            <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
              {t("searchFromUserHeader")}
            </div>
            <div className="flex flex-col gap-0.5">
              {filteredMembers.slice(0, 3).map((m) => renderMemberRow(m, "from"))}
            </div>
          </div>
        </>
      )}

      {/* Group 2: In Matching Channels */}
      {type === "channel" && filteredChannels.length > 0 && (
        <>
          <div className="h-[1px] bg-[#1f2023] my-1" />
          <div>
            <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
              {t("searchInChannelHeader")}
            </div>
            <div className="flex flex-col gap-0.5">
              {filteredChannels.slice(0, 3).map((c) => renderChannelRow(c))}
            </div>
          </div>
        </>
      )}

      {/* Group 3: Mentions Matching Users */}
      {filteredMembers.length > 0 && (
        <>
          <div className="h-[1px] bg-[#1f2023] my-1" />
          <div>
            <div className="text-[11px] font-bold text-[#949ba4] tracking-wider uppercase mb-1.5 px-2">
              {t("searchMentionsHeader")}
            </div>
            <div className="flex flex-col gap-0.5">
              {filteredMembers.slice(0, 3).map((m) => renderMemberRow(m, "mentions"))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

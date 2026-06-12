"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SidebarWrapper } from "@/components/sidebar/SidebarWrapper";
import { DMSidebar } from "@/components/sidebar/DMSidebar";
import { DmUserPanel } from "@/components/dm/DmUserPanel";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { SearchDropdown, type ActiveFilter } from "@/components/chat/SearchDropdown";
import { parseSearchFilters } from "@/lib/searchParser";
import { Phone, Video, Pin, User, Reply, Server, UserPlus, FileIcon, Search, X } from "lucide-react";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { SlidingPanel } from "@/components/ui/SlidingPanel";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useRoomStore } from "@/stores/roomStore";
import { getStompClient } from "@/lib/websocket";
import { type Message } from "@/types";
import { useVoiceStore } from "@/stores/voiceStore";
import { DmCallView } from "@/components/voice/DmCallView";
import { PinnedListModal } from "@/components/chat/PinnedListModal";
import { SearchResultsPanel } from "@/components/chat/SearchResultsPanel";

function getMutualServersCount(userId: string) {
  // TODO: Implement mutual servers logic with real API
  return 0;
}

import { cn } from "@/lib/utils";
import { useTranslation, getDateLocale } from "@/lib/i18n";
import { useNotificationStore } from "@/stores/notificationStore";

// Stable empty array to prevent React getSnapshot caching issues
const EMPTY_DM: Message[] = [];

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 pb-0 space-y-6 overflow-hidden opacity-50">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-10 w-10 shrink-0 rounded-full bg-secondary" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-secondary rounded" />
              <div className="h-3 w-16 bg-secondary/50 rounded" />
            </div>
            <div className="h-4 bg-secondary rounded w-3/4" />
            <div className="h-4 bg-secondary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}


export default function DmChatPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { t } = useTranslation();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
  const showDmUserPanel = useUIStore((s) => s.showDmUserPanel);
  const toggleDmUserPanel = useUIStore((s) => s.toggleDmUserPanel);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const handleResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  const friends = useFriendStore((s) => s.friends);
  const currentUser = useAuthStore((s) => s.user);

  // Get Room Mapping
  const { getDmRoomForUser, members: allMembers, findOrCreateDmRoom, isLoading: isLoadingRoom, fetchMembers } = useRoomStore();
  const dmRoom = getDmRoomForUser(userId);
  const roomId = dmRoom?.roomId || "";
  const channelId = dmRoom?.channelId || "";
  const showSearchPanel = useChatStore((s) => s.showSearchPanel[channelId] || false);

  // Hydrate room members whenever the DM room is loaded or changed.
  // This ensures members list is cached for search filter mapper and autocomplete list.
  useEffect(() => {
    if (roomId) {
      fetchMembers(roomId);
    }
  }, [roomId, fetchMembers]);

  // Resolve friend name from multiple sources
  const friend = friends.find((f) => f.user.id === userId);
  const roomMember = roomId
    ? allMembers[roomId]?.find((m) => m.userId === userId)
    : null;
  const friendName = friend?.user.username || roomMember?.username || "User";
  const friendAvatar = friend?.user.avatarUrl || roomMember?.avatarUrl || null;
  // Prefer friendStore (real-time PRESENCE_UPDATE), then roomStore.members (also synced)
  const friendStatus = friend?.user.status ?? roomMember?.status ?? "OFFLINE";
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);

  // Build avatar lookup map for chat messages (covers both current user + recipient)
  const memberAvatarMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    if (roomId && allMembers[roomId]) {
      for (const m of allMembers[roomId]) {
        map[m.userId] = m.avatarUrl;
      }
    }
    // Also include current user's avatar
    if (currentUser?.id) {
      map[currentUser.id] = currentUser.avatarUrl || null;
    }
    return map;
  }, [roomId, allMembers, currentUser]);

  // Build status lookup map for chat messages (covers both current user + recipient)
  const memberStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (roomId && allMembers[roomId]) {
      for (const m of allMembers[roomId]) {
        map[m.userId] = m.status || "OFFLINE";
      }
    }
    // Also sync from friendStore for more accurate presence
    if (friend?.user) {
      map[friend.user.id] = friend.user.status || "OFFLINE";
    }
    return map;
  }, [roomId, allMembers, friend]);

  const [modalType, setModalType] = useState<"REMOVE_FRIEND" | "BLOCK" | null>(null);
  const [relationship, setRelationship] = useState<"friend" | "none" | "blocked">("friend");

  // Chat store — Read messages from global channel storage
  const messages = useChatStore((s) => s.getChannelMessages(channelId));
  const addReaction = useChatStore((s) => s.addReaction);
  const addOptimisticMessage = useChatStore((s) => s.addOptimisticMessage);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const clearReplyingTo = useChatStore((s) => s.clearReplyingTo);
  const markChannelAsRead = useChatStore((s) => s.markChannelAsRead);
  const isLoadingMessages = useChatStore((s) => s.isLoading);

  const token = useAuthStore((s) => s.token);

  // Dynamically auto-hide DM User Panel when viewport drops below 1024px (minimized/narrow screens)
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.innerWidth < 1024) {
        // Direct state mutation of zustand store to dynamically close panel without forcing redundant store action updates logic
        if (useUIStore.getState().showDmUserPanel) {
          useUIStore.setState({ showDmUserPanel: false });
        }
      }
    };

    handleViewportResize(); // run on mount
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, []);

  const handleSend = useCallback(
    async (content: string, attachment?: { fileKey: string; fileName: string; fileSize: number } | null, mentions?: string[]) => {
      let activeRoomId = roomId;
      let activeChannelId = channelId;

      if (!activeRoomId || !activeChannelId) {
        try {
          const newRoom = await findOrCreateDmRoom(userId);
          activeRoomId = newRoom.id;
          const { channels: updatedChannels } = useRoomStore.getState();
          const newChannels = updatedChannels[newRoom.id] || [];
          const defaultCh = newChannels.find(c => c.type === "TEXT") || newChannels[0];
          if (!defaultCh) {
            console.error("Failed to find text channel after creating lazy room", newRoom.id);
            return;
          }
          activeChannelId = defaultCh.id;

          // Eager Stomp subscribe to avoid any messaging race condition before React renders
          const activeToken = useAuthStore.getState().token;
          if (activeToken) {
            const client = getStompClient(activeToken);
            if (client.connected) {
              client.subscribe(`/topic/room.${activeRoomId}`, (msg) => {
                try {
                  const data = JSON.parse(msg.body);
                  useChatStore.getState().receiveMessage(data.channelId, {
                    id: data.id || data.messageId,
                    messageId: data.messageId,
                    roomId: data.roomId,
                    channelId: data.channelId,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    senderAvatar: data.senderAvatar || null,
                    type: data.type || "TEXT",
                    content: data.content,
                    fileKey: data.fileKey || null,
                    fileName: data.fileName || null,
                    fileSize: data.fileSize || null,
                    reactions: [],
                    isEdited: false,
                    isDeleted: false,
                    editedAt: null,
                    createdAt: data.createdAt || new Date().toISOString(),
                    replyTo: data.replyTo || null,
                    mentions: data.mentions || [],
                  });
                } catch (e) {
                  console.error("Failed to parse lazy room message", e);
                }
              });
              // Wait for broker to bind the queue before publishing first message
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (err) {
          console.error("Lazy DM creation failed", err);
          return;
        }
      }

      if (!token) {
        console.error("[DM] Cannot send: no token");
        return;
      }
      const client = getStompClient(token);

      const nonce = crypto.randomUUID();

      // Optimistic insert — show message immediately
      const optimisticMsg: Message = {
        id: nonce,
        messageId: nonce,
        nonce,
        roomId: activeRoomId,
        channelId: activeChannelId,
        senderId: currentUser?.id || "",
        senderName: currentUser?.displayName || currentUser?.username || "",
        senderAvatar: currentUser?.avatarUrl || null,
        type: attachment ? "FILE" : "TEXT",
        content,
        fileKey: attachment?.fileKey || null,
        fileName: attachment?.fileName || null,
        fileSize: attachment?.fileSize || null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        editedAt: null,
        createdAt: new Date().toISOString(),
        replyTo: replyingTo
          ? {
            messageId: replyingTo.messageId,
            content: replyingTo.content.slice(0, 100),
            senderName: replyingTo.senderName,
          }
          : null,
        mentions,
        status: client.connected ? "SENDING" : "FAILED",
      };
      addOptimisticMessage(activeChannelId, optimisticMsg);

      if (!client.connected) {
        console.error("[DM] Cannot send: STOMP not connected");
        return;
      }

      const payload = {
        id: nonce,
        messageId: nonce,
        nonce,
        roomId: activeRoomId,
        channelId: activeChannelId,
        content,
        type: attachment ? "FILE" : "TEXT",
        senderName: currentUser?.displayName || currentUser?.username,
        senderAvatar: currentUser?.avatarUrl,
        fileKey: attachment?.fileKey,
        fileName: attachment?.fileName,
        fileSize: attachment?.fileSize,
        replyTo: replyingTo
          ? {
            messageId: replyingTo.messageId,
            content: replyingTo.content.slice(0, 100),
            senderName: replyingTo.senderName,
          }
          : null,
        mentions,
      };

      client.publish({
        destination: "/app/chat.send",
        body: JSON.stringify(payload),
      });

      // Discord behavior: sending a message implicitly marks channel as read
      if (activeChannelId) {
        useNotificationStore.getState().markAsRead(activeChannelId);
      }
      // Backend sync — use last REAL message ID (not optimistic), fallback handled by cleanup
      const lastRealId = useChatStore.getState().getChannelMessages(activeChannelId).slice(-1)[0]?.id;
      if (activeRoomId && activeChannelId && lastRealId && !lastRealId.startsWith('optimistic-')) {
        useChatStore.getState().markChannelAsRead(activeRoomId, activeChannelId, lastRealId);
      }

      clearReplyingTo();
    },
    [channelId, roomId, token, replyingTo, clearReplyingTo, currentUser, addOptimisticMessage, userId, findOrCreateDmRoom]
  );



  const handleTyping = useCallback(() => {
    if (!token || !roomId || !channelId) return;
    const client = getStompClient(token);
    if (!client.connected) return;

    const currentUser = useAuthStore.getState().user;
    const username = currentUser?.displayName || currentUser?.username;
    client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify({ roomId, channelId, username }),
    });
  }, [channelId, roomId, token]);

  // Auto-scroll to bottom state
  const messageListRef = useRef<MessageListHandle>(null);
  const [showJumpBanner, setShowJumpBanner] = useState(false);

  useEffect(() => {
    setShowJumpBanner(false);
  }, [channelId, userId]);

  const handleScrollStateChange = useCallback((isAtBottom: boolean) => {
    setShowJumpBanner(!isAtBottom);
  }, []);

  return (
    <>
      {/* Column 1+2: ServerList + DM Sidebar + UserPanel */}
      <SidebarWrapper>
        <DMSidebar activeUserId={userId} />
      </SidebarWrapper>

      <ResizeHandle onResize={handleResize} />

      {/* Column 3 is the positioning context for the floating message composer. */}
      <main className="relative flex flex-1 min-w-0 flex-col bg-[#313338]">
        {/* Unified header bar across both columns */}
        <div className="flex h-12 shrink-0 items-center border-b border-[#1e1f22] bg-[#313338] px-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              @ {friendName}
            </span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (roomId && userId) {
                    useVoiceStore.getState().startCall(roomId, userId);
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#23a55a] hover:text-[#1a7f43] bg-[#23a55a]/10 hover:bg-[#23a55a]/20 transition-all duration-150 cursor-pointer shadow-sm animate-pulse"
                title={t("voice.startCall")}
              >
                <Phone className="h-5 w-5" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Video className="h-5 w-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowPinnedModal(!showPinnedModal)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                    showPinnedModal
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={t("chat.pin")}
                >
                  <Pin className={cn("h-5 w-5", showPinnedModal && "fill-current text-[#f5c211]")} />
                </button>
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
              </div>
              <button
                onClick={toggleDmUserPanel}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer",
                  showDmUserPanel
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Toggle user panel"
              >
                <User className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
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
                type="dm"
                isOpen={isSearchFocused && showDropdown}
                activeFilter={activeFilter}
                filterQuery={filterQuery}
                members={roomId ? allMembers[roomId] || [] : []}
                onSelectFilter={handleSelectFilter}
                onSelectUser={handleSelectUser}
                onSelectChannel={handleSelectChannel}
                onSelectDataType={handleSelectDataType}
                onSearchSubmit={handleSearchSubmit}
              />
            </div>
          </div>
        </div>

        {/* Unified wrapper that holds Chat + side Panel */}
        <div className="flex flex-1 min-h-0 relative">

          {/* Chat content container */}
          <div className="flex flex-1 flex-col min-w-0 relative">
            {activeCallRoomId === roomId && (
              <DmCallView
                roomId={roomId}
                recipientId={userId}
                recipientName={friendName}
                recipientAvatar={friendAvatar}
              />
            )}

            {/* Messages */}
            {(isLoadingMessages && messages.length === 0) ? (
              <div className="flex-1 overflow-y-auto">
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-secondary mb-3 mt-16 mx-4">
                  <User className="h-10 w-10 text-foreground" />
                </div>
                <MessagesSkeleton />
              </div>
            ) : (
              <MessageList
                ref={messageListRef}
                messages={messages}
                channelName={friendName}
                channelId={channelId}
                roomId={roomId}
                onMarkAsReadBackend={markChannelAsRead}
                memberAvatarMap={memberAvatarMap}
                memberStatusMap={memberStatusMap}
                onScrollStateChange={handleScrollStateChange}
                welcomeHeader={
                  <div className="px-4 pt-4 pb-4">
                    {/* Large Avatar */}
                    <div className="mb-3">
                      <StatusAvatar
                        src={friendAvatar}
                        fallback={friendName}
                        status={friendStatus as any}
                        size="xl"
                      />
                    </div>

                    {/* Display Name */}
                    <h2 className="text-[2rem] font-bold text-foreground leading-tight">
                      {friendName}
                    </h2>

                    {/* Secondary Username */}
                    <p className="text-[15px] text-muted-foreground mt-0.5">
                      {friendName.toLowerCase()}
                    </p>

                    {/* Description */}
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                      {t("dm.welcomeMessage")}{" "}
                      <strong className="font-semibold text-foreground">{friendName}</strong>.
                    </p>

                    {/* Mutual Servers + Action Buttons Row */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {/* Mutual Servers Badge */}
                      {getMutualServersCount(userId) > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-[13px] text-muted-foreground">
                          <Server className="h-3.5 w-3.5" />
                          <span>{getMutualServersCount(userId)} {t("dm.mutualServers")}</span>
                        </div>
                      )}

                      {/* Relationship: friend → show Remove + Block */}
                      {relationship === "friend" && (
                        <>
                          <button
                            onClick={() => setModalType("REMOVE_FRIEND")}
                            className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                          >
                            {t("dm.removeFriend")}
                          </button>
                          <button
                            onClick={() => setModalType("BLOCK")}
                            className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                          >
                            {t("dm.block")}
                          </button>
                        </>
                      )}

                      {/* Relationship: none → show Add Friend */}
                      {relationship === "none" && (
                        <button
                          onClick={() => setRelationship("friend")}
                          className="flex items-center gap-1.5 rounded-[3px] bg-accent px-4 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover transition-colors duration-150 cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {t("dm.addFriend")}
                        </button>
                      )}

                      {/* Relationship: blocked → show Unblock + Report Spam */}
                      {relationship === "blocked" && (
                        <>
                          <button
                            onClick={() => setRelationship("none")}
                            className="rounded-[3px] border border-border bg-transparent px-4 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary/50 transition-colors duration-150 cursor-pointer"
                          >
                            {t("dm.unblock")}
                          </button>
                          <button
                            className="rounded-[3px] bg-destructive px-4 py-1.5 text-[13px] font-medium text-white hover:bg-destructive/80 transition-colors duration-150 cursor-pointer"
                          >
                            {t("dm.reportSpam")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                }
              />
            )}

            {/* Input wrapper — relative context for floating banner */}
            <div className="relative w-full">
              {/* Opaque bottom overlay to prevent chat messages from showing below the floating composer */}
              <div className="absolute bottom-0 left-0 right-0 h-[88px] bg-[#313338] z-10 pointer-events-none" />
              {/* Bottom bar: MessageInput or Blocked bar */}
              {relationship === "blocked" ? (
                <div
                  className="absolute inset-x-0 z-20 px-4"
                  style={{ bottom: "var(--floating-bar-gap)" }}
                >
                  <div
                    className="flex items-center justify-between px-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
                    style={{
                      minHeight: "var(--floating-user-panel-height)",
                      borderRadius: "var(--floating-bar-radius)",
                      backgroundColor: "#383a40",
                    }}
                  >
                    <span className="text-sm font-semibold text-zinc-200">
                      {t("dm.blockedMessage")}
                    </span>
                    <button
                      onClick={() => setRelationship("none")}
                      className="shrink-0 rounded bg-[#2b2d31] px-4 py-1.5 text-sm text-white hover:bg-[#1e1f22] transition-colors cursor-pointer"
                    >
                      {t("dm.unblock")}
                    </button>
                  </div>
                </div>
              ) : (
                <MessageInput
                  channelId={channelId || "pending"}
                  channelName={friendName}
                  isDm
                  onSend={handleSend}
                  onTyping={handleTyping}
                  members={roomId ? (allMembers[roomId] || []) : []}
                  showScrollDown={showJumpBanner}
                  onScrollDown={() => messageListRef.current?.scrollToBottom()}
                />
              )}
            </div>
          </div> {/* End of Chat container */}

          {/* DmUserPanel container (CSS Toggle instead of conditional render / SlidingPanel to avoid API spam) */}
          <div className={cn("shrink-0 bg-[#2b2d31] overflow-hidden transition-all duration-200 ease-in-out", showDmUserPanel && !showSearchPanel ? "w-[340px]" : "w-0")}>
            <div className="w-[340px] h-full">
              <DmUserPanel userId={userId} />
            </div>
          </div>

          {/* Search Results Panel for DM */}
          <div className={cn("shrink-0 bg-[#2b2d31] border-l border-[#1e1f22] overflow-hidden transition-all duration-200 ease-in-out", showSearchPanel ? "w-[400px]" : "w-0")}>
            <div className="w-[400px] h-full">
              <SearchResultsPanel channelId={channelId} />
            </div>
          </div>

        </div>
      </main>

      {/* Confirm Modal (Remove Friend / Block) */}
      {
        modalType && (
          <ConfirmModal
            title={
              modalType === "REMOVE_FRIEND"
                ? `${t("modal.removeFriendTitle")} ${friendName}`
                : `${t("modal.blockTitle")} ${friendName}`
            }
            description={
              modalType === "REMOVE_FRIEND" ? (
                <p>
                  {t("modal.removeFriendDesc").split("{name}")[0]}
                  <strong className="font-semibold text-white">{friendName}</strong>
                  {t("modal.removeFriendDesc").split("{name}")[1]}
                </p>
              ) : (
                <p>
                  {t("modal.blockDesc").split("{name}")[0]}
                  <strong className="font-semibold text-white">{friendName}</strong>
                  {t("modal.blockDesc").split("{name}")[1]}
                </p>
              )
            }
            confirmText={
              modalType === "REMOVE_FRIEND"
                ? t("modal.removeFriendConfirm")
                : t("modal.blockConfirm")
            }
            onClose={() => setModalType(null)}
            onConfirm={() => {
              if (modalType === "REMOVE_FRIEND") {
                setRelationship("none");
              } else {
                setRelationship("blocked");
              }
            }}
          />
        )
      }
    </>
  );
}

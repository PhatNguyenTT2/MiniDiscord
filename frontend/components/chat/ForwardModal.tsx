"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Search, Check, Send, Hash, Volume2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { getStompClient } from "@/lib/websocket";
import { cn } from "@/lib/utils";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import type { Message } from "@/types";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
}

interface Destination {
  id: string; // channelId or roomChannelId
  roomId: string;
  name: string;
  type: "DM" | "CHANNEL";
  serverName?: string;
  avatar?: string;
  status?: "ONLINE" | "OFFLINE" | "IDLE" | "DND";
  hasVoice?: boolean;
}

export function ForwardModal({ isOpen, onClose, message }: ForwardModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);

  const rooms = useRoomStore((s) => s.rooms);
  const channels = useRoomStore((s) => s.channels);
  const members = useRoomStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);

  // Group, format and sort destinations
  const destinations = useMemo<Destination[]>(() => {
    if (!currentUserId) return [];
    const list: Destination[] = [];

    // 1. Text channels from all Servers (GROUP rooms)
    rooms
      .filter((r) => r.type !== "DM")
      .forEach((room) => {
        const roomChannels = channels[room.id] || [];
        roomChannels
          .filter((c) => c.type === "TEXT" || c.type === "VOICE")
          .forEach((channel) => {
            list.push({
              id: channel.id,
              roomId: room.id,
              name: channel.name,
              type: "CHANNEL",
              serverName: room.name,
              hasVoice: channel.type === "VOICE",
            });
          });
      });

    // 2. DM rooms
    rooms
      .filter((r) => r.type === "DM")
      .forEach((room) => {
        const roomMembers = members[room.id] || [];
        const otherUser = roomMembers.find((m) => m.userId !== currentUserId);
        if (otherUser) {
          const roomChannelId = channels[room.id]?.[0]?.id || room.id;
          list.push({
            id: roomChannelId,
            roomId: room.id,
            name: otherUser.username,
            type: "DM",
            avatar: otherUser.avatarUrl || undefined,
            status: otherUser.status as any,
          });
        }
      });

    // 3. Sort by recently active channels using localStorage
    const recents: string[] = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("recent_channels") || "[]")
      : [];

    return list.sort((a, b) => {
      const idxA = recents.indexOf(a.id);
      const idxB = recents.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0; // maintain original grouping
    });
  }, [rooms, channels, members, currentUserId]);

  // Filter list by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return destinations;
    const query = search.toLowerCase();
    return destinations.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        (d.serverName && d.serverName.toLowerCase().includes(query))
    );
  }, [destinations, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSendForward = async () => {
    if (!token || selectedIds.length === 0) return;
    const client = getStompClient(token);
    if (!client.connected) return;

    setIsSending(true);

    try {
      for (const destId of selectedIds) {
        const dest = destinations.find((d) => d.id === destId);
        if (!dest) continue;

        // 1. Send forwarded message
        const payload = {
          roomId: dest.roomId,
          channelId: dest.id,
          content: message.content || "",
          type: (message.fileKey || message.type === "FILE") ? "FILE" : "TEXT",
          senderName: useAuthStore.getState().user?.username || "User",
          senderAvatar: useAuthStore.getState().user?.avatarUrl || null,
          fileKey: message.fileKey || null,
          fileName: message.fileName || null,
          fileSize: message.fileSize || null,
          replyTo: null,
          isForwarded: true,
        };

        client.publish({
          destination: "/app/chat.send",
          body: JSON.stringify(payload),
        });

        // 2. Send optional comment if present
        if (comment.trim()) {
          const commentPayload = {
            roomId: dest.roomId,
            channelId: dest.id,
            content: comment.trim(),
            type: "TEXT",
            senderName: useAuthStore.getState().user?.username || "User",
            senderAvatar: useAuthStore.getState().user?.avatarUrl || null,
            fileKey: null,
            fileName: null,
            fileSize: null,
            replyTo: null,
            isForwarded: false,
          };

          // Give a short delay to maintain timeline sequence
          await new Promise((r) => setTimeout(r, 60));
          client.publish({
            destination: "/app/chat.send",
            body: JSON.stringify(commentPayload),
          });
        }
      }

      onClose();
    } catch (err) {
      console.error("Failed to forward:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Reset local state when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setComment("");
      setSearch("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
      <div className="flex w-[460px] max-h-[85vh] flex-col rounded-md border border-[#1e1f22] bg-[#313338] shadow-2xl animate-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2b2d31]">
          <div>
            <h3 className="text-[19px] font-bold text-foreground leading-tight">
              {t("chat.forwardTo")}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {t("chat.forwardSubtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#949ba4] hover:text-[#dbdee1] p-1.5 hover:bg-[#35373c]/50 rounded-full transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="px-5 py-3.5 border-b border-[#2b2d31]">
          <div className="relative flex items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("chat.search")}
              className="h-9 w-full rounded bg-[#1e1f22] pl-10 pr-4 text-[14px] text-foreground placeholder:text-[#949ba4] outline-none border border-transparent focus:border-accent transition duration-150"
            />
            <Search className="absolute left-3.5 h-4.5 w-4.5 text-[#949ba4]" />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-[#949ba4]">
              {t("chat.noResults")}
            </div>
          ) : (
            filtered.map((dest) => {
              const isChecked = selectedIds.includes(dest.id);

              return (
                <div
                  key={dest.id}
                  onClick={() => toggleSelect(dest.id)}
                  className="flex items-center justify-between rounded-md p-2.5 hover:bg-[#35373c]/60 cursor-pointer select-none transition duration-100"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Left Icon / Avatar */}
                    {dest.type === "DM" ? (
                      <StatusAvatar
                        src={dest.avatar}
                        fallback={dest.name}
                        status={dest.status}
                        size="md"
                        className="shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-[#2b2d31] text-[#949ba4] flex items-center justify-center shrink-0">
                        {dest.hasVoice ? (
                          <Volume2 className="h-4 w-4" />
                        ) : (
                          <Hash className="h-4 w-4" />
                        )}
                      </div>
                    )}

                    {/* Name & Details */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold text-foreground truncate leading-tight">
                        {dest.type === "CHANNEL" ? `# ${dest.name}` : dest.name}
                      </p>
                      <p className="text-[12px] text-[#949ba4] mt-0.5 truncate leading-none">
                        {dest.serverName
                          ? t("chat.serverOf", { serverName: dest.serverName })
                          : `@${dest.name.toLowerCase().replace(/\s+/g, "")}`}
                      </p>
                    </div>
                  </div>

                  {/* Custom check box */}
                  <div className="ml-4 shrink-0">
                    <div
                      className={cn(
                        "flex h-[20px] w-[20px] items-center justify-center rounded border transition duration-75",
                        isChecked
                          ? "border-[#5865f2] bg-[#5865f2] text-white"
                          : "border-[#80848e] bg-transparent hover:border-[#dbdee1]"
                      )}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected tag bubbles */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 py-2 max-h-[80px] overflow-y-auto border-t border-[#2b2d31] bg-[#2b2d31]/10">
            {selectedIds.map((id) => {
              const dest = destinations.find((d) => d.id === id);
              if (!dest) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-1.5 bg-[#5865f2]/15 border border-[#5865f2]/30 text-[#dbdee1] px-2.5 py-1 rounded-full text-xs font-semibold"
                >
                  <span>{dest.type === "CHANNEL" ? `#${dest.name}` : `@${dest.name}`}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(id);
                    }}
                    className="hover:text-white transition rounded-full hover:bg-black/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input & Send row */}
        <div className="p-4 border-t border-[#2b2d31] bg-[#2b2d31]/40 rounded-b-md flex gap-3 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("chat.forwardCommentPlaceholder")}
              className="w-full h-10 rounded bg-[#1e1f22] pl-3.5 pr-10 text-[13.5px] text-foreground placeholder:text-[#949ba4] outline-none border border-transparent focus:border-accent transition duration-150"
            />
            {/* Emoji icon */}
            <button className="absolute right-3 top-2.5 text-[#949ba4] hover:text-[#dbdee1] transition">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <button
            disabled={selectedIds.length === 0 || isSending}
            onClick={handleSendForward}
            className={cn(
              "flex h-[40px] px-6 items-center justify-center rounded text-sm font-semibold select-none transition duration-150 gap-1.5 cursor-pointer",
              selectedIds.length === 0 || isSending
                ? "bg-[#5865f2]/40 text-[#ffffff]/40 cursor-not-allowed"
                : "bg-[#5865f2] text-white hover:bg-[#4752c4]"
            )}
          >
            {isSending ? (
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <span>{t("imageViewer.forwardSend")}</span>
                <Send className="h-3.5 w-3.5 rotate-0" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

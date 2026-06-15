"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useFriendStore } from "@/stores/friendStore";
import { ScrollArea } from "../ui/ScrollArea";
import { cn } from "@/lib/utils";

import { api } from "@/lib/api";
import { useHasPermission } from "@/hooks/useHasPermission";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  channelName?: string;
}

export function InviteModal({ isOpen, onClose, roomId, roomName, channelName = "general" }: InviteModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const { friends, fetchFriends } = useFriendStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [invitingIds, setInvitingIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const canInvite = useHasPermission("INVITE_MEMBER", roomId || undefined);

  // Load friends and invite when open
  useEffect(() => {
    if (isOpen && canInvite) {
      fetchFriends();
      setSearchQuery("");
      setInvitedIds([]);
      setCopied(false);

      const loadInvite = async () => {
        try {
          const res = await api.get(`/rooms/${roomId}/invites`);
          const active = res.data.data;
          if (active && active.length > 0) {
            setInviteCode(active[0].code);
          } else {
            const createRes = await api.post(`/rooms/${roomId}/invites`);
            setInviteCode(createRes.data.data.code);
          }
        } catch (err) {
          console.error("Failed to load invite link", err);
        }
      };
      loadInvite();
    }
  }, [isOpen, roomId, fetchFriends, canInvite]);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (!canInvite) return null;

  // Filter friends
  const filteredFriends = friends.filter((f) =>
    f.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inviteLink = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : "";

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleInvite = async (friendId: string) => {
    if (invitedIds.includes(friendId) || invitingIds.includes(friendId)) return;
    setInvitingIds((prev) => [...prev, friendId]);
    try {
      await api.post(`/rooms/${roomId}/members`, { userId: friendId });
      setInvitedIds((prev) => [...prev, friendId]);
    } catch (err: any) {
      console.error("Failed to direct invite friend via modal", err);
      if (err.response?.status === 409) {
        setInvitedIds((prev) => [...prev, friendId]);
      }
    } finally {
      setInvitingIds((prev) => prev.filter((id) => id !== friendId));
    }
  };


  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 transition-all duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="relative w-[440px] max-h-[85vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 duration-200 text-[#dbdee1]"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-2 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-[17px] font-bold text-white leading-tight">
            {t("invite.title", { serverName: roomName })}
          </h2>
          <p className="text-xs text-[#949ba4] mt-1">
            {t("invite.subtitle", { channel: channelName })}
          </p>
        </div>

        {/* Search Input */}
        <div className="px-5 py-2">
          <div className="relative flex items-center mt-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("invite.searchPlaceholder")}
              className="w-full rounded bg-[#1e1f22] pl-3 pr-9 py-2 text-sm text-white placeholder-[#80848e] outline-none"
            />
            <Search className="absolute right-3 h-4 w-4 text-[#80848e] shrink-0 pointer-events-none" />
          </div>
        </div>

        {/* Scrollable Friend List */}
        <div className="flex-1 overflow-hidden px-5 py-2">
          <ScrollArea className="max-h-[220px] pr-2">
            {filteredFriends.length > 0 ? (
              <div className="space-y-2.5 pb-2">
                {filteredFriends.map((f) => {
                  const isInvited = invitedIds.includes(f.user.id);
                  const isOnline = f.user.status === "ONLINE" || f.user.status === "IDLE" || f.user.status === "DND";
                  return (
                    <div
                      key={f.user.id}
                      className="flex items-center justify-between py-1.5 border-b border-[#3f4147]/20 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        {f.user.avatarUrl ? (
                          <img
                            src={f.user.avatarUrl}
                            alt={f.user.username}
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-[#5865f2]/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-[#5865f2] uppercase">
                              {f.user.username.substring(0, 2)}
                            </span>
                          </div>
                        )}
                        {/* User details */}
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-white text-[14px] truncate leading-tight">
                            {f.user.username}
                          </span>
                          <span className="text-[11px] text-[#949ba4] mt-0.5">
                            {isOnline ? t("invite.statusOnline") : t("invite.statusOffline")}
                          </span>
                        </div>
                      </div>

                      {/* Invite Button */}
                      <button
                        onClick={() => handleInvite(f.user.id)}
                        disabled={isInvited || invitingIds.includes(f.user.id)}
                        className={cn(
                          "px-4 py-1.5 text-xs font-semibold rounded transition-all duration-150 shrink-0 border",
                          isInvited
                            ? "border-[#80848e] text-[#b5bac1] hover:text-[#dbdee1] bg-transparent cursor-default"
                            : invitingIds.includes(f.user.id)
                              ? "bg-[#5865f2]/50 text-white/50 border-transparent cursor-not-allowed"
                              : "bg-[#5865f2] hover:bg-[#4752c4] text-white border-transparent cursor-pointer"
                        )}
                      >
                        {invitingIds.includes(f.user.id)
                          ? "..."
                          : isInvited
                            ? t("invite.invited")
                            : t("invite.sendAction")}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#949ba4]">
                {t("invite.noFriendsFound")}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Copy Invite Link field */}
        <div className="p-5 bg-[#2b2d31]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block">
            {t("invite.orSendLink")}
          </span>
          <div className="mt-2 flex items-center md:gap-2 bg-[#1e1f22] p-1 rounded">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent px-2.5 py-1 text-sm text-[#dbdee1] outline-none"
            />
            <button
              onClick={handleCopy}
              className={cn(
                "px-4 py-1.5 rounded text-xs font-semibold text-white transition-colors cursor-pointer shrink-0 ml-1",
                copied ? "bg-[#23a55a] hover:bg-[#23a55a]" : "bg-[#5865f2] hover:bg-[#4752c4]"
              )}
            >
              {copied ? t("invite.copied") : t("invite.copy")}
            </button>
          </div>
          <p className="mt-3 text-[10.5px] text-[#949ba4] leading-relaxed">
            {t("invite.linkNote")}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

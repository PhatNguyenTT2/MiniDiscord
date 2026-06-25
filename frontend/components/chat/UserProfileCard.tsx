"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n";
import { useFriendStore } from "@/stores/friendStore";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { getStompClient } from "@/lib/websocket";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { useHasPermission } from "@/hooks/useHasPermission";
import { api } from "@/lib/api";
import {
  MoreVertical,
  UserPlus,
  UserMinus,
  Check,
  X,
  VolumeX,
  ShieldAlert,
  Loader2,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileCardProps {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl: string | null;
  status: string;
  roomId: string;
  onClose: () => void;
}

export function UserProfileCard({
  userId,
  username,
  displayName,
  avatarUrl,
  status,
  roomId,
  onClose,
}: UserProfileCardProps) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);

  const friends = useFriendStore((s) => s.friends);
  const pendingRequests = useFriendStore((s) => s.pendingRequests);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const fetchPending = useFriendStore((s) => s.fetchPending);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptFriend = useFriendStore((s) => s.acceptFriend);
  const declineOrRemoveFriend = useFriendStore((s) => s.declineOrRemoveFriend);

  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
  const [muteDuration, setMuteDuration] = useState(5);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canBan = useHasPermission("BAN_MEMBER", roomId);
  const canRestrict = useHasPermission("RESTRICT_MEMBER", roomId);
  const rooms = useRoomStore((s) => s.rooms);
  const activeRoom = rooms.find((r) => r.id === roomId);
  const isOwner = activeRoom?.ownerId === currentUser?.id;
  const isAdmin = useHasPermission("MANAGE_CHANNEL", roomId) || isOwner;

  const token = useAuthStore((s) => s.token);
  const currentChannel = useVoiceStore((s) => s.currentChannel);

  const handleKickBot = () => {
    if (!token || !currentChannel) return;
    setLoadingAction("kick");
    try {
      getStompClient(token).publish({
        destination: "/app/voice.music.command",
        body: JSON.stringify({
          roomId,
          channelId: currentChannel.channelId,
          command: "stop"
        })
      });
      onClose();
    } catch (err) {
      console.error("[UserProfileCard] Failed to kick bot:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Target Member Server Mute state
  const members = useRoomStore((s) => s.members[roomId]) || [];
  const targetMember = members.find((m) => m.userId === userId);
  const isTargetMuted = targetMember?.mutedUntil
    ? new Date(targetMember.mutedUntil).getTime() > Date.now()
    : false;

  useEffect(() => {
    fetchFriends();
    fetchPending();
  }, [fetchFriends, fetchPending]);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
      if (cardRef.current && !cardRef.current.contains(event.target as Node) && !isBanModalOpen && !isMuteModalOpen) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, isBanModalOpen, isMuteModalOpen]);

  if (!currentUser) return null;
  const isSelf = currentUser.id === userId;

  // Determine friendship status
  const matchedFriend = friends.find((f) => f.user.id === userId);
  const matchedPending = pendingRequests.find((p) => p.user.id === userId);

  let relationType: "NONE" | "FRIEND" | "PENDING_INCOMING" | "PENDING_OUTGOING" = "NONE";
  let friendshipId = "";

  if (matchedFriend) {
    relationType = "FRIEND";
    friendshipId = matchedFriend.friendshipId;
  } else if (matchedPending) {
    relationType = matchedPending.incoming ? "PENDING_INCOMING" : "PENDING_OUTGOING";
    friendshipId = matchedPending.friendshipId;
  }

  const handleAddFriend = async () => {
    if (loadingAction) return;
    setLoadingAction("add");
    try {
      await sendRequest(username);
    } catch (err) {
      console.error("Failed to send friend request:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAcceptFriend = async () => {
    if (loadingAction || !friendshipId) return;
    setLoadingAction("accept");
    try {
      await acceptFriend(friendshipId);
    } catch (err) {
      console.error("Failed to accept friend request:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeclineFriend = async () => {
    if (loadingAction || !friendshipId) return;
    setLoadingAction("decline");
    try {
      await declineOrRemoveFriend(friendshipId);
    } catch (err) {
      console.error("Failed to decline friend-request:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemoveFriend = async () => {
    if (loadingAction || !friendshipId) return;
    if (!window.confirm(t("friends.removeFriendAction") + "?")) return;
    setLoadingAction("remove");
    try {
      await declineOrRemoveFriend(friendshipId);
    } catch (err) {
      console.error("Failed to remove friend:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBan = async () => {
    if (loadingAction) return;
    setLoadingAction("ban");
    try {
      await api.post(`/rooms/${roomId}/bans`, {
        userId,
        reason: banReason.trim() || undefined,
      });
      setIsBanModalOpen(false);
      onClose();
    } catch (err) {
      console.error("Failed to ban member:", err);
      alert("Failed to ban member");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMute = async (minutes: number) => {
    if (loadingAction) return;
    setLoadingAction("mute");
    try {
      await api.post(`/rooms/${roomId}/members/${userId}/mute`, {
        durationMinutes: minutes,
      });
      setIsActionsDropdownOpen(false);
      setIsMuteModalOpen(false);
      onClose();
    } catch (err) {
      console.error("Failed to mute member:", err);
      alert("Failed to restrict/mute member");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnmute = async () => {
    if (loadingAction) return;
    setLoadingAction("unmute");
    try {
      await api.post(`/rooms/${roomId}/members/${userId}/mute`, {
        durationMinutes: 0,
      });
      setIsActionsDropdownOpen(false);
      onClose();
    } catch (err) {
      console.error("Failed to unmute member:", err);
      alert("Failed to unmute member");
    } finally {
      setLoadingAction(null);
    }
  };

  const resolvedName = displayName || username;

  return (
    <div
      ref={cardRef}
      className="w-[300px] select-none rounded-xl border border-[#1f2023]/60 bg-[#1e1f22] text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 font-sans"
    >
      {/* Banner */}
      <div className="h-16 w-full bg-gradient-to-r from-[#5865f2] to-[#7f88f5] rounded-t-xl" />

      {/* Avatar Wrapper */}
      <div className="px-4 pb-3 relative">
        <div className="absolute -top-[32px] left-3 rounded-full border-[6px] border-[#1e1f22] bg-[#1e1f22]">
          <StatusAvatar
            src={avatarUrl}
            fallback={username}
            status={status as "ONLINE" | "OFFLINE" | "IDLE" | "DND"}
            size="xl"
          />
        </div>

        {/* Action Button Row */}
        <div className="flex items-center justify-end gap-1.5 h-10 w-full pt-1">
          {userId === "music-bot" && isAdmin && (
            <button
              onClick={handleKickBot}
              disabled={loadingAction !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#da373c] text-white hover:bg-[#a92b2f] transition cursor-pointer select-none active:scale-95 disabled:opacity-50"
            >
              {loadingAction === "kick" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserMinus className="h-3.5 w-3.5" />
              )}
              Kick Bot
            </button>
          )}

          {!isSelf && userId !== "music-bot" && (
            <>
              {relationType === "NONE" && (
                <button
                  onClick={handleAddFriend}
                  disabled={loadingAction !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#23a55a] text-white hover:bg-[#1a7e44] transition cursor-pointer select-none active:scale-95 disabled:opacity-50"
                >
                  {loadingAction === "add" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {t("chat.addFriend")}
                </button>
              )}

              {relationType === "PENDING_OUTGOING" && (
                <div className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#3f4147] text-[#dbdee1] border border-[#4e5058] select-none">
                  {t("chat.pendingFriend")}
                </div>
              )}

              {relationType === "PENDING_INCOMING" && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleAcceptFriend}
                    disabled={loadingAction !== null}
                    title={t("chat.acceptFriend")}
                    className="p-1.5 rounded-md bg-[#23a55a] text-white hover:bg-[#1a7e44] transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {loadingAction === "accept" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleDeclineFriend}
                    disabled={loadingAction !== null}
                    title={t("chat.declineFriend")}
                    className="p-1.5 rounded-md bg-[#da373c] text-white hover:bg-[#a12828] transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {loadingAction === "decline" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}

              {relationType === "FRIEND" && (
                <button
                  onClick={handleRemoveFriend}
                  disabled={loadingAction !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#da373c] text-white hover:bg-[#a12828] transition cursor-pointer select-none active:scale-95 disabled:opacity-50"
                >
                  {loadingAction === "remove" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                  {t("chat.removeFriend")}
                </button>
              )}

              {/* 3-Dot Actions Trigger */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                  className="p-1.5 rounded-md text-[#b5bac1] hover:bg-[#35363c] hover:text-[#dbdee1] transition cursor-pointer active:scale-95"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {/* Dropdown Panel */}
                {isActionsDropdownOpen && (
                  <div className="absolute right-0 top-8 z-50 w-52 rounded-md bg-[#111214] border border-[#1f2023] p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => alert("Xem hồ sơ đầy đủ triggered")}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded hover:bg-[#5865f2] text-[#dbdee1] hover:text-white transition cursor-pointer outline-none"
                    >
                      <span>{t("chat.viewFullProfile")}</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>

                    {/* Admin Actions */}
                    {(canBan || canRestrict) && (
                      <>
                        <div className="h-px bg-[#3f4147] my-1" />

                        {canRestrict && (
                          <button
                            onClick={() => {
                              setIsActionsDropdownOpen(false);
                              if (isTargetMuted) {
                                handleUnmute();
                              } else {
                                setIsMuteModalOpen(true);
                              }
                            }}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-[#ed4245] text-amber-500 hover:text-white transition cursor-pointer outline-none"
                          >
                            <VolumeX className="h-3.5 w-3.5" />
                            <span>{isTargetMuted ? t("chat.unmuteMember") : t("chat.restrictMember")}</span>
                          </button>
                        )}

                        {canBan && (
                          <button
                            onClick={() => {
                              setIsBanModalOpen(true);
                              setIsActionsDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-[#ed4245] text-red-500 hover:text-white transition cursor-pointer outline-none"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>{t("chat.banMember")}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="px-4 pb-4">
        {/* Name and Tag */}
        <div className="bg-[#111214] p-3 rounded-lg border border-[#232428]">
          <div className="text-[17px] font-bold text-white font-sans truncate leading-none flex items-center gap-1.5">
            <span>{resolvedName}</span>
            {userId === "music-bot" && (
              <span className="bg-[#5865f2] text-white text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider select-none leading-none scale-95 font-sans">
                BOT
              </span>
            )}
          </div>
          <p className="text-xs text-[#b5bac1] mt-1.5 select-all font-sans">
            @{username}
          </p>
        </div>

        {/* Small bio or additional placeholder info */}
        <div className="mt-3">
          <p className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider">
            {t("dm.aboutMeUpper")}
          </p>
          <p className="text-xs text-[#dbdee1] mt-1 pr-1 leading-snug">
            {t("dm.hello", { username: resolvedName })}
          </p>
        </div>
      </div>

      {/* Ban Reason Inline Modal */}
      {isBanModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-[17px] font-bold text-white leading-none">
              {t("chat.banMember")}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-tight">
              {t("chat.banConfirm", { username: resolvedName })}
            </p>
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={t("chat.banReasonPlaceholder")}
              className="mt-3.5 w-full bg-[#1e1f22] text-white p-2.5 rounded text-sm outline-none border border-[#1f2023] focus:border-[#5865f2] transition"
            />
            <div className="mt-5 flex items-center justify-end gap-2 text-sm font-semibold select-none">
              <button
                onClick={() => setIsBanModalOpen(false)}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={handleBan}
                disabled={loadingAction === "ban"}
                className="flex items-center gap-1 bg-[#da373c] text-white px-4 py-2 rounded hover:bg-[#a12828] active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "ban" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("chat.delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Restrict Member Modal */}
      {isMuteModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in font-sans">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <h3 className="text-[17px] font-bold text-white leading-none">
              {t("chat.restrictMember")}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-normal">
              {t("chat.restrictConfirm", { username: resolvedName })}
            </p>

            <div className="mt-4">
              <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1.5">
                {t("chat.restrictDurationLabel")}
              </label>
              <select
                value={muteDuration}
                onChange={(e) => setMuteDuration(Number(e.target.value))}
                className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 rounded text-sm outline-none border border-[#1f2023] focus:border-[#5865f2] transition cursor-pointer"
              >
                <option value={5}>{t("chat.mute5m")}</option>
                <option value={60}>{t("chat.mute1h")}</option>
                <option value={24 * 60}>{t("chat.mute24h")}</option>
                <option value={7 * 24 * 60}>{t("chat.mute1w")}</option>
              </select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 text-sm font-semibold select-none">
              <button
                onClick={() => setIsMuteModalOpen(false)}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={() => handleMute(muteDuration)}
                disabled={loadingAction === "mute"}
                className="flex items-center gap-1 bg-[#f59e0b] hover:bg-[#d97706] text-white px-4 py-2 rounded active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "mute" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("chat.restrictMember")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

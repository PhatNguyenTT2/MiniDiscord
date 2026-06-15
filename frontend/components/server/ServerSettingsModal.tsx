"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, ShieldAlert, Users, Trash2, Search, Shield, SlidersHorizontal, ChevronRight, Pencil, MoreHorizontal, VolumeX, Crown, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { ScrollArea } from "../ui/ScrollArea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import type { RoleResponse } from "@/types/room";
import { PermissionEditor } from "./PermissionEditor";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { useHasPermission } from "@/hooks/useHasPermission";

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

type TabType = "members" | "roles" | "invites";

interface InviteLinkListItem {
  id: string;
  code: string;
  roomId: string;
  roomName: string;
  roomIcon: string | null;
  uses: number;
  expiresAt: string;
  createdAt: string;
  creatorId: string;
}

export function ServerSettingsModal({ isOpen, onClose, roomId }: ServerSettingsModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { rooms, members, fetchMembers } = useRoomStore();
  const { friends, fetchFriends } = useFriendStore();

  const [activeTab, setActiveTab] = useState<TabType>("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "joinedAt" | "createdAt">("joinedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [activeInvites, setActiveInvites] = useState<InviteLinkListItem[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteCreator, setShowInviteCreator] = useState(false);

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);

  const [actionSearchQuery, setActionSearchQuery] = useState("");
  const [selectedActionMember, setSelectedActionMember] = useState<{
    userId: string;
    username: string;
    displayName?: string;
    avatarUrl: string | null;
    status: string;
    role: string;
    joinedAt?: string;
    createdAt?: string;
  } | null>(null);
  const [showMuteActionModal, setShowMuteActionModal] = useState(false);
  const [muteActionDuration, setMuteActionDuration] = useState(5);
  const [showBanActionModal, setShowBanActionModal] = useState(false);
  const [banActionReason, setBanActionReason] = useState("");
  const [showTransferActionModal, setShowTransferActionModal] = useState(false);
  const [showRoleActionModal, setShowRoleActionModal] = useState(false);
  const [targetRole, setTargetRole] = useState<"ADMIN" | "MEMBER" | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canBan = useHasPermission("BAN_MEMBER", roomId);
  const canRestrict = useHasPermission("RESTRICT_MEMBER", roomId);

  const [activeDropdownMemberId, setActiveDropdownMemberId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await api.get(`/rooms/${roomId}/roles`);
      setRoles(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (isOpen && roomId && activeTab === "roles") {
      fetchRoles();
      setEditingRole(null);
    }
  }, [isOpen, roomId, activeTab]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [searchFriendQuery, setSearchFriendQuery] = useState("");
  const [copiedStatus, setCopiedStatus] = useState(false);


  const MOCK_FRIENDS = [
    { id: "1", username: "kkk", tag: "tulatu#573" },
    { id: "2", username: "Nguyen Tue", tag: "tue_lord11349" },
    { id: "3", username: "muadongseoul.", tag: "terv1302" },
    { id: "4", username: "dola500", tag: "ganganngang" },
    { id: "5", username: "rotduide", tag: "rotduide" },
    { id: "6", username: "Shiroko", tag: "beluhacker" },
    { id: "7", username: "Big Mike", tag: "sdmikecfc" },
  ];

  const currentRoom = rooms.find((r) => r.id === roomId);
  const roomMembers = members[roomId] || [];
  const isOwner = currentRoom?.ownerId === user?.id;

  const fetchActiveInvites = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/invites`);
      setActiveInvites(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch active invites", err);
    }
  };

  const fetchOrCreateInvite = async () => {
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
      console.error("Failed to fetch/create invite link", err);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await api.delete(`/rooms/${roomId}/invites/${inviteId}`);
      setActiveInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error("Failed to delete invite label", err);
    }
  };

  useEffect(() => {
    if (isOpen && roomId) {
      fetchMembers(roomId);
      fetchFriends();
    }
  }, [isOpen, roomId, fetchMembers, fetchFriends]);

  useEffect(() => {
    if (isOpen && roomId && activeTab === "invites" && isOwner) {
      fetchActiveInvites();
    }
  }, [isOpen, roomId, activeTab, isOwner]);

  useEffect(() => {
    if (showInviteCreator && roomId) {
      fetchOrCreateInvite();
    }
  }, [showInviteCreator, roomId]);


  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showInviteCreator) {
          setShowInviteCreator(false);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showInviteCreator, onClose]);

  // Lock scroll
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



  const filteredMembers = useMemo(() => {
    const filtered = roomMembers.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesUser = m.username.toLowerCase().includes(q);
      const matchesDisplay = m.displayName ? m.displayName.toLowerCase().includes(q) : false;
      return matchesUser || matchesDisplay;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        const nameA = (a.displayName || a.username).toLowerCase();
        const nameB = (b.displayName || b.username).toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "joinedAt") {
        const dateA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const dateB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === "createdAt") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [roomMembers, searchQuery, sortBy, sortOrder]);

  const adminCount = roomMembers.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length;
  const normalMemberCount = roomMembers.filter((m) => m.role === "MEMBER").length;

  const getRoleBadgeColor = (role: string) => {
    if (role === "OWNER") return "bg-[#ffaa00]/20 text-[#ffaa00] border-[#ffaa00]/30";
    if (role === "ADMIN") return "bg-[#5865f2]/20 text-[#5865f2] border-[#5865f2]/30";
    return "bg-[#80848e]/20 text-[#b5bac1] border-[#80848e]/30";
  };

  const getLocalizedRoleName = (roleName?: string) => {
    if (!roleName) return t("serverSettingsModal.memberRoleName");
    const r = roleName.toUpperCase();
    if (r === "OWNER") {
      return t("serverSettingsModal.ownerRoleName");
    }
    if (r === "ADMIN") {
      return t("serverSettingsModal.adminRoleName");
    }
    if (r === "MEMBER") {
      return t("serverSettingsModal.memberRoleName");
    }
    return roleName;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("serverSettingsModal.recent");
    try {
      const d = new Date(dateString);
      return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return "01/01/2026";
    }
  };

  const handleCopyLink = () => {
    if (!inviteCode) return;
    const inviteLink = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleTransferOwnershipAction = async (targetUserId: string) => {
    try {
      setLoadingAction("transfer");
      await api.post(`/rooms/${roomId}/transfer-ownership`, { newOwnerId: targetUserId });
      alert(t("serverSettingsModal.transferSuccess") || "Ownership transferred successfully!");
      fetchMembers(roomId);
      onClose();
    } catch (err) {
      console.error("Failed to transfer ownership", err);
      alert("Failed to transfer ownership");
    } finally {
      setLoadingAction(null);
      setShowTransferActionModal(false);
      setSelectedActionMember(null);
    }
  };

  const handleMuteAction = async (targetUserId: string, minutes: number) => {
    try {
      setLoadingAction("mute");
      await api.post(`/rooms/${roomId}/members/${targetUserId}/mute`, {
        durationMinutes: minutes,
      });
      alert(t("serverSettingsModal.restrictSuccess") || "Member restricted successfully!");
      fetchMembers(roomId);
    } catch (err) {
      console.error("Failed to mute member", err);
      alert("Failed to mute member");
    } finally {
      setLoadingAction(null);
      setShowMuteActionModal(false);
      setSelectedActionMember(null);
    }
  };

  const handleBanAction = async (targetUserId: string, reason: string) => {
    try {
      setLoadingAction("ban");
      await api.post(`/rooms/${roomId}/bans`, {
        userId: targetUserId,
        reason: reason.trim() || undefined,
      });
      alert(t("serverSettingsModal.banSuccess") || "Member banned successfully!");
      fetchMembers(roomId);
    } catch (err) {
      console.error("Failed to ban member", err);
      alert("Failed to ban member");
    } finally {
      setLoadingAction(null);
      setShowBanActionModal(false);
      setSelectedActionMember(null);
    }
  };

  const handleUpdateRoleAction = async (targetUserId: string, newRole: "ADMIN" | "MEMBER") => {
    try {
      setLoadingAction("role");
      await api.post(`/rooms/${roomId}/members/${targetUserId}/role`, {
        role: newRole,
      });
      alert(newRole === "ADMIN"
        ? (t("serverSettingsModal.promoteSuccess") || "Member promoted successfully!")
        : (t("serverSettingsModal.demoteSuccess") || "Member demoted successfully!")
      );
      fetchMembers(roomId);
    } catch (err) {
      console.error("Failed to update role", err);
      alert("Failed to update role");
    } finally {
      setLoadingAction(null);
      setSelectedActionMember(null);
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.user.username.toLowerCase().includes(searchFriendQuery.toLowerCase()) ||
    (f.user.displayName && f.user.displayName.toLowerCase().includes(searchFriendQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex bg-[#313338] text-[#dbdee1] animate-in fade-in duration-200">
      {/* ─── Left sidebar Column Wrapper ─── */}
      <div className="flex-[0.8_0_260px] bg-[#2b2d31] flex justify-end border-r border-[#1f2023]/20 select-none">
        <div className="w-[260px] flex flex-col justify-between p-6 pr-4 shrink-0">
          <div className="space-y-4 pt-8 shrink-0 flex flex-col h-full justify-between pb-8">
            <div>
              {/* Header / Server settings */}
              <div className="px-2 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block truncate">
                  {currentRoom?.name || t("serverSettingsModal.title")}
                </span>
              </div>

              {/* Sections */}
              <ScrollArea className="h-[calc(100vh-220px)] pr-2">
                <div className="space-y-4">
                  {/* section 1: Mọi Người */}
                  <div className="space-y-1">
                    <span className="px-2.5 text-[10px] font-bold uppercase text-[#949ba4] tracking-wider">
                      {t("serverSettingsModal.people")}
                    </span>
                    <nav className="space-y-0.5 pt-1">
                      <button
                        onClick={() => setActiveTab("members")}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === "members"
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                        )}
                      >
                        {t("serverSettingsModal.members")}
                      </button>
                      <button
                        onClick={() => setActiveTab("roles")}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === "roles"
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                        )}
                      >
                        {t("serverSettingsModal.roles")}
                      </button>
                      <button
                        onClick={() => setActiveTab("invites")}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === "invites"
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                        )}
                      >
                        {t("serverSettingsModal.invites")}
                      </button>
                    </nav>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Separator / Footer (Non-highlighted normal list style at end of left sidebar menu) */}
            <div className="border-t border-[#35373c]/60 pt-2.5 shrink-0">
              <button
                onClick={() => alert(t("serverSettingsModal.deleteWarning"))}
                className="w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium text-[#f23f43]/80 hover:bg-[#f23f43]/10 hover:text-[#f23f43] transition-colors cursor-pointer"
              >
                {t("serverSettingsModal.deleteServer")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right content Column Wrapper (Centered layout context) ─── */}
      <div className="flex-[1.8_1_800px] bg-[#313338] flex justify-start relative min-w-0">
        {/* ESC close bubble */}
        <div className="absolute right-[40px] top-[40px] md:right-[60px] z-[9995]">
          <div className="flex flex-col items-center">
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#b5bac1] hover:border-white text-[#b5bac1] hover:text-white transition-all cursor-pointer rotate-0 hover:rotate-90"
              aria-label="Close settings"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-[12px] font-semibold text-[#b5bac1] mt-2 select-none uppercase">
              ESC
            </span>
          </div>
        </div>

        {/* Content scroller */}
        <div className="flex-1 overflow-y-auto px-[40px] md:px-[60px] lg:px-[80px] py-[60px]">
          <div className="max-w-[800px] w-full">
            {/* Render Tab Content */}
            {activeTab === "members" ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header */}
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">{t("serverSettingsModal.membersTitle")}</h2>
                  <p className="text-sm text-[#949ba4] max-w-[800px] leading-relaxed">
                    {t("serverSettingsModal.membersDesc")}
                  </p>
                </div>



                {/* Sub-header actions */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-white uppercase tracking-wide">
                    {t("serverSettingsModal.recentMembers")}
                  </span>

                  {/* Filter row container */}
                  <div className="flex items-center gap-2">
                    {/* Searchbox */}
                    <div className="relative flex items-center w-[240px]">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("serverSettingsModal.searchByUsernameOrId")}
                        className="w-full rounded bg-[#1e1f22] pl-3 pr-8 py-1.5 text-xs text-white placeholder-[#80848e] outline-none"
                      />
                      <Search className="absolute right-2.5 h-3.5 w-3.5 text-[#80848e] shrink-0 pointer-events-none" />
                    </div>

                    {/* Sort Button */}
                    <button
                      onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#35373c] text-white hover:bg-[#4e5058] rounded text-xs font-semibold overflow-hidden transition cursor-pointer shrink-0"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 opacity-80" />
                      {t("serverSettingsModal.sort")}: {sortOrder === "asc" ? "Asc" : "Desc"}
                    </button>

                    {/* Prune Button */}
                    <button className="px-3 py-1.5 text-[#dbdee1] hover:underline rounded text-xs font-semibold transition cursor-pointer shrink-0">
                      {t("serverSettingsModal.prune")}
                    </button>
                  </div>
                </div>

                {/* Member Directory Grid Table */}
                <div className="overflow-x-auto rounded-md bg-[#2b2d31]/40 border border-[#1f2023]/20">
                  <table className="w-full border-collapse text-left text-xs text-[#dbdee1]">
                    <thead>
                      <tr className="bg-[#2b2d31]/60 text-[#b5bac1] font-bold uppercase tracking-wider border-b border-[#2b2d31]">
                        <th
                          className="px-4 py-3 select-none cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (sortBy === "name") {
                              setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                            } else {
                              setSortBy("name");
                              setSortOrder("asc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.tableHeaderName")}
                            {sortBy === "name" && (
                              <span className="text-[10px] text-[#5865f2]">
                                {sortOrder === "asc" ? " ▲" : " ▼"}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 select-none cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (sortBy === "joinedAt") {
                              setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                            } else {
                              setSortBy("joinedAt");
                              setSortOrder("desc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.tableHeaderJoined")}
                            <SlidersHorizontal className="h-3 w-3 text-[#b5bac1]/60 shrink-0" />
                            {sortBy === "joinedAt" && (
                              <span className="text-[10px] text-[#5865f2]">
                                {sortOrder === "asc" ? " ▲" : " ▼"}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 select-none cursor-pointer hover:text-white transition-colors"
                          onClick={() => {
                            if (sortBy === "createdAt") {
                              setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                            } else {
                              setSortBy("createdAt");
                              setSortOrder("desc");
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.tableHeaderAge")}
                            <SlidersHorizontal className="h-3 w-3 text-[#b5bac1]/60 shrink-0" />
                            {sortBy === "createdAt" && (
                              <span className="text-[10px] text-[#5865f2]">
                                {sortOrder === "asc" ? " ▲" : " ▼"}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 select-none">
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.tableHeaderRoles")}
                            <SlidersHorizontal className="h-3 w-3 text-[#b5bac1]/60 shrink-0" />
                          </div>
                        </th>
                        <th className="px-4 py-3 select-none">
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.tableHeaderStatus")}
                            <SlidersHorizontal className="h-3 w-3 text-[#b5bac1]/60 shrink-0" />
                          </div>
                        </th>
                        <th className="px-4 py-3 select-none">
                          <div className="flex items-center gap-1">
                            {t("serverSettingsModal.actions")}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b2d31]/40">
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((m) => {
                          const isOnline = m.status === "ONLINE" || m.status === "IDLE" || m.status === "DND";
                          return (
                            <tr key={m.userId} className="hover:bg-[#2b2d31]/25 transition-colors">
                              {/* Name profile */}
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <StatusAvatar
                                    src={m.avatarUrl}
                                    fallback={m.username}
                                    size="sm"
                                    status={m.status as "ONLINE" | "OFFLINE" | "IDLE" | "DND"}
                                    className="shrink-0"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-white text-[13px] truncate">
                                      {m.displayName || m.username}
                                    </span>
                                    {m.displayName && m.displayName !== m.username && (
                                      <span className="text-[10px] text-[#949ba4] truncate">
                                        @{m.username}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Joined date */}
                              <td className="px-4 py-3.5 text-[#b5bac1] whitespace-nowrap">
                                {formatDate(m.joinedAt)}
                              </td>

                              {/* Discord Age */}
                              <td className="px-4 py-3.5 text-[#b5bac1] whitespace-nowrap">
                                {m.createdAt ? formatDate(m.createdAt) : t("serverSettingsModal.recent")}
                              </td>

                              {/* Role Pill Badges */}
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="flex flex-wrap gap-1.5">
                                  <span className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold border rounded-full flex items-center gap-1 select-none",
                                    getRoleBadgeColor(m.role)
                                  )}>
                                    {m.role === "OWNER" ? (
                                      <span title={getLocalizedRoleName("OWNER")}>
                                        <Crown className="h-3 w-3 shrink-0 text-[#ffaa00] fill-[#ffaa00]" />
                                      </span>
                                    ) : m.role === "ADMIN" ? (
                                      <Shield className="h-3 w-3 shrink-0" />
                                    ) : null}
                                    {m.role}
                                  </span>
                                </div>
                              </td>

                              {/* Signals / Presence status */}
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    isOnline ? "bg-[#23a55a]" : "bg-[#80848e]"
                                  )} />
                                  <span className="text-[11px] text-[#949ba4]">
                                    {isOnline ? t("serverSettingsModal.statusOnline") : t("serverSettingsModal.statusOffline")}
                                  </span>
                                </div>
                              </td>

                              {/* ACTIONS */}
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {m.userId !== user?.id && m.role !== "OWNER" && (isOwner || canRestrict || canBan) && (
                                    <button
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownPosition({
                                          top: rect.bottom + 5,
                                          left: rect.right - 176,
                                        });
                                        setActiveDropdownMemberId(m.userId);
                                      }}
                                      className="p-1 rounded hover:bg-[#35373c]/60 text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
                                      title={t("serverSettingsModal.actions")}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[#949ba4]">
                            {t("serverSettingsModal.noMembersFound")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "roles" ? (
              editingRole ? (
                <PermissionEditor
                  roomId={roomId}
                  roleId={editingRole.id}
                  roleName={editingRole.name}
                  initialPermissions={editingRole.permissions}
                  onBack={() => setEditingRole(null)}
                  onSaveSuccess={() => {
                    fetchRoles();
                    setEditingRole(null);
                  }}
                />
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Header */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{t("serverSettingsModal.rolesTitle")}</h2>
                    <p className="text-sm text-[#949ba4] max-w-[800px] leading-relaxed">
                      {t("serverSettingsModal.rolesDesc")}
                    </p>
                  </div>

                  {/* default permissions card */}
                  <div
                    onClick={() => {
                      if (!isOwner) return;
                      const everyone = roles.find((r) => r.name === "@everyone");
                      if (everyone) setEditingRole(everyone);
                    }}
                    className={cn(
                      "rounded-md bg-[#2b2d31] p-4 flex items-center justify-between border border-[#1f2023]/25 shadow-sm group",
                      isOwner
                        ? "cursor-pointer hover:bg-[#35373c] transition-colors"
                        : "opacity-80 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#80848e]/20 flex items-center justify-center text-[#b5bac1] shrink-0">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white text-sm">
                          {t("serverSettingsModal.defaultPermissions")}
                        </span>
                        <span className="text-xs text-[#949ba4] mt-0.5">
                          {t("serverSettingsModal.everyoneSubtitle")}
                        </span>
                      </div>
                    </div>
                    {isOwner && <ChevronRight className="h-5 w-5 text-[#949ba4] group-hover:text-white transition-colors" />}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-4 mt-6">
                    {/* Search box */}
                    <div className="relative flex items-center w-full max-w-[340px]">
                      <input
                        type="text"
                        placeholder={t("serverSettingsModal.searchRolesPlaceholder")}
                        className="w-full rounded bg-[#1e1f22] pl-3 pr-8 py-1.5 text-xs text-white placeholder-[#80848e] outline-none"
                      />
                      <Search className="absolute right-2.5 h-3.5 w-3.5 text-[#80848e] shrink-0 pointer-events-none" />
                    </div>

                    {/* Create Role Button */}
                    <button className="rounded bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-1.5 text-xs font-semibold shadow transition-colors cursor-pointer shrink-0 opacity-50 cursor-not-allowed" disabled>
                      {t("serverSettingsModal.createRole")}
                    </button>
                  </div>

                  {/* Roles table/list */}
                  <div className="rounded-md bg-[#2b2d31]/40 border border-[#1f2023]/20 overflow-hidden">
                    <div className="flex items-center justify-between bg-[#2b2d31]/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#b5bac1] border-b border-[#2b2d31]">
                      <div>{t("serverSettingsModal.rolesCount", { count: roles.length })}</div>
                      <div className="mr-32">{t("serverSettingsModal.membersColumn")}</div>
                    </div>

                    <div className="divide-y divide-[#2b2d31]/40">
                      {loadingRoles ? (
                        <div className="py-8 text-center text-xs text-[#949ba4] flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin"></span>
                          {t("serverSettingsModal.loadingRoles")}
                        </div>
                      ) : roles.length > 0 ? (
                        roles.map((role) => {
                          const isEveryone = role.name === "@everyone";
                          const isAdmin = role.name === "Admin";
                          const isMember = role.name === "Member";

                          const roleDisplayName = isEveryone
                            ? "@everyone"
                            : isAdmin
                              ? t("serverSettingsModal.adminRoleName")
                              : isMember
                                ? t("serverSettingsModal.memberRoleName")
                                : role.name;

                          const roleDescription = isEveryone
                            ? t("serverSettingsModal.everyoneSubtitle")
                            : isAdmin
                              ? t("serverSettingsModal.adminRoleDesc")
                              : isMember
                                ? t("serverSettingsModal.memberRoleDesc")
                                : "";

                          const memberCountForRole = role.name === "Admin" ? adminCount : normalMemberCount;
                          return (
                            <div key={role.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#2b2d31]/25 transition-colors group">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 border"
                                  style={{
                                    backgroundColor: `${role.color}15`,
                                    color: role.color,
                                    borderColor: `${role.color}20`
                                  }}
                                >
                                  {isEveryone ? <Users className="h-4.5 w-4.5" /> : <Shield className="h-4.5 w-4.5" />}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-white text-sm">
                                    {roleDisplayName}
                                  </span>
                                  <span className="text-[11px] text-[#949ba4] mt-0.5">
                                    {roleDescription}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                <span className="flex items-center gap-1.5 text-xs text-[#b5bac1] w-20">
                                  <Users className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                  {memberCountForRole}
                                </span>
                                {isOwner && (
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setEditingRole(role)}
                                      className="h-7 w-7 rounded flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-[#35373c]/60 cursor-pointer"
                                      title="Edit Role permissions"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center text-xs text-[#949ba4]">
                          {t("serverSettingsModal.noRoles")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : activeTab === "invites" ? (
              /* Invites active list layout (Image 3 details) */
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{t("serverSettingsModal.invitesTitle")}</h2>
                    <p className="text-sm text-[#949ba4] max-w-[800px] leading-relaxed">
                      {t("serverSettingsModal.invitesDesc")}
                    </p>
                  </div>

                  {/* Create Invites button */}
                  <button
                    onClick={() => setShowInviteCreator(true)}
                    className="rounded bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-1.5 text-xs font-semibold shadow transition-colors cursor-pointer shrink-0"
                  >
                    {t("serverSettingsModal.createInviteLink")}
                  </button>
                </div>

                <div className="border-t border-[#35373c]/60 my-2" />

                {/* Active invitation section */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider block">
                    {t("serverSettingsModal.activeInviteHeader")}
                  </span>

                  {activeInvites.length > 0 ? (
                    <div className="overflow-x-auto rounded-md bg-[#2b2d31]/40 border border-[#1f2023]/20">
                      <table className="w-full border-collapse text-left text-xs text-[#dbdee1]">
                        <thead>
                          <tr className="bg-[#2b2d31]/60 text-[#b5bac1] font-bold uppercase tracking-wider border-b border-[#2b2d31]">
                            <th className="px-4 py-2.5">{t("serverSettingsModal.tableHeaderInviter")}</th>
                            <th className="px-4 py-2.5">{t("serverSettingsModal.tableHeaderInviteCode")}</th>
                            <th className="px-4 py-2.5">{t("serverSettingsModal.tableHeaderUses")}</th>
                            <th className="px-4 py-2.5">{t("serverSettingsModal.tableHeaderDuration")}</th>
                            <th className="px-4 py-2.5">{t("serverSettingsModal.tableHeaderRoles")}</th>
                            <th className="px-4 py-2.5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b2d31]/40">
                          {activeInvites.map((invite) => {
                            const inviter = roomMembers.find((m) => m.userId?.toLowerCase() === invite.creatorId?.toLowerCase());
                            let inviterName = t("serverSettingsModal.unknownCreator") || "Unknown Creator";
                            let inviterAvatar = null;
                            let inviterStatus = undefined;
                            let inviterRole = inviter?.role;

                            if (inviter) {
                              inviterName = inviter.displayName || inviter.username;
                              inviterAvatar = inviter.avatarUrl;
                              inviterStatus = inviter.status;
                            } else if (user && user.id?.toLowerCase() === invite.creatorId?.toLowerCase()) {
                              inviterName = user.displayName || user.username || "Owner";
                              const u = user as unknown as { avatarUrl?: string | null; avatar?: string | null };
                              inviterAvatar = u.avatarUrl || u.avatar || null;
                              inviterStatus = "ONLINE";
                              inviterRole = currentRoom?.ownerId === user.id ? "OWNER" : "MEMBER";
                            }


                            const channelName = "general";
                            const getDurationText = (expiresAtStr: string) => {
                              const diff = new Date(expiresAtStr).getTime() - Date.now();
                              if (diff <= 0) return "Expired";
                              const days = Math.floor(diff / (24 * 3600 * 1000));
                              const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
                              const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
                              return `${days}d ${hours}h ${mins}m`;
                            };

                            return (
                              <tr key={invite.id} className="hover:bg-[#2b2d31]/25 transition-colors">
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2.5">
                                    <StatusAvatar
                                      src={inviterAvatar}
                                      fallback={inviterName}
                                      status={inviterStatus as "ONLINE" | "OFFLINE" | "IDLE" | "DND"}
                                      size="sm"
                                      className="shrink-0"
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-white truncate text-xs">
                                        {inviterName}
                                      </span>
                                      <span className="text-[10px] text-[#949ba4]">
                                        #{channelName}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-white font-mono whitespace-nowrap">
                                  {invite.code}
                                </td>
                                <td className="px-4 py-3.5 text-[#b5bac1] whitespace-nowrap">
                                  {invite.uses}
                                </td>
                                <td className="px-4 py-3.5 text-[#b5bac1] font-mono whitespace-nowrap">
                                  {getDurationText(invite.expiresAt)}
                                </td>
                                <td className="px-4 py-3.5 text-[#949ba4] whitespace-nowrap">
                                  {getLocalizedRoleName(inviterRole)}
                                </td>
                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="h-6 w-6 rounded flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-[#f23f43]/20 hover:text-[#f23f43] transition-colors cursor-pointer"
                                    title={t("common.remove")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md bg-[#2b2d31]/40 border border-[#1f2023]/20 py-8 text-center text-xs text-[#949ba4]">
                      {t("serverSettingsModal.noInvitesFound")}
                    </div>
                  )}

                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Invite Friends Creator Modal Overlay (matching picture 4) */}
      {showInviteCreator && (
        <div className="fixed inset-0 z-[9995] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#313338] text-[#dbdee1] w-full max-w-[440px] rounded-lg shadow-2xl overflow-hidden border border-[#232428]/45 relative animate-in zoom-in-95 duration-200">
            {/* Close Cross icon */}
            <button
              onClick={() => setShowInviteCreator(false)}
              className="absolute top-4 right-4 text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Inner Content Card container */}
            <div className="p-6 pb-4">
              <h3 className="text-base font-bold text-white pr-6 leading-tight">
                {t("serverSettingsModal.friendsInviteTitle", { serverName: currentRoom?.name || "" })}
              </h3>
              <p className="text-xs text-[#949ba4] mt-1 leading-snug">
                {t("serverSettingsModal.friendsInviteSubtitle", { channelName: "chung" })}
              </p>

              {/* Search input field */}
              <div className="relative flex items-center mt-4 mb-3">
                <input
                  type="text"
                  value={searchFriendQuery}
                  onChange={(e) => setSearchFriendQuery(e.target.value)}
                  placeholder={t("serverSettingsModal.searchFriends")}
                  className="w-full rounded bg-[#1e1f22] pl-3 pr-8 py-2 text-xs text-white placeholder-[#80848e] outline-none"
                />
                <Search className="absolute right-2.5 h-3.5 w-3.5 text-[#80848e] shrink-0 pointer-events-none" />
              </div>

              {/* Friends list container */}
              <ScrollArea className="h-[200px] pr-2 -mr-2">
                <div className="space-y-1 pt-1">
                  {filteredFriends.length > 0 ? (
                    filteredFriends.map((friend) => {
                      const isInvited = invitedFriends.includes(friend.user.id);
                      return (
                        <div key={friend.user.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-[#35373c]/40 rounded transition-colors group">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <StatusAvatar
                              src={friend.user.avatarUrl}
                              fallback={friend.user.username}
                              size="sm"
                              status={friend.status as "ONLINE" | "OFFLINE" | "IDLE" | "DND"}
                              className="shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-white text-xs truncate">
                                {friend.user.displayName || friend.user.username}
                              </span>
                              <span className="text-[10px] text-[#949ba4] truncate">
                                @{friend.user.username}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={async () => {
                              if (!isInvited) {
                                try {
                                  await api.post(`/rooms/${roomId}/members`, { userId: friend.user.id });
                                  setInvitedFriends((prev) => [...prev, friend.user.id]);
                                } catch (err) {
                                  console.error("Failed to direct invite friend:", err);
                                }
                              }
                            }}
                            disabled={isInvited}
                            className={cn(
                              "px-3 py-1.5 rounded text-xs font-semibold select-none border transition-colors cursor-pointer shrink-0 font-sans",
                              isInvited
                                ? "border-[#23a55a] text-[#23a55a] bg-transparent cursor-default"
                                : "border-[#5865f2] bg-[#5865f2] text-white hover:bg-[#4752c4] hover:border-[#4752c4]"
                            )}
                          >
                            {isInvited ? t("serverSettingsModal.invitedButton") : t("serverSettingsModal.inviteButton")}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-xs text-[#949ba4]">
                      {t("invite.noFriendsFound")}
                    </div>
                  )}

                </div>
              </ScrollArea>
            </div>

            {/* Bottom Section Link clipboard block */}
            <div className="bg-[#2b2d31] p-6 border-t border-[#1f2023]/25 font-sans">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block mb-2 leading-none">
                {t("serverSettingsModal.orSendLink")}
              </span>
              <div className="flex items-center gap-2 bg-[#1e1f22] p-1.5 rounded border border-[#1f2023]/30">
                <input
                  type="text"
                  readOnly
                  value={inviteCode ? `${window.location.origin}/invite/${inviteCode}` : ""}
                  className="flex-1 bg-transparent border-0 outline-none text-xs text-[#dbdee1] pl-2 select-all font-mono"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "px-4 py-2 rounded text-xs font-semibold text-white transition-all shadow select-none cursor-pointer shrink-0 min-w-[96px]",
                    copiedStatus
                      ? "bg-[#23a55a] hover:bg-[#23a55a]"
                      : "bg-[#5865f2] hover:bg-[#4752c4]"
                  )}
                >
                  {copiedStatus ? t("serverSettingsModal.copiedButton") : t("serverSettingsModal.copyButton")}
                </button>
              </div>

              <span className="text-[10px] text-[#949ba4] block mt-3 leading-snug">
                {t("serverSettingsModal.inviteExpiryDesc", { days: 7 })}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Ban Reason Inline Modal */}
      {showBanActionModal && selectedActionMember && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <h3 className="text-[17px] font-bold text-white leading-none">
              {t("serverSettingsModal.banButton")} {selectedActionMember.displayName || selectedActionMember.username}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-tight">
              {t("chat.banConfirm", { username: selectedActionMember.displayName || selectedActionMember.username })}
            </p>
            <input
              type="text"
              value={banActionReason}
              onChange={(e) => setBanActionReason(e.target.value)}
              placeholder={t("chat.banReasonPlaceholder")}
              className="mt-3.5 w-full bg-[#1e1f22] text-white p-2.5 rounded text-sm outline-none border border-[#1f2023] focus:border-[#5865f2] transition"
            />
            <div className="mt-5 flex items-center justify-end gap-2 text-sm font-semibold select-none">
              <button
                onClick={() => {
                  setShowBanActionModal(false);
                  setSelectedActionMember(null);
                }}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={() => handleBanAction(selectedActionMember.userId, banActionReason)}
                disabled={loadingAction === "ban"}
                className="flex items-center gap-1 bg-[#da373c] text-white px-4 py-2 rounded hover:bg-[#a12828] active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "ban" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("serverSettingsModal.banButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restrict Member Modal */}
      {showMuteActionModal && selectedActionMember && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <h3 className="text-[17px] font-bold text-white leading-none">
              {t("serverSettingsModal.restrictButton")} {selectedActionMember.displayName || selectedActionMember.username}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-normal">
              {t("chat.restrictConfirm", { username: selectedActionMember.displayName || selectedActionMember.username })}
            </p>

            <div className="mt-4">
              <label className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider block mb-1.5">
                {t("chat.restrictDurationLabel")}
              </label>
              <select
                value={muteActionDuration}
                onChange={(e) => setMuteActionDuration(Number(e.target.value))}
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
                onClick={() => {
                  setShowMuteActionModal(false);
                  setSelectedActionMember(null);
                }}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={() => handleMuteAction(selectedActionMember.userId, muteActionDuration)}
                disabled={loadingAction === "mute"}
                className="flex items-center gap-1 bg-[#f59e0b] hover:bg-[#d97706] text-white px-4 py-2 rounded active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "mute" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("serverSettingsModal.restrictButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferActionModal && selectedActionMember && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <h3 className="text-[17px] font-bold text-white leading-none">
              {t("serverSettingsModal.transferTitle")}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-normal">
              {t("serverSettingsModal.transferConfirmPrompt", { username: selectedActionMember.displayName || selectedActionMember.username })}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2 text-sm font-semibold select-none">
              <button
                onClick={() => {
                  setShowTransferActionModal(false);
                  setSelectedActionMember(null);
                }}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={() => handleTransferOwnershipAction(selectedActionMember.userId)}
                disabled={loadingAction === "transfer"}
                className="flex items-center gap-1 bg-[#da373c] text-white px-4 py-2 rounded hover:bg-[#a12828] active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "transfer" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("serverSettingsModal.transferOwnership")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote / Demote Member Role Modal */}
      {showRoleActionModal && selectedActionMember && targetRole && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 transition-opacity animate-in fade-in">
          <div className="relative w-full max-w-[380px] rounded-lg bg-[#313338] p-5 shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <h3 className="text-[17px] font-bold text-white leading-none font-sans">
              {targetRole === "ADMIN"
                ? t("serverSettingsModal.promoteConfirmTitle")
                : t("serverSettingsModal.demoteConfirmTitle")}
            </h3>
            <p className="text-sm text-[#b5bac1] mt-2 leading-normal font-sans">
              {targetRole === "ADMIN"
                ? t("serverSettingsModal.promoteConfirmDesc", { username: selectedActionMember.displayName || selectedActionMember.username })
                : t("serverSettingsModal.demoteConfirmDesc", { username: selectedActionMember.displayName || selectedActionMember.username })}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2 text-sm font-semibold select-none">
              <button
                onClick={() => {
                  setShowRoleActionModal(false);
                  setSelectedActionMember(null);
                  setTargetRole(null);
                }}
                className="px-4 py-2 text-[#dbdee1] hover:underline cursor-pointer transition"
              >
                {t("modal.cancel")}
              </button>
              <button
                onClick={() => {
                  handleUpdateRoleAction(selectedActionMember.userId, targetRole);
                  setShowRoleActionModal(false);
                  setTargetRole(null);
                }}
                disabled={loadingAction === "role"}
                className={cn(
                  "flex items-center gap-1 text-white px-4 py-2 rounded active:scale-95 transition cursor-pointer disabled:opacity-50 font-sans font-semibold",
                  targetRole === "ADMIN"
                    ? "bg-[#5865f2] hover:bg-[#4752c4]"
                    : "bg-[#da373c] hover:bg-[#a12828]"
                )}
              >
                {loadingAction === "role" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {targetRole === "ADMIN"
                  ? t("serverSettingsModal.promoteConfirm")
                  : t("serverSettingsModal.demoteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member actions dropdown menu */}
      {activeDropdownMemberId && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={() => setActiveDropdownMemberId(null)}
          />
          <div
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 9999,
            }}
            className="w-44 rounded-md border border-[#1e1f22] bg-[#111214] py-1.5 shadow-xl animate-in font-sans"
          >
            <div className="flex flex-col px-1.5 gap-0.5 select-none text-xs">
              {/* Transfer Ownership option */}
              {isOwner && (
                <button
                  onClick={() => {
                    const m = roomMembers.find((item) => item.userId === activeDropdownMemberId);
                    if (m) {
                      setSelectedActionMember(m);
                      setShowTransferActionModal(true);
                    }
                    setActiveDropdownMemberId(null);
                  }}
                  className="flex items-center gap-2 w-full rounded-[2px] px-2 py-1.5 font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  {t("serverSettingsModal.transferOwnership")}
                </button>
              )}

              {/* Promote/Demote to Admin option (OWNER ONLY) */}
              {isOwner && (() => {
                const target = roomMembers.find((item) => item.userId === activeDropdownMemberId);
                if (!target) return null;
                const isTargetAdmin = target.role === "ADMIN";
                return (
                  <button
                    onClick={() => {
                      setSelectedActionMember(target);
                      setTargetRole(isTargetAdmin ? "MEMBER" : "ADMIN");
                      setShowRoleActionModal(true);
                      setActiveDropdownMemberId(null);
                    }}
                    className="flex items-center gap-2 w-full rounded-[2px] px-2 py-1.5 font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    {isTargetAdmin
                      ? t("serverSettingsModal.demoteToMember") || "Demote to Member"
                      : t("serverSettingsModal.promoteToAdmin") || "Promote to Admin"}
                  </button>
                );
              })()}

              {/* Mute member option */}
              {(() => {
                const target = roomMembers.find((item) => item.userId === activeDropdownMemberId);
                const currentUserMember = roomMembers.find((m) => m.userId === user?.id);
                const currentUserRole = currentUserMember?.role;
                const canMuteTarget = isOwner || (canRestrict && (currentUserRole !== "ADMIN" || target?.role === "MEMBER"));

                if (!canMuteTarget) return null;

                return (
                  <button
                    onClick={() => {
                      if (target) {
                        setSelectedActionMember(target);
                        setShowMuteActionModal(true);
                      }
                      setActiveDropdownMemberId(null);
                    }}
                    className="flex items-center gap-2 w-full rounded-[2px] px-2 py-1.5 font-medium text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <VolumeX className="h-3.5 w-3.5 text-orange-400" />
                    {t("serverSettingsModal.muteButton")}
                  </button>
                );
              })()}

              {/* Ban member option */}
              {(() => {
                const target = roomMembers.find((item) => item.userId === activeDropdownMemberId);
                const currentUserMember = roomMembers.find((m) => m.userId === user?.id);
                const currentUserRole = currentUserMember?.role;
                const canBanTarget = isOwner || (canBan && (currentUserRole !== "ADMIN" || target?.role === "MEMBER"));

                if (!canBanTarget) return null;

                return (
                  <button
                    onClick={() => {
                      if (target) {
                        setSelectedActionMember(target);
                        setShowBanActionModal(true);
                      }
                      setActiveDropdownMemberId(null);
                    }}
                    className="flex items-center gap-2 w-full rounded-[2px] px-2 py-1.5 font-medium text-[#da373c] hover:bg-[#da373c] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {t("serverSettingsModal.banButton")}
                  </button>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

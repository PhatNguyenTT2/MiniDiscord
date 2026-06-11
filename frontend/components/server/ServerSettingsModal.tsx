"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldAlert, Users, Trash2, Search, Calendar, Badge, Shield } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { ScrollArea } from "../ui/ScrollArea";
import { cn } from "@/lib/utils";

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

type TabType =
  | "members"
  | "roles"
  | "invites"
  | "access"
  | "integrations"
  | "directory"
  | "safety"
  | "audit"
  | "bans"
  | "automod";

export function ServerSettingsModal({ isOpen, onClose, roomId }: ServerSettingsModalProps) {
  const { t } = useTranslation();
  const { rooms, members, fetchMembers } = useRoomStore();
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabType>("members");
  const [searchQuery, setSearchQuery] = useState("");

  const currentRoom = rooms.find((r) => r.id === roomId);
  const roomMembers = members[roomId] || [];

  // Fetch members when modal is opened
  useEffect(() => {
    if (isOpen && roomId) {
      fetchMembers(roomId);
    }
  }, [isOpen, roomId, fetchMembers]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  const filteredMembers = roomMembers.filter((m) =>
    m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    if (role === "OWNER") return "bg-[#ffaa00]/20 text-[#ffaa00] border-[#ffaa00]/30";
    if (role === "ADMIN") return "bg-[#5865f2]/20 text-[#5865f2] border-[#5865f2]/30";
    return "bg-[#80848e]/20 text-[#b5bac1] border-[#80848e]/30";
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

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex bg-[#313338] text-[#dbdee1] animate-in fade-in duration-200">
      {/* ─── Left sidebar Column Wrapper ─── */}
      <div className="flex-[1_0_240px] bg-[#2b2d31] flex justify-end border-r border-[#1f2023]/20 select-none">
        <div className="w-[240px] flex flex-col justify-between p-6 pr-4 shrink-0">
          <div className="space-y-4 pt-8 shrink-0">
            {/* Header / Server settings */}
            <div className="px-2 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block truncate">
                {currentRoom?.name || t("serverSettingsModal.title")}
              </span>
            </div>

            {/* Sections */}
            <ScrollArea className="h-[calc(100vh-160px)] pr-2">
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
                    {(["roles", "invites", "access"] as const).map((tKey) => (
                      <button
                        key={tKey}
                        onClick={() => setActiveTab(tKey)}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === tKey
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4]/60 hover:bg-[#35373c]/20 hover:text-[#dbdee1]"
                        )}
                      >
                        {tKey === "roles" ? t("serverSettingsModal.roles") : tKey === "invites" ? t("serverSettingsModal.invites") : t("serverSettingsModal.access")}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* section 2: Ứng dụng */}
                <div className="space-y-1">
                  <span className="px-2.5 text-[10px] font-bold uppercase text-[#949ba4] tracking-wider">
                    {t("serverSettingsModal.apps")}
                  </span>
                  <nav className="space-y-0.5 pt-1">
                    {(["integrations", "directory"] as const).map((tKey) => (
                      <button
                        key={tKey}
                        onClick={() => setActiveTab(tKey)}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === tKey
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4]/60 hover:bg-[#35373c]/20 hover:text-[#dbdee1]"
                        )}
                      >
                        {tKey === "integrations" ? t("serverSettingsModal.integrations") : t("serverSettingsModal.appDirectory")}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* section 3: Điều chỉnh */}
                <div className="space-y-1">
                  <span className="px-2.5 text-[10px] font-bold uppercase text-[#949ba4] tracking-wider">
                    {t("serverSettingsModal.moderation")}
                  </span>
                  <nav className="space-y-0.5 pt-1">
                    {(["safety", "audit", "bans", "automod"] as const).map((tKey) => (
                      <button
                        key={tKey}
                        onClick={() => setActiveTab(tKey)}
                        className={cn(
                          "w-full flex items-center px-2.5 py-1.5 rounded text-sm text-left font-medium transition-colors cursor-pointer",
                          activeTab === tKey
                            ? "bg-[#35373c] text-white"
                            : "text-[#949ba4]/60 hover:bg-[#35373c]/20 hover:text-[#dbdee1]"
                        )}
                      >
                        {tKey === "safety"
                          ? t("serverSettingsModal.safety")
                          : tKey === "audit"
                            ? t("serverSettingsModal.audit")
                            : tKey === "bans"
                              ? t("serverSettingsModal.bans")
                              : t("serverSettingsModal.automod")}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </ScrollArea>

            {/* Separator / Footer */}
            <div className="border-t border-[#35373c]/60 pt-2 shrink-0">
              <button
                onClick={() => alert(t("serverSettingsModal.deleteWarning"))}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left font-medium text-[#f23f43] hover:bg-[#f23f43]/10 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {t("serverSettingsModal.deleteServer")}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Right content Column Wrapper ─── */}
        <div className="flex-[1.8_1_0%] bg-[#313338] flex justify-start relative min-w-0">
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-[40px] md:px-[60px] lg:px-[80px] py-[60px]">
            <div className="max-w-[680px] w-full">
              {/* Render Tab Content */}
              {activeTab === "members" ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Header */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{t("serverSettingsModal.membersTitle")}</h2>
                    <p className="text-sm text-[#949ba4] max-w-[680px] leading-relaxed">
                      {t("serverSettingsModal.membersDesc")}
                    </p>
                  </div>

                  <div className="border-t border-[#35373c]/60 my-2" />

                  {/* Sub-header actions */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">
                      {t("serverSettingsModal.memberCount", { count: filteredMembers.length })}
                    </span>

                    {/* Searchbox */}
                    <div className="relative flex items-center w-[240px]">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("serverSettingsModal.searchPlaceholder")}
                        className="w-full rounded bg-[#1e1f22] pl-3 pr-8 py-1.5 text-xs text-white placeholder-[#80848e] outline-none"
                      />
                      <Search className="absolute right-2.5 h-3.5 w-3.5 text-[#80848e] shrink-0 pointer-events-none" />
                    </div>
                  </div>

                  {/* Member Directory Grid Table */}
                  <div className="overflow-x-auto rounded-md bg-[#2b2d31]/40 border border-[#1f2023]/20">
                    <table className="w-full border-collapse text-left text-xs text-[#dbdee1]">
                      <thead>
                        <tr className="bg-[#2b2d31]/60 text-[#b5bac1] font-bold uppercase tracking-wider border-b border-[#2b2d31]">
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderName")}</th>
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderJoined")}</th>
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderAge")}</th>
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderMethod")}</th>
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderRoles")}</th>
                          <th className="px-4 py-3 select-none">{t("serverSettingsModal.tableHeaderStatus")}</th>
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
                                    {m.avatarUrl ? (
                                      <img
                                        src={m.avatarUrl}
                                        alt={m.username}
                                        className="h-8 w-8 rounded-full object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full bg-[#5865f2]/20 flex items-center justify-center shrink-0">
                                        <span className="text-[11px] font-bold text-[#5865f2] uppercase">
                                          {m.username.substring(0, 2)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-white text-[13px] truncate">
                                        {m.username}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Joined date */}
                                <td className="px-4 py-3.5 text-[#b5bac1] whitespace-nowrap">
                                  {formatDate(m.joinedAt)}
                                </td>

                                {/* Discord Age */}
                                <td className="px-4 py-3.5 text-[#949ba4] whitespace-nowrap">
                                  {t("serverSettingsModal.yearsAgo")}
                                </td>

                                {/* Invite Method */}
                                <td className="px-4 py-3.5 text-[#949ba4] whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-[#1e1f22] text-[10px] font-medium border border-[#3f4147]/10">
                                    {t("serverSettingsModal.defaultMethod")}
                                  </span>
                                </td>

                                {/* Role Pill Badges */}
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={cn(
                                      "px-2 py-0.5 text-[10px] font-bold border rounded-full flex items-center gap-1 select-none",
                                      getRoleBadgeColor(m.role)
                                    )}>
                                      {m.role === "OWNER" || m.role === "ADMIN" ? (
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
              ) : (
                // Fallback placeholder layouts for un-implemented items
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-300">
                  <ShieldAlert className="h-16 w-16 text-[#b5bac1]/40" />
                  <h3 className="text-lg font-bold text-white">{t("serverSettingsModal.underDev")}</h3>
                  <p className="text-sm text-[#949ba4] max-w-[420px]">
                    {t("serverSettingsModal.underDevDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

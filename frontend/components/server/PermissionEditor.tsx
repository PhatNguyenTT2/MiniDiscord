"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/lib/api";

interface PermissionEditorProps {
  roomId: string;
  roleId: string;
  roleName: string;
  initialPermissions: Record<string, boolean>;
  onBack: () => void;
  onSaveSuccess: () => void;
}

const PERMISSION_METADATA = [
  {
    key: "MANAGE_CHANNEL",
    titleKey: "permissions.manageChannelTitle",
    titleDefault: "Quản lý kênh",
    descKey: "permissions.manageChannelDesc",
    descDefault: "Cho phép tạo, chỉnh sửa hoặc xóa các kênh.",
  },
  {
    key: "INVITE_MEMBER",
    titleKey: "permissions.inviteMemberTitle",
    titleDefault: "Mời thành viên",
    descKey: "permissions.inviteMemberDesc",
    descDefault: "Cho phép tạo liên kết mời thành viên vào máy chủ.",
  },
  {
    key: "DELETE_ANY_MESSAGE",
    titleKey: "permissions.deleteAnyMessageTitle",
    titleDefault: "Quản lý tin nhắn",
    descKey: "permissions.deleteAnyMessageDesc",
    descDefault: "Cho phép xóa tin nhắn của các thành viên khác.",
  },
  {
    key: "BAN_MEMBER",
    titleKey: "permissions.banMemberTitle",
    titleDefault: "Cấm thành viên",
    descKey: "permissions.banMemberDesc",
    descDefault: "Cho phép cấm thành viên vĩnh viễn khỏi máy chủ.",
  },
  {
    key: "RESTRICT_MEMBER",
    titleKey: "permissions.restrictMemberTitle",
    titleDefault: "Hạn chế thành viên",
    descKey: "permissions.restrictMemberDesc",
    descDefault: "Cho phép tắt tiếng hoặc hạn chế chat/hoạt động của thành viên.",
  },
  {
    key: "ALLOW_MENTION",
    titleKey: "permissions.allowMentionTitle",
    titleDefault: "Cho phép mention @everyone",
    descKey: "permissions.allowMentionDesc",
    descDefault: "Cho phép đề cập đến @everyone hoặc @here trong tin nhắn.",
  },
];

export function PermissionEditor({
  roomId,
  roleId,
  roleName,
  initialPermissions,
  onBack,
  onSaveSuccess,
}: PermissionEditorProps) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    ...initialPermissions,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    JSON.stringify(permissions) !== JSON.stringify(initialPermissions);

  const handleToggle = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleReset = () => {
    setPermissions({ ...initialPermissions });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.put(`/rooms/${roomId}/roles/${roleId}/permissions`, permissions);
      onSaveSuccess();
    } catch (err: any) {
      console.error("Failed to update role permissions", err);
      setError(
        err.response?.data?.message || "Internal server error. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 relative pb-24">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#35373c]/60 text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
          aria-label="Back to roles"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">
            {t("permissions.editorTitle")}
          </h2>
          <p className="text-sm text-[#949ba4] mt-1">
            {t("permissions.editorSubtitle", { roleName })}
          </p>
        </div>
      </div>

      <div className="border-t border-[#35373c]/60 my-2" />

      {error && (
        <div className="p-3 bg-[#f23f43]/10 text-[#f23f43] rounded text-sm font-semibold border border-[#f23f43]/20">
          {error}
        </div>
      )}

      {/* Permissions List */}
      <div className="space-y-4 pt-1">
        {PERMISSION_METADATA.map((p) => {
          const isAllowed = !!permissions[p.key];
          return (
            <div
              key={p.key}
              onClick={() => handleToggle(p.key)}
              className="rounded-md bg-[#2b2d31] p-4 flex items-center justify-between gap-4 border border-[#1f2023]/25 cursor-pointer hover:bg-[#35373c]/30 transition-colors select-none"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-semibold text-white text-sm">
                  {t(p.titleKey)}
                </span>
                <span className="text-xs text-[#949ba4] leading-relaxed mt-1">
                  {t(p.descKey)}
                </span>
              </div>

              <label className="relative inline-flex items-center pointer-events-none shrink-0">
                <input
                  type="checkbox"
                  checked={isAllowed}
                  onChange={() => { }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#80848e] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#23a55a]"></div>
              </label>
            </div>
          );
        })}
      </div>

      {/* Discord-style floating save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-[260px] right-0 bg-[#1e1f22]/95 backdrop-blur px-8 py-3.5 z-[9992] flex items-center justify-between border-t border-[#1f2023]/35 shadow-lg animate-in slide-in-from-bottom duration-200">
          <span className="text-xs font-semibold text-white">
            {t("permissions.unsavedChanges")}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs text-[#dbdee1] hover:underline font-semibold transition cursor-pointer"
            >
              {t("permissions.reset")}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-1.5 bg-[#23a55a] hover:bg-[#1a7f45] text-white rounded text-xs font-semibold shadow transition-all cursor-pointer flex items-center justify-center min-w-[70px] disabled:opacity-50"
            >
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
              ) : (
                t("permissions.save")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

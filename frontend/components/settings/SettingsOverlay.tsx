"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { StatusAvatar } from "@/components/ui/StatusAvatar";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import {
  User,
  Globe,
  LogOut,
  X,
  Pencil,
  Camera,
  Check,
  Volume2
} from "lucide-react";
import { SoundTab } from "./SoundTab";
import { CURRENT_USER } from "@/lib/mock-data";
import { useTranslation, useI18nStore, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useFileStore } from "@/stores/fileStore";

type SettingsTab = "account" | "language" | "sound";

const LANGUAGES: { key: Locale; label: string; nativeLabel: string }[] = [
  { key: "en", label: "English", nativeLabel: "English" },
  { key: "vi", label: "Tiếng Việt", nativeLabel: "Vietnamese" },
];

/* ─── Avatar with popup ────────────────────────────────────────────── */
function AvatarWithPopup() {
  const { t } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user) || CURRENT_USER;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const isUploading = useFileStore((s) => s.isUploading);
  const [localUploading, setLocalUploading] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    }
    if (showPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopup]);

  const handleAvatarChangeClick = () => {
    fileInputRef.current?.click();
    setShowPopup(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (localUploading || isUploading) return;

    try {
      setLocalUploading(true);
      const res = await useFileStore.getState().uploadFile(file, "avatar");
      if (res && res.fileKey) {
        await updateProfile({ avatarUrl: res.fileKey });
      }
    } catch (err) {
      console.error("Failed to upload avatar:", err);
    } finally {
      setLocalUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const showLoading = isUploading || localUploading;

  return (
    <div className="relative" ref={popupRef}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        onClick={() => setShowPopup(!showPopup)}
        disabled={showLoading}
        className="group relative cursor-pointer disabled:opacity-50"
      >
        <StatusAvatar
          src={user.avatarUrl}
          fallback={user.username}
          status={user.status}
          size="xl"
        />
        {showLoading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 z-10">
            <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Camera className="h-5 w-5 text-white" />
          </div>
        )}
      </button>

      {showPopup && (
        <div className="absolute left-0 top-full z-50 mt-2 rounded-lg bg-background-tertiary p-2 shadow-xl border border-border min-w-[180px]">
          <button
            onClick={handleAvatarChangeClick}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
            {t("settings.changeAvatar")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── My Account tab (with Security / Standing sub-tabs) ──────────── */
type AccountSubTab = "security" | "standing";

function SecurityContent() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user) || CURRENT_USER;
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [readonlyWarningField, setReadonlyWarningField] = useState<"username" | "email" | null>(null);

  const handleEditClick = () => {
    setNewDisplayName(user.displayName || user.username || "");
    setIsEditingDisplayName(true);
  };

  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || isSavingDisplayName) return;
    try {
      setIsSavingDisplayName(true);
      await updateProfile({ displayName: newDisplayName.trim() });
      setIsEditingDisplayName(false);
    } catch (err) {
      console.error("Failed to save display name:", err);
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="rounded-lg">
        {/* Profile banner */}
        <div className="h-[100px] bg-accent rounded-t-lg" />

        {/* Profile card */}
        <div className="relative bg-background-secondary px-4 pb-4 rounded-b-lg">
          <div className="relative -mt-10 mb-3 flex items-end justify-between">
            <AvatarWithPopup />
          </div>

          {/* Info fields */}
          <div className="space-y-3 rounded-lg bg-background-tertiary p-4">
            <InfoRow
              label={t("settings.displayName")}
              value={user.displayName || user.username}
              onEdit={handleEditClick}
            />
            <InfoRow
              label={t("settings.username")}
              value={(user.username || "").toLowerCase()}
              onEdit={() => setReadonlyWarningField("username")}
            />
            <InfoRow
              label={t("settings.email")}
              value={user.email || ""}
              onEdit={() => setReadonlyWarningField("email")}
            />
          </div>
        </div>
      </div>

      {readonlyWarningField && (
        <ConfirmModal
          title={
            readonlyWarningField === "username"
              ? t("settings.cannotChangeUsernameTitle")
              : t("settings.cannotChangeEmailTitle")
          }
          description={
            readonlyWarningField === "username"
              ? t("settings.cannotChangeUsernameDesc")
              : t("settings.cannotChangeEmailDesc")
          }
          confirmText="OK"
          showCancel={false}
          variant="primary"
          onClose={() => setReadonlyWarningField(null)}
          onConfirm={() => setReadonlyWarningField(null)}
        />
      )}

      {isEditingDisplayName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => !isSavingDisplayName && setIsEditingDisplayName(false)} />
          <div className="relative z-10 w-full max-w-[440px] rounded-md bg-[#313338] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white">{t("settings.editDisplayNameTitle")}</h2>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  {t("settings.editDisplayNameLabel")}
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  disabled={isSavingDisplayName}
                  className="w-full bg-[#1e1f22] text-white p-2.5 rounded-md border border-neutral-800 focus:border-accent focus:outline-none text-[15px] disabled:opacity-50"
                  placeholder={t("settings.displayName")}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveDisplayName();
                    } else if (e.key === "Escape" && !isSavingDisplayName) {
                      setIsEditingDisplayName(false);
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 bg-[#2b2d31] px-4 py-4">
              <button
                onClick={() => setIsEditingDisplayName(false)}
                disabled={isSavingDisplayName}
                className="px-4 py-2 text-sm font-medium text-[#dbdee1] hover:text-white hover:underline bg-transparent border-none transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("settings.cancel")}
              </button>
              <button
                onClick={handleSaveDisplayName}
                disabled={isSavingDisplayName}
                className="flex items-center gap-2 rounded bg-[#5865f2] px-6 py-2 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingDisplayName && (
                  <div className="h-3.5 w-3.5 rounded-full border border-white border-t-transparent animate-spin shrink-0" />
                )}
                {t("settings.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StandingContent() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user) || CURRENT_USER;

  const STEPS = [
    t("settings.stepGood"),
    t("settings.stepLimited"),
    t("settings.stepSevere"),
    t("settings.stepRisk"),
    t("settings.stepSuspended"),
  ];

  const activeStep = 0;

  return (
    <div className="mt-6">
      {/* Status card */}
      <div className="flex items-start gap-4">
        <StatusAvatar
          src={user.avatarUrl}
          fallback={user.username}
          status={user.status}
          size="xl"
        />
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-base text-foreground">
            {t("settings.accountGoodIntro")}
            <span className="font-bold text-success">
              {t("settings.accountGood")}
            </span>
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
            {t("settings.accountGoodDesc")}
          </p>
        </div>
      </div>

      {/* Standing progress bar */}
      <div className="mt-8">
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              {/* Step dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    i === activeStep
                      ? "border-success bg-success"
                      : i < activeStep
                        ? "border-success bg-success"
                        : "border-muted-foreground/30 bg-transparent"
                  )}
                >
                  {i <= activeStep && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </div>
                <p className={cn(
                  "mt-2 text-center text-[11px] leading-tight whitespace-pre-line",
                  i === activeStep ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {step}
                </p>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1",
                    i < activeStep ? "bg-success" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountTab() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<AccountSubTab>("security");

  const SUB_TABS: { key: AccountSubTab; label: string }[] = [
    { key: "security", label: t("settings.security") },
    { key: "standing", label: t("settings.standing") },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-border">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={cn(
              "pb-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px",
              subTab === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "security" && <SecurityContent />}
      {subTab === "standing" && <StandingContent />}
    </div>
  );
}

function InfoRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
      <Button variant="outline" size="sm" className="text-xs h-7" onClick={onEdit}>
        {t("settings.edit")}
      </Button>
    </div>
  );
}

/* ─── Language & Time tab ──────────────────────────────────────────── */
function LanguageTab() {
  const { t } = useTranslation();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const [timeFormat, setTimeFormat] = useState<string>("auto");

  const TIME_FORMATS = [
    { key: "auto", label: t("settings.timeAuto") },
    { key: "12h", label: t("settings.time12h") },
    { key: "24h", label: t("settings.time24h") },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-4">
        {t("settings.languageTime")}
      </h2>

      {/* Language */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("settings.selectLanguage")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("settings.selectLanguageDesc")}
        </p>

        <div className="mt-3 space-y-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.key}
              onClick={() => setLocale(lang.key)}
              className={cn(
                "group flex w-full items-center justify-between rounded-md px-3 py-2.5 transition-all cursor-pointer",
                locale === lang.key
                  ? "bg-accent/20 ring-1 ring-accent"
                  : "bg-background-tertiary hover:bg-secondary/50 hover:ring-1 hover:ring-border"
              )}
            >
              <span className="text-sm text-foreground">
                {lang.label}
              </span>
              {locale === lang.key && (
                <Check className="h-4 w-4 text-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time format */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("settings.timeFormat")}
        </h3>

        <div className="mt-3 space-y-2.5">
          {TIME_FORMATS.map((fmt) => (
            <label
              key={fmt.key}
              onClick={() => setTimeFormat(fmt.key)}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div
                className={cn(
                  "flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 transition-colors",
                  timeFormat === fmt.key
                    ? "border-accent"
                    : "border-muted-foreground/40 group-hover:border-muted-foreground"
                )}
              >
                {timeFormat === fmt.key && (
                  <div className="h-2 w-2 rounded-full bg-accent" />
                )}
              </div>
              <span className="text-sm text-foreground">
                {fmt.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Settings Overlay ────────────────────────────────────────── */
export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user) || CURRENT_USER;

  const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    {
      key: "account",
      label: t("settings.myAccount"),
      icon: User,
    },
    {
      key: "language",
      label: t("settings.languageTime"),
      icon: Globe,
    },
    {
      key: "sound",
      label: t("settings.sound"),
      icon: Volume2,
    },
  ];

  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    onClose();
    router.push("/login");
  }

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9990] flex bg-[#313338] text-[#dbdee1] animate-in fade-in duration-200">
      {/* ─── Left sidebar Column Wrapper ─── */}
      <div className="flex-[0.8_0_260px] bg-[#2b2d31] flex justify-end border-r border-[#1f2023]/20 select-none">
        <div className="w-[260px] flex flex-col justify-between p-6 pr-4 shrink-0">
          <div>
            {/* User header */}
            <div className="flex items-center gap-2.5 px-3 pt-8 pb-3">
              <StatusAvatar
                src={user.avatarUrl}
                fallback={user.username}
                status={user.status}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground leading-tight">
                  {user.displayName || user.username}
                </p>
                <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                  <span className="whitespace-nowrap truncate">{t("settings.editProfile")}</span>
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-2.5 pb-4">
              <div className="flex h-7 items-center rounded bg-[#1e1f22] px-2">
                <span className="text-[11px] text-[#80848e] whitespace-nowrap truncate">
                  {t("settings.search")}
                </span>
              </div>
            </div>

            {/* Section title */}
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[#949ba4] whitespace-nowrap truncate">
              {t("settings.userSettings")}
            </p>

            {/* Tabs */}
            <ScrollArea className="h-[calc(100vh-220px)] pr-2">
              <nav className="space-y-0.5">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors cursor-pointer font-medium",
                        activeTab === tab.key
                          ? "bg-[#35373c] text-white"
                          : "text-[#949ba4] hover:bg-[#35373c]/40 hover:text-[#dbdee1]"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="whitespace-nowrap truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Separator + Logout */}
              <div className="my-2 border-t border-[#35373c]/60" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap truncate">{t("settings.logOut")}</span>
              </button>
            </ScrollArea>
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

        {/* Content */}
        <ScrollArea className="flex-1 px-[40px] md:px-[60px] lg:px-[80px] py-[60px]">
          <div className="max-w-[800px] w-full">
            {activeTab === "account" && <AccountTab />}
            {activeTab === "language" && <LanguageTab />}
            {activeTab === "sound" && <SoundTab />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

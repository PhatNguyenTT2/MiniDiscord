"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronRight,
  Sparkles,
  Gamepad2,
  Users,
  GraduationCap,
  School,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATE_OPTIONS = [
  { key: "gaming" as const, icon: Gamepad2, emoji: "🎮" },
  { key: "friends" as const, icon: Users, emoji: "🤝" },
  { key: "study" as const, icon: GraduationCap, emoji: "📚" },
  { key: "school" as const, icon: School, emoji: "🏫" },
];

export function CreateServerModal({ isOpen, onClose }: CreateServerModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { createRoom } = useRoomStore();

  const [step, setStep] = useState<"templates" | "form">("templates");
  const [serverName, setServerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("templates");
      setServerName("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        className="relative z-10 w-[440px] max-h-[90vh] flex flex-col rounded-md overflow-hidden bg-[#313338] shadow-2xl animate-in zoom-in-95 fade-in duration-200"
      >
        {/* ─── Header ─── */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-sm text-[#b5bac1] hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-xl font-bold text-foreground">
            {t("createServer.title")}
          </h2>
          <p className="mt-2 text-[13px] text-[#b5bac1] leading-relaxed">
            {t("createServer.subtitle")}
          </p>
        </div>

        {/* ─── Body ─── */}
        {step === "templates" ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <button
                onClick={() => setStep("form")}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border border-[#3f4147] p-3.5 transition-colors cursor-pointer",
                  "hover:bg-[#3a3c41]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌈</span>
                  <span className="text-[15px] font-semibold text-foreground">
                    {t("createServer.createOwn")}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-[#b5bac1]" />
              </button>

              <p className="mt-4 mb-2 text-xs font-bold text-[#b5bac1] uppercase tracking-wide">
                {t("createServer.templateLabel")}
              </p>

              <div className="flex flex-col gap-2">
                {TEMPLATE_OPTIONS.map(({ key, emoji }) => (
                  <button
                    key={key}
                    onClick={() => setStep("form")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border border-[#3f4147] p-3.5 transition-colors cursor-pointer",
                      "hover:bg-[#3a3c41]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{emoji}</span>
                      <span className="text-[15px] font-semibold text-foreground">
                        {t(`createServer.template.${key}`)}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#b5bac1]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#2b2d31] px-4 py-4">
              <h3 className="text-center text-base font-semibold text-foreground mb-2">
                {t("createServer.joinTitle")}
              </h3>
              <button
                className={cn(
                  "w-full rounded-md bg-[#4e5058] px-4 py-2.5 text-sm font-medium text-[#dbdee1] transition-colors cursor-pointer",
                  "hover:bg-[#6d6f78]"
                )}
              >
                {t("createServer.joinButton")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pb-4">
              <label className="text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
                Server Name
              </label>
              <input
                type="text"
                autoFocus
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="mt-2 w-full rounded-md bg-[#1e1f22] p-2.5 text-foreground outline-none border border-transparent focus:border-brand transition-colors"
                placeholder="My Awesome Server"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between bg-[#2b2d31] px-4 py-4">
              <button
                onClick={() => setStep("templates")}
                disabled={isSubmitting}
                className="text-sm font-medium text-muted-foreground hover:underline cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  if (!serverName.trim()) return;
                  try {
                    setIsSubmitting(true);
                    const newRoom = await createRoom(serverName.trim());
                    // Fetch channels for the new room, then navigate
                    const { fetchChannels } = useRoomStore.getState();
                    await fetchChannels(newRoom.id);
                    const newChannels = useRoomStore.getState().channels[newRoom.id] || [];
                    const defaultCh = newChannels.find(c => c.type === "TEXT") || newChannels[0];
                    onClose();
                    if (defaultCh) {
                      router.push(`/channels/${defaultCh.id}`);
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={!serverName.trim() || isSubmitting}
                className="rounded-md bg-brand px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/80 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

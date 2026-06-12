"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  title: string;
  description: React.ReactNode;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
  showCancel?: boolean;
  variant?: "danger" | "primary";
}

export function ConfirmModal({
  title,
  description,
  confirmText,
  onClose,
  onConfirm,
  showCancel = true,
  variant = "danger",
}: ConfirmModalProps) {
  const { t } = useTranslation();

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[440px] rounded-md bg-[#313338] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Body */}
        <div className="p-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <div className="mt-4 text-base leading-relaxed text-gray-300">
            {description}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-md bg-[#2b2d31] px-4 py-4">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#dbdee1] hover:text-white hover:underline bg-transparent transition-colors cursor-pointer"
            >
              {t("modal.cancel")}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "rounded-md px-6 py-2 text-sm font-medium text-white transition-colors cursor-pointer",
              variant === "danger"
                ? "bg-[#da373c] hover:bg-[#a12828]"
                : "bg-[#5865f2] hover:bg-[#4752c4]"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useTranslation } from "@/lib/i18n";
import { Phone, PhoneOff } from "lucide-react";

export function IncomingCallModal() {
  const { t } = useTranslation();
  const incomingCall = useVoiceStore((s) => s.incomingCall);
  const acceptCall = useVoiceStore((s) => s.acceptCall);
  const declineCall = useVoiceStore((s) => s.declineCall);

  if (!incomingCall) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-bounce duration-500">
      <div className="flex flex-col items-center justify-between w-80 bg-[#1e1f22] border border-[#35363c] shadow-[0_24px_50px_rgba(0,0,0,0.5)] rounded-xl p-5">

        {/* Ringing waves avatar container */}
        <div className="relative mb-4">
          <span className="absolute inset-0 rounded-full bg-[#23a55a]/25 animate-ping" />
          {incomingCall.callerAvatar ? (
            <img
              src={incomingCall.callerAvatar}
              alt={incomingCall.callerName}
              className="h-16 w-16 rounded-full object-cover relative z-10 border border-[#23a55a]/50"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-[#5865f2] flex items-center justify-center relative z-10 text-xl font-bold text-white uppercase border border-[#23a55a]/50">
              {incomingCall.callerName.substring(0, 2)}
            </div>
          )}
        </div>

        {/* Messaging header */}
        <h3 className="text-[16px] font-bold text-white tracking-wide text-center">
          {incomingCall.callerName}
        </h3>
        <p className="text-[13px] text-[#23a55a] font-semibold animate-pulse text-center mt-1 uppercase tracking-wider">
          {t("voice.incomingCall")}...
        </p>

        {/* Green/Red click buttons panel */}
        <div className="flex items-center justify-center gap-4 w-full mt-5">
          {/* Decline (Red) Button */}
          <button
            onClick={declineCall}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded bg-[#ed4245] hover:bg-[#c93b3e] text-white text-[14px] font-semibold transition-colors duration-150 shadow-md cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" />
            <span>{t("voice.decline")}</span>
          </button>

          {/* Accept (Green) Button */}
          <button
            onClick={acceptCall}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded bg-[#23a55a] hover:bg-[#1a7f43] text-white text-[14px] font-semibold transition-colors duration-150 shadow-md cursor-pointer animate-pulse"
          >
            <Phone className="h-4 w-4" />
            <span>{t("voice.accept")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

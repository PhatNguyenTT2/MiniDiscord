"use client";

import { useEffect, useState } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useTranslation } from "@/lib/i18n";
import { Phone, X } from "lucide-react";
import { soundEngine } from "@/lib/soundEngine";
import { getResolvedFileUrl } from "@/lib/fileResolver";

export function IncomingCallModal() {
  const { t } = useTranslation();
  const incomingCall = useVoiceStore((s) => s.incomingCall);
  const acceptCall = useVoiceStore((s) => s.acceptCall);
  const declineCall = useVoiceStore((s) => s.declineCall);

  const [isRingtoneBlocked, setIsRingtoneBlocked] = useState(false);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!incomingCall) {
      setResolvedAvatar(null);
      return;
    }

    setIsRingtoneBlocked(false);

    if (incomingCall.callerAvatar) {
      getResolvedFileUrl(incomingCall.callerAvatar)
        .then((url) => setResolvedAvatar(url))
        .catch(() => setResolvedAvatar(null));
    } else {
      setResolvedAvatar(null);
    }

    if (soundEngine) {
      soundEngine.playLoop("call_ringing")
        .catch((err) => {
          console.warn("[IncomingCallModal] Browser blocked audio autoplay:", err);
          setIsRingtoneBlocked(true);
        });
    }

    // 60-second automatic decline timeout
    const ringTimeout = setTimeout(() => {
      console.log("[IncomingCallModal] Ringing timeout reached after 60s. Auto declining.");
      declineCall();
    }, 60000);

    return () => {
      if (soundEngine) {
        soundEngine.stopLoop("call_ringing");
      }
      clearTimeout(ringTimeout);
    };
  }, [incomingCall, declineCall]);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111214]/70 backdrop-blur-[2px] transition-all duration-300">
      <div className="flex flex-col items-center justify-between w-[280px] bg-[#313338] shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded-2xl p-6 border border-[#2b2d31] text-white">

        {/* Ringing waves avatar container */}
        <div className="relative mb-4 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-[#23a55a]/20 scale-125 animate-pulse" />
          {resolvedAvatar ? (
            <img
              src={resolvedAvatar}
              alt={incomingCall.callerName}
              className="h-20 w-20 rounded-full object-cover relative z-10 border-2 border-[#23a55a]"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[#5865f2] flex items-center justify-center relative z-10 border-2 border-[#23a55a]">
              <svg className="h-10 w-10 text-white fill-current animate-pulse" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.88,6.83,77.19,77.19,0,0,0,49.58,0,105.15,105.15,0,0,0,19.14,8.07C2.81,32.22-1.71,55.78,1,79a105.73,105.73,0,0,0,32,16.14,77.89,77.89,0,0,0,6.71-11,68.6,68.6,0,0,1-10.64-5.12c.9-.66,1.8-1.34,2.65-2a75.58,75.58,0,0,0,94.26,0c.85.7,1.75,1.38,2.65,2a68.6,68.6,0,0,1-10.64,5.12,77.89,77.89,0,0,0,6.71,11,105.73,105.73,0,0,0,32-16.14C129.66,50.21,124.64,26.85,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,54,46,54,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.11,46,96.11,53,91,65.69,84.69,65.69Z" />
              </svg>
            </div>
          )}
        </div>

        {/* Messaging header */}
        <h3 className="text-lg font-bold text-white tracking-wide text-center">
          {incomingCall.callerName}
        </h3>
        <p className="text-sm text-[#dbdee1] text-center mt-1">
          {t("voice.incomingCall")}...
        </p>

        {/* Decline/Accept actions centered, no text, only icons */}
        <div className="flex items-center justify-center gap-6 mt-6">
          {/* Decline (Red) Button */}
          <button
            onClick={declineCall}
            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-[#ed4245] hover:bg-[#c93b3e] text-white transition-colors duration-150 shadow-md cursor-pointer"
            title={t("voice.decline")}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Accept (Green) Button */}
          <button
            onClick={acceptCall}
            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-[#23a55a] hover:bg-[#1a7f43] text-white transition-colors duration-150 shadow-md cursor-pointer"
            title={t("voice.accept")}
          >
            <Phone className="h-6 w-6 fill-current text-white" />
          </button>
        </div>

        {/* Browser autoplay fallback unmuter banner */}
        {isRingtoneBlocked && (
          <button
            onClick={() => {
              if (soundEngine) {
                soundEngine.playLoop("call_ringing")
                  .then(() => setIsRingtoneBlocked(false))
                  .catch(() => { });
              }
            }}
            className="mt-4 px-3 py-1.5 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] text-xs font-semibold text-white transition-all cursor-pointer uppercase tracking-wider text-center"
          >
            {t("settings.incomingCallRingtoneUnmute")}
          </button>
        )}
      </div>
    </div>
  );
}

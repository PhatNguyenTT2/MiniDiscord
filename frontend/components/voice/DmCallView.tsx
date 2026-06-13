"use client";

import { useState, useEffect } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { Mic, MicOff, PhoneOff, HeadphoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResolvedFileUrl } from "@/lib/fileResolver";
import { useAudioActivity } from "@/hooks/useAudioActivity";

interface DmCallViewProps {
  roomId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
}

export function DmCallView({ roomId, recipientId, recipientName, recipientAvatar }: DmCallViewProps) {
  const { t } = useTranslation();

  const currentUser = useAuthStore((s) => s.user);

  const localStream = useVoiceStore((s) => s.localStream);
  const remoteStreams = useVoiceStore((s) => s.remoteStreams);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const endCall = useVoiceStore((s) => s.endCall);
  const incomingCall = useVoiceStore((s) => s.incomingCall);
  const callStatus = useVoiceStore((s) => s.callStatus);

  const channelParticipants = useVoiceStore((s) => s.channelParticipants);
  const participantsList = channelParticipants["dm"] || [];
  const recipientState = participantsList.find((p) => p.userId === recipientId);
  const isRecipientMuted = recipientState?.muted || false;
  const isRecipientDeafened = recipientState?.deafened || false;

  const isConnected = callStatus === "ACTIVE";
  const isRinging = callStatus === "RINGING";

  const toggleMute = useVoiceStore((s) => s.toggleMute);

  const recipientStream = remoteStreams[recipientId] || null;
  const isSelfSpeaking = useAudioActivity(localStream, isMuted || isDeafened);
  const isRecipientSpeaking = useAudioActivity(recipientStream, isRecipientMuted || isRecipientDeafened);

  // Dynamic Avatar Resolution States (specifically resolves B2 storage keys)
  const [resolvedUserAvatar, setResolvedUserAvatar] = useState<string | null>(null);
  const [resolvedRecipientAvatar, setResolvedRecipientAvatar] = useState<string | null>(null);

  // Resolve current user avatar Url
  useEffect(() => {
    const userSrc = currentUser?.avatarUrl;
    if (!userSrc) {
      setResolvedUserAvatar(null);
      return;
    }
    const isB2 = !(
      userSrc.startsWith("http://") ||
      userSrc.startsWith("https://") ||
      userSrc.startsWith("data:") ||
      userSrc.startsWith("/")
    );
    if (!isB2) {
      setResolvedUserAvatar(userSrc);
      return;
    }
    let isMounted = true;
    getResolvedFileUrl(userSrc)
      .then((url) => {
        if (isMounted) setResolvedUserAvatar(url);
      })
      .catch((err) => {
        console.error("DmCallView: failed to resolve user avatar", err);
        if (isMounted) setResolvedUserAvatar(null);
      });
    return () => {
      isMounted = false;
    };
  }, [currentUser?.avatarUrl]);

  // Resolve recipient avatar Url
  useEffect(() => {
    if (!recipientAvatar) {
      setResolvedRecipientAvatar(null);
      return;
    }
    const isB2 = !(
      recipientAvatar.startsWith("http://") ||
      recipientAvatar.startsWith("https://") ||
      recipientAvatar.startsWith("data:") ||
      recipientAvatar.startsWith("/")
    );
    if (!isB2) {
      setResolvedRecipientAvatar(recipientAvatar);
      return;
    }
    let isMounted = true;
    getResolvedFileUrl(recipientAvatar)
      .then((url) => {
        if (isMounted) setResolvedRecipientAvatar(url);
      })
      .catch((err) => {
        console.error("DmCallView: failed to resolve recipient avatar", err);
        if (isMounted) setResolvedRecipientAvatar(null);
      });
    return () => {
      isMounted = false;
    };
  }, [recipientAvatar]);

  const handleDisconnect = () => {
    endCall();
  };

  return (
    <div className="w-full h-[385px] bg-[#111214] border-b border-[#1f2023] relative flex flex-col items-center justify-center p-6 shrink-0 transition-all duration-300 font-sans select-none overflow-hidden">

      {/* 1. Centered Participant Cards Container */}
      <div className="flex items-center justify-center gap-12 w-full max-w-2xl mt-[-20px]">

        {/* Card 1: Current User */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className={cn(
              "w-[100px] h-[100px] md:w-[110px] md:h-[110px] rounded-full flex items-center justify-center bg-[#2b2d31] relative shadow-2xl overflow-hidden border-2 transition-all duration-150",
              isSelfSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.15)]" : "border-transparent"
            )}>
              {resolvedUserAvatar ? (
                <img
                  src={resolvedUserAvatar}
                  alt={currentUser?.username || "You"}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <div className="h-full w-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-2xl uppercase">
                  {currentUser?.username.substring(0, 2) || "ME"}
                </div>
              )}
            </div>

            {/* Mic / Deafen indicator overlays outside overflow-hidden */}
            {(isMuted || isDeafened) && (
              <div className="absolute bottom-0 right-0 flex items-center gap-0.5 z-10 translate-x-[4px] translate-y-[4px]">
                {isDeafened && (
                  <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#111214]">
                    <HeadphoneOff className="h-3.5 w-3.5" />
                  </div>
                )}
                {isMuted && !isDeafened && (
                  <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#111214]">
                    <MicOff className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            )}
          </div>

          <span className="text-[13px] font-bold text-[#dbdee1] mt-3 max-w-[120px] truncate block text-center">
            {currentUser?.displayName || currentUser?.username || "You"}
          </span>
        </div>

        {/* Card 2: Recipient (The Friend) */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* Pulsing signal rings when call is ringing */}
            {isRinging && (
              <div className="absolute inset-0 rounded-full border-2 border-[#23a55a] animate-ping opacity-60" style={{ margin: "-4px" }} />
            )}

            <div className={cn(
              "w-[100px] h-[100px] md:w-[110px] md:h-[110px] rounded-full bg-[#2b2d31] flex items-center justify-center relative shadow-2xl overflow-hidden border-2 transition-all duration-150",
              isRecipientSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.15)]" : "border-transparent"
            )}>
              {resolvedRecipientAvatar ? (
                <img
                  src={resolvedRecipientAvatar}
                  alt={recipientName}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <div className="h-full w-full bg-[#5865f2]/85 flex items-center justify-center text-white font-bold text-2xl uppercase">
                  {recipientName.substring(0, 2)}
                </div>
              )}
            </div>

            {/* Mic / Deafen indicator overlays outside overflow-hidden for the recipient */}
            {(isRecipientMuted || isRecipientDeafened) && (
              <div className="absolute bottom-0 right-0 flex items-center gap-0.5 z-10 translate-x-[4px] translate-y-[4px]">
                {isRecipientDeafened && (
                  <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#111214]">
                    <HeadphoneOff className="h-3.5 w-3.5" />
                  </div>
                )}
                {isRecipientMuted && !isRecipientDeafened && (
                  <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#111214]">
                    <MicOff className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            )}
          </div>

          <span className="text-[13px] font-bold text-[#dbdee1] mt-3 max-w-[120px] truncate block text-center">
            {recipientName}
          </span>

          {/* Connection status tag */}
          <span className="text-[10px] font-bold tracking-wider uppercase mt-1 leading-none text-center">
            {callStatus === "RINGING" && (
              incomingCall ? (
                <span className="text-[#23a55a] animate-pulse">{t("voice.incomingCall")}...</span>
              ) : (
                <span className="text-[#23a55a] animate-pulse">Ringing...</span>
              )
            )}
            {callStatus === "ACTIVE" && <span className="text-[#5865f2]">Connected</span>}
            {callStatus === "DECLINED" && <span className="text-[#ed4245]">{t("voice.decline")}</span>}
            {callStatus === "UNAVAILABLE" && <span className="text-[#ed4245]">{t("voice.callUnavailable")}</span>}
          </span>
        </div>

      </div>

      {/* 2. Floating Controls Overlay Bar at bottom center of the black viewport */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3.5 px-5 py-2.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.5)] border border-[#1f2023]/60 mix-blend-normal z-25"
        style={{
          backgroundColor: "#1e1f22"
        }}
      >
        {/* Mic toggle */}
        <button
          type="button"
          onClick={toggleMute}
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border-none outline-none cursor-pointer shadow-sm shrink-0",
            isMuted
              ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]"
              : "bg-[#313338] text-[#dbdee1] hover:bg-[#3f4147] hover:text-[#f2f3f5]"
          )}
          title={isMuted ? "Bật Mic" : "Tắt Mic"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Red circular Disconnect button */}
        <button
          type="button"
          onClick={handleDisconnect}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-[#ed4245] hover:bg-[#c93b3e] text-white transition-all scale-102 hover:scale-108 cursor-pointer border-none outline-none shadow-sm shrink-0"
          title={t("voice.disconnect")}
        >
          <PhoneOff className="h-5 w-5" fill="currentColor" stroke="none" />
        </button>
      </div>

    </div>
  );
}

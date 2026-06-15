"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceParticipantGrid, type VoiceParticipant } from "./VoiceParticipantGrid";

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

  const toggleMute = useVoiceStore((s) => s.toggleMute);

  const handleDisconnect = () => {
    endCall();
  };

  const participants: VoiceParticipant[] = [
    {
      userId: currentUser?.id || "me",
      username: currentUser?.username || "You",
      displayName: currentUser?.displayName || "You",
      avatarUrl: currentUser?.avatarUrl,
      muted: isMuted,
      deafened: isDeafened,
    },
    {
      userId: recipientId,
      username: recipientName,
      displayName: recipientName,
      avatarUrl: recipientAvatar,
      muted: isRecipientMuted,
      deafened: isRecipientDeafened,
      statusText: (
        <span className="text-[10px] font-bold tracking-wider uppercase mt-1 leading-none text-center block select-none">
          {callStatus === "RINGING" && (
            incomingCall ? (
              <span className="text-[#23a55a] animate-pulse">{t("voice.incomingCall")}...</span>
            ) : (
              <span className="text-[#23a55a] animate-pulse">{t("voice.ringing")}...</span>
            )
          )}
          {callStatus === "ACTIVE" && <span className="text-[#5865f2]">{t("voice.connected")}</span>}
          {callStatus === "DECLINED" && <span className="text-[#ed4245]">{t("voice.decline")}</span>}
          {callStatus === "UNAVAILABLE" && <span className="text-[#ed4245]">{t("voice.callUnavailable")}</span>}
        </span>
      )
    }
  ];

  return (
    <div className="w-full h-[385px] bg-[#111214] border-b border-[#1f2023] relative flex flex-col items-center justify-center p-6 shrink-0 transition-all duration-300 font-sans select-none overflow-hidden">

      {/* 1. Centered Participant Cards Container */}
      <div className="flex items-center justify-center gap-12 w-full max-w-2xl mt-[-20px] h-[220px]">
        <VoiceParticipantGrid
          participants={participants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          currentUserId={currentUser?.id}
          roomId={roomId}
          ringingRecipientId={callStatus === "RINGING" ? recipientId : null}
        />
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
          title={isMuted ? t("voice.unmute") : t("voice.mute")}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Red circular Disconnect button */}
        <button
          type="button"
          onClick={handleDisconnect}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-[#ed4245] hover:bg-[#c93b3e] text-[#fff] transition-all scale-102 hover:scale-108 cursor-pointer border-none outline-none shadow-sm shrink-0"
          title={t("voice.disconnect")}
        >
          <PhoneOff className="h-5 w-5" fill="currentColor" stroke="none" />
        </button>
      </div>

    </div>
  );
}
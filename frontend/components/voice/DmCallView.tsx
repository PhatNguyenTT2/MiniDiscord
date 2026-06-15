"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { useFriendStore } from "@/stores/friendStore";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioActivity } from "@/hooks/useAudioActivity";
import { useState, useEffect } from "react";
import { getResolvedFileUrl } from "@/lib/fileResolver";

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
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);

  const channelParticipants = useVoiceStore((s) => s.channelParticipants);
  const participantsList = channelParticipants["dm"] || [];
  const recipientState = participantsList.find((p) => p.userId === recipientId);
  const isRecipientMuted = recipientState?.muted || false;
  const isRecipientDeafened = recipientState?.deafened || false;

  const isSelfSpeaking = useAudioActivity(localStream, isMuted || isDeafened);
  const isRemoteSpeaking = useAudioActivity(remoteStreams[recipientId], isRecipientMuted || isRecipientDeafened);

  // Hook reactive lookups from FriendStore & RoomStore to completely bypass websocket name fallbacks
  const friends = useFriendStore((s) => s.friends);
  const friendRecord = friends.find((f) => f.user.id === recipientId);
  const roomMembers = useRoomStore((s) => s.members[roomId] || []);
  const roomMember = roomMembers.find((m) => m.userId === recipientId);

  const resolvedRecipientName = friendRecord?.user.displayName || friendRecord?.user.username || roomMember?.displayName || roomMember?.username || recipientName;
  const resolvedRecipientAvatar = friendRecord?.user.avatarUrl || roomMember?.avatarUrl || recipientAvatar;

  // Avatar path resolutions
  const selfAvatarSrc = currentUser?.avatarUrl;
  const selfIsB2 = !!selfAvatarSrc && !(
    selfAvatarSrc.startsWith("http://") ||
    selfAvatarSrc.startsWith("https://") ||
    selfAvatarSrc.startsWith("data:") ||
    selfAvatarSrc.startsWith("/")
  );
  const [resolvedSelfAvatar, setResolvedSelfAvatar] = useState<string | null>(selfIsB2 ? null : selfAvatarSrc || null);

  useEffect(() => {
    if (!selfIsB2 || !selfAvatarSrc) return;
    let isMounted = true;
    getResolvedFileUrl(selfAvatarSrc).then((url) => {
      if (isMounted) setResolvedSelfAvatar(url);
    });
    return () => { isMounted = false; };
  }, [selfAvatarSrc, selfIsB2]);

  const remoteIsB2 = !!resolvedRecipientAvatar && !(
    resolvedRecipientAvatar.startsWith("http://") ||
    resolvedRecipientAvatar.startsWith("https://") ||
    resolvedRecipientAvatar.startsWith("data:") ||
    resolvedRecipientAvatar.startsWith("/")
  );
  const [resolvedRemoteAvatar, setResolvedRemoteAvatar] = useState<string | null>(remoteIsB2 ? null : resolvedRecipientAvatar || null);

  useEffect(() => {
    if (!remoteIsB2 || !resolvedRecipientAvatar) return;
    let isMounted = true;
    getResolvedFileUrl(resolvedRecipientAvatar).then((url) => {
      if (isMounted) setResolvedRemoteAvatar(url);
    });
    return () => { isMounted = false; };
  }, [resolvedRecipientAvatar, remoteIsB2]);

  const selfDisplayName = currentUser?.displayName || currentUser?.username || "You";

  return (
    <div className="w-full h-[260px] bg-[#111214] border-b border-[#1f2023] relative flex flex-col justify-between items-center p-6 shrink-0 transition-all select-none overflow-hidden font-sans">
      {/* Centered Avatars row */}
      <div className="flex items-center justify-center gap-16 w-full flex-1 min-h-0">
        {/* User Card */}
        <div className="flex flex-col items-center gap-2.5">
          <div
            className={cn(
              "w-20 h-20 rounded-full bg-[#313338] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 select-none",
              isSelfSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.4)]" : "border-transparent"
            )}
          >
            {resolvedSelfAvatar ? (
              <img src={resolvedSelfAvatar} alt={selfDisplayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold uppercase select-none">
                {selfDisplayName.substring(0, 2)}
              </div>
            )}
          </div>
          <span className="text-[13px] font-semibold text-[#dbdee1] truncate max-w-[120px]">
            {selfDisplayName}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider select-none">
            {isMuted ? t("voice.mute") : t("voice.connected")}
          </span>
        </div>

        {/* Recipient Card */}
        <div className="flex flex-col items-center gap-2.5">
          <div
            className={cn(
              "w-20 h-20 rounded-full bg-[#313338] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 select-none",
              isRemoteSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.4)]" : "border-transparent"
            )}
          >
            {resolvedRemoteAvatar ? (
              <img src={resolvedRemoteAvatar} alt={resolvedRecipientName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold uppercase select-none">
                {resolvedRecipientName.substring(0, 2)}
              </div>
            )}
          </div>
          <span className="text-[13px] font-semibold text-[#dbdee1] truncate max-w-[120px]">
            {resolvedRecipientName}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider select-none">
            {callStatus === "RINGING" ? (
              incomingCall ? `${t("voice.incomingCall")}...` : `${t("voice.ringing")}...`
            ) : (
              isRecipientMuted ? t("voice.mute") : t("voice.connected")
            )}
          </span>
        </div>
      </div>

      {/* Control buttons bar - SQUARE buttons */}
      <div className="flex items-center justify-center gap-4 py-2 shrink-0 z-10">
        {/* Toggle Muted */}
        <button
          type="button"
          onClick={toggleMute}
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all border-none outline-none cursor-pointer shadow-md",
            isMuted ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]" : "bg-[#2b2d31] hover:bg-[#3f4147] text-[#dbdee1]"
          )}
          title={isMuted ? t("voice.unmute") : t("voice.mute")}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Toggle Deafen */}
        <button
          type="button"
          onClick={toggleDeafen}
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all border-none outline-none cursor-pointer shadow-md",
            isDeafened ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]" : "bg-[#2b2d31] hover:bg-[#3f4147] text-[#dbdee1]"
          )}
          title={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
        >
          {isDeafened ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        {/* Decline/Disconnect call - SQUARE */}
        <button
          type="button"
          onClick={endCall}
          className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#ed4245] hover:bg-[#c93b3e] text-white transition-all cursor-pointer border-none outline-none shadow-md"
          title={t("voice.disconnect")}
        >
          <PhoneOff className="h-5 w-5" fill="currentColor" stroke="none" />
        </button>
      </div>
    </div>
  );
}
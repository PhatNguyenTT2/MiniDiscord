"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { useFriendStore } from "@/stores/friendStore";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioActivity, useAudioVolume } from "@/hooks/useAudioActivity";
import { useState, useEffect, useRef } from "react";
import { getResolvedFileUrl } from "@/lib/fileResolver";

interface DmCallViewProps {
  roomId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  height?: number;
}

export function DmCallView({ roomId, recipientId, recipientName, recipientAvatar, height = 360 }: DmCallViewProps) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);

  const localStream = useVoiceStore((s) => s.localStream);
  const remoteStreams = useVoiceStore((s) => s.remoteStreams);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isVideoOn = useVoiceStore((s) => s.isVideoOn);
  const endCall = useVoiceStore((s) => s.endCall);
  const incomingCall = useVoiceStore((s) => s.incomingCall);
  const callStatus = useVoiceStore((s) => s.callStatus);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const toggleVideo = useVoiceStore((s) => s.toggleVideo);

  const channelParticipants = useVoiceStore((s) => s.channelParticipants);
  const participantsList = channelParticipants["dm"] || [];
  const recipientState = participantsList.find((p) => p.userId === recipientId);
  const isRecipientMuted = recipientState?.muted || false;
  const isRecipientDeafened = recipientState?.deafened || false;

  const isSelfSpeaking = useAudioActivity(localStream, isMuted || isDeafened);
  const isRemoteSpeaking = useAudioActivity(remoteStreams[recipientId], isRecipientMuted || isRecipientDeafened);

  const selfVolume = useAudioVolume(localStream, isMuted || isDeafened);
  const remoteVolume = useAudioVolume(remoteStreams[recipientId], isRecipientMuted || isRecipientDeafened);

  // Hook reactive lookups from FriendStore & RoomStore to completely bypass websocket name fallbacks
  const friends = useFriendStore((s) => s.friends);
  const friendRecord = friends.find((f) => f.user.id === recipientId);
  const roomMembers = useRoomStore((s) => s.members[roomId] || []);
  const roomMember = roomMembers.find((m) => m.userId === recipientId);

  const resolvedRecipientName = friendRecord?.user.displayName || friendRecord?.user.username || roomMember?.displayName || roomMember?.username || recipientName;
  const resolvedRecipientAvatar = friendRecord?.user.avatarUrl || roomMember?.avatarUrl || recipientAvatar;

  // Key Shortcut for Camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.hasAttribute("contenteditable")
      );
      if (isInput) return;

      const isV = e.key.toLowerCase() === "v";
      const isAltV = e.altKey && isV;

      if (isAltV || (isV && !e.ctrlKey && !e.metaKey && !e.shiftKey)) {
        e.preventDefault();
        toggleVideo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleVideo]);

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

  // Dynamic border glow based on voice amplitude average volume
  const showSelfGlow = isSelfSpeaking && selfVolume > 5;
  const selfGlowStyle = showSelfGlow ? {
    borderColor: "#23a55a",
    boxShadow: `0 0 ${8 + (selfVolume / 100) * 16}px rgba(35, 165, 90, ${0.35 + (selfVolume / 100) * 0.45})`,
  } : {
    borderColor: "transparent",
    boxShadow: "none",
  };

  const showRemoteGlow = isRemoteSpeaking && remoteVolume > 5;
  const remoteGlowStyle = showRemoteGlow ? {
    borderColor: "#23a55a",
    boxShadow: `0 0 ${8 + (remoteVolume / 100) * 16}px rgba(35, 165, 90, ${0.35 + (remoteVolume / 100) * 0.45})`,
  } : {
    borderColor: "transparent",
    boxShadow: "none",
  };

  // Video track setup and status flags
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localParticipant = participantsList.find((p) => p.userId === currentUser?.id);
  const showLocalVideo = (localParticipant?.cameraOn ?? false) || (localStream?.getVideoTracks().some(t => t.enabled) ?? false);
  const showRemoteVideo = (recipientState?.cameraOn ?? false) || (remoteStreams[recipientId]?.getVideoTracks().some(t => t.enabled) ?? false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, showLocalVideo]);

  useEffect(() => {
    const remoteStream = remoteStreams[recipientId];
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStreams, recipientId, showRemoteVideo]);

  return (
    <div
      className="w-full bg-[#111214] border-b border-[#1f2023] relative flex flex-col justify-between items-center p-6 shrink-0 transition-all select-none overflow-hidden font-sans"
      style={{ height: `${height}px` }}
    >
      {/* Centered Avatars row */}
      <div className="flex items-center justify-center gap-16 w-full flex-1 min-h-0">
        {/* User Card */}
        <div className="flex flex-col items-center gap-2.5">
          {showLocalVideo ? (
            <div
              className="w-[180px] h-[101px] rounded-xl bg-[#1e1f22] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 relative select-none"
              style={selfGlowStyle}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1] rounded-xl absolute inset-0 z-0"
              />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-full bg-[#313338] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 select-none"
              style={selfGlowStyle}
            >
              {resolvedSelfAvatar ? (
                <img src={resolvedSelfAvatar} alt={selfDisplayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold uppercase select-none">
                  {selfDisplayName.substring(0, 2)}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {isDeafened ? (
              <VolumeX className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
            ) : isMuted ? (
              <MicOff className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
            ) : (
              <Mic className="h-3.5 w-3.5 text-white opacity-85 shrink-0" />
            )}
            <span className="text-[13px] font-semibold text-[#dbdee1] truncate max-w-[120px]">
              {selfDisplayName}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider select-none">
            {isMuted ? t("voice.mute") : t("voice.connected")}
          </span>
        </div>

        {/* Remote Card */}
        <div className="flex flex-col items-center gap-2.5">
          {showRemoteVideo ? (
            <div
              className="w-[180px] h-[101px] rounded-xl bg-[#1e1f22] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 relative select-none"
              style={remoteGlowStyle}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-xl absolute inset-0 z-0"
              />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-full bg-[#313338] flex items-center justify-center overflow-hidden transition-all duration-200 border-2 select-none"
              style={remoteGlowStyle}
            >
              {resolvedRemoteAvatar ? (
                <img src={resolvedRemoteAvatar} alt={resolvedRecipientName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold uppercase select-none">
                  {resolvedRecipientName.substring(0, 2)}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {isRecipientDeafened ? (
              <VolumeX className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
            ) : isRecipientMuted ? (
              <MicOff className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
            ) : (
              <Mic className="h-3.5 w-3.5 text-white opacity-85 shrink-0" />
            )}
            <span className="text-[13px] font-semibold text-[#dbdee1] truncate max-w-[120px]">
              {resolvedRecipientName}
            </span>
          </div>
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
        {/* Toggle Video */}
        <button
          type="button"
          onClick={toggleVideo}
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all border-none outline-none cursor-pointer shadow-md",
            isVideoOn ? "bg-[#23a55a] text-[#dbdee1]" : "bg-[#ed4245] hover:bg-[#c93b3e] text-white"
          )}
          title={isVideoOn ? t("voice.cameraOff") || "Tắt Camera" : t("voice.cameraOn") || "Bật Camera"}
        >
          {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

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
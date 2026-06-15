"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useRoomStore } from "@/stores/roomStore";
import { Volume2, VolumeX, Mic, MicOff, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioActivity } from "@/hooks/useAudioActivity";
import { useState, useEffect } from "react";
import { getResolvedFileUrl } from "@/lib/fileResolver";

interface VoiceChannelViewProps {
  channelId: string;
  roomId: string;
  channelName: string;
}

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  muted: boolean;
  deafened: boolean;
}

// Subcomponent for square participant card
function SquareParticipantCard({
  p,
  isSelf,
  isSpeaking,
  roomId,
}: {
  p: VoiceParticipant;
  isSelf: boolean;
  isSpeaking: boolean;
  roomId: string;
}) {
  const { t } = useTranslation();

  // Reactively lookup details from RoomStore to solve voice sync race conditions
  const members = useRoomStore((s) => s.members[roomId] || []);
  const member = members.find((m) => m.userId === p.userId);
  const name = member?.displayName || member?.username || p.displayName || p.username;
  const avatarUrl = member?.avatarUrl || p.avatarUrl;

  const isB2 = !!avatarUrl && !(
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("data:") ||
    avatarUrl.startsWith("/")
  );
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(isB2 ? null : avatarUrl || null);

  useEffect(() => {
    if (!isB2 || !avatarUrl) return;
    let isMounted = true;
    getResolvedFileUrl(avatarUrl).then((url) => {
      if (isMounted) setResolvedAvatar(url);
    });
    return () => { isMounted = false; };
  }, [avatarUrl, isB2]);

  // Hook reactive checks to avoid stale voice store states for local mic statuses
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);

  // Sync server-mute status for other participants
  const isMemberServerMuted = member?.mutedUntil
    ? new Date(member.mutedUntil).getTime() > Date.now()
    : false;

  const isMutedState = isSelf
    ? (isMuted || isMemberServerMuted)
    : (p.muted || isMemberServerMuted);
  const isDeafenedState = isSelf ? isDeafened : p.deafened;

  return (
    <div
      className={cn(
        "flex flex-col justify-between bg-[#2b2d31] rounded-lg relative shadow-md overflow-hidden aspect-video transition-all border-2 w-full max-w-[280px] min-w-[200px] select-none",
        isSpeaking ? "border-[#23a55a] shadow-[0_0_12px_rgba(35,165,90,0.35)]" : "border-transparent"
      )}
    >
      {/* Centered Discord Logo or Profile Circle */}
      <div className="flex-1 flex items-center justify-center p-4">
        {resolvedAvatar ? (
          <div className="w-16 h-16 rounded-full overflow-hidden border border-[#1f2023]/40">
            <img src={resolvedAvatar} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <svg className="w-12 h-12 text-[#dbdee1] opacity-80" fill="currentColor" viewBox="0 0 127.14 96.36">
            <path d="M107.7,8.07c-9.56-4.42-19.82-7.75-30.6-9.74a.43.43,0,0,0-.46.21C75,1.44,73,5.69,71.59,9c-11.66-1.74-23.23-1.74-34.69,0C35.49,5.69,33.56,1.44,31.83.54a.48.48,0,0,0-.46-.21C20.6,2.32,10.32,5.65.76,10.07a.46.46,0,0,0-.2.18C-12.76,38.25-1.92,65.65,11,83.91a.57.57,0,0,0,.26.24c13.79,10.14,27.18,16.34,40.35,20.47a.5.5,0,0,0,.52-.17c3.15-4.3,5.92-8.87,8.27-13.68a.49.49,0,0,0-.27-.68c-4.36-1.66-8.52-3.7-12.48-6.1a.49.49,0,0,1-.05-.81c.84-.63,1.68-1.28,2.48-1.94a.48.48,0,0,1,.5-.07c26.5,12.11,55.22,12.11,81.42,0a.53.53,0,0,1,.51.06c.8.67,1.64,1.32,2.49,1.95a.49.49,0,0,1-.05.81c-3.95,2.41-8.12,4.45-12.48,6.1a.49.49,0,0,0-.27.68c2.37,4.81,5.14,9.38,8.27,13.68a.49.49,0,0,0,.52.17c13.2-4.13,26.62-10.33,40.42-20.47a.47.47,0,0,0,.26-.24c14.28-22,6.46-49,1.2-73.66A.4.4,0,0,0,107.7,8.07ZM42.45,65.69C34.73,65.69,28.32,58.6,28.32,50s6.41-15.69,14.13-15.69,14.22,7.1,14.13,15.69S50.17,65.69,42.45,65.69Zm42.24,0C77,65.69,70.57,58.6,70.57,50s6.41-15.69,14.12-15.69,14.23,7.1,14.13,15.69S92.38,65.69,84.69,65.69Z" />
          </svg>
        )}
      </div>

      {/* Mic status & Display name Overlay tag at bottom-left */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[rgba(17,18,20,0.7)] text-xs text-white max-w-[85%] select-none z-10 transition-all font-semibold">
        {isDeafenedState ? (
          <VolumeX className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
        ) : isMutedState ? (
          <MicOff className="h-3.5 w-3.5 text-[#ed4245] shrink-0" />
        ) : (
          <Mic className="h-3.5 w-3.5 text-white opacity-85 shrink-0" />
        )}
        <span className="truncate leading-none">
          {name}
        </span>
      </div>
    </div>
  );
}

// Wrapper to safely query useAudioActivity on each participant
function CircularSpeakingWrapper({
  p,
  isSelf,
  stream,
  roomId,
}: {
  p: VoiceParticipant;
  isSelf: boolean;
  stream: MediaStream | null;
  roomId: string;
}) {
  const isSpeaking = useAudioActivity(stream, p.muted || p.deafened);
  return (
    <SquareParticipantCard
      p={p}
      isSelf={isSelf}
      isSpeaking={isSpeaking}
      roomId={roomId}
    />
  );
}

// Simple Waiting Card displayed when 1 user is connected
function WaitingCard() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center bg-[#2b2d31]/40 border-2 border-dashed border-[#2b2d31]/80 rounded-lg relative shadow-md overflow-hidden aspect-video w-full max-w-[280px] min-w-[200px] p-6 text-center select-none font-sans">
      <div className="flex flex-col items-center gap-3">
        {/* Simple dotted spin loader or custom waiting graphic */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent border-dashed border-[#dbdee1]/40 animate-spin" />
          <div className="absolute w-6 h-6 rounded-full bg-[#dbdee1]/15 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#dbdee1]/60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
        <span className="text-[13px] font-semibold text-[#949ba4] tracking-wide animate-pulse">
          {t("voice.waiting") || "Đang chờ..."}
        </span>
      </div>
    </div>
  );
}

// Main VoiceParticipantList wrapper
function SimpleVoiceParticipantList({
  participants,
  localStream,
  remoteStreams,
  currentUserId,
  roomId,
}: {
  participants: VoiceParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream | undefined>;
  currentUserId: string | undefined;
  roomId: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 w-full h-full p-4 overflow-y-auto">
      {participants.map((p) => {
        const isSelf = p.userId === currentUserId;
        const stream = isSelf ? localStream : remoteStreams[p.userId] || null;
        return (
          <CircularSpeakingWrapper
            key={p.userId}
            p={p}
            isSelf={isSelf}
            stream={stream}
            roomId={roomId}
          />
        );
      })}

      {/* If exactly 1 participant in the channel, show a waiting slot block on the right */}
      {participants.length === 1 && (
        <WaitingCard />
      )}
    </div>
  );
}

const EMPTY_PARTICIPANTS: VoiceParticipant[] = [];

export function VoiceChannelView({ channelId, roomId, channelName }: VoiceChannelViewProps) {
  const { t } = useTranslation();

  const participants = useVoiceStore((s) => s.channelParticipants[channelId] || EMPTY_PARTICIPANTS);
  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const joinVoiceChannel = useVoiceStore((s) => s.joinVoiceChannel);

  const localStream = useVoiceStore((s) => s.localStream);
  const remoteStreams = useVoiceStore((s) => s.remoteStreams);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const isJoined = currentChannel?.channelId === channelId;

  // Sound and mute options for voice connected users
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const leaveVoiceChannel = useVoiceStore((s) => s.leaveVoiceChannel);

  return (
    <div className="flex flex-1 min-w-0 flex-col bg-[#111214] h-full relative font-sans">
      {!isJoined ? (
        // Beautiful Discord-accurate Gradient Joining Screen
        <div className="flex-1 w-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#20223a] to-[#111214] select-none text-center">
          <div className="h-20 w-20 bg-[#5865f2]/10 text-[#5865f2] rounded-full flex items-center justify-center mb-6 shadow-lg border border-[#5865f2]/20">
            <Volume2 className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-3 tracking-wide w-full text-center px-4">
            {channelName || "Voice Channel"}
          </h2>
          <p className="text-[15px] text-[#949ba4] mb-8 max-w-[384px] leading-relaxed text-center px-6 mx-auto">
            {participants.length > 0 ? (
              <>
                {participants.length} {t("voice.participantsConnected") || "participants connected"}
              </>
            ) : (
              <>
                {t("voice.emptyChannel") || "Currently no one in the voice channel"}
              </>
            )}
          </p>
          <button
            onClick={() => joinVoiceChannel(roomId, channelId)}
            className="px-8 py-3 bg-white hover:bg-neutral-100 text-black text-[15px] font-bold rounded-md shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-102 hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] outline-none"
          >
            {t("voice.joinVoice") || "Join Voice Channel"}
          </button>
        </div>
      ) : (
        // Voice Session Dashboard - completely borderless/clean header as original design
        <div className="flex-1 w-full flex flex-col justify-between p-6">
          {/* Header Info */}
          <div className="flex items-center justify-between pb-4 mb-4 select-none shrink-0 border-b border-[#1f2023]/60">
            <h3 className="text-[17px] font-bold text-white flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <span>{channelName}</span>
            </h3>
            {/* bubbles icon or similar */}
            <div className="text-muted-foreground hover:text-foreground cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>

          {/* Participant avatars - aspect-video grids */}
          <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
            {participants.length === 0 ? (
              <div className="text-muted-foreground text-sm flex flex-col items-center justify-center text-center w-full gap-2 select-none">
                <Users className="h-8 w-8 opacity-40 animate-pulse" />
                <span>{t("voice.emptyChannel") || "Currently no one in the voice channel"}</span>
              </div>
            ) : (
              <SimpleVoiceParticipantList
                participants={participants}
                localStream={localStream}
                remoteStreams={remoteStreams}
                currentUserId={currentUserId}
                roomId={roomId}
              />
            )}
          </div>

          {/* Connected Console Controls - rounded-xl buttons */}
          <div className="flex items-center justify-center gap-4 py-3 shrink-0 border-t border-[#1f2023]/60 mt-4 select-none">
            <button
              onClick={toggleMute}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all border-none outline-none cursor-pointer shadow-md",
                isMuted ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]" : "bg-[#2b2d31] hover:bg-[#3f4147] text-[#dbdee1]"
              )}
              title={isMuted ? t("voice.unmute") : t("voice.mute")}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center transition-all border-none outline-none cursor-pointer shadow-md",
                isDeafened ? "bg-[#ed4245] text-white hover:bg-[#c93b3e]" : "bg-[#2b2d31] hover:bg-[#3f4147] text-[#dbdee1]"
              )}
              title={isDeafened ? t("voice.undeafen") : t("voice.deafen")}
            >
              {isDeafened ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            <button
              onClick={leaveVoiceChannel}
              className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#ed4245] hover:bg-[#c93b3e] text-white transition-all cursor-pointer border-none outline-none shadow-md"
              title={t("voice.disconnect")}
            >
              <PhoneOff className="h-5 w-5" fill="currentColor" stroke="none" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

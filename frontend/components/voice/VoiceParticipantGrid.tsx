import { useState, useEffect, useRef } from "react";
import { useAudioActivity } from "@/hooks/useAudioActivity";
import { MemberProfilePopover } from "@/components/chat/MemberProfilePopover";
import { cn } from "@/lib/utils";
import { getResolvedFileUrl } from "@/lib/fileResolver";
import { useRoomStore } from "@/stores/roomStore";
import { MicOff, HeadphoneOff, Volume2, Disc } from "lucide-react";
import { MemberVolumePopover } from "./MemberVolumePopover";

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  displayName?: string | null;
  cameraOn?: boolean;
  statusText?: React.ReactNode;
}

interface ParticipantCardProps {
  p: VoiceParticipant;
  currentUserId: string | undefined;
  localStream: MediaStream | null;
  remoteStream: MediaStream | undefined;
  roomId: string;
  participantsLength: number;
  isRinging?: boolean;
}

function ParticipantCard({
  p,
  currentUserId,
  localStream,
  remoteStream,
  roomId,
  participantsLength,
  isRinging,
}: ParticipantCardProps) {
  const members = useRoomStore((s) => s.members[roomId] || []);
  const member = members.find((m) => m.userId === p.userId);
  const displayName = member?.displayName || member?.username || p.displayName || p.username;
  const avatarUrl = member?.avatarUrl || p.avatarUrl;

  const isSelf = p.userId === currentUserId;
  const isMusicBot = p.userId === "music-bot";
  const stream = isSelf ? localStream : remoteStream || null;
  const isSpeaking = isMusicBot ? true : useAudioActivity(stream, p.muted || p.deafened);

  const src = avatarUrl;
  const isB2 = !!src && !(
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("/")
  );

  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(isB2 ? null : src || null);
  const [prevAvatarUrl, setPrevAvatarUrl] = useState<string | null | undefined>(avatarUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideoTrack = stream?.getVideoTracks().some((t) => t.enabled) ?? false;
  const showVideo = p.cameraOn || hasVideoTrack;

  useEffect(() => {
    if (videoRef.current && stream && showVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, showVideo]);

  if (avatarUrl !== prevAvatarUrl) {
    setPrevAvatarUrl(avatarUrl);
    setResolvedAvatar(isB2 ? null : src || null);
  }

  useEffect(() => {
    if (!isB2 || !src) return;

    let isMounted = true;
    getResolvedFileUrl(src)
      .then((url) => {
        if (isMounted) setResolvedAvatar(url);
      })
      .catch((err) => {
        console.error("ParticipantCard: failed to resolve avatar", err);
        if (isMounted) setResolvedAvatar(null);
      });
    return () => {
      isMounted = false;
    };
  }, [src, isB2]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-[#2b2d31] rounded-xl relative shadow-xl overflow-hidden aspect-video transition-all border-2 w-full",
        isSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.15)]" : "border-transparent"
      )}
    >
      <div className="relative flex items-center justify-center shrink-0 w-full flex-1 h-full min-h-0">
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf}
            className={cn(
              "w-full h-full object-cover rounded-xl absolute inset-0 z-0",
              isSelf && "scale-x-[-1]"
            )}
          />
        ) : (
          <div className="relative flex items-center justify-center shrink-0 w-full">
            {/* Ringing pulse wave animation */}
            {isRinging && (
              <div className="absolute inset-0 rounded-full border-2 border-[#23a55a] animate-ping opacity-60" style={{ margin: "-4px" }} />
            )}

            {isMusicBot ? (
              <MemberVolumePopover
                userId={p.userId}
                username={p.username}
                displayName={displayName}
                side="top"
                align="center"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-full flex items-center justify-center bg-[#1e1f22] relative overflow-hidden transition-all duration-150 border-2 border-transparent scale-100 hover:scale-105 cursor-pointer outline-none shrink-0 w-1/3 aspect-square text-3xl",
                    isSpeaking ? "ring-2 ring-green-500 ring-offset-2" : ""
                  )}
                  title={displayName}
                >
                  <div className="h-full w-full bg-[#111214] flex items-center justify-center text-[#23a55a] rounded-full">
                    <Disc className="h-2/3 w-2/3 animate-[spin_8s_linear_infinite]" />
                  </div>
                </button>
              </MemberVolumePopover>
            ) : (
              <MemberProfilePopover
                userId={p.userId}
                username={member?.username || p.username}
                displayName={displayName}
                avatarUrl={avatarUrl || null}
                status="ONLINE"
                roomId={roomId}
                side="top"
                align="center"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-full flex items-center justify-center bg-[#1e1f22] relative overflow-hidden transition-all duration-150 border-2 border-transparent scale-100 hover:scale-105 cursor-pointer outline-none shrink-0 ring-offset-background w-1/3 aspect-square text-3xl",
                    isSpeaking ? "ring-2 ring-green-500 ring-offset-2" : ""
                  )}
                  title={displayName}
                >
                  {resolvedAvatar ? (
                    <img
                      src={resolvedAvatar}
                      alt={displayName}
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="h-full w-full bg-[#5865f2] flex items-center justify-center text-white font-extrabold uppercase select-none rounded-full">
                      {displayName.substring(0, 2)}
                    </div>
                  )}
                </button>
              </MemberProfilePopover>
            )}
          </div>
        )}

        {/* State mute/deafen flag badge overlays */}
        {(p.muted || p.deafened || !isSelf) && (
          <div className={cn(
            "flex items-center gap-1 z-10",
            showVideo ? "absolute bottom-2 right-2" : "absolute bottom-0 right-0 translate-x-[4px] translate-y-[4px]"
          )}>
            {!isSelf && (
              <MemberVolumePopover userId={p.userId} username={member?.username || p.username} displayName={displayName}>
                <button
                  type="button"
                  className="bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] hover:text-[#dbdee1] p-1 rounded-full shadow-lg border-2 border-[#2b2d31] transition-transform duration-100 hover:scale-105 cursor-pointer outline-none shrink-0 flex items-center justify-center"
                  title="Volume & Mute Settings"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </MemberVolumePopover>
            )}
            {p.deafened && (
              <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#2b2d31]">
                <HeadphoneOff className="h-3.5 w-3.5" />
              </div>
            )}
            {p.muted && !p.deafened && (
              <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg border-2 border-[#2b2d31]">
                <MicOff className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        )}

        {/* Floating overlays for video view */}
        {showVideo && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white z-10 font-medium select-none truncate max-w-[75%]">
            {displayName}
          </span>
        )}
      </div>

      {!showVideo && (
        <span className="text-[13px] font-bold text-[#dbdee1] mt-3 max-w-[85%] truncate select-none flex items-center justify-center gap-1.5 w-full">
          <span>{displayName}</span>
          {p.userId === "music-bot" && (
            <span className="bg-[#5865f2] text-white text-[8px] px-1 py-0.2 rounded font-black uppercase tracking-wider scale-95 leading-none">
              BOT
            </span>
          )}
        </span>
      )}
      {p.statusText && !showVideo && (
        <div className="mt-1">
          {p.statusText}
        </div>
      )}
    </div>
  );
}

interface VoiceParticipantGridProps {
  participants: VoiceParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream | undefined>;
  currentUserId: string | undefined;
  roomId: string;
  ringingRecipientId?: string | null;
}

export function VoiceParticipantGrid({
  participants,
  localStream,
  remoteStreams,
  currentUserId,
  roomId,
  ringingRecipientId,
}: VoiceParticipantGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 w-full h-full flex-1 items-center justify-center py-4 min-h-0 overflow-y-auto",
        participants.length <= 1
          ? "grid-cols-1 max-w-xl mx-auto"
          : participants.length === 2
            ? "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto"
            : "grid-cols-2 lg:grid-cols-3"
      )}
    >
      {participants.map((p) => (
        <ParticipantCard
          key={p.userId}
          p={p}
          currentUserId={currentUserId}
          localStream={localStream}
          remoteStream={remoteStreams[p.userId]}
          roomId={roomId}
          participantsLength={participants.length}
          isRinging={p.userId === ringingRecipientId}
        />
      ))}
    </div>
  );
}

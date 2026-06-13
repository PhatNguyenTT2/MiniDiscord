"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { VoiceControlBar } from "./VoiceControlBar";
import { MicOff, HeadphoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioActivity } from "@/hooks/useAudioActivity";

interface VoiceChannelViewProps {
  channelId: string;
  roomId: string;
  channelName: string;
}

interface VoiceParticipant {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  muted: boolean;
  deafened: boolean;
}

const EMPTY_PARTICIPANTS: VoiceParticipant[] = [];

interface VoiceParticipantCardProps {
  p: VoiceParticipant;
  currentUserId: string | undefined;
  localStream: MediaStream | null;
  remoteStream: MediaStream | undefined;
  participantsLength: number;
}

function VoiceParticipantCard({
  p,
  currentUserId,
  localStream,
  remoteStream,
  participantsLength,
}: VoiceParticipantCardProps) {
  const isSelf = p.userId === currentUserId;
  const stream = isSelf ? localStream : remoteStream || null;
  const isSpeaking = useAudioActivity(stream, p.muted || p.deafened);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-[#2b2d31] rounded-xl relative shadow-xl overflow-hidden aspect-video transition-all border-2",
        isSpeaking ? "border-[#23a55a] shadow-[0_0_15px_rgba(35,165,90,0.15)]" : "border-transparent"
      )}
    >
      {/* User Profile Avatar */}
      {p.avatarUrl ? (
        <img
          src={p.avatarUrl}
          alt={p.displayName || p.username}
          className={cn(
            "rounded-full object-cover shadow-2xl transition-transform duration-350 scale-100 hover:scale-105",
            participantsLength <= 2 ? "h-20 w-20 md:h-24 md:w-24" : "h-14 w-14 md:h-16 md:w-16"
          )}
        />
      ) : (
        <div className={cn(
          "rounded-full bg-[#5865f2] flex items-center justify-center shadow-2xl shrink-0 uppercase",
          participantsLength <= 2 ? "h-20 w-20 md:h-24 md:w-24 text-2xl" : "h-14 w-14 md:h-16 md:w-16 text-lg",
          "font-extrabold text-white"
        )}>
          {(p.displayName || p.username).substring(0, 2)}
        </div>
      )}

      {/* Username text badge */}
      <div className="absolute bottom-3 left-3 bg-[#111214]/75 backdrop-blur-sm px-2.5 py-1 rounded-md text-[13px] font-bold text-white max-w-[85%] truncate">
        {p.displayName || p.username}
      </div>

      {/* State flag indicators overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {p.deafened && (
          <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg">
            <HeadphoneOff className="h-4.5 w-4.5" />
          </div>
        )}
        {p.muted && !p.deafened && (
          <div className="bg-[#ed4245] text-white p-1.5 rounded-full shadow-lg">
            <MicOff className="h-4.5 w-4.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function VoiceChannelView({ channelId, roomId, channelName }: VoiceChannelViewProps) {
  const { t } = useTranslation();

  const participants = useVoiceStore((s) => s.channelParticipants[channelId] || EMPTY_PARTICIPANTS);
  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const joinVoiceChannel = useVoiceStore((s) => s.joinVoiceChannel);

  const localStream = useVoiceStore((s) => s.localStream);
  const remoteStreams = useVoiceStore((s) => s.remoteStreams);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // If user is click-viewing but has NOT yet joined audio stream, show a premium "Join Voice Channel" banner
  const isJoined = currentChannel?.channelId === channelId;

  return (
    <div className="flex flex-1 flex-col bg-[#1e1f22] h-full min-h-0 relative">
      {/* Viewport content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto min-h-0">
        {!isJoined ? (
          <div className="flex flex-col items-center text-center max-w-md p-8 bg-[#2b2d31] rounded-2xl shadow-2xl border border-[#35363c]">
            <div className="h-16 w-16 bg-[#5865f2]/10 text-[#5865f2] rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {channelName || "Voice Channel"}
            </h2>
            <p className="text-[14px] text-[#949ba4] mb-6 leading-relaxed">
              Bạn đang xem chi tiết phòng chat thoại. Bấm nút bên dưới để tham gia vào cuộc nói chuyện cùng những thành viên khác.
            </p>
            <button
              onClick={() => joinVoiceChannel(roomId, channelId)}
              className="px-6 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-[15px] font-semibold rounded-md shadow-lg transition-all duration-150 transform hover:scale-102 cursor-pointer"
            >
              {t("voice.joinVoice")}
            </button>
          </div>
        ) : (
          <div className="w-full h-full max-w-5xl flex flex-col justify-between">
            {/* Grid Layout of video/audio participants */}
            <div className={cn(
              "grid gap-4 w-full flex-1 items-center justify-center auto-rows-fr py-4 min-h-0 overflow-y-auto",
              participants.length <= 1 ? "grid-cols-1 max-w-xl mx-auto" :
                participants.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto" :
                  "grid-cols-2 lg:grid-cols-3"
            )}>
              {participants.map((p) => (
                <VoiceParticipantCard
                  key={p.userId}
                  p={p}
                  currentUserId={currentUserId}
                  localStream={localStream}
                  remoteStream={remoteStreams[p.userId]}
                  participantsLength={participants.length}
                />
              ))}
            </div>

            {/* Premium Console Controls at Bottom */}
            <div className="flex items-center justify-center py-4 shrink-0 border-t border-[#35363c]/50 mt-4">
              <VoiceControlBar className="gap-4 scale-110" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

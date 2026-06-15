"use client";

import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { VoiceControlBar } from "./VoiceControlBar";
import { Users } from "lucide-react";
import { VoiceParticipantGrid, type VoiceParticipant } from "./VoiceParticipantGrid";

interface VoiceChannelViewProps {
  channelId: string;
  roomId: string;
  channelName: string;
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
              {t("voice.channelIntro")}
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
            <VoiceParticipantGrid
              participants={participants}
              localStream={localStream}
              remoteStreams={remoteStreams}
              currentUserId={currentUserId}
              roomId={roomId}
            />

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

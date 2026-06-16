"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useRoomStore } from "@/stores/roomStore";
import { useAuthStore } from "@/stores/authStore";
import { getStompClient } from "@/lib/websocket";
import { useTranslation } from "@/lib/i18n";
import { Volume2, VolumeX, Music, Disc, SkipForward, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicPlayerBarProps {
  roomId: string;
  channelId: string;
}

export function MusicPlayerBar({ roomId, channelId }: MusicPlayerBarProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useVoiceStore((s) => s.currentMusicTrack);
  const token = useAuthStore((s) => s.token);

  // Bot volume and mute settings (stored locally on client)
  const volume = useVoiceStore((s) => s.memberVolumes["music-bot"] ?? 100);
  const isMuted = useVoiceStore((s) => s.memberMuted["music-bot"] ?? false);
  const setMemberVolume = useVoiceStore((s) => s.setMemberVolume);
  const toggleMemberMute = useVoiceStore((s) => s.toggleMemberMute);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 1. Core audio source, offset sync on track change
  useEffect(() => {
    if (!currentTrack || !currentTrack.directUrl || !audioRef.current) {
      setIsPlaying(false);
      return;
    }

    const audio = audioRef.current;

    // Stop and load new URL
    audio.pause();
    audio.src = currentTrack.directUrl;
    audio.load();

    // Calculate latency offset: (Date.now() - startTime) / 1000
    const offsetSeconds = (Date.now() - currentTrack.startTime) / 1000;

    if (offsetSeconds < currentTrack.duration) {
      audio.currentTime = Math.max(0, offsetSeconds);
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[MusicPlayerBar] Playback blocked by browser autoplay rules. Waiting for user interaction.", err);
          setIsPlaying(false);
        });
    } else {
      console.log("[MusicPlayerBar] Offset exceeds track duration, triggering natural end");
      handleTrackEnded();
    }
  }, [currentTrack?.trackId]);

  // 2. Map volume changes dynamically
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : Math.min(1.0, volume / 100);
    }
  }, [volume, isMuted]);

  // 3. Track progress ticker
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || currentTrack?.duration || 0);
    };

    const handlePlayState = () => setIsPlaying(true);
    const handlePauseState = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlayState);
    audio.addEventListener("pause", handlePauseState);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlayState);
      audio.removeEventListener("pause", handlePauseState);
    };
  }, [currentTrack]);

  // 4. Natural track end callback to STOMP
  const handleTrackEnded = () => {
    if (!token) return;
    console.log("[MusicPlayerBar] Audio ended naturally, notifying STOMP of track end");
    getStompClient(token).publish({
      destination: "/app/voice.music.trackEnded",
      body: JSON.stringify({ roomId, channelId })
    });
  };

  // Skip Command Callback
  const handleSkip = () => {
    if (!token) return;
    console.log("[MusicPlayerBar] User skipping track via GUI control");
    getStompClient(token).publish({
      destination: "/app/voice.music.command",
      body: JSON.stringify({
        roomId,
        channelId,
        command: "skip"
      })
    });
  };

  // Stop Command Callback
  const handleStop = () => {
    if (!token) return;
    console.log("[MusicPlayerBar] User stopping playback via GUI control");
    getStompClient(token).publish({
      destination: "/app/voice.music.command",
      body: JSON.stringify({
        roomId,
        channelId,
        command: "stop"
      })
    });
  };

  if (!currentTrack) return null;

  // Render Time Progress: MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-[#111214] border border-[#1f2023]/80 rounded-lg shadow-inner w-full font-sans select-none text-white overflow-hidden">
      {/* Dynamic hidden audio tag */}
      <audio ref={audioRef} onEnded={handleTrackEnded} playsInline />

      <div className="flex items-center justify-between gap-3">
        {/* Vinyl disk indicator */}
        <div className="relative h-10 w-10 shrink-0 bg-[#2b2d31] rounded-md overflow-hidden flex items-center justify-center border border-[#35363c]">
          {currentTrack.thumbnail ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className={cn(
                "h-full w-full object-cover transition-transform duration-1000",
                isPlaying ? "animate-[spin_12s_linear_infinite]" : ""
              )}
            />
          ) : (
            <Disc className={cn("h-6 w-6 text-gray-400", isPlaying ? "animate-[spin_8s_linear_infinite]" : "")} />
          )}
          <div className="absolute inset-0 bg-black/10 rounded-full flex items-center justify-center">
            <div className="h-3 w-3 bg-[#111214] rounded-full border border-white/20" />
          </div>
        </div>

        {/* Track Title and Requester Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-[12.5px] font-bold truncate text-[#dbdee1]" title={currentTrack.title}>
            {currentTrack.title}
          </span>
          <span className="text-[10.5px] text-[#949ba4] truncate font-medium mt-0.5">
            {t("music.orderedBy", { name: currentTrack.requestedByName || currentTrack.requestedBy })}
          </span>
        </div>

        {/* Local Controls: Mute, Volume Slider, Skip, Stop */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Mute button */}
          <button
            type="button"
            onClick={() => toggleMemberMute("music-bot")}
            className="p-1 px-1.5 rounded hover:bg-[#35363c] text-[#b5bac1] hover:text-[#dbdee1] transition cursor-pointer border-none outline-none"
            title={isMuted ? t("music.unmuteMember") : t("music.muteMember")}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-[#ed4245]" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            disabled={isMuted}
            onChange={(e) => setMemberVolume("music-bot", parseInt(e.target.value))}
            className="w-16 h-1 rounded bg-[#4e5058] cursor-pointer accent-[#5865f2] disabled:opacity-40 disabled:cursor-not-allowed hidden sm:block"
            title={`${t("music.volume")}: ${volume}%`}
          />

          {/* Skip Button */}
          <button
            type="button"
            onClick={handleSkip}
            className="p-1 px-1.5 rounded hover:bg-[#35363c] text-[#b5bac1] hover:text-[#dbdee1] transition cursor-pointer border-none outline-none"
            title="Skip Track"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={handleStop}
            className="p-1 px-1.5 rounded hover:bg-[#ed4245]/20 hover:text-[#ed4245] text-[#b5bac1] transition cursor-pointer border-none outline-none"
            title="Stop Music"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      </div>

      {/* Progress slider bar & values */}
      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#949ba4] font-mono">
        <span>{formatTime(currentTime)}</span>
        <div className="flex-1 h-1 rounded bg-[#2b2d31] relative overflow-hidden">
          <div
            className="h-full bg-[#23a55a] rounded"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

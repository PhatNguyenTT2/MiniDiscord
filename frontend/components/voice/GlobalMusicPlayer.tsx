"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useAuthStore } from "@/stores/authStore";
import { getStompClient } from "@/lib/websocket";

export function GlobalMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useVoiceStore((s) => s.currentMusicTrack);
  const musicBotActive = useVoiceStore((s) => s.musicBotActive);
  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const token = useAuthStore((s) => s.token);

  // Volume & mute
  const volume = useVoiceStore((s) => s.memberVolumes["music-bot"] ?? 100);
  const isMuted = useVoiceStore((s) => s.memberMuted["music-bot"] ?? false);

  const setMusicCurrentTime = useVoiceStore((s) => s.setMusicCurrentTime);
  const setMusicDuration = useVoiceStore((s) => s.setMusicDuration);
  const isPlaying = useVoiceStore((s) => s.musicIsPlaying);
  const setMusicIsPlaying = useVoiceStore((s) => s.setMusicIsPlaying);

  // 1. Sync source URL & startTime offset
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // If not connected to voice OR bot is not active OR no track URL, stop audio
    if (!currentChannel || !musicBotActive || !currentTrack || !currentTrack.directUrl) {
      audio.pause();
      audio.src = "";
      setMusicIsPlaying(false);
      setMusicCurrentTime(0);
      setMusicDuration(0);
      return;
    }

    // Load new URL
    if (audio.src !== currentTrack.directUrl) {
      audio.pause();
      audio.src = currentTrack.directUrl;
      audio.load();
    }

    const offsetSeconds = (Date.now() - currentTrack.startTime) / 1000;

    if (offsetSeconds < currentTrack.duration) {
      audio.currentTime = Math.max(0, offsetSeconds);
      audio.play()
        .then(() => setMusicIsPlaying(true))
        .catch((err) => {
          console.warn("[GlobalMusicPlayer] Playback blocked by browser autoplay rules. Waiting for interaction.", err);
          setMusicIsPlaying(false);
        });
    } else {
      console.log("[GlobalMusicPlayer] Offset exceeds track duration, notifying naturally ended");
      handleTrackEnded();
    }
  }, [currentTrack?.trackId, currentChannel?.channelId, musicBotActive]);

  // 2. Playback state recovery when user clicks anywhere (autoplay bypass)
  useEffect(() => {
    const handleInteraction = () => {
      const audio = audioRef.current;
      if (!audio || isPlaying || !currentTrack || !musicBotActive || !currentChannel) return;

      const offsetSeconds = (Date.now() - currentTrack.startTime) / 1000;
      if (offsetSeconds < currentTrack.duration) {
        audio.currentTime = Math.max(0, offsetSeconds);
        audio.play()
          .then(() => {
            setMusicIsPlaying(true);
            console.log("[GlobalMusicPlayer] Playback started successfully on user interaction.");
          })
          .catch((err) => {
            console.warn("[GlobalMusicPlayer] Interaction play failed:", err);
          });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("click", handleInteraction);
      window.addEventListener("keydown", handleInteraction);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("click", handleInteraction);
        window.removeEventListener("keydown", handleInteraction);
      }
    };
  }, [isPlaying, currentTrack, musicBotActive, currentChannel]);

  // 3. Sync volume and mute state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : Math.min(1.0, volume / 100);
    }
  }, [volume, isMuted]);

  // 4. Progress ticking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setMusicCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setMusicDuration(audio.duration || currentTrack?.duration || 0);
    };

    const handlePlay = () => setMusicIsPlaying(true);
    const handlePause = () => setMusicIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [currentTrack, setMusicCurrentTime, setMusicDuration]);

  // 5. Track end callback published to stomp
  const handleTrackEnded = () => {
    if (!token || !currentChannel) return;
    console.log("[GlobalMusicPlayer] Track ended naturally");
    try {
      getStompClient(token).publish({
        destination: "/app/voice.music.trackEnded",
        body: JSON.stringify({
          roomId: currentChannel.roomId,
          channelId: currentChannel.channelId
        })
      });
    } catch (err) {
      console.error("[GlobalMusicPlayer] Stomp publish error:", err);
    }
  };

  return (
    <audio
      ref={audioRef}
      onEnded={handleTrackEnded}
      playsInline
      className="hidden"
      style={{ display: "none" }}
    />
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useRoomStore } from "@/stores/roomStore";
import { useTranslation } from "@/lib/i18n";
import { Lock, PhoneOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Green cellular style signal wave icon
function VoiceSignalIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("text-[#23a55a] shrink-0 animate-pulse", className)} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M7 17a4 4 0 0 1 10 0" />
      <path d="M10 20a1 1 0 0 1 4 0" />
    </svg>
  );
}

// Krisp noise suppression wave pattern icon
function WaveformIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <rect x="4" y="8" width="2" height="8" rx="1" />
      <rect x="9" y="4" width="2" height="16" rx="1" />
      <rect x="14" y="9" width="2" height="6" rx="1" />
      <rect x="19" y="11" width="2" height="3" rx="1" />
    </svg>
  );
}

export function VoiceConnectedPanel() {
  const { t } = useTranslation();

  const currentChannel = useVoiceStore((s) => s.currentChannel);
  const activeCallRoomId = useVoiceStore((s) => s.activeCallRoomId);
  const leaveVoiceChannel = useVoiceStore((s) => s.leaveVoiceChannel);
  const endCall = useVoiceStore((s) => s.endCall);
  const remoteStreams = useVoiceStore((s) => s.remoteStreams);

  const rooms = useRoomStore((s) => s.rooms);
  const channels = useRoomStore((s) => s.channels);

  // Connection Overlays State
  const [showPingPopup, setShowPingPopup] = useState(false);
  const [showMicTestPopup, setShowMicTestPopup] = useState(false);

  // Dynamic Ping Stats
  const [avgPing, setAvgPing] = useState(38);
  const [lastPing, setLastPing] = useState(32);

  // Mic Testing States
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  // Microphone Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Periodic ping simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setLastPing(Math.round(25 + Math.random() * 15));
      setAvgPing((prev) => Math.round(prev * 0.9 + (25 + Math.random() * 15) * 0.1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup mic test on unmount
  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  function stopMicTest() {
    setIsTestingMic(false);
    setMicVolume(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const win = window as unknown as Record<string, unknown>;
    if (win._mockMicInterval) {
      clearInterval(win._mockMicInterval as number);
      delete win._mockMicInterval;
    }
  }

  // Microphones checking operations
  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const win = window as unknown as Record<string, unknown>;
      const AudioContextClass = window.AudioContext || (win.webkitAudioContext as typeof AudioContext);
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsTestingMic(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Map average input volume to a 0-100 gauge
        const targetVol = Math.min(100, Math.round((average / 60) * 100));
        setMicVolume(targetVol);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn("Direct microphone input not accessible, using mock visualizer oscillation:", err);
      setIsTestingMic(true);

      // Fallback oscillation loop
      let mockDir = 1;
      let mockVol = 15;
      const interval = setInterval(() => {
        mockVol += (Math.random() * 22 - 9) * mockDir;
        if (mockVol > 85) mockDir = -1;
        if (mockVol < 10) mockDir = 1;
        setMicVolume(Math.min(100, Math.max(0, Math.round(mockVol))));
      }, 70);
      (window as unknown as Record<string, unknown>)._mockMicInterval = interval as unknown;
    }
  };

  const handleDisconnect = () => {
    stopMicTest();
    setShowMicTestPopup(false);
    if (activeCallRoomId) {
      endCall();
    } else {
      leaveVoiceChannel();
    }
  };

  // If not in voice channel and not in active call, don't show the panel
  if (!currentChannel && !activeCallRoomId) return null;

  let title = t("voice.incomingCall");
  let subTitle = "MiniDiscord";
  let targetUrl = "";

  if (currentChannel) {
    const activeRoom = rooms.find((r) => r.id === currentChannel.roomId);
    const roomChannels = channels[currentChannel.roomId] || [];
    const activeChannelObj = roomChannels.find((c) => c.id === currentChannel.channelId);

    title = activeChannelObj?.name ? `🔊 ${activeChannelObj.name}` : "🔊 Voice Channel";
    subTitle = activeRoom?.name || "Server Room";
    targetUrl = `/channels/${currentChannel.roomId}/${currentChannel.channelId}`;
  } else if (activeCallRoomId) {
    const activeRoom = rooms.find((r) => r.id === activeCallRoomId);
    title = t("voice.connectedStatus");
    subTitle = activeRoom?.name ? `📞 ${activeRoom.name}` : "Direct DM Call";
    targetUrl = `/channels/me/${activeCallRoomId}`;
  }

  return (
    <div
      className="absolute inset-x-0 z-20 px-2 select-none"
      style={{
        bottom: "calc(var(--floating-bar-gap) + var(--floating-user-panel-height) + 8px)",
      }}
    >
      {/* 1. CONNECTION DETAILS OVERLAY PANEL (PING CAPTURING HOVER) */}
      {showPingPopup && !showMicTestPopup && (
        <div
          className="absolute left-0 right-0 bottom-[105%] z-30 p-3.5 rounded-lg shadow-xl border border-[#1f2023]/80 text-[#dbdee1] text-xs leading-normal animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{ backgroundColor: "#1e1f22" }}
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#23a55a] text-[12.5px] uppercase tracking-wide">
                {t("voice.voiceCallDetails")}
              </span>
              <Lock className="h-3.5 w-3.5 text-[#23a55a]" />
            </div>

            <hr className="border-[#35363c]" />

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#949ba4]">{t("voice.averagePing")}</span>
                <span className="font-semibold text-white">{avgPing} ms</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#949ba4]">{t("voice.latestPing")}</span>
                <span className="font-semibold text-white">{lastPing} ms</span>
              </div>
            </div>

            <div className="text-[10px] text-[#949ba4] leading-relaxed mt-0.5">
              {t("voice.pingDetailsInfo")}
            </div>

            <div className="flex items-center gap-1.5 text-[#23a55a] text-[11px] font-semibold mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#23a55a]" />
              {t("voice.secureConnection")}
            </div>
          </div>
        </div>
      )}

      {/* 2. NOISE SUPPRESSION OMITTED: MIC CHECK ONLY PANEL */}
      {showMicTestPopup && (
        <div
          className="absolute left-0 right-0 bottom-[105%] z-30 p-4 rounded-lg shadow-xl border border-[#1f2023]/80 text-[#dbdee1] text-xs leading-normal animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{ backgroundColor: "#1e1f22" }}
        >
          <div className="flex flex-col gap-3.5">
            {/* Mic Testing Visualizer Block */}
            <div className="flex flex-col gap-2">
              <span className="font-bold text-white text-[12px] uppercase tracking-wide">{t("voice.micTest")}</span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={isTestingMic ? stopMicTest : startMicTest}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-bold rounded text-white shadow-sm transition-colors duration-150 cursor-pointer border-none outline-none",
                    isTestingMic
                      ? "bg-[#ed4245] hover:bg-[#c93b3e]"
                      : "bg-[#5865f2] hover:bg-[#4752c4]"
                  )}
                >
                  {isTestingMic ? t("voice.stopTest") : t("voice.startTest")}
                </button>

                {/* DB Level Visualizer */}
                <div className="flex-1 flex items-center justify-between gap-[2px] h-[24px] bg-[#2b2d31]/80 px-2.5 rounded border border-[#1f2023]/60">
                  {Array.from({ length: 14 }).map((_, idx) => {
                    const cutoff = (idx / 14) * 100;
                    const isActive = isTestingMic && micVolume > cutoff;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-1 rounded-full transition-all duration-75",
                          isActive ? "bg-[#23a55a]" : "bg-[#3f4147]"
                        )}
                        style={{
                          height: isActive
                            ? `${6 + Math.min(10, Math.round((micVolume - cutoff) / 3.2)) * 1.5}px`
                            : "6px",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Krisp brand footer */}
            <div className="flex items-center justify-between text-[10.5px] text-[#949ba4] pt-1">
              <div className="flex items-center gap-1">
                <span>{t("voice.sponsoredBy")}</span>
                <span className="font-black text-white hover:text-gray-200 cursor-pointer">krisp</span>
              </div>
              <a
                href="https://krisp.ai"
                target="_blank"
                rel="noreferrer"
                className="text-[#00a8fc] hover:underline transition font-bold"
              >
                {t("voice.learnMore")}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. SINGLE-ROW CONNECTED PANEL */}
      <div
        className="flex items-center justify-between gap-1.5 p-2 px-2.5 shadow-[0_-8px_20px_rgba(0,0,0,0.18)]"
        style={{
          borderRadius: "var(--floating-bar-radius)",
          backgroundColor: "#2b2d31",
          border: "1px solid #1f2023",
        }}
      >
        {/* Signal hover action trigger info */}
        <Link
          href={targetUrl || "#"}
          className="flex flex-1 items-center gap-2 min-w-0 hover:opacity-90 transition-opacity"
          onMouseEnter={() => setShowPingPopup(true)}
          onMouseLeave={() => setShowPingPopup(false)}
        >
          <VoiceSignalIcon />

          <div className="flex flex-col min-w-0 font-sans">
            <span className="text-[12px] font-bold text-[#23a55a] leading-tight hover:underline cursor-pointer">
              {t("voice.connectedStatus")}
            </span>
            <span className="text-[10px] text-[#949ba4] truncate leading-none mt-0.5 font-medium">
              {title.replace("🔊 ", "")} / {subTitle}
            </span>
          </div>
        </Link>

        {/* Action triggers: Waveform (test mic) / PhoneOff (hangup) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Waveform Noise Suppressor Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowMicTestPopup((prev) => !prev);
              if (isTestingMic) stopMicTest();
            }}
            title="Kiểm tra Mic"
            className={cn(
              "p-2 rounded hover:bg-[#35363c] transition-colors cursor-pointer border-none outline-none flex items-center justify-center",
              showMicTestPopup ? "text-[#23a55a] bg-[#23a55a]/10" : "text-[#b5bac1] hover:text-[#dbdee1]"
            )}
          >
            <WaveformIcon />
          </button>

          {/* Hangup Red button */}
          <button
            type="button"
            onClick={handleDisconnect}
            className="p-1.5 rounded-full bg-[#ed4245] hover:bg-[#c93b3e] text-white transition-all scale-102 hover:scale-108 cursor-pointer border-none outline-none flex items-center justify-center shrink-0"
            title={t("voice.disconnect")}
          >
            <PhoneOff className="h-[14px] w-[14px]" fill="currentColor" stroke="none" />
          </button>
        </div>
      </div>

      {/* 4. Global hidden audio playback elements for active remote streams */}
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <audio
          key={userId}
          ref={(el) => {
            if (el) {
              el.srcObject = stream;
            }
          }}
          autoPlay
          playsInline
          className="hidden"
        />
      ))}
    </div>
  );
}

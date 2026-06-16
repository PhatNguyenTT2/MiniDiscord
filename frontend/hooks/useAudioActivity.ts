import { useEffect, useState, useRef } from "react";

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext is only available in the browser");
  }
  if (!sharedAudioCtx) {
    const win = window as unknown as { webkitAudioContext: typeof AudioContext };
    const AudioContextClass = window.AudioContext || win.webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  return sharedAudioCtx;
}

/**
 * Bootstrapper to resume the shared AudioContext from a user-triggered gesture.
 * Bypasses the browser's autoplay policies that suspension-lock audio analysis.
 */
export async function resumeAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const audioCtx = getSharedAudioContext();
    if (audioCtx.state === "suspended") {
      console.log("[AudioActivity] Shared AudioContext is suspended, attempting to resume...");
      await audioCtx.resume();
      console.log("[AudioActivity] Shared AudioContext resumed successfully. Current state:", audioCtx.state);
    }
  } catch (err) {
    console.error("[AudioActivity] Failed to resume shared AudioContext:", err);
  }
}

/**
 * useAudioActivity Hook
 * 
 * Analyzes audio amplitude levels for a given MediaStream to detect speaking state.
 * Employs a singleton AudioContext to prevent context limits.
 * Has a 400ms debounce buffer to filter rapid audio drop flicker.
 */
export function useAudioActivity(stream: MediaStream | null, isDisabled: boolean = false): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastActiveRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    if (!stream || isDisabled) {
      Promise.resolve().then(() => {
        if (isMounted) setIsSpeaking(false);
      });
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks.some((t) => t.enabled)) {
      Promise.resolve().then(() => {
        if (isMounted) setIsSpeaking(false);
      });
      return;
    }

    try {
      const audioCtx = getSharedAudioContext();

      // Auto-resume if it was previously resumed but somehow got suspended
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(console.error);
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!isMounted || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const threshold = 10; // Adjusted threshold for speaking

        const now = Date.now();
        if (average > threshold) {
          lastActiveRef.current = now;
          setIsSpeaking(true);
        } else {
          // Speak hang-time debounce of 400ms
          if (now - lastActiveRef.current > 400) {
            setIsSpeaking(false);
          }
        }

        animationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("[AudioActivity] Failed to hook audio activity visualizer:", e);
    }

    return () => {
      isMounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (err) {
          // ignore already-disconnected errors
        }
        sourceRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, isDisabled]);

  return isSpeaking;
}

/**
 * useAudioVolume Hook
 * 
 * Extracts real-time amplitude/volume metrics (0 to 100) from a MediaStream using AnalyserNode.
 * Uses the same singleton AudioContext as useAudioActivity.
 */
export function useAudioVolume(stream: MediaStream | null, isDisabled: boolean = false): number {
  const [volume, setVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!stream || isDisabled) {
      if (isMounted) setVolume(0);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks.some((t) => t.enabled)) {
      if (isMounted) setVolume(0);
      return;
    }

    try {
      const audioCtx = getSharedAudioContext();
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(console.error);
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3; // slightly faster smoothing for visuals
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!isMounted || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Map average (approx 0..80 for normal speech) to 0..100 scale
        const currentVolume = Math.min(100, Math.round((average / 80) * 100));

        if (isMounted) {
          setVolume(currentVolume);
        }

        animationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("[AudioActivity] Failed to hook audio volume visualizer:", e);
    }

    return () => {
      isMounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (err) {
          // ignore
        }
        sourceRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, isDisabled]);

  return volume;
}

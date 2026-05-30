import { useSoundStore } from '@/stores/soundStore';

export type SoundName =
  | 'message_notification'
  | 'voice_join'
  | 'voice_leave'
  | 'voice_disconnect'
  | 'mute'
  | 'unmute'
  | 'deafen'
  | 'undeafen'
  | 'call_ringing'
  | 'user_join_voice'
  | 'user_leave_voice';

export const ALL_SOUNDS: SoundName[] = [
  'message_notification',
  'voice_join',
  'voice_leave',
  'voice_disconnect',
  'mute',
  'unmute',
  'deafen',
  'undeafen',
  'call_ringing',
  'user_join_voice',
  'user_leave_voice'
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private lastPlayedAt = new Map<SoundName, number>();

  // Lazy init - SSR safe
  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  async preload(sounds: SoundName[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const ctx = this.getContext();
    await Promise.all(sounds.map(async (name) => {
      try {
        const res = await fetch(`/sounds/${name}.mp3`);
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
      } catch (err) {
        console.warn(`[SoundEngine] Failed to preload sound: ${name}`, err);
      }
    }));
  }

  play(name: SoundName): void {
    if (typeof window === 'undefined') return;

    // 1. Check Zustand store settings
    const settings = useSoundStore.getState();

    // 2. Global condition
    if (!settings.soundEnabled) return;

    // 3. Category conditions
    if (name === 'message_notification' && !settings.messageSound) return;
    if (name.startsWith('voice_') && !settings.voiceSound) return;
    if ((name === 'user_join_voice' || name === 'user_leave_voice') && !settings.voiceSound) return;
    if (name === 'call_ringing' && !settings.callSound) return;

    // Debounce: prevent spam (100ms)
    const now = Date.now();
    const last = this.lastPlayedAt.get(name) ?? 0;
    if (now - last < 100) return;
    this.lastPlayedAt.set(name, now);

    const ctx = this.getContext();
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      // Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') ctx.resume();

      // Create new source node for polyphonic playback (audio overlap)
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, settings.masterVolume / 100));

      source.connect(gainNode).connect(ctx.destination);
      source.start(0);
    } catch {
      // Silent fail (usually autoplay blocked)
    }
  }
}

// Export a single instance to be used everywhere (SSR-safe wrapper)
export const soundEngine = typeof window !== 'undefined' ? new SoundEngine() : null;

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
  private loadingPromises = new Map<SoundName, Promise<void>>();
  private lastPlayedAt = new Map<SoundName, number>();

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  /** Load a single sound on-demand (deduped, cached) */
  private async loadSound(name: SoundName): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return this.buffers.get(name)!;

    // Dedup: if already loading, wait for existing promise
    if (this.loadingPromises.has(name)) {
      await this.loadingPromises.get(name);
      return this.buffers.get(name) ?? null;
    }

    const promise = (async () => {
      const ctx = this.getContext();
      const customUrl = useSoundStore.getState().customSounds?.[name];
      const cdnBase = process.env.NEXT_PUBLIC_SOUND_CDN_URL || '/sounds';
      const defaultUrl = `${cdnBase}/${name}.mp3`;

      // 1. Try Custom Sound first
      if (customUrl) {
        try {
          const res = await fetch(customUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(name, audioBuffer);
            return;
          }
        } catch (err) {
          console.warn(`[SoundEngine] Custom sound broken for ${name}, flushing key and falling back to default`, err);
          useSoundStore.getState().clearCustomSound(name);
        }
      }

      // 2. Fallback to Default URL
      try {
        const res = await fetch(defaultUrl);
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
      } catch (err) {
        console.warn(`[SoundEngine] Failed to load default sound: ${name}`, err);
      } finally {
        this.loadingPromises.delete(name);
      }
    })();

    this.loadingPromises.set(name, promise);
    await promise;
    return this.buffers.get(name) ?? null;
  }

  /** Eagerly preload specific sounds (use sparingly) */
  async preload(sounds: SoundName[]): Promise<void> {
    if (typeof window === 'undefined') return;
    await Promise.all(sounds.map((name) => this.loadSound(name)));
  }

  async play(name: SoundName): Promise<void> {
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

    // Lazy load: fetch on first play if not cached
    const buffer = await this.loadSound(name);
    if (!buffer) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();

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

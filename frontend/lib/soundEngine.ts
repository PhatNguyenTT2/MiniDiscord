import { useSoundStore } from '@/stores/soundStore';
import { api } from '@/lib/api';

export type SoundName =
  | 'message_notification'
  | 'message_mention'
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
  'message_mention',
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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

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

  invalidateBuffer(name: SoundName): void {
    this.buffers.delete(name);
    this.loadingPromises.delete(name);
    if (name === 'voice_join') {
      this.buffers.delete('user_join_voice');
      this.loadingPromises.delete('user_join_voice');
    }
    if (name === 'voice_leave') {
      this.buffers.delete('user_leave_voice');
      this.loadingPromises.delete('user_leave_voice');
    }
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

      let configName: SoundName = name;
      if (name === 'user_join_voice') configName = 'voice_join';
      if (name === 'user_leave_voice') configName = 'voice_leave';

      const customFileKey = useSoundStore.getState().customSounds?.[configName];

      // 1. Try Custom Sound first (B2 pre-signed dynamic authorization)
      if (customFileKey) {
        try {
          const urlRes = await api.get<{ message: string; data: { url: string; expiresIn: number } }>(
            `/files/url?key=${encodeURIComponent(customFileKey)}`
          );
          const freshUrl = urlRes.data.data.url;
          if (freshUrl) {
            const res = await fetch(freshUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
              this.buffers.set(name, audioBuffer);
              return;
            }
          }
        } catch (err) {
          console.warn(`[SoundEngine] Custom sound failed for ${name}, falling back to default`, err);
          useSoundStore.getState().clearCustomSound(name);
        }
      }

      // 2. Fallback to Default Base64 embedded audio data
      try {
        const { SOUNDS_BASE64 } = await import('./soundsData');
        const base64Data = SOUNDS_BASE64[name];
        if (base64Data) {
          const arrayBuffer = base64ToArrayBuffer(base64Data);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          this.buffers.set(name, audioBuffer);
        } else {
          console.warn(`[SoundEngine] No default base64 sound data for: ${name}`);
        }
      } catch (err) {
        console.warn(`[SoundEngine] Failed to decode base64 sound: ${name}`, err);
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
    if (name === 'message_mention' && !settings.messageSound) return;
    if ((name === 'voice_join' || name === 'user_join_voice') && !settings.voiceJoinSound) return;
    if ((name === 'voice_leave' || name === 'user_leave_voice') && !settings.voiceLeaveSound) return;
    if (name === 'voice_disconnect' && !settings.voiceDisconnectSound) return;
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

  private activeLoopSources = new Map<SoundName, AudioBufferSourceNode>();

  async playLoop(name: SoundName): Promise<void> {
    if (typeof window === 'undefined') return;
    const settings = useSoundStore.getState();
    if (!settings.soundEnabled) return;
    if (name === 'call_ringing' && !settings.callSound) return;

    this.stopLoop(name);

    const ctx = this.getContext();
    const buffer = await this.loadSound(name);
    if (!buffer) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, settings.masterVolume / 100));

      source.connect(gainNode).connect(ctx.destination);
      source.start(0);

      this.activeLoopSources.set(name, source);
    } catch {
      // Silent fail
    }
  }

  stopLoop(name: SoundName): void {
    const source = this.activeLoopSources.get(name);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped or not started
      }
      this.activeLoopSources.delete(name);
    }
  }
}

// Export a single instance to be used everywhere (SSR-safe wrapper)
export const soundEngine = typeof window !== 'undefined' ? new SoundEngine() : null;

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

class SoundEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private arrayBuffers = new Map<SoundName, ArrayBuffer>();
  private loadingPromises = new Map<SoundName, Promise<AudioBuffer | null>>();
  private preloadPromises = new Map<SoundName, Promise<ArrayBuffer | null>>();
  private lastPlayedAt = new Map<SoundName, number>();

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  invalidateBuffer(name: SoundName): void {
    this.buffers.delete(name);
    this.arrayBuffers.delete(name);
    this.loadingPromises.delete(name);
    this.preloadPromises.delete(name);
    if (name === 'voice_join') {
      this.buffers.delete('user_join_voice');
      this.arrayBuffers.delete('user_join_voice');
      this.loadingPromises.delete('user_join_voice');
      this.preloadPromises.delete('user_join_voice');
    }
    if (name === 'voice_leave') {
      this.buffers.delete('user_leave_voice');
      this.arrayBuffers.delete('user_leave_voice');
      this.loadingPromises.delete('user_leave_voice');
      this.preloadPromises.delete('user_leave_voice');
    }
  }

  /** Fetch sound binary bytes to cache on RAM without AudioContext context dependency */
  private async preloadSoundArrayBuffer(name: SoundName): Promise<ArrayBuffer | null> {
    if (this.arrayBuffers.has(name)) return this.arrayBuffers.get(name)!;

    if (this.preloadPromises.has(name)) {
      return this.preloadPromises.get(name)!;
    }

    const promise = (async () => {
      let configName: SoundName = name;
      if (name === 'user_join_voice') configName = 'voice_join';
      if (name === 'user_leave_voice') configName = 'voice_leave';
      if (name === 'deafen') configName = 'mute';
      if (name === 'undeafen') configName = 'unmute';

      const customFileKey = useSoundStore.getState().customSounds?.[configName];
      if (!customFileKey) return null;

      try {
        const urlRes = await api.get<{ message: string; data: { url: string; expiresIn: number } }>(
          `/files/url?key=${encodeURIComponent(customFileKey)}`
        );
        const freshUrl = urlRes.data.data.url;
        if (freshUrl) {
          const res = await fetch(freshUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            this.arrayBuffers.set(name, arrayBuffer);
            return arrayBuffer;
          }
        }
      } catch (err) {
        console.warn(`[SoundEngine] Preload array buffer failed for ${name}:`, err);
      } finally {
        this.preloadPromises.delete(name);
      }
      return null;
    })();

    this.preloadPromises.set(name, promise);
    return promise;
  }

  /** Load and decode a sound utilizing cached array buffer if available */
  private async loadSound(name: SoundName): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return this.buffers.get(name)!;

    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }

    const promise = (async () => {
      try {
        let arrayBuffer = this.arrayBuffers.get(name) || null;
        if (!arrayBuffer) {
          arrayBuffer = await this.preloadSoundArrayBuffer(name);
        }
        if (!arrayBuffer) return null;

        const ctx = this.getContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        this.buffers.set(name, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.warn(`[SoundEngine] Failed to decode audio for ${name}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(name);
      }
    })();

    this.loadingPromises.set(name, promise);
    return promise;
  }

  /** Eagerly preload sound file key and download its binary buffer to RAM array buffer cache */
  async preload(sounds: SoundName[]): Promise<void> {
    if (typeof window === 'undefined') return;
    await Promise.all(sounds.map((name) => this.preloadSoundArrayBuffer(name)));
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
    if ((name === 'mute' || name === 'deafen') && !settings.muteSound) return;
    if ((name === 'unmute' || name === 'undeafen') && !settings.unmuteSound) return;

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
  private expectedLoopState = new Map<SoundName, boolean>();

  async playLoop(name: SoundName): Promise<void> {
    if (typeof window === 'undefined') return;
    const settings = useSoundStore.getState();
    if (!settings.soundEnabled) return;
    if (name === 'call_ringing' && !settings.callSound) return;

    this.expectedLoopState.set(name, true);
    this.stopLoop(name);

    const ctx = this.getContext();
    const buffer = await this.loadSound(name);
    if (!this.expectedLoopState.get(name)) {
      return;
    }
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
    this.expectedLoopState.set(name, false);
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

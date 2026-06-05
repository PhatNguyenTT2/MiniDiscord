import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type SoundName } from '@/lib/soundEngine';

export interface SoundSettings {
  masterVolume: number;    // 0-100
  soundEnabled: boolean;
  messageSound: boolean;
  voiceJoinSound: boolean;
  voiceLeaveSound: boolean;
  voiceDisconnectSound: boolean;
  callSound: boolean;
  customSounds: Partial<Record<SoundName, string>>;
}

interface SoundStore extends SoundSettings {
  setMasterVolume: (volume: number) => void;
  toggleSoundEnabled: (enabled?: boolean) => void;
  toggleMessageSound: (enabled?: boolean) => void;
  toggleVoiceJoinSound: (enabled?: boolean) => void;
  toggleVoiceLeaveSound: (enabled?: boolean) => void;
  toggleVoiceDisconnectSound: (enabled?: boolean) => void;
  toggleCallSound: (enabled?: boolean) => void;
  setCustomSound: (name: SoundName, url: string) => void;
  clearCustomSound: (name: SoundName) => void;
  resetSound: (name: SoundName) => void;
}

export const useSoundStore = create<SoundStore>()(
  persist(
    (set) => ({
      masterVolume: 100, // Safe default volume for Web Audio (controlled by user later)
      soundEnabled: true,
      messageSound: true,
      voiceJoinSound: true,
      voiceLeaveSound: true,
      voiceDisconnectSound: true,
      callSound: true,
      customSounds: {},

      setMasterVolume: (volume) => set({ masterVolume: volume }),
      toggleSoundEnabled: (enabled) => set((s) => ({ soundEnabled: enabled ?? !s.soundEnabled })),
      toggleMessageSound: (enabled) => set((s) => ({ messageSound: enabled ?? !s.messageSound })),
      toggleVoiceJoinSound: (enabled) => set((s) => ({ voiceJoinSound: enabled ?? !s.voiceJoinSound })),
      toggleVoiceLeaveSound: (enabled) => set((s) => ({ voiceLeaveSound: enabled ?? !s.voiceLeaveSound })),
      toggleVoiceDisconnectSound: (enabled) => set((s) => ({ voiceDisconnectSound: enabled ?? !s.voiceDisconnectSound })),
      toggleCallSound: (enabled) => set((s) => ({ callSound: enabled ?? !s.callSound })),
      setCustomSound: (name, url) => set((s) => ({
        customSounds: { ...s.customSounds, [name]: url }
      })),
      clearCustomSound: (name) => set((s) => {
        const next = { ...s.customSounds };
        delete next[name];
        return { customSounds: next };
      }),
      resetSound: (name) => set((s) => {
        const next = { ...s.customSounds };
        delete next[name];
        return { customSounds: next };
      }),
    }),
    {
      name: 'minidiscord-sound-settings',
    }
  )
);

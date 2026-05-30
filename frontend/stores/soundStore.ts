import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SoundSettings {
  masterVolume: number;    // 0-100
  soundEnabled: boolean;
  messageSound: boolean;
  voiceSound: boolean;
  callSound: boolean;
}

interface SoundStore extends SoundSettings {
  setMasterVolume: (volume: number) => void;
  toggleSoundEnabled: (enabled?: boolean) => void;
  toggleMessageSound: (enabled?: boolean) => void;
  toggleVoiceSound: (enabled?: boolean) => void;
  toggleCallSound: (enabled?: boolean) => void;
}

export const useSoundStore = create<SoundStore>()(
  persist(
    (set) => ({
      masterVolume: 100, // Safe default volume for Web Audio (controlled by user later)
      soundEnabled: true,
      messageSound: true,
      voiceSound: true,
      callSound: true,

      setMasterVolume: (volume) => set({ masterVolume: volume }),
      toggleSoundEnabled: (enabled) => set((s) => ({ soundEnabled: enabled ?? !s.soundEnabled })),
      toggleMessageSound: (enabled) => set((s) => ({ messageSound: enabled ?? !s.messageSound })),
      toggleVoiceSound: (enabled) => set((s) => ({ voiceSound: enabled ?? !s.voiceSound })),
      toggleCallSound: (enabled) => set((s) => ({ callSound: enabled ?? !s.callSound })),
    }),
    {
      name: 'minidiscord-sound-settings',
    }
  )
);

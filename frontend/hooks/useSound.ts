import { useCallback } from 'react';
import { soundEngine, type SoundName } from '@/lib/soundEngine';

/**
 * Hook to get the play function for sounds.
 * Sounds are loaded lazily on first play — no eager preload needed.
 */
export function useSound() {
  const play = useCallback((name: SoundName) => {
    if (soundEngine) {
      soundEngine.play(name);
    }
  }, []);

  return { play };
}

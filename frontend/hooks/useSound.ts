import { useCallback, useEffect } from 'react';
import { soundEngine, type SoundName, ALL_SOUNDS } from '@/lib/soundEngine';

/**
 * Hook to get the play function for sounds.
 * Sounds pre-load custom audio binary bytes to RAM cache on mount.
 */
export function useSound() {
  useEffect(() => {
    if (soundEngine) {
      soundEngine.preload(ALL_SOUNDS);
    }
  }, []);

  const play = useCallback((name: SoundName) => {
    if (soundEngine) {
      soundEngine.play(name);
    }
  }, []);

  return { play };
}

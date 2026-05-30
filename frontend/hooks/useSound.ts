import { useEffect, useCallback } from 'react';
import { soundEngine, ALL_SOUNDS, type SoundName } from '@/lib/soundEngine';

/**
 * Hook to preload sounds and get play function
 * Should be called once high up in the component tree (e.g. main layout) to trigger preloading.
 * For playing sounds, you can use this hook or directly import and call soundEngine.play(name).
 */
export function useSound() {
  useEffect(() => {
    // Preload sounds after mount
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

# Sound System: Fix Custom Sound Override & Reduce Latency

Custom sounds uploaded to B2 are being irreversibly overridden by the default fallback system. Additionally, the "Test Sound" preview and real-time playback exhibit noticeable latency on first use.

## Root Cause Analysis

### Bug 1: Custom sounds erased on any network failure
In [soundEngine.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts#L106-L109), the `catch` block calls [clearCustomSound(name)](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#59-64) on **any** fetch error. This permanently deletes the user's B2 file key from `localStorage`, making the loss irreversible.

```typescript
// CURRENT (line 106-109):
} catch (err) {
  console.warn(`Custom sound failed, falling back to default`, err);
  useSoundStore.getState().clearCustomSound(name); // ← DESTRUCTIVE
}
```

### Bug 2: [clearCustomSound](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#59-64) targets wrong key
The aliasing logic maps `user_join_voice → voice_join`, `deafen → mute`, etc. But [clearCustomSound(name)](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#59-64) is called with the **original** [name](file:///e:/UIT/cv/MiniDiscord/frontend/components/chat/MessageItem.tsx#97-101) (e.g., `user_join_voice`), not `configName` (e.g., `voice_join`). The custom key is stored under `voice_join`, so clearing `user_join_voice` is a no-op — or worse, it clears the wrong entry.

### Bug 3: All default sounds are identical placeholders
[soundsData.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundsData.ts) contains 12 entries that are **all the same** base64 string (identical OGG/Opus silence). These are not real distinct sounds — they're just placeholder data that should be removed entirely.

### Latency: Multi-hop lazy loading on first play
[play()](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts#141-187) → [loadSound()](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts#69-134) → API call for presigned URL → B2 fetch → `decodeAudioData()`. This 3-hop chain causes 500ms–2s delay on first playback.

---

## Proposed Changes

### Sound Engine Core

#### [MODIFY] [soundEngine.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts)

1. **Remove destructive [clearCustomSound](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#59-64) from catch block** — On B2 fetch failure, log a warning and fall through to the default fallback **without** deleting the user's stored key. The key remains intact for the next attempt.
2. **Remove the entire base64 fallback path** — Since all default sounds are identical silent placeholders, the fallback to `soundsData` is useless. When no custom sound is configured and no B2 key exists, [loadSound](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts#69-134) should return `null` (= no sound plays), which is the correct behavior for an unconfigured category.
3. **Fix `loadingPromises.delete(name)` placement** — Currently inside the base64 `finally` block only. Move it to after the outer promise completes so deduplication cleanup always happens.
4. **Add eager preloading for custom sounds** — After a successful custom sound upload or on app init, preload all configured custom sounds into the AudioContext buffer cache. This eliminates first-play latency.

#### [DELETE] [soundsData.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundsData.ts)

Remove the entire file (130KB of identical placeholder data). All references to it in [soundEngine.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts) will be removed as part of the changes above.

---

### Sound Settings UI

#### [MODIFY] [SoundTab.tsx](file:///e:/UIT/cv/MiniDiscord/frontend/components/settings/SoundTab.tsx)

1. **"Test Sound" preview should indicate loading** — When the user clicks the preview speaker icon, if the sound hasn't been cached yet, show a brief loading spinner on the icon while the B2 fetch + decode runs.
2. **Trigger preload after upload** — After a successful custom sound upload, immediately call `soundEngine.preload([soundName])` so the buffer is warm for the next preview/playback.

---

### Sound Store

#### [MODIFY] [soundStore.ts](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts)

No functional changes needed. The [clearCustomSound](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#59-64) / [resetSound](file:///e:/UIT/cv/MiniDiscord/frontend/stores/soundStore.ts#64-69) methods are correct — the issue was in [soundEngine.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundEngine.ts) calling them inappropriately.

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` — Verify zero compile errors after removing [soundsData.ts](file:///e:/UIT/cv/MiniDiscord/frontend/lib/soundsData.ts) and all its import references.

### Manual Verification
1. Upload a custom sound for "Message Notification" → verify "Custom sound active" badge appears.
2. Disable network / simulate B2 timeout → trigger the sound → verify the custom sound key is **not** erased from `localStorage` (check `minidiscord-sound-settings` in DevTools).
3. Re-enable network → trigger again → custom sound should play normally.
4. Click "Test Sound" preview button → verify sound plays without excessive delay after the first load.
5. Reset a sound (click ↻) → verify it goes silent (no default placeholder) and the badge disappears.

"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX, Upload, X, RotateCcw } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useSoundStore } from "@/stores/soundStore";
import { soundEngine, type SoundName } from "@/lib/soundEngine";
import { useFileStore } from "@/stores/fileStore";
import { cn } from "@/lib/utils";

// Allowed mime types directly here
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
const MAX_SOUND_SIZE = 500 * 1024; // 500KB

export function SoundTab() {
  const { t } = useTranslation();

  const {
    masterVolume,
    setMasterVolume,
    soundEnabled,
    toggleSoundEnabled,
    messageSound,
    toggleMessageSound,
    voiceSound,
    toggleVoiceSound,
    callSound,
    toggleCallSound,
    customSounds,
    setCustomSound,
    clearCustomSound
  } = useSoundStore();

  const handlePreview = (name: SoundName) => {
    if (!soundEnabled) return;
    if (soundEngine) {
      soundEngine.play(name);
    }
  };

  return (
    <div className="space-y-8 pb-4">
      {/* ─── Header ─── */}
      <div>
        <h2 className="mb-2 text-lg font-semibold text-foreground uppercase">
          {t("settings.sound")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.soundDescription")}
        </p>
      </div>

      <div className="space-y-6">

        {/* Master Volume */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-foreground">{t("settings.masterVolume")}</span>
            <span className="text-xs font-mono text-muted-foreground">{masterVolume}%</span>
          </div>
          <div className="flex items-center gap-4">
            <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseInt(e.target.value))}
              className="w-full accent-accent h-2 bg-background-tertiary rounded-lg appearance-none cursor-pointer"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>

        <div className="h-px bg-border my-4" />

        {/* Enable All Sounds Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[15px] font-medium text-foreground">{t("settings.enableSounds")}</span>
            <span className="text-xs text-muted-foreground">{t("settings.enableSoundsDesc")}</span>
          </div>
          <button
            type="button"
            className={cn("relative inline-flex h-[24px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75", soundEnabled ? 'bg-success' : 'bg-[#80848E]')}
            onClick={() => toggleSoundEnabled()}
          >
            <span className={cn("inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out", soundEnabled ? 'translate-x-4' : 'translate-x-0')} />
          </button>
        </div>

        <div className="h-px bg-border my-4" />

        {/* Per-category Toggles with Preview */}
        <SoundRow
          label={t("settings.messageSound")}
          enabled={messageSound}
          onToggle={() => toggleMessageSound()}
          globalEnabled={soundEnabled}
          previewSound="message_notification"
          onPreview={handlePreview}
        />

        <SoundRow
          label={t("settings.voiceSound")}
          enabled={voiceSound}
          onToggle={() => toggleVoiceSound()}
          globalEnabled={soundEnabled}
          previewSound="voice_join"
          onPreview={handlePreview}
        />

        <SoundRow
          label={t("settings.callSound")}
          enabled={callSound}
          onToggle={() => toggleCallSound()}
          globalEnabled={soundEnabled}
          previewSound="call_ringing"
          onPreview={handlePreview}
        />

      </div>
    </div>
  );
}

function SoundRow({
  label,
  enabled,
  onToggle,
  globalEnabled,
  previewSound,
  onPreview
}: {
  label: string,
  enabled: boolean,
  onToggle: () => void,
  globalEnabled: boolean,
  previewSound: SoundName,
  onPreview: (name: SoundName) => void
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className={cn("text-[15px] font-medium transition-colors", !globalEnabled ? "text-muted-foreground line-through" : "text-foreground")}>{label}</span>
        <button
          onClick={() => onPreview(previewSound)}
          disabled={!globalEnabled || !enabled}
          className="p-1 text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("settings.previewSound")}
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        disabled={!globalEnabled}
        className={cn("relative inline-flex h-[24px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50", enabled && globalEnabled ? 'bg-success' : 'bg-[#80848E]')}
        onClick={onToggle}
      >
        <span className={cn("inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out", enabled && globalEnabled ? 'translate-x-4' : 'translate-x-0')} />
      </button>
    </div>
  );
}

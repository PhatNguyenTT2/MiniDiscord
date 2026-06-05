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
    voiceJoinSound,
    toggleVoiceJoinSound,
    voiceLeaveSound,
    toggleVoiceLeaveSound,
    voiceDisconnectSound,
    toggleVoiceDisconnectSound,
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
          customFileKey={customSounds["message_notification"]}
          onUpload={(key) => {
            if (soundEngine) soundEngine.invalidateBuffer("message_notification");
            setCustomSound("message_notification", key);
          }}
          onReset={() => {
            if (soundEngine) soundEngine.invalidateBuffer("message_notification");
            clearCustomSound("message_notification");
          }}
        />

        <SoundRow
          label={t("settings.voiceJoinSound")}
          enabled={voiceJoinSound}
          onToggle={() => toggleVoiceJoinSound()}
          globalEnabled={soundEnabled}
          previewSound="voice_join"
          onPreview={handlePreview}
          customFileKey={customSounds["voice_join"]}
          onUpload={(key) => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_join");
            }
            setCustomSound("voice_join", key);
          }}
          onReset={() => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_join");
            }
            clearCustomSound("voice_join");
          }}
        />

        <SoundRow
          label={t("settings.voiceLeaveSound")}
          enabled={voiceLeaveSound}
          onToggle={() => toggleVoiceLeaveSound()}
          globalEnabled={soundEnabled}
          previewSound="voice_leave"
          onPreview={handlePreview}
          customFileKey={customSounds["voice_leave"]}
          onUpload={(key) => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_leave");
            }
            setCustomSound("voice_leave", key);
          }}
          onReset={() => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_leave");
            }
            clearCustomSound("voice_leave");
          }}
        />

        <SoundRow
          label={t("settings.voiceDisconnectSound")}
          enabled={voiceDisconnectSound}
          onToggle={() => toggleVoiceDisconnectSound()}
          globalEnabled={soundEnabled}
          previewSound="voice_disconnect"
          onPreview={handlePreview}
          customFileKey={customSounds["voice_disconnect"]}
          onUpload={(key) => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_disconnect");
            }
            setCustomSound("voice_disconnect", key);
          }}
          onReset={() => {
            if (soundEngine) {
              soundEngine.invalidateBuffer("voice_disconnect");
            }
            clearCustomSound("voice_disconnect");
          }}
        />

        <SoundRow
          label={t("settings.callSound")}
          enabled={callSound}
          onToggle={() => toggleCallSound()}
          globalEnabled={soundEnabled}
          previewSound="call_ringing"
          onPreview={handlePreview}
          customFileKey={customSounds["call_ringing"]}
          onUpload={(key) => {
            if (soundEngine) soundEngine.invalidateBuffer("call_ringing");
            setCustomSound("call_ringing", key);
          }}
          onReset={() => {
            if (soundEngine) soundEngine.invalidateBuffer("call_ringing");
            clearCustomSound("call_ringing");
          }}
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
  onPreview,
  customFileKey,
  onUpload,
  onReset
}: {
  label: string,
  enabled: boolean,
  onToggle: () => void,
  globalEnabled: boolean,
  previewSound: SoundName,
  onPreview: (name: SoundName) => void,
  customFileKey?: string,
  onUpload: (fileKey: string) => void,
  onReset: () => void
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadFile = useFileStore((s) => s.uploadFile);

  const handleUploadClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SOUND_SIZE) {
      alert(t("settings.soundFileTooLarge"));
      return;
    }

    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      alert(t("settings.soundFileInvalid"));
      return;
    }

    try {
      setIsUploading(true);
      const res = await uploadFile(file, "sound");
      if (res.fileKey) {
        onUpload(res.fileKey);
      }
    } catch (error) {
      console.error("Failed to upload custom sound:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3">
        <span className={cn("text-[15px] font-medium transition-colors", !globalEnabled ? "text-muted-foreground line-through" : "text-foreground")}>{label}</span>
        <button
          onClick={() => onPreview(previewSound)}
          disabled={!globalEnabled || !enabled || isUploading}
          className="p-1 text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("settings.previewSound")}
        >
          <Volume2 className="h-4 w-4" />
        </button>

        {/* Custom sound badge */}
        {customFileKey && !isUploading && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#248046]/20 text-[#23a55a]" title={customFileKey}>
            {t("settings.customSoundActive")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Upload Button with Hidden input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".mp3,.ogg,.wav"
          className="hidden"
          disabled={!globalEnabled || isUploading}
        />

        <button
          type="button"
          onClick={handleUploadClick}
          disabled={!globalEnabled || isUploading}
          className="p-1 text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
          title={t("settings.customSoundUpload")}
        >
          {isUploading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-white" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </button>

        {/* Reset Button */}
        {customFileKey && (
          <button
            type="button"
            onClick={onReset}
            disabled={!globalEnabled || isUploading}
            className="p-1 text-danger hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={t("settings.customSoundReset")}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          disabled={!globalEnabled || isUploading}
          className={cn("relative inline-flex h-[24px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50", enabled && globalEnabled ? 'bg-success' : 'bg-[#80848E]')}
          onClick={onToggle}
        >
          <span className={cn("inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out", enabled && globalEnabled ? 'translate-x-4' : 'translate-x-0')} />
        </button>
      </div>
    </div>
  );
}

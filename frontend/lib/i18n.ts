import { create } from "zustand";
import { useEffect } from "react";
import en from "@/dictionaries/en.json";
import vi from "@/dictionaries/vi.json";

export type Locale = "en" | "vi";

/* ─── Flatten nested JSON into dot-notation keys ──────────────────── */
type NestedRecord = { [key: string]: string | NestedRecord };

function flattenDict(obj: NestedRecord, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "string") {
      result[fullKey] = value;
    } else {
      Object.assign(result, flattenDict(value as NestedRecord, fullKey));
    }
  }
  return result;
}

const dictionaries = {
  en: flattenDict(en as NestedRecord),
  vi: flattenDict(vi as NestedRecord),
} as const;

/* ─── Extract all valid translation keys ──────────────────────────── */
export type TranslationKey = keyof typeof dictionaries.en;

/* ─── Zustand store ───────────────────────────────────────────────── */
interface I18nState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: "en",
  hydrated: false,
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", locale);
    }
    set({ locale });
  },
  hydrate: () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("locale") as Locale | null;
      if (saved && (saved === "en" || saved === "vi")) {
        set({ locale: saved, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    }
  },
}));

/** Map app locale to Intl date locale string */
const DATE_LOCALE_MAP: Record<Locale, string> = { en: "en-US", vi: "vi-VN" };
export function getDateLocale(): string {
  return DATE_LOCALE_MAP[useI18nStore.getState().locale];
}

/** Call this in a top-level client component to hydrate locale from localStorage */
export function useI18nHydration() {
  const hydrate = useI18nStore((s) => s.hydrate);
  const hydrated = useI18nStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);
}

/* ─── Translation hook ────────────────────────────────────────────── */
export function useTranslation() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  function t(key: string, vars?: Record<string, string | number>): string {
    let value =
      (dictionaries[locale] as Record<string, string>)[key] ??
      (dictionaries.en as Record<string, string>)[key] ??
      key;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }

    return value;
  }

  return { t, locale, setLocale };
}

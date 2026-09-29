import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { PREFS_KEY } from '@/config';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: ThemePreference;
  haptics: boolean;
  widgetTipDismissed: boolean;
}

const DEFAULT_PREFS: Prefs = { theme: 'system', haptics: true, widgetTipDismissed: false };

interface PrefsStore extends Prefs {
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Prefs>): void;
}

function applyTheme(theme: ThemePreference) {
  try {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  } catch {
    // Eski platformlarda desteklenmeyebilir; sistem teması kullanılır.
  }
}

function sanitize(value: unknown): Prefs {
  const v = (value ?? {}) as Partial<Prefs>;
  return {
    theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'system',
    haptics: typeof v.haptics === 'boolean' ? v.haptics : DEFAULT_PREFS.haptics,
    widgetTipDismissed: v.widgetTipDismissed === true,
  };
}

/** Cihaza özel tercihler (widget ile paylaşılmaz). */
export const usePrefs = create<PrefsStore>((set, get) => ({
  ...DEFAULT_PREFS,
  loaded: false,

  async load() {
    let prefs = DEFAULT_PREFS;
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) prefs = sanitize(JSON.parse(raw));
    } catch {
      prefs = DEFAULT_PREFS;
    }
    applyTheme(prefs.theme);
    set({ ...prefs, loaded: true });
  },

  update(patch) {
    const { theme, haptics, widgetTipDismissed } = { ...get(), ...patch };
    const next: Prefs = { theme, haptics, widgetTipDismissed };
    if (patch.theme !== undefined) applyTheme(next.theme);
    set(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  },
}));

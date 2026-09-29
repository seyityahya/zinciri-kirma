import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_GROUP, DATA_KEY } from '@/config';

import type { DataStorage } from './storage';

export type { DataStorage } from './storage';

interface ExtensionStorageNative {
  get(key: string, group?: string): string | null | undefined;
  setString(key: string, value: string, group?: string): void;
}

function nativeModule(): ExtensionStorageNative | null {
  const mod = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules
    ?.ExtensionStorage as ExtensionStorageNative | undefined;
  return mod ?? null;
}

const sharedDefaults = nativeModule();

/**
 * iOS: veri App Group UserDefaults'ta tutulur; böylece widget'taki "Yaptım"
 * düğmesi uygulama açılmadan aynı veriyi günceller.
 * Yerel modül yoksa (ör. Expo Go) AsyncStorage'a düşer.
 */
export const dataStorage: DataStorage = sharedDefaults
  ? {
      shared: true,
      async load() {
        const value = sharedDefaults.get(DATA_KEY, APP_GROUP);
        return typeof value === 'string' && value.length > 0 ? value : null;
      },
      async save(json) {
        sharedDefaults.setString(DATA_KEY, json, APP_GROUP);
      },
    }
  : {
      shared: false,
      load: () => AsyncStorage.getItem(DATA_KEY),
      save: (json) => AsyncStorage.setItem(DATA_KEY, json),
    };

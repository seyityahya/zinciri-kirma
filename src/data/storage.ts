import AsyncStorage from '@react-native-async-storage/async-storage';

import { DATA_KEY } from '@/config';

/**
 * Zincir verisinin saklandığı yer.
 * Android/web: AsyncStorage (Android widget'ı da aynı JS ortamında çalışıp buradan okur).
 * iOS: storage.ios.ts — widget ile paylaşılan App Group.
 */
export interface DataStorage {
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
  /** Uygulama dışından (widget) değişiklik yapılabiliyor mu? */
  readonly shared: boolean;
}

export const dataStorage: DataStorage = {
  shared: false,
  load: () => AsyncStorage.getItem(DATA_KEY),
  save: (json) => AsyncStorage.setItem(DATA_KEY, json),
};

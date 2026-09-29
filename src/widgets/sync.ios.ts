import type { AppData } from '@/domain/types';

interface ExtensionStorageNative {
  reloadWidget(kind?: string): void;
}

/**
 * Veri zaten App Group'a yazıldı; WidgetKit'e zaman çizelgelerini yenilemesini söyle.
 */
export function syncWidgets(_data: AppData): void {
  const mod = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules
    ?.ExtensionStorage as ExtensionStorageNative | undefined;
  try {
    mod?.reloadWidget();
  } catch (error) {
    console.warn('[widget] yenilenemedi', error);
  }
}

import type { AppData } from '@/domain/types';

import { updateAllWidgets } from './android/render';

/** Uygulamadaki her değişiklikten sonra ana ekran widget'larını yeniden çiz. */
export function syncWidgets(data: AppData): void {
  updateAllWidgets(data).catch((error) => console.warn('[widget] güncellenemedi', error));
}

'use no memo';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { flushStore, useHabitStore } from '@/data/store';
import { todayKey } from '@/domain/dates';

import { renderFor, setWidgetHabit, updateAllWidgets } from './render';

/**
 * Android widget olayları (ekleme, periyodik güncelleme, dokunma).
 * Uygulama kapalıyken bile arka planda (headless JS) çalışır; uygulama açıksa
 * aynı JS ortamını paylaştığı için ekran da anında güncellenir.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, clickAction, clickActionData, renderWidget } = props;
  const store = useHabitStore.getState();
  await store.init();

  switch (widgetAction) {
    case 'WIDGET_DELETED':
      await setWidgetHabit(widgetInfo.widgetId, null);
      return;

    case 'WIDGET_CLICK': {
      store.setToday(todayKey());
      const shownDay = clickActionData?.day;
      // Widget gece yarısından sonra henüz yenilenmediyse dünü gösteriyordur:
      // yanlış günü işaretlemek yerine önce güncel hâliyle yeniden çiz.
      const stale = typeof shownDay === 'string' && shownDay !== todayKey();
      if (clickAction === 'TOGGLE' && typeof clickActionData?.habitId === 'string' && !stale) {
        useHabitStore.getState().toggleToday(clickActionData.habitId);
        await flushStore();
      } else if (stale) {
        await store.refresh();
        await updateAllWidgets(useHabitStore.getState().data);
      }
      break;
    }

    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    default:
      // Uygulama kapalıyken gün değişmiş olabilir.
      store.setToday(todayKey());
      await store.refresh();
      break;
  }

  renderWidget(await renderFor(widgetInfo, useHabitStore.getState().data));
}

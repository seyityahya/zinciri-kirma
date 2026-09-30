import { useEffect } from 'react';
import { AppState } from 'react-native';

import { dayNow, useHabitStore } from '@/data/store';
import { nextDayBoundary } from '@/domain/dates';
import { scheduleReminderSync } from '@/notifications/reminders';
import { syncWidgets } from '@/widgets/sync';

/** Diskten tazele; widget'ları ve hatırlatmaları güncel güne göre yeniden kur. */
function refreshEverything() {
  useHabitStore.getState().setToday(dayNow());
  void useHabitStore
    .getState()
    .refresh()
    .then(() => {
      const { data, ready } = useHabitStore.getState();
      if (!ready) return;
      syncWidgets(data);
      scheduleReminderSync(data);
    });
}

/**
 * Uygulama açıkken gün değişimini (ayardaki saat, varsayılan 03:00) ve öne gelmeyi
 * takip eder; öne gelince widget'ın yaptığı değişiklikleri de diskten okur.
 */
export function useDayAndSync(): void {
  const dayStartHour = useHabitStore((s) => s.data.settings.dayStartHour);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      const wait = Math.max(1000, nextDayBoundary(now, dayStartHour).getTime() - now.getTime() + 500);
      timer = setTimeout(() => {
        refreshEverything();
        schedule();
      }, wait);
    };

    // Android'de JS ortamını widget önceden başlatmış olabilir; açılışta günü ve veriyi tazele.
    refreshEverything();
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshEverything();
        schedule();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [dayStartHour]);
}

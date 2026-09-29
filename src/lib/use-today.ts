import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useHabitStore } from '@/data/store';
import { nextLocalMidnight, todayKey } from '@/domain/dates';

/**
 * Uygulama açıkken gün değişimini (gece yarısı) ve öne gelmeyi takip eder;
 * öne gelince widget'ın yaptığı değişiklikleri de diskten okur.
 */
export function useDayAndSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      const wait = Math.max(1000, nextLocalMidnight(now).getTime() - now.getTime() + 500);
      timer = setTimeout(() => {
        useHabitStore.getState().setToday(todayKey());
        schedule();
      }, wait);
    };

    // Android'de JS ortamını widget önceden başlatmış olabilir; açılışta günü ve veriyi tazele.
    useHabitStore.getState().setToday(todayKey());
    void useHabitStore.getState().refresh();
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useHabitStore.getState().setToday(todayKey());
        void useHabitStore.getState().refresh();
        schedule();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);
}

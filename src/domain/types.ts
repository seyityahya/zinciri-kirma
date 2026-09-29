import type { DayKey, Weekday } from './dates';

/**
 * Bir zincirin ne sıklıkla yapılması gerektiği.
 * - days: haftanın belirli günleri (her gün = 7 gün, hafta içi = Pzt–Cum)
 * - interval: en geç her N günde bir (ör. 2 günde bir)
 * - weekly: her hafta (Pzt–Paz) en az N kez
 */
export type Schedule =
  | { kind: 'days'; days: Weekday[] }
  | { kind: 'interval'; every: number }
  | { kind: 'weekly'; times: number };

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  /** #RRGGBB */
  color: string;
  schedule: Schedule;
  /** Zincirin başladığı gün (oluşturulduğu gün). */
  startDate: DayKey;
  /** Yapıldığı günler — artan sırada ve tekrarsız. */
  completions: DayKey[];
  createdAt: number;
}

export interface AppData {
  version: 1;
  habits: Habit[];
  /** Son değişikliğin zamanı (ms). Uygulama ile widget arasındaki senkron için kullanılır. */
  updatedAt: number;
}

export const DATA_VERSION = 1 as const;

export const SCHEDULE_LIMITS = {
  intervalMin: 2,
  intervalMax: 30,
  weeklyMin: 1,
  weeklyMax: 7,
} as const;

export const NAME_MAX_LENGTH = 40;

export function emptyData(): AppData {
  return { version: DATA_VERSION, habits: [], updatedAt: 0 };
}

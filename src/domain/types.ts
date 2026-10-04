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

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

/** Widget'larla paylaşılan ayarlar (Swift: ZKSettings). */
export interface AppSettings {
  /** Gün bu saatte biter: 3 → gece 03:00'e kadar hâlâ önceki gün sayılır (0–6). */
  dayStartHour: number;
  /** Art arda 7 halkada 1 kaçırma affedilir. */
  grace: boolean;
  /** Akşam, bekleyen zincirler için tek bir hatırlatma. */
  reminder: ReminderSettings;
}

export interface AppData {
  version: 1;
  habits: Habit[];
  settings: AppSettings;
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

export const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6] as const;
export const GRACE_WINDOW = 7;

export function defaultSettings(): AppSettings {
  return { dayStartHour: 3, grace: true, reminder: { enabled: true, hour: 21, minute: 0 } };
}

export function emptyData(): AppData {
  return { version: DATA_VERSION, habits: [], settings: defaultSettings(), updatedAt: 0 };
}

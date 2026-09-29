import { addDays, type DayKey } from '../dates';
import type { Habit, Schedule } from '../types';

export const DAILY: Schedule = { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] };
export const WEEKDAYS: Schedule = { kind: 'days', days: [0, 1, 2, 3, 4] };

// 2026-09-28 Pazartesi … 2026-10-04 Pazar
export const MON = '2026-09-28';
export const TUE = '2026-09-29';
export const WED = '2026-09-30';
export const THU = '2026-10-01';
export const FRI = '2026-10-02';
export const SAT = '2026-10-03';
export const SUN = '2026-10-04';

export function habit(
  schedule: Schedule,
  completions: DayKey[],
  startDate: DayKey = completions.length > 0 ? [...completions].sort()[0] : '2026-01-01',
): Habit {
  return {
    id: 'h1',
    name: 'Test',
    emoji: '🔥',
    color: '#FF6B3D',
    schedule,
    startDate,
    completions: [...new Set(completions)].sort(),
    createdAt: 0,
  };
}

/** today'den geriye doğru offset listesi: back(T, 0, 1, 2) → [T, T-1, T-2] */
export function back(today: DayKey, ...offsets: number[]): DayKey[] {
  return offsets.map((o) => addDays(today, -o));
}

export function range(from: DayKey, count: number, step = 1): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i * step));
}

import { isValidDayKey, todayKey, type DayKey, type Weekday } from './dates';
import {
  type AppData,
  DATA_VERSION,
  emptyData,
  type Habit,
  NAME_MAX_LENGTH,
  type Schedule,
  SCHEDULE_LIMITS,
} from './types';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_COLOR = '#FF6B3D';
export const DEFAULT_EMOJI = '🔥';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSchedule(value: unknown): Schedule {
  const v = (value ?? {}) as Record<string, unknown>;
  switch (v.kind) {
    case 'interval':
      return {
        kind: 'interval',
        every: clampInt(v.every, SCHEDULE_LIMITS.intervalMin, SCHEDULE_LIMITS.intervalMax, 2),
      };
    case 'weekly':
      return {
        kind: 'weekly',
        times: clampInt(v.times, SCHEDULE_LIMITS.weeklyMin, SCHEDULE_LIMITS.weeklyMax, 1),
      };
    case 'days':
    default: {
      const raw = Array.isArray(v.days) ? v.days : [];
      const days = [...new Set(raw)]
        .filter((d): d is Weekday => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
        .sort((a, b) => a - b);
      return { kind: 'days', days: days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6] };
    }
  }
}

export function normalizeCompletions(value: unknown): DayKey[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isValidDayKey))].sort();
}

export function normalizeHabit(value: unknown, today: DayKey = todayKey()): Habit | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;
  const name = typeof v.name === 'string' ? v.name.trim().slice(0, NAME_MAX_LENGTH) : '';
  if (name.length === 0) return null;
  const completions = normalizeCompletions(v.completions);
  const startDate = isValidDayKey(v.startDate)
    ? v.startDate
    : (completions[0] ?? today);
  return {
    id: v.id,
    name,
    emoji: typeof v.emoji === 'string' && v.emoji.length > 0 ? v.emoji : DEFAULT_EMOJI,
    color: typeof v.color === 'string' && HEX_RE.test(v.color) ? v.color.toUpperCase() : DEFAULT_COLOR,
    schedule: normalizeSchedule(v.schedule),
    startDate,
    completions,
    createdAt: typeof v.createdAt === 'number' && Number.isFinite(v.createdAt) ? v.createdAt : 0,
  };
}

/** Saklanan (ya da widget'ın yazdığı) JSON'u güvenle AppData'ya çevirir. */
export function parseAppData(json: string | null | undefined): AppData | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const habits: Habit[] = [];
  const seen = new Set<string>();
  if (Array.isArray(v.habits)) {
    for (const item of v.habits) {
      const habit = normalizeHabit(item);
      if (habit && !seen.has(habit.id)) {
        seen.add(habit.id);
        habits.push(habit);
      }
    }
  }
  return {
    ...emptyData(),
    version: DATA_VERSION,
    habits,
    updatedAt: typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) ? v.updatedAt : 0,
  };
}

export function serializeAppData(data: AppData): string {
  return JSON.stringify(data);
}

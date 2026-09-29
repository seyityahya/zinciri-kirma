/**
 * AppData üzerinde saf (yan etkisiz) değişiklikler.
 * Her fonksiyon "mutlak" bir değişiklik tarif eder (ör. "şu gün yapıldı olsun"),
 * böylece aynı değişiklik diskteki güncel veriye tekrar uygulanabilir.
 */
import { type DayKey, compareDayKeys } from './dates';
import type { AppData, Habit, Schedule } from './types';
import { NAME_MAX_LENGTH } from './types';
import { normalizeSchedule } from './validate';

export interface HabitInput {
  name: string;
  emoji: string;
  color: string;
  schedule: Schedule;
}

export function generateId(now: number = Date.now()): string {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createHabit(input: HabitInput, today: DayKey, id: string, now: number): Habit {
  return {
    id,
    name: input.name.trim().slice(0, NAME_MAX_LENGTH),
    emoji: input.emoji,
    color: input.color.toUpperCase(),
    schedule: normalizeSchedule(input.schedule),
    startDate: today,
    completions: [],
    createdAt: now,
  };
}

export function addHabit(data: AppData, habit: Habit): AppData {
  if (data.habits.some((h) => h.id === habit.id)) return data;
  return { ...data, habits: [...data.habits, habit] };
}

export function updateHabit(data: AppData, id: string, input: HabitInput): AppData {
  let changed = false;
  const habits = data.habits.map((h) => {
    if (h.id !== id) return h;
    changed = true;
    return {
      ...h,
      name: input.name.trim().slice(0, NAME_MAX_LENGTH),
      emoji: input.emoji,
      color: input.color.toUpperCase(),
      schedule: normalizeSchedule(input.schedule),
    };
  });
  return changed ? { ...data, habits } : data;
}

export function deleteHabit(data: AppData, id: string): AppData {
  const habits = data.habits.filter((h) => h.id !== id);
  return habits.length === data.habits.length ? data : { ...data, habits };
}

export function setCompletion(
  data: AppData,
  id: string,
  day: DayKey,
  done: boolean,
  today: DayKey,
): AppData {
  if (compareDayKeys(day, today) > 0) return data;
  let changed = false;
  const habits = data.habits.map((h) => {
    if (h.id !== id) return h;
    const has = h.completions.includes(day);
    if (has === done) return h;
    changed = true;
    const completions = done
      ? [...h.completions, day].sort()
      : h.completions.filter((c) => c !== day);
    return { ...h, completions };
  });
  return changed ? { ...data, habits } : data;
}

/** Zincirleri verilen id sırasına göre dizer; listede olmayanlar sona eklenir. */
export function reorderHabits(data: AppData, orderedIds: string[]): AppData {
  const index = new Map(orderedIds.map((id, i) => [id, i]));
  const habits = [...data.habits].sort((a, b) => {
    const ia = index.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const ib = index.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  const same = habits.every((h, i) => h === data.habits[i]);
  return same ? data : { ...data, habits };
}

export function moveHabit(data: AppData, id: string, delta: -1 | 1): AppData {
  const i = data.habits.findIndex((h) => h.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= data.habits.length) return data;
  const habits = [...data.habits];
  [habits[i], habits[j]] = [habits[j], habits[i]];
  return { ...data, habits };
}

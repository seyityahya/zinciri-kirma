/**
 * Akşam hatırlatmalarının planı (saf fonksiyon).
 * Swift karşılığı: targets/widget/ChainLogic.swift → ReminderPlanner.plan — iOS widget'ı
 * "Yaptım"a basıldığında aynı planı yeniden kurar. İkisi parite testinde karşılaştırılır.
 */
import { addDays, type DayKey, logicalDayKey, parseDayKey } from '@/domain/dates';
import { reminderContent } from '@/domain/labels';
import { computeStatus } from '@/domain/streak';
import type { AppData } from '@/domain/types';

export const REMINDER_PREFIX = 'zk-reminder-';
export const REMINDER_DAYS = 14;

export interface PlannedReminder {
  id: string;
  day: DayKey;
  /** Bildirimin gönderileceği an (ms). */
  at: number;
  title: string;
  body: string;
}

/** Mantıksal `day` için hatırlatma anı. Saat gün bitişinden önceyse ertesi takvim gününe düşer. */
export function reminderTime(day: DayKey, hour: number, minute: number, dayStartHour: number): Date {
  const { year, month, day: d } = parseDayKey(day);
  return new Date(year, month - 1, d + (hour < dayStartHour ? 1 : 0), hour, minute, 0, 0);
}

export function planReminders(data: AppData, now: Date): PlannedReminder[] {
  const { reminder, dayStartHour, grace } = data.settings;
  if (!reminder.enabled || data.habits.length === 0) return [];
  const today = logicalDayKey(now, dayStartHour);
  const out: PlannedReminder[] = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const day = addDays(today, i);
    const at = reminderTime(day, reminder.hour, reminder.minute, dayStartHour).getTime();
    if (at <= now.getTime()) continue;
    const content = reminderContent(
      data.habits.map((h) => ({ name: h.name, emoji: h.emoji, schedule: h.schedule, status: computeStatus(h, day, grace) })),
    );
    if (content) out.push({ id: `${REMINDER_PREFIX}${day}`, day, at, ...content });
  }
  return out;
}

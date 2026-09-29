/**
 * Türkçe metinler. iOS widget'ı aynı metinleri Swift tarafında üretir
 * (targets/widget/ChainLogic.swift) — değişiklikleri iki tarafa da yansıtın.
 */
import { type DayKey, diffDays, parseDayKey, weekdayOf, type Weekday } from './dates';
import type { HabitStatus, StreakUnit } from './streak';
import type { Schedule } from './types';

export const WEEKDAY_NAMES = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const;

export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
export const WEEKDAY_LETTER = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'] as const;

export const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WORK_DAYS: Weekday[] = [0, 1, 2, 3, 4];
export const WEEKEND_DAYS: Weekday[] = [5, 6];

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function scheduleLabel(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'days': {
      const days = [...schedule.days].sort((a, b) => a - b);
      if (days.length === 7) return 'Her gün';
      if (sameDays(days, WORK_DAYS)) return 'Hafta içi her gün';
      if (sameDays(days, WEEKEND_DAYS)) return 'Hafta sonları';
      if (days.length === 1) return `Her ${WEEKDAY_NAMES[days[0]]}`;
      return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    }
    case 'interval':
      return `${schedule.every} günde bir`;
    case 'weekly':
      return schedule.times === 1 ? 'Haftada bir' : `Haftada ${schedule.times} kez`;
  }
}

export function unitLabel(unit: StreakUnit): string {
  switch (unit) {
    case 'day':
      return 'gün';
    case 'week':
      return 'hafta';
    case 'time':
      return 'kez';
  }
}

/** "12 günlük zincir", "3 haftalık zincir", "5 halkalık zincir" */
export function chainLengthLabel(unit: StreakUnit): string {
  switch (unit) {
    case 'day':
      return 'günlük zincir';
    case 'week':
      return 'haftalık zincir';
    case 'time':
      return 'halkalık zincir';
  }
}

/** Bugünden sonraki bir gün için kısa ifade: "yarın", "Çarşamba", "12 Ekim". */
export function relativeDayLabel(day: DayKey, today: DayKey): string {
  const diff = diffDays(day, today);
  if (diff === 0) return 'bugün';
  if (diff === 1) return 'yarın';
  if (diff > 1 && diff < 7) return WEEKDAY_NAMES[weekdayOf(day)];
  const { day: d, month } = parseDayKey(day);
  return `${d} ${MONTH_NAMES[month - 1]}`;
}

/** Kartlarda ve widget'ta gösterilen tek satırlık durum metni. */
export function statusText(schedule: Schedule, status: HabitStatus, today: DayKey): string {
  switch (schedule.kind) {
    case 'days': {
      if (status.doneToday) {
        return status.scheduledToday ? 'Bugün tamamlandı' : 'İzin gününde ekstra halka';
      }
      if (!status.scheduledToday) {
        return status.nextDue
          ? `Bugün izin günü · sıradaki ${relativeDayLabel(status.nextDue, today)}`
          : 'Bugün izin günü';
      }
      if (status.state === 'pending') return 'Zinciri korumak için bugün yap';
      if (status.state === 'broken') return 'Zincir kırıldı · bugün yeniden başla';
      return 'İlk halkayı bugün ekle';
    }
    case 'interval': {
      if (status.doneToday) return 'Bugün tamamlandı';
      if (status.state === 'broken') return 'Zincir kırıldı · yeniden başla';
      if (status.state === 'new') return 'İlk halkayı ekle';
      if (status.dueToday) return 'Bugün son gün!';
      const left = status.nextDue ? diffDays(status.nextDue, today) : 0;
      return left === 1 ? 'En geç yarın yap' : `En geç ${left} gün içinde yap`;
    }
    case 'weekly': {
      const week = status.week ?? { done: 0, target: schedule.times, daysLeft: 0 };
      const progress = `Bu hafta ${week.done}/${week.target}`;
      const needed = week.target - week.done;
      if (needed <= 0) return `${progress} · hedef tamam`;
      if (status.weekLost) return `${progress} · hedef kaçtı`;
      if (status.dueToday) return `${progress} · bugün şart`;
      if (status.state === 'broken' && week.done === 0) return 'Zincir kırıldı · bu hafta yeniden başla';
      return `${progress} · ${needed} kez daha`;
    }
  }
}

/** Widget'lar için kısa durum (Swift: ZKText.shortStatus). */
export function shortStatus(schedule: Schedule, status: HabitStatus, today: DayKey): string {
  if (status.doneToday) return 'Tamamlandı';
  switch (schedule.kind) {
    case 'days':
      if (!status.scheduledToday) return 'İzin günü';
      if (status.state === 'broken') return 'Zincir kırıldı';
      return status.state === 'pending' ? 'Bugün yap' : 'Başla';
    case 'interval': {
      if (status.state === 'broken') return 'Zincir kırıldı';
      if (status.state === 'new') return 'Başla';
      if (status.dueToday) return 'Bugün son gün';
      const left = status.nextDue ? diffDays(status.nextDue, today) : 0;
      return left === 1 ? 'En geç yarın' : `${left} gün süren var`;
    }
    case 'weekly': {
      const week = status.week ?? { done: 0, target: 1, daysLeft: 0 };
      return `Bu hafta ${week.done}/${week.target}`;
    }
  }
}

/** "Salı, 29 Eylül" */
export function longDateLabel(day: DayKey): string {
  const { day: d, month } = parseDayKey(day);
  return `${WEEKDAY_NAMES[weekdayOf(day)]}, ${d} ${MONTH_NAMES[month - 1]}`;
}

/** "29 Eylül 2026" */
export function fullDateLabel(day: DayKey): string {
  const { year, day: d, month } = parseDayKey(day);
  return `${d} ${MONTH_NAMES[month - 1]} ${year}`;
}

/** Kısa açıklama: sıklığın ne anlama geldiği. */
export function scheduleExplanation(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'days': {
      const days = [...schedule.days].sort((a, b) => a - b);
      if (days.length === 7) return 'Her gün bir halka ekle. Bir gün bile atlarsan zincir kırılır.';
      if (days.length === 0) return 'En az bir gün seç.';
      const names = sameDays(days, WORK_DAYS)
        ? 'hafta içi günlerde'
        : sameDays(days, WEEKEND_DAYS)
          ? 'hafta sonları'
          : `${days.map((d) => WEEKDAY_NAMES[d]).join(', ')} günleri`;
      return `Sadece ${names} yapman gerekir. Diğer günler zinciri kırmaz.`;
    }
    case 'interval':
      return `Her yaptığında ${schedule.every} günlük süren yeniden başlar. ${schedule.every} gün içinde tekrar yapmazsan zincir kırılır.`;
    case 'weekly':
      return `Pazartesi–Pazar arasında istediğin ${schedule.times === 1 ? 'bir gün' : `${schedule.times} gün`} yap. Hedefi tutturamadığın hafta zincir kırılır.`;
  }
}

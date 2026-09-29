/**
 * Zincir (seri) hesaplamaları.
 *
 * ÖNEMLİ: Bu dosyanın mantığı iOS widget'ında Swift'e birebir taşındı
 * (targets/widget/ChainLogic.swift). Burada bir kural değişirse orayı da
 * güncelleyin; `npm run test:swift` iki tarafın aynı sonucu verdiğini doğrular.
 */
import {
  type DayKey,
  fromEpochDay,
  toEpochDay,
  weekdayOfEpochDay,
  weekStartOfEpochDay,
} from './dates';
import type { Habit, Schedule } from './types';

export type ChainState = 'new' | 'active' | 'pending' | 'broken';
export type StreakUnit = 'day' | 'week' | 'time';

export interface WeekProgress {
  done: number;
  target: number;
  /** Bugün dahil haftanın kalan günleri. */
  daysLeft: number;
}

export interface HabitStatus {
  /** Kırılmamış mevcut zincirin uzunluğu (birimi `unit`). */
  streak: number;
  /** Bugüne kadarki en uzun zincir. */
  best: number;
  /** Toplam kaç kez yapıldı. */
  total: number;
  unit: StreakUnit;
  doneToday: boolean;
  /** Bugün planlı bir gün mü? (interval/weekly için her zaman true) */
  scheduledToday: boolean;
  /** Zinciri korumak için bugün yapılması şart ve henüz yapılmadı. */
  dueToday: boolean;
  state: ChainState;
  /** Mevcut zincirin başladığı gün. */
  chainStart: DayKey | null;
  /** days: bugünden sonraki ilk planlı gün, interval: en geç yapılması gereken gün. */
  nextDue: DayKey | null;
  week: WeekProgress | null;
  /** weekly: bu hafta hedefe ulaşmak artık mümkün değil. */
  weekLost: boolean;
  /** 0–1 arası başarı oranı; hesaplanamıyorsa null. */
  successRate: number | null;
}

export type SlotState = 'done' | 'missed' | 'pending' | 'empty';

export interface ChainSlot {
  key: string;
  state: SlotState;
  /** Haftalık zincirlerde o haftanın ilerlemesi (0–1). */
  progress?: number;
}

export type CalendarDayState = 'done' | 'missed' | 'rest' | 'today' | 'future' | 'none';

interface Prepared {
  today: number;
  /** Bugüne kadarki (bugün dahil) tamamlanan günler, artan. */
  days: number[];
  set: Set<number>;
  /** İlk tamamlanan gün (yoksa +∞). */
  first: number;
  /** Zincirin başladığı gün ile ilk tamamlanan günün küçüğü. */
  origin: number;
}

function prepare(habit: Habit, today: DayKey): Prepared {
  const t = toEpochDay(today);
  const days: number[] = [];
  for (const key of habit.completions) {
    const d = toEpochDay(key);
    if (d <= t) days.push(d);
  }
  days.sort((a, b) => a - b);
  const unique = days.filter((d, i) => i === 0 || d !== days[i - 1]);
  const first = unique.length > 0 ? unique[0] : Number.POSITIVE_INFINITY;
  const start = Math.min(toEpochDay(habit.startDate), t);
  return { today: t, days: unique, set: new Set(unique), first, origin: Math.min(start, first) };
}

function unitOf(schedule: Schedule): StreakUnit {
  switch (schedule.kind) {
    case 'days':
      return 'day';
    case 'weekly':
      return 'week';
    case 'interval':
      return 'time';
  }
}

function stateOf(streak: number, best: number, dueToday: boolean): ChainState {
  if (streak > 0) return dueToday ? 'pending' : 'active';
  return best > 0 ? 'broken' : 'new';
}

// ---------------------------------------------------------------------------
// Haftanın belirli günleri
// ---------------------------------------------------------------------------

function daysStatus(habit: Habit, schedule: { days: number[] }, p: Prepared): HabitStatus {
  const planned = new Set(schedule.days);
  const isPlanned = (d: number) => planned.has(weekdayOfEpochDay(d));
  const t = p.today;

  let streak = 0;
  let chainStart: number | null = null;
  for (let d = t; d >= p.first; d--) {
    if (!isPlanned(d)) continue;
    if (p.set.has(d)) {
      streak++;
      chainStart = d;
    } else if (d !== t) {
      break;
    }
  }

  let best = 0;
  let run = 0;
  for (let d = p.first; d <= t; d++) {
    if (!isPlanned(d)) continue;
    if (p.set.has(d)) {
      run++;
      if (run > best) best = run;
    } else if (d !== t) {
      run = 0;
    }
  }

  // Başarı oranı: başlangıçtan bugüne planlı günlerin kaçı yapıldı (bugün henüz
  // yapılmadıysa sayılmaz).
  let plannedCount = 0;
  let doneCount = 0;
  if (Number.isFinite(p.origin)) {
    for (let d = p.origin; d <= t; d++) {
      if (!isPlanned(d)) continue;
      const done = p.set.has(d);
      if (d === t && !done) continue;
      plannedCount++;
      if (done) doneCount++;
    }
  }

  let nextDue: number | null = null;
  if (planned.size > 0) {
    for (let d = t + 1; d <= t + 7; d++) {
      if (isPlanned(d)) {
        nextDue = d;
        break;
      }
    }
  }

  const doneToday = p.set.has(t);
  const scheduledToday = isPlanned(t);
  const dueToday = scheduledToday && !doneToday;

  return {
    streak,
    best,
    total: p.days.length,
    unit: 'day',
    doneToday,
    scheduledToday,
    dueToday,
    state: stateOf(streak, best, dueToday),
    chainStart: chainStart === null ? null : fromEpochDay(chainStart),
    nextDue: nextDue === null ? null : fromEpochDay(nextDue),
    week: null,
    weekLost: false,
    successRate: plannedCount > 0 ? doneCount / plannedCount : null,
  };
}

// ---------------------------------------------------------------------------
// N günde bir
// ---------------------------------------------------------------------------

function intervalStatus(every: number, p: Prepared): HabitStatus {
  const t = p.today;
  const list = p.days;
  const n = list.length;

  let best = 0;
  let run = 0;
  for (let i = 0; i < n; i++) {
    run = i > 0 && list[i] - list[i - 1] <= every ? run + 1 : 1;
    if (run > best) best = run;
  }

  let streak = 0;
  let chainStart: number | null = null;
  let nextDue: number | null = null;
  const last = n > 0 ? list[n - 1] : null;
  const alive = last !== null && t - last <= every;
  if (alive) {
    streak = 1;
    let i = n - 1;
    while (i > 0 && list[i] - list[i - 1] <= every) {
      streak++;
      i--;
    }
    chainStart = list[i];
    nextDue = (last as number) + every;
  }

  const doneToday = last === t;
  const dueToday = alive && !doneToday && nextDue === t;

  return {
    streak,
    best,
    total: n,
    unit: 'time',
    doneToday,
    scheduledToday: true,
    dueToday,
    state: stateOf(streak, best, dueToday),
    chainStart: chainStart === null ? null : fromEpochDay(chainStart),
    nextDue: nextDue === null ? null : fromEpochDay(nextDue),
    week: null,
    weekLost: false,
    successRate: null,
  };
}

// ---------------------------------------------------------------------------
// Haftada N kez
// ---------------------------------------------------------------------------

interface WeeklyContext {
  times: number;
  startWeek: number;
  startWeekday: number;
  p: Prepared;
}

function weekCount(ctx: WeeklyContext, weekStart: number): number {
  let count = 0;
  for (let d = weekStart; d < weekStart + 7 && d <= ctx.p.today; d++) {
    if (ctx.p.set.has(d)) count++;
  }
  return count;
}

/** Zincirin başladığı hafta yarım kalabileceği için hedef kalan gün sayısıyla sınırlanır. */
function weekTarget(ctx: WeeklyContext, weekStart: number): number {
  if (weekStart === ctx.startWeek) return Math.min(ctx.times, 7 - ctx.startWeekday);
  return ctx.times;
}

function weekSatisfied(ctx: WeeklyContext, weekStart: number): boolean {
  return weekCount(ctx, weekStart) >= weekTarget(ctx, weekStart);
}

function weeklyStatus(habit: Habit, times: number, p: Prepared): HabitStatus {
  const t = p.today;
  const start = Math.min(toEpochDay(habit.startDate), t);
  const ctx: WeeklyContext = {
    times,
    startWeek: weekStartOfEpochDay(start),
    startWeekday: weekdayOfEpochDay(start),
    p,
  };
  const current = weekStartOfEpochDay(t);

  let streak = 0;
  let chainStart: number | null = null;
  if (weekSatisfied(ctx, current)) {
    streak = 1;
    chainStart = current;
  }
  for (let w = current - 7; w + 6 >= p.first; w -= 7) {
    if (!weekSatisfied(ctx, w)) break;
    streak++;
    chainStart = w;
  }

  let best = 0;
  let run = 0;
  let weeksCounted = 0;
  let weeksDone = 0;
  if (Number.isFinite(p.first)) {
    for (let w = weekStartOfEpochDay(p.first); w <= current; w += 7) {
      const ok = weekSatisfied(ctx, w);
      if (ok) {
        run++;
        if (run > best) best = run;
      } else if (w !== current) {
        run = 0;
      }
    }
  }
  if (Number.isFinite(p.origin)) {
    for (let w = weekStartOfEpochDay(p.origin); w <= current; w += 7) {
      const ok = weekSatisfied(ctx, w);
      if (w === current && !ok) continue;
      weeksCounted++;
      if (ok) weeksDone++;
    }
  }

  const done = weekCount(ctx, current);
  const target = weekTarget(ctx, current);
  const doneToday = p.set.has(t);
  const weekday = weekdayOfEpochDay(t);
  const needed = Math.max(0, target - done);
  const available = doneToday ? 6 - weekday : 7 - weekday;
  const weekLost = needed > available;
  const dueToday = !doneToday && needed > 0 && needed === available;

  return {
    streak,
    best,
    total: p.days.length,
    unit: 'week',
    doneToday,
    scheduledToday: true,
    dueToday,
    state: stateOf(streak, best, dueToday),
    chainStart: chainStart === null ? null : fromEpochDay(chainStart),
    nextDue: null,
    week: { done, target, daysLeft: 7 - weekday },
    weekLost,
    successRate: weeksCounted > 0 ? weeksDone / weeksCounted : null,
  };
}

// ---------------------------------------------------------------------------
// Genel API
// ---------------------------------------------------------------------------

export function computeStatus(habit: Habit, today: DayKey): HabitStatus {
  const p = prepare(habit, today);
  const s = habit.schedule;
  switch (s.kind) {
    case 'days':
      return daysStatus(habit, s, p);
    case 'interval':
      return intervalStatus(s.every, p);
    case 'weekly':
      return weeklyStatus(habit, s.times, p);
  }
}

/**
 * Bu zincir bugünün "yapılacaklar" sayısına girer mi? (Özet halkası ve Bugün widget'ı)
 * - Bugün yapıldıysa her zaman.
 * - Belirli günler: bugün planlı bir günse.
 * - Haftada N kez: bu haftanın hedefi henüz tutmadıysa (ve hâlâ tutturulabiliyorsa).
 * - N günde bir: süre bugün doluyorsa ya da zincir yeni/kırık olduğu için başlanması gerekiyorsa.
 */
export function countsToday(schedule: Schedule, status: HabitStatus): boolean {
  if (status.doneToday) return true;
  switch (schedule.kind) {
    case 'days':
      return status.scheduledToday;
    case 'weekly':
      return status.week !== null && status.week.done < status.week.target && !status.weekLost;
    case 'interval':
      return status.dueToday || status.state === 'new' || status.state === 'broken';
  }
}

/** Zincirin kaç gündür sürdüğü (birimlerden bağımsız karşılaştırma için). */
export function chainAgeDays(status: HabitStatus, today: DayKey): number {
  return status.chainStart ? toEpochDay(today) - toEpochDay(status.chainStart) + 1 : 0;
}

export function streakUnit(schedule: Schedule): StreakUnit {
  return unitOf(schedule);
}

/**
 * Zincir görseli için son `count` halka (eskiden yeniye).
 */
export function recentSlots(habit: Habit, today: DayKey, count: number): ChainSlot[] {
  const p = prepare(habit, today);
  const t = p.today;
  const s = habit.schedule;
  const slots: ChainSlot[] = [];

  if (s.kind === 'days') {
    const planned = new Set<number>(s.days);
    for (let d = t; slots.length < count && d > t - count * 7 - 7; d--) {
      if (!planned.has(weekdayOfEpochDay(d))) continue;
      let state: SlotState;
      if (d === t) state = p.set.has(d) ? 'done' : 'pending';
      else if (p.set.has(d)) state = 'done';
      else if (d < p.origin) state = 'empty';
      else state = 'missed';
      slots.push({ key: fromEpochDay(d), state });
    }
    slots.reverse();
  } else if (s.kind === 'weekly') {
    const start = Math.min(toEpochDay(habit.startDate), t);
    const ctx: WeeklyContext = {
      times: s.times,
      startWeek: weekStartOfEpochDay(start),
      startWeekday: weekdayOfEpochDay(start),
      p,
    };
    const current = weekStartOfEpochDay(t);
    const originWeek = Number.isFinite(p.origin) ? weekStartOfEpochDay(p.origin) : current;
    for (let i = count - 1; i >= 0; i--) {
      const w = current - i * 7;
      const target = weekTarget(ctx, w);
      const progress = Math.min(1, weekCount(ctx, w) / target);
      let state: SlotState;
      if (w < originWeek) state = 'empty';
      else if (progress >= 1) state = 'done';
      else if (w === current) state = 'pending';
      else state = 'missed';
      slots.push({ key: fromEpochDay(w), state, progress });
    }
  } else {
    const every = s.every;
    const list = p.days;
    const seq: ChainSlot[] = [];
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i] - list[i - 1] > every) {
        seq.push({ key: `miss-${fromEpochDay(list[i - 1] + every + 1)}`, state: 'missed' });
      }
      seq.push({ key: fromEpochDay(list[i]), state: 'done' });
    }
    const last = list.length > 0 ? list[list.length - 1] : null;
    if (last === null) {
      seq.push({ key: 'next', state: 'pending' });
    } else if (t - last > every) {
      seq.push({ key: `miss-${fromEpochDay(last + every + 1)}`, state: 'missed' });
      seq.push({ key: 'next', state: 'pending' });
    } else if (last !== t) {
      seq.push({ key: 'next', state: 'pending' });
    }
    slots.push(...seq.slice(-count));
  }

  let pad = 0;
  while (slots.length < count) {
    slots.unshift({ key: `empty-${pad++}`, state: 'empty' });
  }
  return slots;
}

/** Takvimde bir günün nasıl görüneceği. */
export function calendarDayState(habit: Habit, day: DayKey, today: DayKey): CalendarDayState {
  const d = toEpochDay(day);
  const t = toEpochDay(today);
  if (d > t) return 'future';
  const done = habit.completions.includes(day);
  if (done) return 'done';
  const s = habit.schedule;
  if (s.kind === 'days') {
    if (!s.days.includes(weekdayOfEpochDay(d))) return 'rest';
    if (d === t) return 'today';
    const first = habit.completions.length > 0 ? toEpochDay(habit.completions[0]) : Infinity;
    const origin = Math.min(toEpochDay(habit.startDate), first);
    return d < origin ? 'none' : 'missed';
  }
  return d === t ? 'today' : 'none';
}

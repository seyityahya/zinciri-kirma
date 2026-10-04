/**
 * Zincir (seri) hesaplamaları.
 *
 * ÖNEMLİ: Bu dosyanın mantığı iOS widget'ında Swift'e birebir taşındı
 * (targets/widget/ChainLogic.swift). Burada bir kural değişirse orayı da
 * güncelleyin; `npm run test:swift` iki tarafın aynı sonucu verdiğini doğrular.
 *
 * Yöntem: her sıklık türü için "beklenen halkalar" (occurrence) sırası çıkarılır
 * — yapıldı / kaçırıldı / bekliyor — sonra bu sıra baştan sona değerlendirilir.
 * Hata payı açıksa, art arda 7 halkada en fazla 1 kaçırmaya izin verilir
 * (iki kaçırma arasında en az 7 halka olmalı); bu kaçırmalar "affedilmiş" sayılır.
 */
import {
  type DayKey,
  fromEpochDay,
  toEpochDay,
  weekdayOfEpochDay,
  weekStartOfEpochDay,
} from './dates';
import { GRACE_WINDOW, type Habit, type Schedule } from './types';

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
  /** Hata payı açık ve zincir sürerken yakın zamanda kullanıldı: bir kaçırma daha zinciri kırar. */
  graceUsed: boolean;
  /** Hata payının yeniden kullanılabilmesi için gereken halka sayısı (kullanıldıysa). */
  graceRenewIn: number | null;
  /** Hata payı açık, zincir sürüyor ve şu an bir kaçırmayı affedebilir. */
  graceAvailable: boolean;
}

export type SlotState = 'done' | 'missed' | 'forgiven' | 'pending' | 'empty';

export interface ChainSlot {
  key: string;
  state: SlotState;
  /** Haftalık zincirlerde o haftanın ilerlemesi (0–1). */
  progress?: number;
}

export type CalendarDayState = 'done' | 'missed' | 'forgiven' | 'rest' | 'today' | 'future' | 'none';

// ---------------------------------------------------------------------------
// Hazırlık
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Beklenen halkalar ve değerlendirme
// ---------------------------------------------------------------------------

type OccState = 'done' | 'miss' | 'pending';

interface Occurrence {
  state: OccState;
  /** days: gün, weekly: hafta başı, interval: yapılış ya da son gün. */
  day: number;
}

interface Evaluation {
  occ: Occurrence[];
  /** Kaçırmaların sonucu: affedildi mi, zinciri mi kırdı? */
  missKind: Map<number, 'forgiven' | 'broken'>;
  /** Mevcut zincirdeki yapılan halka sayısı. */
  run: number;
  bestRun: number;
  chainStartIdx: number | null;
  lastMissIdx: number | null;
  everDone: boolean;
  /** Bir sonraki olası kaçırmanın sırası (ilk bekleyen halka ya da sonrası). */
  nextIdx: number;
}

function evaluate(occ: Occurrence[], grace: boolean): Evaluation {
  const missKind = new Map<number, 'forgiven' | 'broken'>();
  let run = 0;
  let bestRun = 0;
  let chainStartIdx: number | null = null;
  let lastMissIdx: number | null = null;
  let everDone = false;
  let nextIdx = -1;

  for (let i = 0; i < occ.length; i++) {
    const o = occ[i];
    if (o.state === 'done') {
      if (run === 0) chainStartIdx = i;
      run++;
      everDone = true;
      if (run > bestRun) bestRun = run;
    } else if (o.state === 'miss') {
      const forgivable = grace && run > 0 && (lastMissIdx === null || i - lastMissIdx >= GRACE_WINDOW);
      if (forgivable) {
        missKind.set(i, 'forgiven');
      } else {
        missKind.set(i, 'broken');
        run = 0;
        chainStartIdx = null;
      }
      lastMissIdx = i;
    } else if (nextIdx < 0) {
      nextIdx = i;
    }
  }
  return {
    occ,
    missKind,
    run,
    bestRun,
    chainStartIdx,
    lastMissIdx,
    everDone,
    nextIdx: nextIdx < 0 ? occ.length : nextIdx,
  };
}

function graceInfo(
  ev: Evaluation,
  grace: boolean,
): { graceUsed: boolean; graceRenewIn: number | null; graceAvailable: boolean } {
  if (!grace || ev.run === 0) return { graceUsed: false, graceRenewIn: null, graceAvailable: false };
  const distance = ev.lastMissIdx === null ? GRACE_WINDOW : ev.nextIdx - ev.lastMissIdx;
  if (distance >= GRACE_WINDOW) return { graceUsed: false, graceRenewIn: null, graceAvailable: true };
  return { graceUsed: true, graceRenewIn: GRACE_WINDOW - distance, graceAvailable: false };
}

function stateOf(alive: boolean, everDone: boolean, dueToday: boolean): ChainState {
  if (alive) return dueToday ? 'pending' : 'active';
  return everDone ? 'broken' : 'new';
}

// ---------------------------------------------------------------------------
// Haftanın belirli günleri
// ---------------------------------------------------------------------------

function daysOccurrences(isPlanned: (d: number) => boolean, p: Prepared): Occurrence[] {
  const out: Occurrence[] = [];
  const t = p.today;
  if (!Number.isFinite(p.first)) {
    if (isPlanned(t)) out.push({ state: 'pending', day: t });
    return out;
  }
  for (let d = p.first; d <= t; d++) {
    if (!isPlanned(d)) continue;
    if (p.set.has(d)) out.push({ state: 'done', day: d });
    else out.push({ state: d === t ? 'pending' : 'miss', day: d });
  }
  return out;
}

function daysStatus(schedule: { days: number[] }, p: Prepared, grace: boolean): HabitStatus {
  const planned = new Set(schedule.days);
  const isPlanned = (d: number) => planned.has(weekdayOfEpochDay(d));
  const t = p.today;
  const ev = evaluate(daysOccurrences(isPlanned, p), grace);

  // Başarı oranı: başlangıçtan bugüne planlı günlerin kaçı yapıldı (bugün henüz
  // yapılmadıysa sayılmaz).
  let plannedCount = 0;
  let doneCount = 0;
  for (let d = p.origin; d <= t; d++) {
    if (!isPlanned(d)) continue;
    const done = p.set.has(d);
    if (d === t && !done) continue;
    plannedCount++;
    if (done) doneCount++;
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
  const alive = ev.run > 0;

  return {
    streak: ev.run,
    best: ev.bestRun,
    total: p.days.length,
    unit: 'day',
    doneToday,
    scheduledToday,
    dueToday,
    state: stateOf(alive, ev.everDone, dueToday),
    chainStart: ev.chainStartIdx === null ? null : fromEpochDay(ev.occ[ev.chainStartIdx].day),
    nextDue: nextDue === null ? null : fromEpochDay(nextDue),
    week: null,
    weekLost: false,
    successRate: plannedCount > 0 ? doneCount / plannedCount : null,
    ...graceInfo(ev, grace),
  };
}

// ---------------------------------------------------------------------------
// N günde bir
// ---------------------------------------------------------------------------

function intervalOccurrences(every: number, p: Prepared): Occurrence[] {
  const out: Occurrence[] = [];
  const list = p.days;
  const t = p.today;
  for (let i = 0; i < list.length; i++) {
    if (i > 0) {
      const gap = list[i] - list[i - 1];
      const misses = gap > every ? Math.ceil(gap / every) - 1 : 0;
      for (let k = 1; k <= misses; k++) out.push({ state: 'miss', day: list[i - 1] + k * every });
    }
    out.push({ state: 'done', day: list[i] });
  }
  if (list.length === 0) {
    out.push({ state: 'pending', day: t });
    return out;
  }
  const last = list[list.length - 1];
  const elapsed = t - last;
  if (elapsed > 0) {
    const misses = Math.ceil(elapsed / every) - 1;
    for (let k = 1; k <= misses; k++) out.push({ state: 'miss', day: last + k * every });
    out.push({ state: 'pending', day: last + (misses + 1) * every });
  }
  return out;
}

function intervalStatus(every: number, p: Prepared, grace: boolean): HabitStatus {
  const t = p.today;
  const ev = evaluate(intervalOccurrences(every, p), grace);
  const list = p.days;
  const last = list.length > 0 ? list[list.length - 1] : null;
  const doneToday = last === t;
  const alive = ev.run > 0;

  let nextDue: number | null = null;
  if (alive && last !== null) {
    if (doneToday) nextDue = t + every;
    else {
      const pending = ev.occ[ev.occ.length - 1];
      nextDue = pending && pending.state === 'pending' ? pending.day : last + every;
    }
  }
  const dueToday = alive && !doneToday && nextDue === t;

  return {
    streak: ev.run,
    best: ev.bestRun,
    total: list.length,
    unit: 'time',
    doneToday,
    scheduledToday: true,
    dueToday,
    state: stateOf(alive, ev.everDone, dueToday),
    chainStart: ev.chainStartIdx === null ? null : fromEpochDay(ev.occ[ev.chainStartIdx].day),
    nextDue: nextDue === null ? null : fromEpochDay(nextDue),
    week: null,
    weekLost: false,
    successRate: null,
    ...graceInfo(ev, grace),
  };
}

// ---------------------------------------------------------------------------
// Haftada N kez
// ---------------------------------------------------------------------------

interface WeekInfo {
  start: number;
  target: number;
  count: number;
  /** Bu haftanın halkalarının `occ` içindeki aralığı [from, to). */
  from: number;
  to: number;
}

interface WeeklyModel {
  occ: Occurrence[];
  weeks: WeekInfo[];
  /** İlk yapılan haftanın başı (yoksa bu hafta). */
  firstWeek: number;
}

function weekCount(p: Prepared, weekStart: number): number {
  let count = 0;
  for (let d = weekStart; d < weekStart + 7 && d <= p.today; d++) {
    if (p.set.has(d)) count++;
  }
  return count;
}

/** Zincir ilk yapıldığı gün başlar; o hafta yarım kalabileceği için hedef kalan günlerle sınırlanır. */
function weeklyModel(times: number, p: Prepared): WeeklyModel {
  const t = p.today;
  const current = weekStartOfEpochDay(t);
  const startDay = Number.isFinite(p.first) ? p.first : t;
  const firstWeek = weekStartOfEpochDay(startDay);
  const occ: Occurrence[] = [];
  const weeks: WeekInfo[] = [];
  for (let w = firstWeek; w <= current; w += 7) {
    const target = w === firstWeek ? Math.min(times, 7 - weekdayOfEpochDay(startDay)) : times;
    const count = Math.min(weekCount(p, w), target);
    const from = occ.length;
    for (let i = 0; i < count; i++) occ.push({ state: 'done', day: w });
    for (let i = count; i < target; i++) occ.push({ state: w < current ? 'miss' : 'pending', day: w });
    weeks.push({ start: w, target, count, from, to: occ.length });
  }
  return { occ, weeks, firstWeek };
}

function weekVerdict(ev: Evaluation, week: WeekInfo): 'done' | 'missed' | 'forgiven' | 'pending' {
  if (week.count >= week.target) return 'done';
  for (let i = week.from; i < week.to; i++) {
    if (ev.missKind.get(i) === 'broken') return 'missed';
  }
  for (let i = week.from; i < week.to; i++) {
    if (ev.missKind.get(i) === 'forgiven') return 'forgiven';
  }
  return 'pending';
}

function weeklyStatus(times: number, p: Prepared, grace: boolean): HabitStatus {
  const t = p.today;
  const model = weeklyModel(times, p);
  const ev = evaluate(model.occ, grace);

  // Birim hafta: tamamlanan haftalar sayılır; kırılan hafta zinciri sıfırlar,
  // affedilen (hata payıyla geçilen) hafta ne ekler ne kırar.
  let run = 0;
  let best = 0;
  let closedWeeks = 0;
  let doneWeeks = 0;
  const current = weekStartOfEpochDay(t);
  for (const week of model.weeks) {
    const verdict = weekVerdict(ev, week);
    if (verdict === 'missed') {
      run = 0;
    } else if (verdict === 'done') {
      run++;
      if (run > best) best = run;
    }
    if (week.start < current || verdict === 'done') {
      closedWeeks++;
      if (verdict === 'done') doneWeeks++;
    }
  }
  const alive = ev.run > 0;
  const chainStart = alive && ev.chainStartIdx !== null ? ev.occ[ev.chainStartIdx].day : null;

  const currentWeek = model.weeks[model.weeks.length - 1];
  const done = currentWeek.count;
  const target = currentWeek.target;
  const doneToday = p.set.has(t);
  const weekday = weekdayOfEpochDay(t);
  const needed = Math.max(0, target - done);
  const available = doneToday ? 6 - weekday : 7 - weekday;
  const weekLost = needed > available;
  const dueToday = !doneToday && needed > 0 && needed === available;

  return {
    streak: alive ? run : 0,
    best,
    total: p.days.length,
    unit: 'week',
    doneToday,
    scheduledToday: true,
    dueToday,
    state: stateOf(alive, ev.everDone, dueToday),
    chainStart: chainStart === null ? null : fromEpochDay(chainStart),
    nextDue: null,
    week: { done, target, daysLeft: 7 - weekday },
    weekLost,
    successRate: closedWeeks > 0 ? doneWeeks / closedWeeks : null,
    ...graceInfo(ev, grace),
  };
}

// ---------------------------------------------------------------------------
// Genel API
// ---------------------------------------------------------------------------

export function computeStatus(habit: Habit, today: DayKey, grace: boolean): HabitStatus {
  const p = prepare(habit, today);
  const s = habit.schedule;
  switch (s.kind) {
    case 'days':
      return daysStatus(s, p, grace);
    case 'interval':
      return intervalStatus(s.every, p, grace);
    case 'weekly':
      return weeklyStatus(s.times, p, grace);
  }
}

export function streakUnit(schedule: Schedule): StreakUnit {
  switch (schedule.kind) {
    case 'days':
      return 'day';
    case 'weekly':
      return 'week';
    case 'interval':
      return 'time';
  }
}

/**
 * Bu zincir bugünün "yapılacaklar" sayısına girer mi? (Özet halkası, Bugün widget'ı, hatırlatma)
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

function occurrenceSlot(ev: Evaluation, i: number, key: string): ChainSlot {
  const o = ev.occ[i];
  if (o.state === 'done') return { key, state: 'done' };
  if (o.state === 'pending') return { key, state: 'pending' };
  return { key, state: ev.missKind.get(i) === 'forgiven' ? 'forgiven' : 'missed' };
}

/**
 * Zincir görseli için son `count` halka (eskiden yeniye).
 */
export function recentSlots(habit: Habit, today: DayKey, count: number, grace: boolean): ChainSlot[] {
  const p = prepare(habit, today);
  const s = habit.schedule;
  const slots: ChainSlot[] = [];

  if (s.kind === 'days') {
    const planned = new Set<number>(s.days);
    const ev = evaluate(
      daysOccurrences((d) => planned.has(weekdayOfEpochDay(d)), p),
      grace,
    );
    const from = Math.max(0, ev.occ.length - count);
    for (let i = from; i < ev.occ.length; i++) slots.push(occurrenceSlot(ev, i, fromEpochDay(ev.occ[i].day)));
  } else if (s.kind === 'weekly') {
    const model = weeklyModel(s.times, p);
    const ev = evaluate(model.occ, grace);
    const current = weekStartOfEpochDay(p.today);
    const byStart = new Map(model.weeks.map((w) => [w.start, w]));
    for (let i = count - 1; i >= 0; i--) {
      const start = current - i * 7;
      const week = byStart.get(start);
      if (!week) {
        slots.push({ key: fromEpochDay(start), state: 'empty' });
        continue;
      }
      const progress = week.target > 0 ? Math.min(1, week.count / week.target) : 0;
      slots.push({ key: fromEpochDay(start), state: weekVerdict(ev, week), progress });
    }
  } else {
    const ev = evaluate(intervalOccurrences(s.every, p), grace);
    const from = Math.max(0, ev.occ.length - count);
    for (let i = from; i < ev.occ.length; i++) {
      const o = ev.occ[i];
      const key = o.state === 'done' ? fromEpochDay(o.day) : o.state === 'pending' ? 'next' : `miss-${fromEpochDay(o.day)}`;
      slots.push(occurrenceSlot(ev, i, key));
    }
  }

  let pad = 0;
  while (slots.length < count) {
    slots.unshift({ key: `empty-${pad++}`, state: 'empty' });
  }
  return slots;
}

/**
 * Belirli günler zincirlerinde kaçırılan günlerin sonucu (takvim için).
 * Diğer türlerde boş döner.
 */
export function missMarks(habit: Habit, today: DayKey, grace: boolean): Map<DayKey, 'missed' | 'forgiven'> {
  const marks = new Map<DayKey, 'missed' | 'forgiven'>();
  const s = habit.schedule;
  if (s.kind !== 'days') return marks;
  const planned = new Set<number>(s.days);
  const ev = evaluate(
    daysOccurrences((d) => planned.has(weekdayOfEpochDay(d)), prepare(habit, today)),
    grace,
  );
  ev.missKind.forEach((kind, i) => {
    marks.set(fromEpochDay(ev.occ[i].day), kind === 'forgiven' ? 'forgiven' : 'missed');
  });
  return marks;
}

/** Takvimde bir günün nasıl görüneceği. `marks` için missMarks() kullanın. */
export function calendarDayState(
  habit: Habit,
  day: DayKey,
  today: DayKey,
  marks: Map<DayKey, 'missed' | 'forgiven'>,
): CalendarDayState {
  const d = toEpochDay(day);
  const t = toEpochDay(today);
  if (d > t) return 'future';
  if (habit.completions.includes(day)) return 'done';
  const s = habit.schedule;
  if (s.kind === 'days') {
    if (!s.days.includes(weekdayOfEpochDay(d))) return 'rest';
    if (d === t) return 'today';
    return marks.get(day) ?? 'none';
  }
  return d === t ? 'today' : 'none';
}

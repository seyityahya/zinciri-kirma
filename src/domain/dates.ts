/**
 * Gün hesapları yerel takvim günleri üzerinden yapılır.
 * Günler "YYYY-MM-DD" anahtarlarıyla saklanır; aritmetik ise saat dilimi ve
 * yaz saati geçişlerinden etkilenmemek için "epoch günü" (1970-01-01'den beri
 * geçen gün sayısı) tamsayılarıyla yapılır.
 */

export type DayKey = string;

/** 0 = Pazartesi ... 6 = Pazar */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 86_400_000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isValidDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false;
  const m = DAY_KEY_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // 0–99 yılları JS Date.UTC'de 1900'lere kayar; gerçekçi olmayan yılları reddet (Swift ile aynı).
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Cihazın yerel saatine göre verilen anın gün anahtarı. */
export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function toEpochDay(key: DayKey): number {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`Geçersiz gün: ${key}`);
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

export function fromEpochDay(day: number): DayKey {
  const d = new Date(day * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addDays(key: DayKey, amount: number): DayKey {
  return fromEpochDay(toEpochDay(key) + amount);
}

/** a - b, gün cinsinden. */
export function diffDays(a: DayKey, b: DayKey): number {
  return toEpochDay(a) - toEpochDay(b);
}

/** 1970-01-01 Perşembe olduğu için +3 ile Pazartesi = 0 olur. */
export function weekdayOfEpochDay(day: number): Weekday {
  return ((((day + 3) % 7) + 7) % 7) as Weekday;
}

export function weekdayOf(key: DayKey): Weekday {
  return weekdayOfEpochDay(toEpochDay(key));
}

/** Haftanın başlangıcı (Pazartesi) — epoch günü. */
export function weekStartOfEpochDay(day: number): number {
  return day - weekdayOfEpochDay(day);
}

export function weekStartOf(key: DayKey): DayKey {
  return fromEpochDay(weekStartOfEpochDay(toEpochDay(key)));
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const m = DAY_KEY_RE.exec(key);
  if (!m) throw new Error(`Geçersiz gün: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Yerel gece yarısını gösteren Date nesnesi. */
export function dayKeyToLocalDate(key: DayKey): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month - 1, day);
}

/** Verilen andan sonraki ilk yerel gece yarısı. */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

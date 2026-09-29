import {
  addDays,
  dayKeyToLocalDate,
  daysInMonth,
  diffDays,
  fromEpochDay,
  isValidDayKey,
  nextLocalMidnight,
  toDayKey,
  toEpochDay,
  weekdayOf,
  weekStartOf,
} from '../dates';

describe('dates', () => {
  it('epoch günlerini doğru hesaplar', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(toEpochDay('1970-01-02')).toBe(1);
    expect(fromEpochDay(0)).toBe('1970-01-01');
    expect(fromEpochDay(toEpochDay('2026-09-29'))).toBe('2026-09-29');
    expect(fromEpochDay(-1)).toBe('1969-12-31');
  });

  it('haftanın gününü Pazartesi=0 olarak verir', () => {
    expect(weekdayOf('1970-01-01')).toBe(3); // Perşembe
    expect(weekdayOf('2026-09-28')).toBe(0); // Pazartesi
    expect(weekdayOf('2026-09-29')).toBe(1); // Salı
    expect(weekdayOf('2026-10-04')).toBe(6); // Pazar
    expect(weekdayOf('1969-12-29')).toBe(0); // Pazartesi (negatif epoch)
  });

  it('hafta başlangıcını Pazartesi olarak bulur', () => {
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });

  it('ay, yıl ve artık yıl sınırlarında gün ekler', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-29', 0)).toBe('2026-09-29');
    expect(addDays('2026-09-29', -365)).toBe('2025-09-29');
  });

  it('iki gün arasındaki farkı hesaplar', () => {
    expect(diffDays('2026-09-29', '2026-09-28')).toBe(1);
    expect(diffDays('2026-09-28', '2026-09-29')).toBe(-1);
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
    expect(diffDays('2025-01-01', '2024-01-01')).toBe(366);
  });

  it('gün anahtarlarını doğrular', () => {
    expect(isValidDayKey('2026-09-29')).toBe(true);
    expect(isValidDayKey('2024-02-29')).toBe(true);
    expect(isValidDayKey('2026-02-29')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-00-10')).toBe(false);
    expect(isValidDayKey('2026-04-31')).toBe(false);
    expect(isValidDayKey('2026-9-29')).toBe(false);
    expect(isValidDayKey('')).toBe(false);
    expect(isValidDayKey(20260929)).toBe(false);
    expect(isValidDayKey(null)).toBe(false);
    expect(isValidDayKey('0008-09-29')).toBe(false);
    expect(isValidDayKey('2569-09-29')).toBe(true);
  });

  it('ayın gün sayısını bilir', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('yerel saatle gün anahtarı üretir', () => {
    expect(toDayKey(new Date(2026, 8, 29, 0, 0, 1))).toBe('2026-09-29');
    expect(toDayKey(new Date(2026, 8, 29, 23, 59, 59))).toBe('2026-09-29');
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDayKey(dayKeyToLocalDate('2026-03-29'))).toBe('2026-03-29');
  });

  it('bir sonraki gece yarısını bulur', () => {
    const next = nextLocalMidnight(new Date(2026, 11, 31, 15, 30));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(1);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });
});

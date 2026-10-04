import { addDays, logicalDayKey, nextDayBoundary } from '../dates';
import { reminderContent, statusText } from '../labels';
import { computeStatus, missMarks, recentSlots } from '../streak';
import type { Schedule } from '../types';
import { DAILY, habit, MON, range, SAT, SUN, TUE, WED, WEEKDAYS } from './helpers';

/** today'den geriye `n` gün, `skip` içindeki geri-sayılar hariç. */
function daysBack(today: string, n: number, skip: number[] = []): string[] {
  return Array.from({ length: n }, (_, i) => i).filter((i) => !skip.includes(i)).map((i) => addDays(today, -i));
}

describe('hata payı — her gün', () => {
  it('tek kaçırma affedilir, sayılmaz ve turuncu görünür', () => {
    // T-9..T, T-3 hariç
    const h = habit(DAILY, daysBack(TUE, 10, [3]));
    const s = computeStatus(h, TUE, true);
    expect(s.streak).toBe(9);
    expect(s.state).toBe('active');
    expect(s.graceUsed).toBe(true);
    expect(s.graceRenewIn).toBe(3);
    expect(s.graceAvailable).toBe(false);
    expect(s.chainStart).toBe(addDays(TUE, -9));
    expect(recentSlots(h, TUE, 5, true).map((x) => x.state)).toEqual(['done', 'forgiven', 'done', 'done', 'done']);
    expect(missMarks(h, TUE, true).get(addDays(TUE, -3))).toBe('forgiven');
  });

  it('hata payı kapalıyken aynı kaçırma zinciri kırar', () => {
    const s = computeStatus(habit(DAILY, daysBack(TUE, 10, [3])), TUE, false);
    expect(s.streak).toBe(3);
    expect(s.graceUsed).toBe(false);
    expect(s.graceAvailable).toBe(false);
  });

  it('7 halka içinde ikinci kaçırma zinciri kırar', () => {
    // T-9..T-1 yapıldı, T-6 ve T-3 kaçırıldı; bugün bekliyor
    const h = habit(DAILY, daysBack(TUE, 10, [0, 3, 6]));
    const s = computeStatus(h, TUE, true);
    expect(s.streak).toBe(2);
    expect(s.state).toBe('pending');
    expect(s.best).toBe(5);
    // Kırıldıktan sonra 7 halka geçmeden yeni hata payı yok
    expect(s.graceUsed).toBe(true);
    expect(statusText(DAILY, s, TUE)).toBe('Hata payını kullandın · bugün kaçırma');
    const marks = missMarks(h, TUE, true);
    expect(marks.get(addDays(TUE, -6))).toBe('forgiven');
    expect(marks.get(addDays(TUE, -3))).toBe('missed');
  });

  it('en az 7 halka arayla iki kaçırma affedilir', () => {
    // T-12..T; T-10 ve T-3 kaçırıldı (aralarında 7 halka)
    const s = computeStatus(habit(DAILY, daysBack(TUE, 13, [3, 10])), TUE, true);
    expect(s.streak).toBe(11);
    expect(s.state).toBe('active');
  });

  it('art arda iki gün kaçırmak zinciri kırar', () => {
    const s = computeStatus(habit(DAILY, daysBack(TUE, 10, [1, 2, 0])), TUE, true);
    expect(s.streak).toBe(0);
    expect(s.state).toBe('broken');
  });

  it('dün kaçırıldıysa bugün hâlâ zinciri korumak mümkün', () => {
    const s = computeStatus(habit(DAILY, daysBack(TUE, 8, [0, 1])), TUE, true);
    expect(s.streak).toBe(6);
    expect(s.state).toBe('pending');
    expect(s.graceUsed).toBe(true);
    expect(s.graceRenewIn).toBe(6);
  });

  it('hafta içi zincirinde izin günleri halka sayılmaz', () => {
    // İki hafta hafta içi; ilk haftanın Çarşambası kaçırıldı
    const done = [...range('2026-09-21', 5), ...range(MON, 5)].filter((d) => d !== '2026-09-23');
    const s = computeStatus(habit(WEEKDAYS, done), SUN, true);
    expect(s.streak).toBe(9);
    expect(s.state).toBe('active');
    // Kaçırma 7 halka önce: hata payı yenilendi
    expect(s.graceUsed).toBe(false);
    expect(s.graceAvailable).toBe(true);
  });

  it('yeni zincirde hata payı henüz yok', () => {
    const s = computeStatus(habit(DAILY, [], TUE), TUE, true);
    expect(s.graceAvailable).toBe(false);
    expect(s.graceUsed).toBe(false);
  });
});

describe('hata payı — haftada N kez', () => {
  const thrice: Schedule = { kind: 'weekly', times: 3 };
  // Son 4 kapanmış hafta: 08-31, 09-07, 09-14, 09-21; bu hafta 09-28 (MON)
  const week = (start: string, n: number) => range(start, n);

  it('4 haftada 11 kez: zincir sürer (1 kaçırma affedilir)', () => {
    const done = [...week('2026-08-31', 3), ...week('2026-09-07', 3), ...week('2026-09-14', 2), ...week('2026-09-21', 3)];
    const s = computeStatus(habit(thrice, done), MON, true);
    expect(s.state).not.toBe('broken');
    expect(s.streak).toBe(3);
    const slots = recentSlots(habit(thrice, done), MON, 5, true).map((x) => x.state);
    expect(slots).toEqual(['done', 'done', 'forgiven', 'done', 'pending']);
  });

  it('4 haftada 9 kez: zincir kırılır', () => {
    const done = [...week('2026-08-31', 2), ...week('2026-09-07', 3), ...week('2026-09-14', 2), ...week('2026-09-21', 2)];
    const s = computeStatus(habit(thrice, done), MON, true);
    expect(s.state).toBe('broken');
    expect(s.streak).toBe(0);
  });

  it('bir hafta 1 eksik kalacaksa uyarır', () => {
    const done = [...week('2026-09-14', 3), ...week('2026-09-21', 3), SAT];
    // Pazar: bu hafta 1/3, 1 gün kaldı → 1 eksik hata payıyla geçer
    const s = computeStatus(habit(thrice, done), SUN, true);
    expect(s.weekLost).toBe(true);
    expect(statusText(thrice, s, SUN)).toBe('Bu hafta 1/3 · hata payı kullanılacak');
    const strict = computeStatus(habit(thrice, done), SUN, false);
    expect(statusText(thrice, strict, SUN)).toBe('Bu hafta 1/3 · hedef kaçtı');
  });
});

describe('hata payı — N günde bir', () => {
  const every2: Schedule = { kind: 'interval', every: 2 };

  it('bir süre aşımı affedilir, sonraki son gün uzar', () => {
    // T-9, T-7, T-5, T-2 (T-5 → T-2 arası 3 gün: T-3 son günü kaçırıldı)
    const h = habit(every2, [9, 7, 5, 2].map((d) => addDays(TUE, -d)));
    const s = computeStatus(h, TUE, true);
    expect(s.streak).toBe(4);
    expect(s.state).toBe('pending');
    expect(s.dueToday).toBe(true);
    expect(s.graceUsed).toBe(true);
    expect(recentSlots(h, TUE, 6, true).map((x) => x.state)).toEqual(['done', 'done', 'done', 'forgiven', 'done', 'pending']);
  });

  it('son yapılıştan sonra bir süre kaçırılırsa zincir hâlâ sürer', () => {
    // T-3'te yapıldı; T-1 son günüydü (kaçırıldı), T+1 yeni son gün
    const s = computeStatus(habit(every2, [9, 7, 5, 3].map((d) => addDays(TUE, -d))), TUE, true);
    expect(s.state).toBe('active');
    expect(s.nextDue).toBe(addDays(TUE, 1));
    expect(s.graceUsed).toBe(true);
  });
});

describe('gün sınırı (03:00)', () => {
  it('03:00’ten önce hâlâ önceki gün sayılır', () => {
    expect(logicalDayKey(new Date(2026, 8, 30, 1, 30), 3)).toBe('2026-09-29');
    expect(logicalDayKey(new Date(2026, 8, 30, 2, 59), 3)).toBe('2026-09-29');
    expect(logicalDayKey(new Date(2026, 8, 30, 3, 0), 3)).toBe('2026-09-30');
    expect(logicalDayKey(new Date(2026, 8, 30, 0, 10), 0)).toBe('2026-09-30');
    expect(logicalDayKey(new Date(2027, 0, 1, 2, 0), 3)).toBe('2026-12-31');
  });

  it('bir sonraki gün değişim anını bulur', () => {
    const a = nextDayBoundary(new Date(2026, 8, 29, 22, 0), 3);
    expect([a.getDate(), a.getHours()]).toEqual([30, 3]);
    const b = nextDayBoundary(new Date(2026, 8, 30, 1, 0), 3);
    expect([b.getDate(), b.getHours()]).toEqual([30, 3]);
    const c = nextDayBoundary(new Date(2026, 8, 30, 3, 0), 3);
    expect([c.getDate(), c.getHours()]).toEqual([1, 3]);
  });
});

describe('akşam hatırlatması', () => {
  const item = (name: string, schedule: Schedule, completions: string[], today = TUE) => {
    const h = habit(schedule, completions);
    return { name, emoji: '📚', schedule, status: computeStatus(h, today, true) };
  };

  it('bekleyen yoksa bildirim yok', () => {
    expect(reminderContent([item('Kitap oku', DAILY, daysBack(TUE, 3))])).toBeNull();
    expect(reminderContent([])).toBeNull();
    // Hafta içi zincirinde Cumartesi bildirim yok
    expect(reminderContent([item('İş', WEEKDAYS, [MON], SAT)])).toBeNull();
  });

  it('tek zincirde adıyla sorar', () => {
    expect(reminderContent([item('İngilizce', DAILY, daysBack(TUE, 5, [0]))])).toEqual({
      title: '📚 İngilizce',
      body: 'Bugün yaptın mı? 4 günlük zincir kırılmasın.',
    });
    expect(reminderContent([item('İngilizce', DAILY, daysBack(TUE, 5, [0, 1]))])?.body).toBe(
      'Bugün yaptın mı? Hata payını kullandın, bugün kaçırırsan zincir kırılır.',
    );
  });

  it('birden çok zinciri tek bildirimde toplar', () => {
    const items = [
      item('Kitap oku', DAILY, daysBack(TUE, 3, [0])),
      item('Koşu', DAILY, daysBack(TUE, 3, [0, 1])),
      item('Su iç', DAILY, daysBack(TUE, 3)),
      item('Meditasyon', DAILY, [], TUE),
    ];
    expect(reminderContent(items)).toEqual({
      title: 'Bugün 3 zincir seni bekliyor',
      body: 'Kitap oku, Koşu ve Meditasyon. Sözünü tut! Koşu için hata payın kalmadı.',
    });
    const five = ['A', 'B', 'C', 'D', 'E'].map((n) => item(n, DAILY, daysBack(TUE, 2, [0])));
    expect(reminderContent(five)?.body).toBe('A, B ve 3 zincir daha. Sözünü tut!');
  });

  it('haftalık hedef bu hafta tamamsa hatırlatmaz', () => {
    const thrice: Schedule = { kind: 'weekly', times: 3 };
    expect(reminderContent([item('Spor', thrice, range(MON, 3), WED)])).toBeNull();
    expect(reminderContent([item('Spor', thrice, [MON], WED)])?.title).toBe('📚 Spor');
  });
});

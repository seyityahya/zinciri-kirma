import { addDays } from '../dates';
import { calendarDayState, chainAgeDays, computeStatus, countsToday, recentSlots } from '../streak';
import type { Schedule } from '../types';
import { back, DAILY, FRI, habit, MON, range, SAT, SUN, THU, TUE, WED, WEEKDAYS } from './helpers';

describe('computeStatus — her gün', () => {
  it('bugün dahil ardışık günleri sayar', () => {
    const s = computeStatus(habit(DAILY, back(TUE, 0, 1, 2, 3, 4)), TUE);
    expect(s.streak).toBe(5);
    expect(s.best).toBe(5);
    expect(s.doneToday).toBe(true);
    expect(s.dueToday).toBe(false);
    expect(s.state).toBe('active');
    expect(s.unit).toBe('day');
    expect(s.chainStart).toBe(addDays(TUE, -4));
  });

  it('bugün henüz yapılmadıysa zincir kırılmaz, beklemede olur', () => {
    const s = computeStatus(habit(DAILY, back(TUE, 1, 2, 3)), TUE);
    expect(s.streak).toBe(3);
    expect(s.doneToday).toBe(false);
    expect(s.dueToday).toBe(true);
    expect(s.state).toBe('pending');
  });

  it('dün atlandıysa zincir kırılır', () => {
    const s = computeStatus(habit(DAILY, back(TUE, 2, 3, 4)), TUE);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(3);
    expect(s.state).toBe('broken');
    expect(s.chainStart).toBeNull();
  });

  it('kırıldıktan sonra bugün yapılırsa zincir 1 ile yeniden başlar', () => {
    const s = computeStatus(habit(DAILY, back(TUE, 0, 2, 3, 4)), TUE);
    expect(s.streak).toBe(1);
    expect(s.best).toBe(3);
    expect(s.state).toBe('active');
  });

  it('hiç yapılmamış zincir "new" durumundadır', () => {
    const s = computeStatus(habit(DAILY, [], TUE), TUE);
    expect(s).toMatchObject({ streak: 0, best: 0, total: 0, state: 'new', dueToday: true });
    expect(s.successRate).toBeNull();
  });

  it('gelecekteki tamamlamaları yok sayar', () => {
    const s = computeStatus(habit(DAILY, [...back(TUE, 1), addDays(TUE, 1), addDays(TUE, 2)]), TUE);
    expect(s.streak).toBe(1);
    expect(s.total).toBe(1);
    expect(s.doneToday).toBe(false);
  });

  it('en uzun zinciri geçmişten hesaplar', () => {
    const completions = [...range('2026-08-01', 10), ...range('2026-08-15', 4), ...back(TUE, 0, 1)];
    const s = computeStatus(habit(DAILY, completions), TUE);
    expect(s.best).toBe(10);
    expect(s.streak).toBe(2);
    expect(s.total).toBe(16);
  });

  it('başarı oranını bugünü (yapılmadıysa) saymadan hesaplar', () => {
    // 4 günlük pencere: T-3, T-2 yapıldı, T-1 atlandı, T yapılmadı → 2/3
    const s = computeStatus(habit(DAILY, back(TUE, 2, 3), addDays(TUE, -3)), TUE);
    expect(s.successRate).toBeCloseTo(2 / 3);
  });

  it('uzun geçmişte hızlı ve doğru çalışır', () => {
    const completions = range('2020-01-01', 2465);
    const today = addDays('2020-01-01', 2464);
    const s = computeStatus(habit(DAILY, completions), today);
    expect(s.streak).toBe(2465);
    expect(s.best).toBe(2465);
    expect(s.successRate).toBe(1);
  });
});

describe('computeStatus — hafta içi / belirli günler', () => {
  it('hafta sonu zinciri kırmaz', () => {
    // Geçen hafta Pzt–Cum yapıldı, bugün Pazartesi (henüz yapılmadı)
    const lastWeek = range('2026-09-21', 5);
    const s = computeStatus(habit(WEEKDAYS, lastWeek), MON);
    expect(s.streak).toBe(5);
    expect(s.state).toBe('pending');
    expect(s.scheduledToday).toBe(true);
  });

  it('izin gününde planlı değildir ve sıradaki günü bilir', () => {
    const s = computeStatus(habit(WEEKDAYS, range(MON, 5)), SAT);
    expect(s.streak).toBe(5);
    expect(s.scheduledToday).toBe(false);
    expect(s.dueToday).toBe(false);
    expect(s.state).toBe('active');
    expect(s.nextDue).toBe('2026-10-05');
  });

  it('izin gününde yapılan tamamlama zinciri uzatmaz ama sayılır', () => {
    const s = computeStatus(habit(WEEKDAYS, [...range(MON, 5), SAT]), SAT);
    expect(s.streak).toBe(5);
    expect(s.doneToday).toBe(true);
    expect(s.total).toBe(6);
  });

  it('Pzt/Çar/Cum zincirinde Çarşamba atlanırsa Cuma kırık olur', () => {
    const schedule: Schedule = { kind: 'days', days: [0, 2, 4] };
    const s = computeStatus(habit(schedule, [MON, THU]), FRI);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(1);
    expect(s.state).toBe('broken');
  });

  it('Pzt/Çar/Cum zincirinde Perşembe izin günüdür', () => {
    const schedule: Schedule = { kind: 'days', days: [0, 2, 4] };
    const s = computeStatus(habit(schedule, [MON, WED]), THU);
    expect(s.streak).toBe(2);
    expect(s.scheduledToday).toBe(false);
    expect(s.nextDue).toBe(FRI);
    expect(s.state).toBe('active');
  });

  it('başarı oranı yalnızca planlı günleri sayar', () => {
    // Pzt–Paz: Pzt, Sal, Çar, Per, Cum yapıldı (hafta içi) → oran 1
    const s = computeStatus(habit(WEEKDAYS, range(MON, 5), MON), SUN);
    expect(s.successRate).toBe(1);
  });

  it('sadece izin günlerinde yapılırsa zincir oluşmaz', () => {
    const s = computeStatus(habit(WEEKDAYS, ['2026-09-26', '2026-09-27'], '2026-09-26'), SUN);
    expect(s.best).toBe(0);
    expect(s.state).toBe('new');
  });
});

describe('computeStatus — N günde bir', () => {
  const every2: Schedule = { kind: 'interval', every: 2 };

  it('son gün bugünse "dueToday" olur', () => {
    const s = computeStatus(habit(every2, back(TUE, 2, 4, 6)), TUE);
    expect(s.streak).toBe(3);
    expect(s.dueToday).toBe(true);
    expect(s.state).toBe('pending');
    expect(s.nextDue).toBe(TUE);
    expect(s.unit).toBe('time');
  });

  it('süre dolmadıysa zincir güvende', () => {
    const s = computeStatus(habit(every2, back(TUE, 1, 3)), TUE);
    expect(s.streak).toBe(2);
    expect(s.dueToday).toBe(false);
    expect(s.state).toBe('active');
    expect(s.nextDue).toBe(addDays(TUE, 1));
  });

  it('süre geçtiyse zincir kırılır', () => {
    const s = computeStatus(habit(every2, back(TUE, 3, 5)), TUE);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(2);
    expect(s.state).toBe('broken');
    expect(s.nextDue).toBeNull();
  });

  it('aradaki boşluk süreyi aşarsa zincir oradan başlar', () => {
    const s = computeStatus(habit(every2, back(TUE, 0, 2, 6, 8, 10, 12)), TUE);
    expect(s.streak).toBe(2);
    expect(s.best).toBe(4);
    expect(s.chainStart).toBe(addDays(TUE, -2));
  });

  it('bugün yapıldıysa tamamlanmış sayılır', () => {
    const s = computeStatus(habit(every2, back(TUE, 0)), TUE);
    expect(s).toMatchObject({ streak: 1, doneToday: true, dueToday: false, state: 'active' });
    expect(s.nextDue).toBe(addDays(TUE, 2));
  });

  it('hiç yapılmadıysa yeni', () => {
    const s = computeStatus(habit(every2, [], TUE), TUE);
    expect(s).toMatchObject({ streak: 0, best: 0, state: 'new', dueToday: false });
  });
});

describe('computeStatus — haftada N kez', () => {
  const thrice: Schedule = { kind: 'weekly', times: 3 };
  const lastWeek3 = ['2026-09-21', '2026-09-23', '2026-09-25'];
  const twoWeeksAgo3 = ['2026-09-14', '2026-09-15', '2026-09-16'];

  it('hedefine ulaşılan bu hafta zincire dahildir', () => {
    const s = computeStatus(habit(thrice, [...lastWeek3, MON, TUE, WED]), WED);
    expect(s.streak).toBe(2);
    expect(s.week).toEqual({ done: 3, target: 3, daysLeft: 5 });
    expect(s.state).toBe('active');
    expect(s.unit).toBe('week');
  });

  it('bu hafta henüz tamamlanmadıysa önceki haftalar sayılır', () => {
    const s = computeStatus(habit(thrice, [...twoWeeksAgo3, ...lastWeek3, MON]), WED);
    expect(s.streak).toBe(2);
    expect(s.dueToday).toBe(false);
    expect(s.state).toBe('active');
    expect(s.weekLost).toBe(false);
  });

  it('kalan gün sayısı gereken sayıya eşitse bugün şarttır', () => {
    const s = computeStatus(habit(thrice, [...lastWeek3, MON]), SAT);
    expect(s.week?.done).toBe(1);
    expect(s.dueToday).toBe(true);
    expect(s.state).toBe('pending');
  });

  it('hedefe ulaşmak imkânsızsa weekLost olur', () => {
    const s = computeStatus(habit(thrice, [...lastWeek3, MON]), SUN);
    expect(s.weekLost).toBe(true);
    expect(s.dueToday).toBe(false);
    expect(s.streak).toBe(1);
  });

  it('geçen hafta hedef tutmadıysa zincir kırılır', () => {
    const s = computeStatus(habit(thrice, [...twoWeeksAgo3, '2026-09-21']), TUE);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(1);
    expect(s.state).toBe('broken');
  });

  it('başlangıç haftası kalan gün sayısıyla sınırlanır', () => {
    // Cumartesi başladı, haftada 3 → başlangıç haftası hedefi 2
    const s = computeStatus(habit(thrice, [SAT, SUN], SAT), SUN);
    expect(s.week).toEqual({ done: 2, target: 2, daysLeft: 1 });
    expect(s.streak).toBe(1);
    expect(s.state).toBe('active');
  });

  it('bir sonraki haftada tam hedef beklenir', () => {
    const s = computeStatus(habit(thrice, ['2026-09-26', '2026-09-27', MON], '2026-09-26'), TUE);
    expect(s.week).toEqual({ done: 1, target: 3, daysLeft: 6 });
    expect(s.streak).toBe(1);
  });

  it('haftada bir: bu hafta yapıldıysa tamam', () => {
    const once: Schedule = { kind: 'weekly', times: 1 };
    const s = computeStatus(habit(once, ['2026-09-22', THU]), FRI);
    expect(s.streak).toBe(2);
    expect(s.best).toBe(2);
  });

  it('başarı oranı tamamlanan haftaları sayar', () => {
    const s = computeStatus(habit(thrice, [...twoWeeksAgo3, '2026-09-22'], '2026-09-14'), MON);
    // 2 hafta sayılır (bu hafta henüz tamamlanmadı): 1/2
    expect(s.successRate).toBeCloseTo(0.5);
  });
});

describe('recentSlots', () => {
  it('her gün zincirinde son günleri sırayla verir', () => {
    const slots = recentSlots(habit(DAILY, back(TUE, 1, 2, 4), addDays(TUE, -5)), TUE, 7);
    expect(slots.map((s) => s.state)).toEqual([
      'empty',
      'missed',
      'done',
      'missed',
      'done',
      'done',
      'pending',
    ]);
    expect(slots[slots.length - 1].key).toBe(TUE);
  });

  it('hafta içi zincirinde hafta sonlarını atlar', () => {
    const slots = recentSlots(habit(WEEKDAYS, range(MON, 5), MON), SUN, 5);
    expect(slots.map((s) => s.key)).toEqual(range(MON, 5));
    expect(slots.every((s) => s.state === 'done')).toBe(true);
  });

  it('haftalık zincirde ilerlemeyi gösterir', () => {
    const slots = recentSlots(
      habit({ kind: 'weekly', times: 2 }, ['2026-09-21', '2026-09-22', MON], '2026-09-21'),
      TUE,
      3,
    );
    expect(slots.map((s) => s.state)).toEqual(['empty', 'done', 'pending']);
    expect(slots[2].progress).toBeCloseTo(0.5);
  });

  it('aralıklı zincirde kırılmaları ekler', () => {
    const slots = recentSlots(habit({ kind: 'interval', every: 2 }, back(TUE, 8, 6, 1)), TUE, 6);
    expect(slots.map((s) => s.state)).toEqual(['empty', 'done', 'done', 'missed', 'done', 'pending']);
  });

  it('aralıklı zincir süresi geçtiyse kırık ve yeni halka gösterir', () => {
    const slots = recentSlots(habit({ kind: 'interval', every: 2 }, back(TUE, 5)), TUE, 3);
    expect(slots.map((s) => s.state)).toEqual(['done', 'missed', 'pending']);
  });

  it('istenen sayıda halka döner ve anahtarlar benzersizdir', () => {
    const cases: Schedule[] = [DAILY, WEEKDAYS, { kind: 'interval', every: 3 }, { kind: 'weekly', times: 2 }];
    for (const schedule of cases) {
      const slots = recentSlots(habit(schedule, back(TUE, 0, 3, 9, 20)), TUE, 10);
      expect(slots).toHaveLength(10);
      expect(new Set(slots.map((s) => s.key)).size).toBe(10);
    }
  });
});

describe('calendarDayState', () => {
  it('günleri doğru sınıflandırır', () => {
    const h = habit(WEEKDAYS, [MON], MON);
    expect(calendarDayState(h, MON, THU)).toBe('done');
    expect(calendarDayState(h, TUE, THU)).toBe('missed');
    expect(calendarDayState(h, THU, THU)).toBe('today');
    expect(calendarDayState(h, FRI, THU)).toBe('future');
    expect(calendarDayState(h, '2026-09-27', THU)).toBe('rest');
    expect(calendarDayState(h, '2026-09-25', THU)).toBe('none');
  });

  it('aralıklı zincirde kaçırılan gün göstermez', () => {
    const h = habit({ kind: 'interval', every: 2 }, [MON], MON);
    expect(calendarDayState(h, TUE, THU)).toBe('none');
    expect(calendarDayState(h, THU, THU)).toBe('today');
  });
});

describe('countsToday', () => {
  const counts = (schedule: Schedule, completions: string[], today: string, start?: string) =>
    countsToday(schedule, computeStatus(habit(schedule, completions, start), today));

  it('planlı günleri ve bugün yapılanları sayar', () => {
    expect(counts(WEEKDAYS, [MON], TUE)).toBe(true);
    expect(counts(WEEKDAYS, [MON], SAT)).toBe(false);
    expect(counts(WEEKDAYS, [SAT], SAT)).toBe(true);
  });

  it('haftalık hedef tuttuysa artık saymaz', () => {
    const thrice: Schedule = { kind: 'weekly', times: 3 };
    expect(counts(thrice, [MON], WED, MON)).toBe(true);
    expect(counts(thrice, [MON, TUE, WED], THU, MON)).toBe(false);
    // Hedef kaçtıysa bugünün listesine girmez
    expect(counts(thrice, ['2026-09-21', '2026-09-22', '2026-09-23', MON], SUN)).toBe(false);
  });

  it('aralıklı zincirde yalnızca son gün, yeni ya da kırık zinciri sayar', () => {
    const every3: Schedule = { kind: 'interval', every: 3 };
    expect(counts(every3, back(TUE, 1), TUE)).toBe(false);
    expect(counts(every3, back(TUE, 3), TUE)).toBe(true);
    expect(counts(every3, back(TUE, 5), TUE)).toBe(true);
    expect(counts(every3, [], TUE, TUE)).toBe(true);
    expect(counts(every3, back(TUE, 0), TUE)).toBe(true);
  });
});

describe('chainAgeDays', () => {
  it('zincirin kaç gündür sürdüğünü verir', () => {
    expect(chainAgeDays(computeStatus(habit(DAILY, back(TUE, 0, 1, 2)), TUE), TUE)).toBe(3);
    const weekly = computeStatus(habit({ kind: 'weekly', times: 1 }, ['2026-09-22', MON]), TUE);
    expect(chainAgeDays(weekly, TUE)).toBe(9);
    expect(chainAgeDays(computeStatus(habit(DAILY, back(TUE, 3)), TUE), TUE)).toBe(0);
  });
});

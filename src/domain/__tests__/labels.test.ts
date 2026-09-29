import { addDays } from '../dates';
import {
  longDateLabel,
  relativeDayLabel,
  scheduleExplanation,
  scheduleLabel,
  statusText,
  unitLabel,
} from '../labels';
import { computeStatus } from '../streak';
import type { Schedule } from '../types';
import { back, DAILY, habit, MON, SAT, SUN, THU, TUE, WED, WEEKDAYS } from './helpers';

function text(schedule: Schedule, completions: string[], today: string, start?: string) {
  const h = habit(schedule, completions, start);
  return statusText(schedule, computeStatus(h, today), today);
}

describe('scheduleLabel', () => {
  it('sıklıkları Türkçe adlandırır', () => {
    expect(scheduleLabel(DAILY)).toBe('Her gün');
    expect(scheduleLabel(WEEKDAYS)).toBe('Hafta içi her gün');
    expect(scheduleLabel({ kind: 'days', days: [6, 5] })).toBe('Hafta sonları');
    expect(scheduleLabel({ kind: 'days', days: [2] })).toBe('Her Çarşamba');
    expect(scheduleLabel({ kind: 'days', days: [4, 0, 2] })).toBe('Pzt, Çar, Cum');
    expect(scheduleLabel({ kind: 'interval', every: 2 })).toBe('2 günde bir');
    expect(scheduleLabel({ kind: 'weekly', times: 1 })).toBe('Haftada bir');
    expect(scheduleLabel({ kind: 'weekly', times: 3 })).toBe('Haftada 3 kez');
  });

  it('açıklama metinleri üretir', () => {
    expect(scheduleExplanation(DAILY)).toContain('Her gün');
    expect(scheduleExplanation(WEEKDAYS)).toContain('hafta içi');
    expect(scheduleExplanation({ kind: 'interval', every: 3 })).toContain('3 gün');
    expect(scheduleExplanation({ kind: 'weekly', times: 2 })).toContain('2 gün');
  });
});

describe('unitLabel', () => {
  it('birimleri verir', () => {
    expect(unitLabel('day')).toBe('gün');
    expect(unitLabel('week')).toBe('hafta');
    expect(unitLabel('time')).toBe('kez');
  });
});

describe('relativeDayLabel', () => {
  it('yakın günleri adlandırır', () => {
    expect(relativeDayLabel(TUE, TUE)).toBe('bugün');
    expect(relativeDayLabel(WED, TUE)).toBe('yarın');
    expect(relativeDayLabel(SAT, TUE)).toBe('Cumartesi');
    expect(relativeDayLabel(addDays(TUE, 7), TUE)).toBe('6 Ekim');
  });
});

describe('longDateLabel', () => {
  it('uzun tarih yazar', () => {
    expect(longDateLabel(TUE)).toBe('Salı, 29 Eylül');
    expect(longDateLabel('2027-01-01')).toBe('Cuma, 1 Ocak');
  });
});

describe('statusText', () => {
  it('her gün zincirleri', () => {
    expect(text(DAILY, back(TUE, 0), TUE)).toBe('Bugün tamamlandı');
    expect(text(DAILY, back(TUE, 1), TUE)).toBe('Zinciri korumak için bugün yap');
    expect(text(DAILY, back(TUE, 3), TUE)).toBe('Zincir kırıldı · bugün yeniden başla');
    expect(text(DAILY, [], TUE, TUE)).toBe('İlk halkayı bugün ekle');
  });

  it('izin günleri', () => {
    expect(text(WEEKDAYS, [MON], SAT)).toBe('Bugün izin günü · sıradaki Pazartesi');
    expect(text(WEEKDAYS, [MON], SUN)).toBe('Bugün izin günü · sıradaki yarın');
    expect(text(WEEKDAYS, [SAT], SAT)).toBe('İzin gününde ekstra halka');
  });

  it('aralıklı zincirler', () => {
    const every3: Schedule = { kind: 'interval', every: 3 };
    expect(text(every3, back(TUE, 0), TUE)).toBe('Bugün tamamlandı');
    expect(text(every3, back(TUE, 1), TUE)).toBe('En geç 2 gün içinde yap');
    expect(text(every3, back(TUE, 2), TUE)).toBe('En geç yarın yap');
    expect(text(every3, back(TUE, 3), TUE)).toBe('Bugün son gün!');
    expect(text(every3, back(TUE, 4), TUE)).toBe('Zincir kırıldı · yeniden başla');
    expect(text(every3, [], TUE, TUE)).toBe('İlk halkayı ekle');
  });

  it('haftalık zincirler', () => {
    const thrice: Schedule = { kind: 'weekly', times: 3 };
    const lastWeek = ['2026-09-21', '2026-09-22', '2026-09-23'];
    expect(text(thrice, [...lastWeek, MON, TUE, WED], THU)).toBe('Bu hafta 3/3 · hedef tamam');
    expect(text(thrice, [...lastWeek, MON], WED)).toBe('Bu hafta 1/3 · 2 kez daha');
    expect(text(thrice, [...lastWeek, MON], SAT)).toBe('Bu hafta 1/3 · bugün şart');
    expect(text(thrice, [...lastWeek, MON], SUN)).toBe('Bu hafta 1/3 · hedef kaçtı');
    expect(text(thrice, ['2026-09-14', '2026-09-15', '2026-09-16'], TUE)).toBe(
      'Zincir kırıldı · bu hafta yeniden başla',
    );
  });
});

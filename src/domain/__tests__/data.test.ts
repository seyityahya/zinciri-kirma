import {
  addHabit,
  createHabit,
  deleteHabit,
  moveHabit,
  reorderHabits,
  setCompletion,
  updateHabit,
} from '../mutations';
import { emptyData, type AppData } from '../types';
import { normalizeSchedule, parseAppData, serializeAppData } from '../validate';
import { DAILY, TUE } from './helpers';

function sample(): AppData {
  let data = emptyData();
  data = addHabit(data, createHabit({ name: '  Kitap oku ', emoji: '📚', color: '#ff6b3d', schedule: DAILY }, TUE, 'a', 1));
  data = addHabit(data, createHabit({ name: 'Koşu', emoji: '🏃', color: '#34C759', schedule: { kind: 'weekly', times: 3 } }, TUE, 'b', 2));
  data = addHabit(data, createHabit({ name: 'Su iç', emoji: '💧', color: '#2E9BF0', schedule: { kind: 'interval', every: 2 } }, TUE, 'c', 3));
  return data;
}

describe('mutations', () => {
  it('zincir oluştururken adı kırpar ve rengi büyük harfe çevirir', () => {
    const data = sample();
    expect(data.habits[0]).toMatchObject({ id: 'a', name: 'Kitap oku', color: '#FF6B3D', startDate: TUE, completions: [] });
  });

  it('aynı id ile ikinci kez eklemez', () => {
    const data = sample();
    const again = addHabit(data, { ...data.habits[0] });
    expect(again).toBe(data);
  });

  it('tamamlama ekler, sıralar ve kaldırır', () => {
    let data = sample();
    data = setCompletion(data, 'a', TUE, true, TUE);
    data = setCompletion(data, 'a', '2026-09-27', true, TUE);
    expect(data.habits[0].completions).toEqual(['2026-09-27', TUE]);
    const same = setCompletion(data, 'a', TUE, true, TUE);
    expect(same).toBe(data);
    data = setCompletion(data, 'a', TUE, false, TUE);
    expect(data.habits[0].completions).toEqual(['2026-09-27']);
  });

  it('gelecekteki günü işaretlemez', () => {
    const data = sample();
    expect(setCompletion(data, 'a', '2026-09-30', true, TUE)).toBe(data);
  });

  it('olmayan zincir için değişiklik yapmaz', () => {
    const data = sample();
    expect(setCompletion(data, 'zzz', TUE, true, TUE)).toBe(data);
    expect(deleteHabit(data, 'zzz')).toBe(data);
    expect(updateHabit(data, 'zzz', { name: 'x', emoji: 'x', color: '#000000', schedule: DAILY })).toBe(data);
  });

  it('günceller ve tamamlamaları korur', () => {
    let data = setCompletion(sample(), 'a', TUE, true, TUE);
    data = updateHabit(data, 'a', { name: 'Roman oku', emoji: '📖', color: '#8B5CF6', schedule: { kind: 'days', days: [0, 2, 4] } });
    expect(data.habits[0]).toMatchObject({
      name: 'Roman oku',
      emoji: '📖',
      color: '#8B5CF6',
      schedule: { kind: 'days', days: [0, 2, 4] },
      completions: [TUE],
      startDate: TUE,
    });
  });

  it('siler', () => {
    const data = deleteHabit(sample(), 'b');
    expect(data.habits.map((h) => h.id)).toEqual(['a', 'c']);
  });

  it('sıralar ve taşır', () => {
    const data = sample();
    expect(reorderHabits(data, ['c', 'a', 'b']).habits.map((h) => h.id)).toEqual(['c', 'a', 'b']);
    expect(reorderHabits(data, ['a', 'b', 'c'])).toBe(data);
    expect(moveHabit(data, 'b', -1).habits.map((h) => h.id)).toEqual(['b', 'a', 'c']);
    expect(moveHabit(data, 'a', -1)).toBe(data);
    expect(moveHabit(data, 'c', 1)).toBe(data);
  });
});

describe('parseAppData', () => {
  it('bozuk veride null döner', () => {
    expect(parseAppData(null)).toBeNull();
    expect(parseAppData('')).toBeNull();
    expect(parseAppData('{bozuk')).toBeNull();
    expect(parseAppData('42')).toBeNull();
  });

  it('serileştirme ile gidip gelir', () => {
    const data = setCompletion(sample(), 'a', TUE, true, TUE);
    expect(parseAppData(serializeAppData(data))).toEqual(data);
  });

  it('geçersiz zincirleri atar ve alanları düzeltir', () => {
    const json = JSON.stringify({
      version: 1,
      updatedAt: 5,
      habits: [
        { id: 'x', name: '   ' },
        { name: 'id yok' },
        null,
        {
          id: 'ok',
          name: 'Tamam',
          emoji: '',
          color: 'kırmızı',
          schedule: { kind: 'interval', every: 99 },
          startDate: 'dün',
          completions: ['2026-09-29', 'x', '2026-09-27', '2026-09-29', '2026-02-30'],
          extra: 'korunmaz',
        },
        { id: 'ok', name: 'Tekrar' },
      ],
    });
    const data = parseAppData(json);
    expect(data?.updatedAt).toBe(5);
    expect(data?.habits).toHaveLength(1);
    expect(data?.habits[0]).toEqual({
      id: 'ok',
      name: 'Tamam',
      emoji: '🔥',
      color: '#FF6B3D',
      schedule: { kind: 'interval', every: 30 },
      startDate: '2026-09-27',
      completions: ['2026-09-27', '2026-09-29'],
      createdAt: 0,
    });
  });

  it('sıklığı sınırlar içinde tutar', () => {
    expect(normalizeSchedule({ kind: 'weekly', times: 0 })).toEqual({ kind: 'weekly', times: 1 });
    expect(normalizeSchedule({ kind: 'weekly', times: 12 })).toEqual({ kind: 'weekly', times: 7 });
    expect(normalizeSchedule({ kind: 'interval', every: 1 })).toEqual({ kind: 'interval', every: 2 });
    expect(normalizeSchedule({ kind: 'days', days: [4, 4, 9, -1, 1.5, 0] })).toEqual({ kind: 'days', days: [0, 4] });
    expect(normalizeSchedule({ kind: 'days', days: [] })).toEqual({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] });
    expect(normalizeSchedule(undefined)).toEqual({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] });
  });
});

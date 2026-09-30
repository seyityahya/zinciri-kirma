import { addDays } from '@/domain/dates';
import { emptyData, type Habit } from '@/domain/types';

import { planReminders, reminderTime } from '../plan';

const habit = (id: string, name: string, completions: string[], days = [0, 1, 2, 3, 4, 5, 6]): Habit => ({
  id,
  name,
  emoji: '📚',
  color: '#FF6B3D',
  schedule: { kind: 'days', days: days as Habit['schedule'] extends { days: infer D } ? D : never },
  startDate: '2026-09-01',
  completions,
  createdAt: 0,
});

// 29 Eylül 2026 Salı, 18:00
const now = new Date(2026, 8, 29, 18, 0);

describe('planReminders', () => {
  it('14 gün boyunca her akşam tek hatırlatma kurar', () => {
    const data = { ...emptyData(), habits: [habit('a', 'İngilizce', ['2026-09-28'])] };
    const plan = planReminders(data, now);
    expect(plan).toHaveLength(14);
    expect(plan[0]).toMatchObject({ id: 'zk-reminder-2026-09-29', day: '2026-09-29', title: '📚 İngilizce' });
    expect(new Date(plan[0].at)).toEqual(new Date(2026, 8, 29, 21, 0));
    expect(new Set(plan.map((p) => p.id)).size).toBe(14);
  });

  it('bugün tamamsa bugünün hatırlatmasını atlar', () => {
    const data = { ...emptyData(), habits: [habit('a', 'İngilizce', ['2026-09-29'])] };
    expect(planReminders(data, now)[0].day).toBe('2026-09-30');
  });

  it('saati geçtiyse bugünü atlar', () => {
    const data = { ...emptyData(), habits: [habit('a', 'İngilizce', [])] };
    expect(planReminders(data, new Date(2026, 8, 29, 21, 30))[0].day).toBe('2026-09-30');
  });

  it('kapalıysa ya da zincir yoksa hiçbir şey kurmaz', () => {
    const base = emptyData();
    expect(planReminders(base, now)).toEqual([]);
    const off = { ...base, habits: [habit('a', 'A', [])], settings: { ...base.settings, reminder: { enabled: false, hour: 21, minute: 0 } } };
    expect(planReminders(off, now)).toEqual([]);
  });

  it('planlı olmayan günlerde bildirim yok', () => {
    // Hafta içi zinciri: 3 Ekim Cumartesi ve 4 Ekim Pazar atlanır
    const data = { ...emptyData(), habits: [habit('a', 'İş', [], [0, 1, 2, 3, 4])] };
    const days = planReminders(data, now).map((p) => p.day);
    expect(days).not.toContain('2026-10-03');
    expect(days).not.toContain('2026-10-04');
    expect(days).toContain(addDays('2026-09-29', 6));
  });

  it('gün bitişinden önceki bir saat ertesi takvim gününe düşer', () => {
    expect(reminderTime('2026-09-29', 1, 30, 3)).toEqual(new Date(2026, 8, 30, 1, 30));
    expect(reminderTime('2026-09-29', 21, 0, 3)).toEqual(new Date(2026, 8, 29, 21, 0));
  });
});

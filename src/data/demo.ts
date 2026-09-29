import { addDays, type DayKey, weekdayOf } from '@/domain/dates';
import type { Habit } from '@/domain/types';

/** Yalnızca geliştirme sürümünde: ekranları gerçekçi verilerle denemek için örnek zincirler. */
export function demoHabits(today: DayKey, now = Date.now()): Habit[] {
  const back = (from: number, to: number) => {
    const days: DayKey[] = [];
    for (let i = from; i <= to; i++) days.push(addDays(today, -i));
    return days;
  };
  const weekdaysOnly = (days: DayKey[]) => days.filter((d) => weekdayOf(d) <= 4);

  return [
    {
      id: `demo-read-${now}`,
      name: 'Kitap oku',
      emoji: '📚',
      color: '#FF6B3D',
      schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
      startDate: addDays(today, -60),
      completions: [...back(1, 12), ...back(30, 49)].sort(),
      createdAt: now,
    },
    {
      id: `demo-water-${now}`,
      name: '2 litre su iç',
      emoji: '💧',
      color: '#2E9BF0',
      schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
      startDate: addDays(today, -20),
      completions: back(0, 7).sort(),
      createdAt: now + 1,
    },
    {
      id: `demo-run-${now}`,
      name: 'Koşu',
      emoji: '🏃',
      color: '#34C759',
      schedule: { kind: 'weekly', times: 3 },
      startDate: addDays(today, -35),
      completions: back(0, 34).filter((_, i) => i % 2 === 1).sort(),
      createdAt: now + 2,
    },
    {
      id: `demo-meditate-${now}`,
      name: 'Meditasyon',
      emoji: '🧘',
      color: '#A35CF0',
      schedule: { kind: 'days', days: [0, 1, 2, 3, 4] },
      startDate: addDays(today, -30),
      completions: weekdaysOnly([...back(5, 25)]).sort(),
      createdAt: now + 3,
    },
    {
      id: `demo-gym-${now}`,
      name: 'Spor salonu',
      emoji: '💪',
      color: '#F2545B',
      schedule: { kind: 'interval', every: 2 },
      startDate: addDays(today, -20),
      completions: [1, 3, 5, 7, 9, 11].map((d) => addDays(today, -d)).sort(),
      createdAt: now + 4,
    },
  ];
}

import type { HabitInput } from './mutations';

export interface Preset extends HabitInput {
  key: string;
}

/** Boş ekranda önerilen hazır zincirler. */
export const PRESETS: Preset[] = [
  { key: 'read', name: 'Kitap oku', emoji: '📚', color: '#FF6B3D', schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] } },
  { key: 'run', name: 'Koşu', emoji: '🏃', color: '#34C759', schedule: { kind: 'weekly', times: 3 } },
  { key: 'water', name: '2 litre su iç', emoji: '💧', color: '#2E9BF0', schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] } },
  { key: 'meditate', name: 'Meditasyon', emoji: '🧘', color: '#A35CF0', schedule: { kind: 'days', days: [0, 1, 2, 3, 4] } },
  { key: 'gym', name: 'Spor salonu', emoji: '💪', color: '#F2545B', schedule: { kind: 'interval', every: 2 } },
  { key: 'sugar', name: 'Şekersiz gün', emoji: '🍎', color: '#14B8A6', schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] } },
];

export function findPreset(key: string | undefined): Preset | undefined {
  return key ? PRESETS.find((p) => p.key === key) : undefined;
}

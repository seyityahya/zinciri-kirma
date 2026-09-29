import { create } from 'zustand';

import { type DayKey, todayKey } from '@/domain/dates';
import * as M from '@/domain/mutations';
import { type AppData, emptyData, type Habit } from '@/domain/types';
import { parseAppData, serializeAppData } from '@/domain/validate';
import { syncWidgets } from '@/widgets/sync';

import { dataStorage } from './storage';

type Mutator = (data: AppData) => AppData;

export interface HabitStore {
  data: AppData;
  ready: boolean;
  today: DayKey;
  init(): Promise<void>;
  /** Diskten (widget'ın yaptığı değişikliklerle birlikte) yeniden yükler. */
  refresh(): Promise<void>;
  setToday(day: DayKey): void;
  addHabit(input: M.HabitInput): string;
  updateHabit(id: string, input: M.HabitInput): Promise<void>;
  deleteHabit(id: string): Promise<void>;
  setCompletion(id: string, day: DayKey, done: boolean): Promise<void>;
  /** Bugünü işaretler/kaldırır; yeni durumu döndürür. */
  toggleToday(id: string): boolean;
  reorder(ids: string[]): Promise<void>;
  /** Hazır zincirleri toplu ekler (geliştirici örnek verisi). */
  addHabits(habits: Habit[]): Promise<void>;
  resetAll(): Promise<void>;
}

/*
 * Kalıcılık kuralları:
 * - Her değişiklik önce ekrana yansır (iyimser güncelleme).
 * - Ardından sırayla işlenen bir kuyrukta diskteki EN GÜNCEL veri okunur,
 *   aynı değişiklik ona uygulanır ve yazılır. Böylece widget'ın arada yaptığı
 *   işaretlemeler asla ezilmez.
 * - Değişiklikler "mutlak" tarif edildiği için (ör. "şu gün yapıldı olsun")
 *   tekrar uygulanmaları güvenlidir.
 */
let queue: Promise<unknown> = Promise.resolve();
let persisted: AppData = emptyData();
const pending: Mutator[] = [];
let initPromise: Promise<void> | null = null;

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task, task);
  queue = run.catch((error) => {
    console.warn('[store] kayıt hatası', error);
  });
  return queue as Promise<void>;
}

async function readStored(): Promise<AppData | null> {
  try {
    return parseAppData(await dataStorage.load());
  } catch (error) {
    console.warn('[store] okunamadı', error);
    return null;
  }
}

function applyPending(base: AppData): AppData {
  return pending.reduce((d, m) => m(d), base);
}

export const useHabitStore = create<HabitStore>((set, get) => {
  function commit(mutator: Mutator): Promise<void> {
    const current = get().data;
    const optimistic = mutator(current);
    if (optimistic === current) return Promise.resolve();
    pending.push(mutator);
    set({ data: optimistic });

    return enqueue(async () => {
      try {
        const base = (await readStored()) ?? persisted;
        const changed = mutator(base);
        const next: AppData = {
          ...changed,
          updatedAt: Math.max(Date.now(), base.updatedAt + 1),
        };
        await dataStorage.save(serializeAppData(next));
        persisted = next;
        syncWidgets(next);
      } finally {
        pending.shift();
        set({ data: applyPending(persisted) });
      }
    });
  }

  return {
    data: emptyData(),
    ready: false,
    today: todayKey(),

    init() {
      if (!initPromise) {
        initPromise = enqueue(async () => {
          const stored = await readStored();
          persisted = stored ?? emptyData();
          set({ data: applyPending(persisted), ready: true, today: todayKey() });
        });
      }
      return initPromise;
    },

    refresh() {
      return enqueue(async () => {
        const stored = await readStored();
        if (stored && stored.updatedAt !== persisted.updatedAt) {
          persisted = stored;
          set({ data: applyPending(persisted) });
        }
      });
    },

    setToday(day) {
      if (get().today !== day) set({ today: day });
    },

    addHabit(input) {
      const now = Date.now();
      const habit = M.createHabit(input, todayKey(), M.generateId(now), now);
      void commit((d) => M.addHabit(d, habit));
      return habit.id;
    },

    updateHabit(id, input) {
      return commit((d) => M.updateHabit(d, id, input));
    },

    deleteHabit(id) {
      return commit((d) => M.deleteHabit(d, id));
    },

    setCompletion(id, day, done) {
      const today = todayKey();
      return commit((d) => M.setCompletion(d, id, day, done, today));
    },

    toggleToday(id) {
      const today = todayKey();
      if (get().today !== today) set({ today });
      const habit = get().data.habits.find((h) => h.id === id);
      if (!habit) return false;
      const done = !habit.completions.includes(today);
      void commit((d) => M.setCompletion(d, id, today, done, today));
      return done;
    },

    reorder(ids) {
      return commit((d) => M.reorderHabits(d, ids));
    },

    addHabits(habits) {
      return commit((d) => habits.reduce((acc, h) => M.addHabit(acc, h), d));
    },

    resetAll() {
      return commit((d) => (d.habits.length === 0 ? d : { ...d, habits: [] }));
    },
  };
});

export function useHabit(id: string | undefined): Habit | undefined {
  return useHabitStore((s) => (id ? s.data.habits.find((h) => h.id === id) : undefined));
}

/** Testler için modül durumunu sıfırlar. */
export function __resetStoreForTests(): void {
  queue = Promise.resolve();
  persisted = emptyData();
  pending.length = 0;
  initPromise = null;
  useHabitStore.setState({ data: emptyData(), ready: false, today: todayKey() });
}

/** Kuyruktaki tüm kayıtlar bitene kadar bekler. */
export function flushStore(): Promise<void> {
  return enqueue(async () => {});
}

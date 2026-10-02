import { create } from 'zustand';

import { mergeAppData, replaceAppData, type RestoreMode } from '@/domain/backup';
import { type DayKey, logicalDayKey } from '@/domain/dates';
import * as M from '@/domain/mutations';
import { type AppData, type AppSettings, emptyData, type Habit } from '@/domain/types';
import { parseAppData, serializeAppData } from '@/domain/validate';
import { scheduleReminderSync } from '@/notifications/reminders';
import { syncWidgets } from '@/widgets/sync';

import { dataStorage } from './storage';

type Mutator = (data: AppData) => AppData;

export type SettingsPatch = Partial<Omit<AppSettings, 'reminder'>> & { reminder?: Partial<AppSettings['reminder']> };

/** Ayarlara göre "mantıksal" bugün (gün, gece yarısı yerine dayStartHour'da biter). */
export function dayNow(settings: AppSettings = useHabitStore.getState().data.settings, now: Date = new Date()): DayKey {
  return logicalDayKey(now, settings.dayStartHour);
}

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
  /** Paylaşılan ayarları günceller (gün bitişi, hata payı, hatırlatma). */
  updateSettings(patch: SettingsPatch): Promise<void>;
  /** Hazır zincirleri toplu ekler (geliştirici örnek verisi). */
  addHabits(habits: Habit[]): Promise<void>;
  /** Yedekteki veriyi uygular: 'replace' zincirleri ve ayarları değiştirir, 'merge' birleştirir. */
  importData(incoming: AppData, mode: RestoreMode): Promise<void>;
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
        scheduleReminderSync(next);
      } finally {
        pending.shift();
        set({ data: applyPending(persisted) });
      }
    });
  }

  return {
    data: emptyData(),
    ready: false,
    today: dayNow(emptyData().settings),

    init() {
      if (!initPromise) {
        initPromise = enqueue(async () => {
          const stored = await readStored();
          persisted = stored ?? emptyData();
          set({ data: applyPending(persisted), ready: true, today: dayNow(persisted.settings) });
          scheduleReminderSync(persisted);
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
          scheduleReminderSync(persisted);
        }
        const today = dayNow(get().data.settings);
        if (get().today !== today) set({ today });
      });
    },

    setToday(day) {
      if (get().today !== day) set({ today: day });
    },

    addHabit(input) {
      const now = Date.now();
      const habit = M.createHabit(input, dayNow(get().data.settings), M.generateId(now), now);
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
      const today = dayNow(get().data.settings);
      return commit((d) => M.setCompletion(d, id, day, done, today));
    },

    toggleToday(id) {
      const today = dayNow(get().data.settings);
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

    updateSettings(patch) {
      const result = commit((d) => {
        const settings: AppSettings = {
          ...d.settings,
          ...patch,
          reminder: { ...d.settings.reminder, ...(patch.reminder ?? {}) },
        };
        const same = JSON.stringify(settings) === JSON.stringify(d.settings);
        return same ? d : { ...d, settings };
      });
      set({ today: dayNow(get().data.settings) });
      return result;
    },

    addHabits(habits) {
      return commit((d) => habits.reduce((acc, h) => M.addHabit(acc, h), d));
    },

    importData(incoming, mode) {
      const result = commit((d) => (mode === 'replace' ? replaceAppData(d, incoming) : mergeAppData(d, incoming)));
      // Yedekteki "gün bitişi" farklı olabilir.
      set({ today: dayNow(get().data.settings) });
      return result;
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
  useHabitStore.setState({ data: emptyData(), ready: false, today: dayNow(emptyData().settings) });
}

/** Kuyruktaki tüm kayıtlar bitene kadar bekler. */
export function flushStore(): Promise<void> {
  return enqueue(async () => {});
}

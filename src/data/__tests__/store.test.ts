
import { parseAppData, serializeAppData } from '@/domain/validate';

import { __resetStoreForTests, dayNow, flushStore, useHabitStore } from '../store';

// Diski ve "widget"ı taklit eden bellek içi depo.
let mockDisk: string | null = null;
jest.mock('../storage', () => ({
  dataStorage: {
    shared: true,
    load: jest.fn(async () => mockDisk),
    save: jest.fn(async (json: string) => {
      mockDisk = json;
    }),
  },
}));

const mockSyncWidgets = jest.fn();
jest.mock('@/widgets/sync', () => ({ syncWidgets: (...args: unknown[]) => mockSyncWidgets(...args) }));

const input = { name: 'Kitap oku', emoji: '📚', color: '#FF6B3D', schedule: { kind: 'days' as const, days: [0, 1, 2, 3, 4, 5, 6] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[] } };

function stored() {
  return parseAppData(mockDisk);
}

/** Widget'ın uygulama dışından veri değiştirmesini taklit eder. */
function widgetMarks(habitId: string, day: string) {
  const data = parseAppData(mockDisk)!;
  const habits = data.habits.map((h) =>
    h.id === habitId ? { ...h, completions: [...h.completions, day].sort() } : h,
  );
  mockDisk = serializeAppData({ ...data, habits, updatedAt: data.updatedAt + 1000 });
}

beforeEach(() => {
  mockDisk = null;
  mockSyncWidgets.mockClear();
  __resetStoreForTests();
});

describe('useHabitStore', () => {
  it('boş diskte boş veriyle açılır', async () => {
    await useHabitStore.getState().init();
    const s = useHabitStore.getState();
    expect(s.ready).toBe(true);
    expect(s.data.habits).toEqual([]);
  });

  it('diskteki veriyi yükler', async () => {
    mockDisk = JSON.stringify({ version: 1, updatedAt: 10, habits: [{ id: 'x', name: 'Su', schedule: { kind: 'interval', every: 2 }, completions: [], startDate: '2026-01-01' }] });
    await useHabitStore.getState().init();
    expect(useHabitStore.getState().data.habits[0].name).toBe('Su');
  });

  it('eklenen zinciri hemen gösterir ve diske yazar', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    expect(useHabitStore.getState().data.habits.map((h) => h.id)).toEqual([id]);
    await flushStore();
    expect(stored()?.habits[0]).toMatchObject({ id, name: 'Kitap oku' });
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it('bugünü işaretleyip geri alır', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    expect(useHabitStore.getState().toggleToday(id)).toBe(true);
    expect(useHabitStore.getState().data.habits[0].completions).toEqual([dayNow()]);
    await flushStore();
    expect(stored()?.habits[0].completions).toEqual([dayNow()]);
    expect(useHabitStore.getState().toggleToday(id)).toBe(false);
    await flushStore();
    expect(stored()?.habits[0].completions).toEqual([]);
  });

  it('widget değişikliklerini ezmez', async () => {
    await useHabitStore.getState().init();
    const a = useHabitStore.getState().addHabit(input);
    const b = useHabitStore.getState().addHabit({ ...input, name: 'Koşu' });
    await flushStore();

    // Uygulama arka plandayken widget "a"yı dün için işaretledi
    widgetMarks(a, '2026-01-02');

    // Uygulama bellekteki eski veriyle "b"yi işaretliyor
    useHabitStore.getState().toggleToday(b);
    await flushStore();

    const data = stored()!;
    expect(data.habits.find((h) => h.id === a)?.completions).toEqual(['2026-01-02']);
    expect(data.habits.find((h) => h.id === b)?.completions).toEqual([dayNow()]);
    // Ekran da birleşik sonucu gösterir
    expect(useHabitStore.getState().data.habits.find((h) => h.id === a)?.completions).toEqual(['2026-01-02']);
  });

  it('refresh widget değişikliğini ekrana getirir', async () => {
    await useHabitStore.getState().init();
    const a = useHabitStore.getState().addHabit(input);
    await flushStore();
    widgetMarks(a, '2026-01-03');
    await useHabitStore.getState().refresh();
    expect(useHabitStore.getState().data.habits[0].completions).toEqual(['2026-01-03']);
  });

  it('art arda yapılan değişiklikleri sırayla uygular', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    const s = useHabitStore.getState();
    void s.setCompletion(id, '2026-01-01', true);
    void s.setCompletion(id, '2026-01-02', true);
    void s.setCompletion(id, '2026-01-01', false);
    void s.updateHabit(id, { ...input, name: 'Roman oku' });
    // İyimser durum kuyruk bitmeden doğru
    expect(useHabitStore.getState().data.habits[0]).toMatchObject({ name: 'Roman oku', completions: ['2026-01-02'] });
    await flushStore();
    expect(stored()?.habits[0]).toMatchObject({ name: 'Roman oku', completions: ['2026-01-02'] });
    expect(useHabitStore.getState().data.habits[0]).toMatchObject({ name: 'Roman oku', completions: ['2026-01-02'] });
  });

  it('gelecek günü işaretlemez', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    await useHabitStore.getState().setCompletion(id, '2999-01-01', true);
    expect(useHabitStore.getState().data.habits[0].completions).toEqual([]);
  });

  it('siler, sıralar ve sıfırlar', async () => {
    await useHabitStore.getState().init();
    const a = useHabitStore.getState().addHabit(input);
    const b = useHabitStore.getState().addHabit({ ...input, name: 'B' });
    const c = useHabitStore.getState().addHabit({ ...input, name: 'C' });
    await useHabitStore.getState().reorder([c, a, b]);
    expect(stored()?.habits.map((h) => h.id)).toEqual([c, a, b]);
    await useHabitStore.getState().deleteHabit(a);
    expect(stored()?.habits.map((h) => h.id)).toEqual([c, b]);
    await useHabitStore.getState().resetAll();
    expect(stored()?.habits).toEqual([]);
  });

  it('updatedAt her yazımda artar', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    await flushStore();
    const first = stored()!.updatedAt;
    await useHabitStore.getState().setCompletion(id, '2026-01-01', true);
    expect(stored()!.updatedAt).toBeGreaterThan(first);
  });
});

describe('yedekten geri yükleme', () => {
  const backup = {
    version: 1 as const,
    updatedAt: 5,
    settings: { dayStartHour: 0, grace: false, reminder: { enabled: false, hour: 20, minute: 30 } },
    habits: [
      { id: 'y1', name: 'Yoga', emoji: '🧘', color: '#A35CF0', schedule: input.schedule, startDate: '2026-01-01', completions: ['2026-01-01', '2026-01-02'], createdAt: 1 },
    ],
  };

  it('değiştirirken zincirleri ve ayarları yazar, widget\'ı günceller', async () => {
    await useHabitStore.getState().init();
    useHabitStore.getState().addHabit(input);
    await flushStore();
    mockSyncWidgets.mockClear();

    await useHabitStore.getState().importData(backup, 'replace');
    const data = stored()!;
    expect(data.habits.map((h) => h.name)).toEqual(['Yoga']);
    expect(data.settings).toEqual(backup.settings);
    expect(useHabitStore.getState().today).toBe(dayNow(backup.settings));
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it('birleştirirken mevcut zincirleri ve widget işaretlerini korur', async () => {
    await useHabitStore.getState().init();
    const a = useHabitStore.getState().addHabit(input);
    await flushStore();
    widgetMarks(a, '2026-01-05');

    await useHabitStore.getState().importData(backup, 'merge');
    const data = stored()!;
    expect(data.habits.map((h) => h.name)).toEqual(['Kitap oku', 'Yoga']);
    expect(data.habits[0].completions).toEqual(['2026-01-05']);
    expect(data.settings.grace).toBe(true);
  });
});

describe('ayarlar', () => {
  beforeEach(() => {
    mockDisk = null;
    __resetStoreForTests();
  });

  it('ayarları günceller, diske yazar ve zincirlere dokunmaz', async () => {
    await useHabitStore.getState().init();
    const id = useHabitStore.getState().addHabit(input);
    await useHabitStore.getState().updateSettings({ grace: false, reminder: { hour: 22 } });
    const data = stored()!;
    expect(data.settings).toEqual({ dayStartHour: 3, grace: false, reminder: { enabled: true, hour: 22, minute: 0 } });
    expect(data.habits.map((h) => h.id)).toEqual([id]);
  });

  it('eski verilerde varsayılan ayarları kullanır', async () => {
    mockDisk = JSON.stringify({ version: 1, updatedAt: 1, habits: [] });
    await useHabitStore.getState().init();
    expect(useHabitStore.getState().data.settings).toEqual({
      dayStartHour: 3,
      grace: true,
      reminder: { enabled: true, hour: 21, minute: 0 },
    });
  });
});

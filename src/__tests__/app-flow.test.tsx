import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { __resetStoreForTests, flushStore, useHabitStore } from '@/data/store';
import { addDays, todayKey } from '@/domain/dates';

const ROUTES = './src/app';

async function settle() {
  await act(async () => {
    await flushStore();
    // Gece yarısı zamanlayıcısını tetiklememek için yalnızca kısa bir süre ilerlet.
    jest.advanceTimersByTime(1000);
    await flushStore();
  });
}

async function seed(habits: object[]) {
  __resetStoreForTests();
  await AsyncStorage.setItem('zk.data.v1', JSON.stringify({ version: 1, updatedAt: 1, habits }));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetStoreForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('uygulama akışı', () => {
  it('boş ekrandan ilk zinciri oluşturur', async () => {
    renderRouter(ROUTES, { initialUrl: '/' });
    await settle();

    expect(screen.getByText('İlk zincirini oluştur')).toBeTruthy();
    fireEvent.press(screen.getByTestId('empty-add'));
    await settle();
    expect(screen.getByText('Yeni zincir')).toBeTruthy();

    // İsim boşken kaydedilemez
    const save = screen.getByTestId('habit-save');
    expect(save.props.accessibilityState?.disabled ?? save.props['aria-disabled']).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('habit-name'), '  Kitap oku  ');
    fireEvent.press(screen.getByTestId('mode-weekdays'));
    fireEvent.press(screen.getByTestId('habit-save'));
    await settle();

    const habits = useHabitStore.getState().data.habits;
    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({ name: 'Kitap oku', schedule: { kind: 'days', days: [0, 1, 2, 3, 4] } });
    expect(screen.getByText('Kitap oku')).toBeTruthy();
  });

  it('karttaki düğme bugünü işaretler ve geri alır', async () => {
    await seed([
      {
        id: 'a',
        name: 'Koşu',
        emoji: '🏃',
        color: '#34C759',
        schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
        startDate: addDays(todayKey(), -3),
        completions: [addDays(todayKey(), -2), addDays(todayKey(), -1)],
        createdAt: 1,
      },
    ]);
    renderRouter(ROUTES, { initialUrl: '/' });
    await settle();

    expect(screen.getByText('Zinciri korumak için bugün yap')).toBeTruthy();
    fireEvent.press(screen.getByTestId('habit-check-a'));
    await settle();
    expect(useHabitStore.getState().data.habits[0].completions).toContain(todayKey());
    expect(screen.getByText('Bugün tamamlandı')).toBeTruthy();
    expect(screen.getByText('Bugün tamam!')).toBeTruthy();

    fireEvent.press(screen.getByTestId('habit-check-a'));
    await settle();
    expect(useHabitStore.getState().data.habits[0].completions).not.toContain(todayKey());
  });

  it('detay ekranında seriyi gösterir ve bugünü işaretler', async () => {
    const today = todayKey();
    await seed([
      {
        id: 'b',
        name: 'Su iç',
        emoji: '💧',
        color: '#2E9BF0',
        schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
        startDate: addDays(today, -10),
        completions: [1, 2, 3, 4].map((d) => addDays(today, -d)),
        createdAt: 1,
      },
    ]);
    renderRouter(ROUTES, { initialUrl: '/habit/b' });
    await settle();

    expect(screen.getByText('Su iç')).toBeTruthy();
    expect(screen.getByLabelText('4 günlük zincir')).toBeTruthy();

    fireEvent.press(screen.getByTestId('detail-toggle'));
    await settle();
    expect(screen.getByLabelText('5 günlük zincir')).toBeTruthy();
    expect(screen.getByText('Bugün tamamlandı · geri al')).toBeTruthy();
    expect(useHabitStore.getState().data.habits[0].completions).toContain(today);
  });

  it('olmayan zincir için bilgi gösterir', async () => {
    renderRouter(ROUTES, { initialUrl: '/habit/yok' });
    await settle();
    expect(screen.getByText('Bu zincir bulunamadı')).toBeTruthy();
  });

  it('tanınmayan bağlantıda ana ekrana döner', async () => {
    const { getPathname } = renderRouter(ROUTES, { initialUrl: '/bilinmeyen/yol' });
    await settle();
    expect(getPathname()).toBe('/');
    expect(screen.getByText('İlk zincirini oluştur')).toBeTruthy();
  });

  it('zinciri düzenler', async () => {
    await seed([
      {
        id: 'c',
        name: 'Meditasyon',
        emoji: '🧘',
        color: '#A35CF0',
        schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
        startDate: todayKey(),
        completions: [],
        createdAt: 1,
      },
    ]);
    renderRouter(ROUTES, { initialUrl: '/form?id=c' });
    await settle();

    expect(screen.getByText('Zinciri düzenle')).toBeTruthy();
    expect(screen.getByDisplayValue('Meditasyon')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mode-interval'));
    fireEvent.changeText(screen.getByTestId('habit-name'), 'Nefes egzersizi');
    fireEvent.press(screen.getByTestId('habit-save'));
    await settle();

    expect(useHabitStore.getState().data.habits[0]).toMatchObject({
      name: 'Nefes egzersizi',
      schedule: { kind: 'interval', every: 2 },
    });
  });

  it('belirli günlerde hiç gün seçilmezse kaydetmez', async () => {
    renderRouter(ROUTES, { initialUrl: '/form' });
    await settle();
    fireEvent.changeText(screen.getByTestId('habit-name'), 'Yüzme');
    fireEvent.press(screen.getByTestId('mode-custom'));
    // Varsayılan Pzt/Çar/Cum seçili; hepsini kaldır
    fireEvent.press(screen.getByLabelText('Pzt'));
    fireEvent.press(screen.getByLabelText('Çar'));
    fireEvent.press(screen.getByLabelText('Cum'));
    expect(screen.getByText('Gün seç')).toBeTruthy();
    fireEvent.press(screen.getByTestId('habit-save'));
    await settle();
    expect(useHabitStore.getState().data.habits).toHaveLength(0);
  });
});

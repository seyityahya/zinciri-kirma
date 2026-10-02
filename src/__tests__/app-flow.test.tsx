import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { pickBackup, shareBackup } from '@/data/backup-files';
import { usePrefs } from '@/data/prefs';
import { __resetStoreForTests, dayNow, flushStore, useHabitStore } from '@/data/store';
import { addDays } from '@/domain/dates';
import { emptyData } from '@/domain/types';

jest.mock('@/data/backup-files', () => ({
  pickBackup: jest.fn(),
  shareBackup: jest.fn(async () => true),
  saveBackupToFolder: jest.fn(),
}));

const ROUTES = './src/app';

const BACKUP_HABIT = {
  id: 'h',
  name: 'Zincir',
  emoji: '🔥',
  color: '#FF6B3D',
  schedule: { kind: 'days' as const, days: [0, 1, 2, 3, 4, 5, 6] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[] },
  startDate: '2026-01-01',
  completions: ['2026-01-01', '2026-01-02'],
  createdAt: 1,
};

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
  usePrefs.setState({ lastBackupAt: null });
  jest.clearAllMocks();
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
        startDate: addDays(dayNow(), -3),
        completions: [addDays(dayNow(), -2), addDays(dayNow(), -1)],
        createdAt: 1,
      },
    ]);
    renderRouter(ROUTES, { initialUrl: '/' });
    await settle();

    expect(screen.getByText('Zinciri korumak için bugün yap')).toBeTruthy();
    fireEvent.press(screen.getByTestId('habit-check-a'));
    await settle();
    expect(useHabitStore.getState().data.habits[0].completions).toContain(dayNow());
    expect(screen.getByText('Bugün tamamlandı')).toBeTruthy();
    expect(screen.getByText('Bugün tamam!')).toBeTruthy();

    fireEvent.press(screen.getByTestId('habit-check-a'));
    await settle();
    expect(useHabitStore.getState().data.habits[0].completions).not.toContain(dayNow());
  });

  it('detay ekranında seriyi gösterir ve bugünü işaretler', async () => {
    const today = dayNow();
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

  it('ayarlardan zincir kurallarını ve hatırlatmayı değiştirir', async () => {
    renderRouter(ROUTES, { initialUrl: '/settings' });
    await settle();
    expect(screen.getByText('Akşam hatırlatması')).toBeTruthy();
    expect(screen.getByText('21:00')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Daha geç'));
    await settle();
    expect(useHabitStore.getState().data.settings.reminder).toMatchObject({ hour: 21, minute: 30 });

    fireEvent(screen.getByTestId('grace-toggle'), 'valueChange', false);
    await settle();
    expect(useHabitStore.getState().data.settings.grace).toBe(false);

    fireEvent.press(screen.getByLabelText('Gün gece yarısı bitsin'));
    await settle();
    expect(useHabitStore.getState().data.settings.dayStartHour).toBe(0);

    fireEvent(screen.getByTestId('reminder-toggle'), 'valueChange', false);
    await settle();
    expect(useHabitStore.getState().data.settings.reminder.enabled).toBe(false);
    expect(screen.queryByText('21:30')).toBeNull();
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
        startDate: dayNow(),
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

  it('boş ekrandan yedeği geri yükler', async () => {
    jest.mocked(pickBackup).mockResolvedValueOnce({
      ok: true,
      exportedAt: new Date(2026, 9, 1, 14, 5).getTime(),
      data: {
        ...emptyData(),
        habits: [
          { ...BACKUP_HABIT, id: 'y1', name: 'Yoga', emoji: '🧘' },
          { ...BACKUP_HABIT, id: 'y2', name: 'Su iç', emoji: '💧', completions: [addDays(dayNow(), -1)] },
        ],
      },
    });
    renderRouter(ROUTES, { initialUrl: '/' });
    await settle();

    fireEvent.press(screen.getByTestId('empty-restore'));
    await settle();
    expect(screen.getByText('Yedeği geri yükle')).toBeTruthy();
    expect(screen.getByText('1 Ekim 2026, 14:05 tarihli yedek')).toBeTruthy();
    expect(screen.getByLabelText('2 zincir')).toBeTruthy();
    expect(screen.getByLabelText('3 halka')).toBeTruthy();
    // Telefonda zincir yokken seçenek sorulmaz
    expect(screen.queryByTestId('restore-merge')).toBeNull();

    fireEvent.press(screen.getByTestId('restore-confirm'));
    await settle();
    expect(useHabitStore.getState().data.habits.map((h) => h.name)).toEqual(['Yoga', 'Su iç']);
    expect(screen.getAllByText('Yoga').length).toBeGreaterThan(0);
  });

  it('ayarlardan yedeği birleştirir ve geri alır', async () => {
    await seed([{ ...BACKUP_HABIT, id: 'mevcut', name: 'Kitap oku', emoji: '📚' }]);
    jest.mocked(pickBackup).mockResolvedValueOnce({
      ok: true,
      exportedAt: null,
      data: { ...emptyData(), habits: [{ ...BACKUP_HABIT, id: 'y1', name: 'Yoga' }] },
    });
    renderRouter(ROUTES, { initialUrl: '/settings' });
    await settle();

    fireEvent.press(screen.getByTestId('backup-restore'));
    await settle();
    expect(screen.getByText('Bu telefonda şu an 1 zincir var. Ne yapmak istersin?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('restore-merge'));
    await settle();
    expect(useHabitStore.getState().data.habits.map((h) => h.name)).toEqual(['Kitap oku', 'Yoga']);
    expect(screen.getByText('Yedek birleştirildi. Şimdi 2 zincirin var.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('backup-undo'));
    await settle();
    expect(useHabitStore.getState().data.habits.map((h) => h.name)).toEqual(['Kitap oku']);
    expect(screen.getByText('Değişiklik geri alındı.')).toBeTruthy();
  });

  it('yedek olmayan dosyada ne yapılacağını söyler', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(pickBackup).mockResolvedValueOnce({ ok: false, error: 'not-backup' });
    renderRouter(ROUTES, { initialUrl: '/settings' });
    await settle();

    fireEvent.press(screen.getByTestId('backup-restore'));
    await settle();
    expect(alert).toHaveBeenCalledWith('Bu bir yedek dosyası değil', expect.stringContaining('zinciri-kirma-yedek'));
    expect(screen.queryByText('Yedeği geri yükle')).toBeNull();
    alert.mockRestore();
  });

  it('yedek alır ve son yedek bilgisini günceller', async () => {
    await seed([{ ...BACKUP_HABIT, id: 'a', name: 'Kitap oku' }]);
    renderRouter(ROUTES, { initialUrl: '/settings' });
    await settle();
    expect(screen.getByText('Henüz yedek almadın')).toBeTruthy();

    fireEvent.press(screen.getByTestId('backup-export'));
    await settle();
    expect(shareBackup).toHaveBeenCalledWith(expect.objectContaining({ habits: [expect.objectContaining({ id: 'a' })] }));
    expect(screen.getByText('Son yedek: bugün')).toBeTruthy();
  });

  it('zincir yokken yedek alınamaz', async () => {
    renderRouter(ROUTES, { initialUrl: '/settings' });
    await settle();
    const button = screen.getByTestId('backup-export');
    expect(button.props.accessibilityState?.disabled ?? button.props['aria-disabled']).toBeTruthy();
    expect(screen.getByText('Yedeklenecek zincir yok')).toBeTruthy();
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

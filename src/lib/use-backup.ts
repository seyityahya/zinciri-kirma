import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { pickBackup, saveBackupToFolder, shareBackup } from '@/data/backup-files';
import { usePrefs } from '@/data/prefs';
import { useHabitStore } from '@/data/store';
import { backupErrorText, type RestoreMode } from '@/domain/backup';
import type { AppData } from '@/domain/types';
import { requestNotificationPermission, syncReminders } from '@/notifications/reminders';

import { haptic } from './haptics';

/** Aynı anda tek bir dosya işlemi yürüsün; düğmeler bu sırada yükleniyor görünür. */
function useSingleTask() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>, failure: { title: string; message: string }) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      console.warn('[backup]', error);
      haptic.warning();
      Alert.alert(failure.title, failure.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}

const SAVE_FAILED = { title: 'Yedek kaydedilemedi', message: 'Bir sorun oldu. Tekrar dene ya da başka bir yere kaydet.' };

export function useBackupExport({ onSaved }: { onSaved: (folder: string | null) => void }) {
  const { busy, run } = useSingleTask();

  const markBackedUp = () => usePrefs.getState().update({ lastBackupAt: Date.now() });

  const share = () =>
    run(async () => {
      const shared = await shareBackup(useHabitStore.getState().data);
      if (!shared) {
        Alert.alert('Paylaşım kullanılamıyor', 'Bu cihazda paylaşım menüsü açılamadı.');
        return;
      }
      markBackedUp();
    }, SAVE_FAILED);

  const saveToFolder = () =>
    run(async () => {
      const result = await saveBackupToFolder(useHabitStore.getState().data);
      if (result.status === 'canceled') return;
      markBackedUp();
      haptic.success();
      onSaved(result.folder);
    }, SAVE_FAILED);

  return { busy, share, saveToFolder };
}

export interface PendingRestore {
  data: AppData;
  exportedAt: number | null;
}

export interface RestoreOutcome {
  mode: RestoreMode;
  /** Geri almak için, geri yüklemeden hemen önceki veri. */
  previous: AppData;
  habitCount: number;
}

/** Geri yükledikten sonra hatırlatma açıksa ve bu cihazda hiç sorulmadıysa bildirim izni ister. */
function askForRemindersOnce() {
  const { data } = useHabitStore.getState();
  if (!data.settings.reminder.enabled || usePrefs.getState().notificationAsked) return;
  usePrefs.getState().update({ notificationAsked: true });
  setTimeout(() => {
    void requestNotificationPermission().then((granted) => {
      if (granted) void syncReminders(useHabitStore.getState().data);
    });
  }, 700);
}

/** Dosya seç → özet göster → onayla. */
export function useRestore() {
  const { busy, run } = useSingleTask();
  const [pending, setPending] = useState<PendingRestore | null>(null);

  const start = () =>
    run(
      async () => {
        const result = await pickBackup();
        if (!result) return;
        if (!result.ok) {
          const { title, message } = backupErrorText(result.error);
          haptic.warning();
          Alert.alert(title, message);
          return;
        }
        haptic.selection();
        setPending({ data: result.data, exportedAt: result.exportedAt });
      },
      backupErrorText('read-failed'),
    );

  const apply = async (mode: RestoreMode): Promise<RestoreOutcome | null> => {
    if (!pending) return null;
    const previous = useHabitStore.getState().data;
    setPending(null);
    await useHabitStore.getState().importData(pending.data, mode);
    haptic.success();
    askForRemindersOnce();
    return { mode, previous, habitCount: useHabitStore.getState().data.habits.length };
  };

  return { busy, pending, start, apply, cancel: () => setPending(null) };
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AppData } from '@/domain/types';

import { planReminders, REMINDER_PREFIX } from './plan';

const CHANNEL_ID = 'reminders';
let configured = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let latest: AppData | null = null;
let running: Promise<void> = Promise.resolve();

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Akşam hatırlatması',
      description: 'O gün bekleyen zincirlerin için günde en fazla bir bildirim',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FF5A36',
    }).catch(() => {});
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** İzin ister (daha önce reddedildiyse sistem yeniden sormaz). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  configure();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const result = await Notifications.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

/** Bekleyen hatırlatmaları verilere göre baştan kurar (günde en fazla bir bildirim). */
export async function syncReminders(data: AppData, now: Date = new Date()): Promise<void> {
  if (Platform.OS === 'web') return;
  configure();
  const run = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      for (const r of planReminders(data, now)) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, sound: true, data: { url: 'sozumsoz://' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: r.at,
            channelId: CHANNEL_ID,
          },
        });
      }
    } catch (error) {
      console.warn('[hatırlatma] kurulamadı', error);
    }
  };
  running = running.then(run, run);
  return running;
}

/** Değişikliklerden sonra kısa bir gecikmeyle (art arda dokunuşları birleştirerek) yeniden kurar. */
export function scheduleReminderSync(data: AppData): void {
  latest = data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (latest) void syncReminders(latest);
  }, 700);
}

/** Bekleyen gecikmeli kurulumu hemen çalıştırır (Android widget arka plan görevi bitmeden). */
export async function flushReminderSync(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    if (latest) await syncReminders(latest);
  } else {
    await running;
  }
}

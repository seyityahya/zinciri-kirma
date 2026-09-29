'use no memo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate, type WidgetInfo, type WidgetRepresentation } from 'react-native-android-widget';

import { WIDGET_CONFIG_KEY } from '@/config';
import { todayKey } from '@/domain/dates';
import type { AppData, Habit } from '@/domain/types';

import { EmptyWidget, HabitWidgetView, TodayWidgetView } from './views';

export const HABIT_WIDGET = 'HabitWidget';
export const TODAY_WIDGET = 'TodayWidget';

// ---------------------------------------------------------------------------
// Widget örneği → zincir eşleşmesi
// ---------------------------------------------------------------------------

type WidgetConfig = Record<string, string>;

export async function readWidgetConfig(): Promise<WidgetConfig> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as WidgetConfig) : {};
  } catch {
    return {};
  }
}

export async function setWidgetHabit(widgetId: number, habitId: string | null): Promise<void> {
  const config = await readWidgetConfig();
  if (habitId) config[String(widgetId)] = habitId;
  else delete config[String(widgetId)];
  await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
}

export function pickHabit(habits: Habit[], habitId: string | undefined): Habit | undefined {
  return habits.find((h) => h.id === habitId) ?? habits[0];
}

// ---------------------------------------------------------------------------
// Çizim
// ---------------------------------------------------------------------------

export function habitWidget(habit: Habit | undefined, today = todayKey()): WidgetRepresentation {
  if (!habit) return { light: <EmptyWidget mode="light" />, dark: <EmptyWidget mode="dark" /> };
  return {
    light: <HabitWidgetView habit={habit} today={today} mode="light" />,
    dark: <HabitWidgetView habit={habit} today={today} mode="dark" />,
  };
}

/** Yüksekliğe göre kaç satır sığar (başlık ~28dp, satır ~40dp). */
export function rowsFor(heightDp: number): number {
  return Math.max(1, Math.floor((heightDp - 24 - 28) / 40));
}

export function todayWidget(habits: Habit[], heightDp: number, today = todayKey()): WidgetRepresentation {
  if (habits.length === 0) return { light: <EmptyWidget mode="light" />, dark: <EmptyWidget mode="dark" /> };
  // Hepsi sığmıyorsa "+N zincir daha" satırına da yer ayır.
  const maxRows = habits.length > rowsFor(heightDp) ? rowsFor(heightDp - 18) : rowsFor(heightDp);
  return {
    light: <TodayWidgetView habits={habits} today={today} mode="light" maxRows={maxRows} />,
    dark: <TodayWidgetView habits={habits} today={today} mode="dark" maxRows={maxRows} />,
  };
}

export async function renderFor(info: WidgetInfo, data: AppData): Promise<WidgetRepresentation> {
  if (info.widgetName === TODAY_WIDGET) return todayWidget(data.habits, info.height);
  const config = await readWidgetConfig();
  return habitWidget(pickHabit(data.habits, config[String(info.widgetId)]));
}

/** Ana ekrandaki tüm widget'ları verilen veriyle yeniden çizer. */
export async function updateAllWidgets(data: AppData): Promise<void> {
  const config = await readWidgetConfig();
  await Promise.all([
    requestWidgetUpdate({
      widgetName: HABIT_WIDGET,
      renderWidget: (info) => habitWidget(pickHabit(data.habits, config[String(info.widgetId)])),
    }),
    requestWidgetUpdate({
      widgetName: TODAY_WIDGET,
      renderWidget: (info) => todayWidget(data.habits, info.height),
    }),
  ]);
}

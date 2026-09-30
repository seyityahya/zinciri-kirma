'use no memo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate, type WidgetInfo, type WidgetRepresentation } from 'react-native-android-widget';

import { WIDGET_CONFIG_KEY } from '@/config';
import { type DayKey, logicalDayKey } from '@/domain/dates';
import type { AppData, Habit } from '@/domain/types';

import { EmptyWidget, HabitMiniWidgetView, HabitWidgetView, TodayWidgetView } from './views';

export const HABIT_WIDGET = 'HabitWidget';
export const HABIT_MINI_WIDGET = 'HabitMiniWidget';
export const TODAY_WIDGET = 'TodayWidget';

/** Tek bir zincir gösteren (zincir seçilebilen) widget türleri. */
export const SINGLE_HABIT_WIDGETS = [HABIT_WIDGET, HABIT_MINI_WIDGET];

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

/** Widget'ların gösterdiği "bugün" (ayardaki gün bitişi saatine göre). */
export function widgetDay(data: AppData, now: Date = new Date()): DayKey {
  return logicalDayKey(now, data.settings.dayStartHour);
}

const empty = (): WidgetRepresentation => ({ light: <EmptyWidget mode="light" />, dark: <EmptyWidget mode="dark" /> });

export function habitWidget(
  habit: Habit | undefined,
  data: AppData,
  widgetName: string = HABIT_WIDGET,
  today: DayKey = widgetDay(data),
): WidgetRepresentation {
  if (!habit) return empty();
  const View = widgetName === HABIT_MINI_WIDGET ? HabitMiniWidgetView : HabitWidgetView;
  const grace = data.settings.grace;
  return {
    light: <View habit={habit} today={today} grace={grace} mode="light" />,
    dark: <View habit={habit} today={today} grace={grace} mode="dark" />,
  };
}

/** Tüm zincirler kaydırılabilir bir listede (ListWidget) gösterilir. */
export function todayWidget(data: AppData, today: DayKey = widgetDay(data)): WidgetRepresentation {
  const habits = data.habits;
  if (habits.length === 0) return empty();
  const grace = data.settings.grace;
  return {
    light: <TodayWidgetView habits={habits} today={today} grace={grace} mode="light" />,
    dark: <TodayWidgetView habits={habits} today={today} grace={grace} mode="dark" />,
  };
}

export async function renderFor(info: WidgetInfo, data: AppData): Promise<WidgetRepresentation> {
  if (info.widgetName === TODAY_WIDGET) return todayWidget(data);
  const config = await readWidgetConfig();
  return habitWidget(pickHabit(data.habits, config[String(info.widgetId)]), data, info.widgetName);
}

/** Ana ekrandaki tüm widget'ları verilen veriyle yeniden çizer. */
export async function updateAllWidgets(data: AppData): Promise<void> {
  const config = await readWidgetConfig();
  await Promise.all([
    ...SINGLE_HABIT_WIDGETS.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => habitWidget(pickHabit(data.habits, config[String(info.widgetId)]), data, widgetName),
      }),
    ),
    requestWidgetUpdate({
      widgetName: TODAY_WIDGET,
      renderWidget: () => todayWidget(data),
    }),
  ]);
}

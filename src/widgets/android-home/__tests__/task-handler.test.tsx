import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { __resetStoreForTests, dayNow, useHabitStore } from '@/data/store';
import { addDays } from '@/domain/dates';

import { widgetTaskHandler } from '../task-handler';

const today = dayNow();

async function seed() {
  await AsyncStorage.setItem(
    'zk.data.v1',
    JSON.stringify({
      version: 1,
      updatedAt: 1,
      habits: [
        {
          id: 'a',
          name: 'Kitap oku',
          emoji: '📚',
          color: '#FF6B3D',
          schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
          startDate: addDays(today, -5),
          completions: [addDays(today, -1)],
          createdAt: 0,
        },
      ],
    }),
  );
}

function props(overrides: Partial<WidgetTaskHandlerProps>): WidgetTaskHandlerProps {
  return {
    widgetInfo: {
      widgetName: 'HabitWidget',
      widgetId: 7,
      width: 160,
      height: 160,
      screenInfo: { screenHeightDp: 800, screenWidthDp: 400, density: 3, densityDpi: 480 },
    },
    widgetAction: 'WIDGET_UPDATE',
    renderWidget: jest.fn(),
    ...overrides,
  };
}

async function stored() {
  return JSON.parse((await AsyncStorage.getItem('zk.data.v1')) ?? '{}');
}

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetStoreForTests();
  await seed();
});

describe('Android widget görev işleyicisi', () => {
  it('güncellemede veriyi yükleyip çizer', async () => {
    const p = props({});
    await widgetTaskHandler(p);
    expect(useHabitStore.getState().ready).toBe(true);
    expect(p.renderWidget).toHaveBeenCalledTimes(1);
  });

  it('TOGGLE bugünü işaretler ve diske yazar', async () => {
    const p = props({ widgetAction: 'WIDGET_CLICK', clickAction: 'TOGGLE', clickActionData: { habitId: 'a', day: today } });
    await widgetTaskHandler(p);
    expect((await stored()).habits[0].completions).toContain(today);
    expect(p.renderWidget).toHaveBeenCalled();
  });

  it('dünü gösteren eski widget’a dokunulursa işaretlemez, yeniden çizer', async () => {
    const p = props({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'TOGGLE',
      clickActionData: { habitId: 'a', day: addDays(today, -1) },
    });
    await widgetTaskHandler(p);
    expect((await stored()).habits[0].completions).not.toContain(today);
    expect(p.renderWidget).toHaveBeenCalled();
  });

  it('widget silinince eşleşmesini kaldırır', async () => {
    await AsyncStorage.setItem('zk.android-widgets.v1', JSON.stringify({ '7': 'a', '8': 'a' }));
    await widgetTaskHandler(props({ widgetAction: 'WIDGET_DELETED' }));
    expect(JSON.parse((await AsyncStorage.getItem('zk.android-widgets.v1')) ?? '{}')).toEqual({ '8': 'a' });
  });
});

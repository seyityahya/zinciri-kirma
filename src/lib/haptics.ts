import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { usePrefs } from '@/data/prefs';

function enabled(): boolean {
  return Platform.OS !== 'web' && usePrefs.getState().haptics;
}

export const haptic = {
  /** Zincire halka eklendi. */
  success() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** İşaret kaldırıldı ya da küçük bir etkileşim. */
  light() {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium() {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  selection() {
    if (enabled()) Haptics.selectionAsync().catch(() => {});
  },
  warning() {
    if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};

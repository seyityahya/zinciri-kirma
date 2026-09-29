import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { radius, useTheme } from '@/theme';

import { Txt } from './ui';

export interface SheetAction {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Alttan açılan seçenek menüsü. */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Açılırken hemen monte et; kapanırken animasyon bitince kaldır.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.set(withSpring(1, { damping: 22, stiffness: 260 }));
    } else {
      progress.set(
        withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * 320 }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 6 },
            sheet,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <View style={styles.header}>
              <Txt variant="headline" align="center" numberOfLines={1}>
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="caption" tone="secondary" align="center" style={{ marginTop: 2 }}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
          ) : null}
          {actions.map((action) => {
            const Icon = action.icon;
            const color = action.destructive ? colors.danger : colors.text;
            return (
              <Pressable
                key={action.label}
                disabled={action.disabled}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: pressed ? colors.surfacePressed : colors.surfaceAlt, opacity: action.disabled ? 0.4 : 1 },
                ]}
              >
                <Icon size={20} color={color} strokeWidth={2.2} />
                <Txt variant="headline" color={color} style={{ fontWeight: '600' }}>
                  {action.label}
                </Txt>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }]}
          >
            <Txt variant="headline" tone="secondary" align="center">
              Vazgeç
            </Txt>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
  },
  cancel: {
    height: 50,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
});

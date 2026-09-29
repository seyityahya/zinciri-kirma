import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { onColor, withAlpha } from '@/theme';

interface Props {
  done: boolean;
  tint: string;
  onPress: () => void;
  size?: number;
  accessibilityLabel: string;
  testID?: string;
}

/** Bugünü işaretleyen yuvarlak düğme. */
export function CheckButton({ done, tint, onPress, size = 52, accessibilityLabel, testID }: Props) {
  const progress = useSharedValue(done ? 1 : 0);
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(done ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [done, progress]);

  const soft = withAlpha(tint, 0.1);
  const ring = withAlpha(tint, 0.5);
  const mark = onColor(tint);
  const faint = withAlpha(tint, 0.35);

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [soft, tint]),
    borderColor: interpolateColor(progress.get(), [0, 1], [ring, tint]),
    transform: [{ scale: scale.get() }],
  }));

  const doneMark = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.4, 1]) }],
  }));

  const idleMark = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.get(), [0, 0.1, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(burst.get(), [0, 1], [1, 1.9]) }],
  }));

  const handlePress = () => {
    scale.set(withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 260 })));
    if (!done) {
      burst.set(0);
      burst.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    }
    onPress();
  };

  const radius = size / 2;
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{ width: size, height: size }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 2, borderColor: tint },
          burstStyle,
        ]}
      />
      <Animated.View style={[styles.circle, { borderRadius: radius }, circleStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, idleMark]}>
          <Check size={size * 0.44} color={faint} strokeWidth={2.6} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, doneMark]}>
          <Check size={size * 0.46} color={mark} strokeWidth={3.2} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    flex: 1,
    borderWidth: 2,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

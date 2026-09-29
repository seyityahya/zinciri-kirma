import { ChevronLeft, Flame, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { radius, roundedFont, useTheme, withAlpha } from '@/theme';

// ---------------------------------------------------------------------------
// Metin
// ---------------------------------------------------------------------------

type Variant = 'hero' | 'display' | 'title' | 'headline' | 'body' | 'callout' | 'caption' | 'overline';
type Tone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'danger' | 'inverse';

const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontSize: 64, lineHeight: 70, fontWeight: '800', fontFamily: roundedFont, letterSpacing: -1.5 },
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', fontFamily: roundedFont, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontFamily: roundedFont, letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  caption: { fontSize: 12.5, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
};

interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

/** Türkçe büyük harf: i → İ, ı → I (textTransform bunu bilmez). */
export function upperTr(text: string): string {
  return text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

export function Txt({ variant = 'body', tone = 'primary', color, weight, align, style, children, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const toneColor: Record<Tone, string> = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    brand: colors.brand,
    danger: colors.danger,
    inverse: colors.onBrand,
  };
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? toneColor[tone] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {variant === 'overline' && typeof children === 'string' ? upperTr(children) : children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Basılabilir ölçekleme
// ---------------------------------------------------------------------------

interface ScalePressableProps extends PressableProps {
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
  scaleTo?: number;
}

export function ScalePressable({ style, children, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: ScalePressableProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Rozetler
// ---------------------------------------------------------------------------

export function EmojiBadge({ emoji, tint, size = 46 }: { emoji: string; tint: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: withAlpha(tint, 0.15),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}

export function StreakPill({ streak, unit, active }: { streak: number; unit: string; active: boolean }) {
  const { colors } = useTheme();
  const color = active ? colors.flame : colors.textTertiary;
  return (
    <View
      style={[styles.pill, { backgroundColor: active ? withAlpha(colors.flame, 0.12) : colors.surfaceAlt }]}
      accessible
      accessibilityLabel={`${streak} ${unit} zincir`}
    >
      <Flame size={14} color={color} fill={active ? color : 'transparent'} strokeWidth={2.4} />
      <Text style={[styles.pillNumber, { color }]} allowFontScaling={false}>
        {streak}
      </Text>
      <Text style={[styles.pillUnit, { color }]} allowFontScaling={false}>
        {unit}
      </Text>
    </View>
  );
}

export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - clamped)}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Düğmeler
// ---------------------------------------------------------------------------

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tone = 'default',
  size = 40,
  testID,
}: {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'default' | 'danger' | 'plain';
  size?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'plain' ? 'transparent' : colors.surface;
  const fg = tone === 'danger' ? colors.danger : colors.text;
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      scaleTo={0.9}
      testID={testID}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: tone === 'default' ? colors.border : 'transparent',
        },
      ]}
    >
      <Icon size={size * 0.48} color={fg} strokeWidth={2.2} />
    </ScalePressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return <IconButton icon={ChevronLeft} onPress={onPress} accessibilityLabel="Geri" />;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  color,
  textColor,
  icon: Icon,
  variant = 'solid',
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  textColor?: string;
  icon?: LucideIcon;
  variant?: 'solid' | 'soft';
  testID?: string;
}) {
  const { colors } = useTheme();
  const base = color ?? colors.brand;
  const bg = variant === 'solid' ? base : withAlpha(base, 0.14);
  const fg = textColor ?? (variant === 'solid' ? colors.onBrand : base);
  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.primary, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={20} color={fg} strokeWidth={2.6} /> : null}
          <Text style={[styles.primaryLabel, { color: fg }]} maxFontSizeMultiplier={1.4}>
            {label}
          </Text>
        </>
      )}
    </ScalePressable>
  );
}

// ---------------------------------------------------------------------------
// Kartlar ve bölümler
// ---------------------------------------------------------------------------

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; padded?: boolean }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: scheme === 'dark' ? 0 : 0.06,
        },
        padded ? { padding: 16 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="overline" tone="secondary">
        {children}
      </Txt>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
  },
  pillNumber: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: roundedFont,
    fontVariant: ['tabular-nums'],
  },
  pillUnit: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryLabel: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: roundedFont,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 0,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});

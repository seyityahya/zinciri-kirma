import { Check, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Weekday } from '@/domain/dates';
import { WEEKDAY_SHORT } from '@/domain/labels';
import { haptic } from '@/lib/haptics';
import { HABIT_COLORS, HABIT_EMOJIS, onColor, radius, roundedFont, useTheme, withAlpha } from '@/theme';

import { Txt } from './ui';

export function EmojiGrid({ value, tint, onChange }: { value: string; tint: string; onChange: (emoji: string) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const columns = 8;
  const gap = 6;
  const cell = width > 0 ? Math.floor((width - gap * (columns - 1)) / columns) : 40;

  return (
    <View
      style={styles.grid}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel="Simge"
    >
      {HABIT_EMOJIS.map((emoji) => {
        const selected = emoji === value;
        return (
          <Pressable
            key={emoji}
            onPress={() => {
              haptic.selection();
              onChange(emoji);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={emoji}
            style={[
              styles.emojiCell,
              {
                width: cell,
                height: cell,
                backgroundColor: selected ? withAlpha(tint, 0.18) : colors.surfaceAlt,
                borderColor: selected ? tint : 'transparent',
              },
            ]}
          >
            <Text style={{ fontSize: cell * 0.5 }} allowFontScaling={false}>
              {emoji}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.colors} accessibilityRole="radiogroup" accessibilityLabel="Renk">
      {HABIT_COLORS.map((c) => {
        const selected = c.hex.toUpperCase() === value.toUpperCase();
        return (
          <View key={c.hex} style={styles.colorCell}>
            <Pressable
              onPress={() => {
                haptic.selection();
                onChange(c.hex);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={c.name}
              hitSlop={4}
              style={[styles.colorRing, { borderColor: selected ? c.hex : 'transparent' }]}
            >
              <View style={[styles.colorDot, { backgroundColor: c.hex, borderColor: colors.surface }]}>
                {selected ? <Check size={16} color={onColor(c.hex)} strokeWidth={3.2} /> : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function DayPicker({ value, tint, onChange }: { value: Weekday[]; tint: string; onChange: (days: Weekday[]) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.days}>
      {WEEKDAY_SHORT.map((label, i) => {
        const day = i as Weekday;
        const selected = value.includes(day);
        return (
          <Pressable
            key={label}
            onPress={() => {
              haptic.selection();
              onChange(selected ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            style={[
              styles.day,
              {
                backgroundColor: selected ? tint : colors.surfaceAlt,
              },
            ]}
          >
            <Text
              style={[styles.dayLabel, { color: selected ? onColor(tint) : colors.textSecondary }]}
              allowFontScaling={false}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  suffix,
  onChange,
  tint,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
  tint: string;
}) {
  const { colors } = useTheme();
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      haptic.selection();
      onChange(next);
    }
  };
  return (
    <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt }]}>
      <Pressable
        onPress={() => change(-1)}
        disabled={value <= min}
        accessibilityRole="button"
        accessibilityLabel="Azalt"
        hitSlop={6}
        style={[styles.stepButton, { backgroundColor: colors.surface, opacity: value <= min ? 0.4 : 1 }]}
      >
        <Minus size={18} color={colors.text} strokeWidth={2.6} />
      </Pressable>
      <View style={styles.stepValue} accessible accessibilityLabel={`${value} ${suffix}`}>
        <Text style={[styles.stepNumber, { color: tint }]} allowFontScaling={false}>
          {value}
        </Text>
        <Txt variant="callout" tone="secondary">
          {suffix}
        </Txt>
      </View>
      <Pressable
        onPress={() => change(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel="Artır"
        hitSlop={6}
        style={[styles.stepButton, { backgroundColor: colors.surface, opacity: value >= max ? 0.4 : 1 }]}
      >
        <Plus size={18} color={colors.text} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

export function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
  tint,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  tint: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.option,
        {
          backgroundColor: selected ? withAlpha(tint, 0.08) : colors.surface,
          borderColor: selected ? withAlpha(tint, 0.6) : colors.border,
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (!selected) haptic.selection();
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        testID={testID}
        style={styles.optionHead}
      >
        <View style={[styles.radio, { borderColor: selected ? tint : colors.textTertiary }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: tint }]} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="headline" style={{ fontSize: 16 }}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" tone="secondary" style={{ marginTop: 1 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </Pressable>
      {selected && children ? <View style={styles.optionBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  colorCell: {
    width: '20%',
    alignItems: 'center',
  },
  colorRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: {
    flexDirection: 'row',
    gap: 6,
  },
  day: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: 6,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  stepNumber: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: roundedFont,
    fontVariant: ['tabular-nums'],
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  optionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});

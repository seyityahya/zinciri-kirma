import { memo, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { useHabitStore } from '@/data/store';
import type { DayKey } from '@/domain/dates';
import { statusText, unitLabel } from '@/domain/labels';
import { computeStatus, type HabitStatus, recentSlots } from '@/domain/streak';
import type { Habit } from '@/domain/types';
import { haptic } from '@/lib/haptics';
import { type Palette, radius, useTheme } from '@/theme';

import { ChainRow, linksThatFit } from './chain-links';
import { CheckButton } from './check-button';
import { EmojiBadge, ScalePressable, StreakPill, Txt } from './ui';

export function statusTone(status: HabitStatus, colors: Palette): string {
  if (status.doneToday) return colors.success;
  if (status.state === 'broken') return colors.danger;
  if (status.weekLost) return status.graceAvailable ? colors.warning : colors.danger;
  if (status.graceUsed) return colors.warning;
  if (status.dueToday) return colors.brand;
  return colors.textSecondary;
}

interface Props {
  habit: Habit;
  today: DayKey;
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
}

export const HabitCard = memo(function HabitCard({ habit, today, onOpen, onLongPress }: Props) {
  const { colors, scheme } = useTheme();
  const [chainWidth, setChainWidth] = useState(0);
  const grace = useHabitStore((s) => s.data.settings.grace);
  const status = useMemo(() => computeStatus(habit, today, grace), [habit, today, grace]);
  const count = chainWidth > 0 ? Math.min(14, linksThatFit(chainWidth, 'sm')) : 7;
  const slots = useMemo(() => recentSlots(habit, today, count, grace), [habit, today, count, grace]);
  const text = statusText(habit.schedule, status, today);

  const toggle = () => {
    const done = useHabitStore.getState().toggleToday(habit.id);
    if (done) haptic.success();
    else haptic.light();
  };

  const onChainLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (Math.abs(w - chainWidth) > 2) setChainWidth(w);
  };

  return (
    <ScalePressable
      onPress={() => onOpen(habit.id)}
      onLongPress={() => {
        haptic.medium();
        onLongPress(habit.id);
      }}
      delayLongPress={350}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}. ${text}. ${status.streak} ${unitLabel(status.unit)} zincir.`}
      accessibilityHint="Ayrıntılar için dokun, seçenekler için basılı tut"
      accessibilityActions={[
        { name: 'toggle', label: status.doneToday ? 'Bugünü geri al' : 'Bugün yaptım' },
        { name: 'menu', label: 'Seçenekler' },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'toggle') toggle();
        else if (e.nativeEvent.actionName === 'menu') onLongPress(habit.id);
      }}
      testID={`habit-card-${habit.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: scheme === 'dark' ? 0 : 0.07,
        },
      ]}
    >
      <View style={styles.top}>
        <EmojiBadge emoji={habit.emoji} tint={habit.color} />
        <View style={styles.titles}>
          <Txt variant="headline" numberOfLines={1}>
            {habit.name}
          </Txt>
          <Txt variant="caption" color={statusTone(status, colors)} numberOfLines={1} style={styles.status}>
            {text}
          </Txt>
        </View>
        <CheckButton
          done={status.doneToday}
          tint={habit.color}
          onPress={toggle}
          accessibilityLabel={status.doneToday ? `${habit.name}: bugünü geri al` : `${habit.name}: bugün yaptım`}
          testID={`habit-check-${habit.id}`}
        />
      </View>
      <View style={styles.bottom}>
        <View style={styles.chain} onLayout={onChainLayout}>
          <ChainRow slots={slots} tint={habit.color} size="sm" />
        </View>
        <StreakPill streak={status.streak} unit={unitLabel(status.unit)} active={status.streak > 0} />
      </View>
    </ScalePressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingBottom: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    marginTop: 3,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  chain: {
    flex: 1,
    overflow: 'hidden',
  },
});

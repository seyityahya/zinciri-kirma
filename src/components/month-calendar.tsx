import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { type DayKey, daysInMonth, parseDayKey, weekdayOf } from '@/domain/dates';
import { MONTH_NAMES, WEEKDAY_LETTER } from '@/domain/labels';
import { calendarDayState, type CalendarDayState, missMarks } from '@/domain/streak';
import type { Habit } from '@/domain/types';
import { onColor, roundedFont, useTheme, withAlpha } from '@/theme';

import { Txt } from './ui';

interface Props {
  habit: Habit;
  today: DayKey;
  grace: boolean;
  onToggle: (day: DayKey, done: boolean) => void;
}

function monthKey(year: number, month: number) {
  return { year, month };
}

function shift({ year, month }: { year: number; month: number }, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

const MAX_MONTHS_BACK = 36;

export function MonthCalendar({ habit, today, grace, onToggle }: Props) {
  const { colors } = useTheme();
  const t = parseDayKey(today);
  const [offset, setOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const current = shift(monthKey(t.year, t.month), -offset);

  const marks = useMemo(() => missMarks(habit, today, grace), [habit, today, grace]);
  const cells = useMemo(() => {
    const first = `${current.year}-${pad(current.month)}-01`;
    const lead = weekdayOf(first);
    const total = daysInMonth(current.year, current.month);
    const list: ({ day: DayKey; n: number; state: CalendarDayState } | null)[] = [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let n = 1; n <= total; n++) {
      const day = `${current.year}-${pad(current.month)}-${pad(n)}`;
      list.push({ day, n, state: calendarDayState(habit, day, today, marks) });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [current.year, current.month, habit, today, marks]);

  const cell = width > 0 ? Math.floor(width / 7) : 44;
  const dot = Math.min(40, cell - 6);
  const tint = habit.color;

  const doneCount = cells.filter((c) => c?.state === 'done').length;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setOffset((o) => Math.min(MAX_MONTHS_BACK, o + 1))}
          disabled={offset >= MAX_MONTHS_BACK}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Önceki ay"
          style={[styles.nav, { backgroundColor: colors.surfaceAlt }]}
        >
          <ChevronLeft size={18} color={colors.text} strokeWidth={2.4} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Txt variant="headline" accessibilityRole="header">
            {MONTH_NAMES[current.month - 1]} {current.year}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {doneCount > 0 ? `${doneCount} halka` : 'Henüz halka yok'}
          </Txt>
        </View>
        <Pressable
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Sonraki ay"
          style={[styles.nav, { backgroundColor: colors.surfaceAlt, opacity: offset === 0 ? 0.35 : 1 }]}
        >
          <ChevronRight size={18} color={colors.text} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAY_LETTER.map((letter, i) => (
          <View key={`${letter}-${i}`} style={{ width: cell, alignItems: 'center' }}>
            <Text style={[styles.weekday, { color: colors.textTertiary }]} allowFontScaling={false}>
              {letter}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={`blank-${i}`} style={{ width: cell, height: cell }} />;
          const { state } = c;
          const done = state === 'done';
          const disabled = state === 'future';
          let bg = 'transparent';
          let fg = colors.text;
          let border = 'transparent';
          if (done) {
            bg = tint;
            fg = onColor(tint);
          } else if (state === 'missed') {
            bg = colors.dangerSoft;
            fg = colors.danger;
          } else if (state === 'forgiven') {
            bg = colors.warningSoft;
            fg = colors.warning;
          } else if (state === 'today') {
            border = tint;
            bg = withAlpha(tint, 0.08);
          } else if (state === 'rest') {
            fg = colors.textTertiary;
          } else if (state === 'future') {
            fg = colors.textTertiary;
          } else {
            fg = colors.textSecondary;
          }
          const isToday = c.day === today;
          return (
            <Pressable
              key={c.day}
              disabled={disabled}
              onPress={() => onToggle(c.day, !done)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled }}
              accessibilityLabel={`${c.n} ${MONTH_NAMES[current.month - 1]}${done ? ', yapıldı' : state === 'missed' ? ', kaçırıldı' : state === 'forgiven' ? ', hata payıyla geçildi' : state === 'rest' ? ', izin günü' : ''}`}
              style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.day,
                    {
                      width: dot,
                      height: dot,
                      borderRadius: dot / 2,
                      backgroundColor: bg,
                      borderColor: isToday && done ? withAlpha(onColor(tint), 0.6) : border,
                      opacity: pressed ? 0.6 : disabled ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.dayText, { color: fg, fontWeight: done || isToday ? '800' : '600' }]}
                    allowFontScaling={false}
                  >
                    {c.n}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={tint} label="Yapıldı" />
        {habit.schedule.kind === 'days' ? <Legend color={colors.danger} soft label="Kaçırıldı" /> : null}
        {habit.schedule.kind === 'days' && grace ? <Legend color={colors.warning} soft label="Hata payı" /> : null}
        <Legend color={tint} ring label="Bugün" />
      </View>
    </View>
  );
}

function Legend({ color, label, soft, ring }: { color: string; label: string; soft?: boolean; ring?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: ring ? 'transparent' : soft ? withAlpha(color, 0.25) : color,
          borderWidth: ring ? 2 : 0,
          borderColor: color,
        }}
      />
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dayText: {
    fontSize: 15,
    fontFamily: roundedFont,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

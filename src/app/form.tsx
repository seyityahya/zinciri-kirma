import { router, useLocalSearchParams } from 'expo-router';
import { Check, Trash2, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChainRow } from '@/components/chain-links';
import { ColorPicker, DayPicker, EmojiGrid, OptionRow, Stepper } from '@/components/form-controls';
import { EmojiBadge, IconButton, PrimaryButton, SectionTitle, Txt } from '@/components/ui';
import { useHabit, useHabitStore } from '@/data/store';
import type { Weekday } from '@/domain/dates';
import { ALL_DAYS, scheduleExplanation, scheduleLabel, WORK_DAYS } from '@/domain/labels';
import { findPreset } from '@/domain/presets';
import { type Habit, NAME_MAX_LENGTH, type Schedule, SCHEDULE_LIMITS } from '@/domain/types';
import { haptic } from '@/lib/haptics';
import { useKeyboardOverlap } from '@/lib/use-keyboard-overlap';
import { HABIT_COLORS, onColor, radius, useTheme, withAlpha } from '@/theme';

type Mode = 'daily' | 'weekdays' | 'custom' | 'interval' | 'weekly';

interface FormState {
  name: string;
  emoji: string;
  color: string;
  mode: Mode;
  days: Weekday[];
  every: number;
  times: number;
}

function sameDays(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

function fromSchedule(schedule: Schedule): Pick<FormState, 'mode' | 'days' | 'every' | 'times'> {
  const base = { days: [0, 2, 4] as Weekday[], every: 2, times: 3 };
  switch (schedule.kind) {
    case 'days':
      if (schedule.days.length === 7) return { ...base, mode: 'daily' };
      if (sameDays(schedule.days, WORK_DAYS)) return { ...base, mode: 'weekdays' };
      return { ...base, mode: 'custom', days: schedule.days };
    case 'interval':
      return { ...base, mode: 'interval', every: schedule.every };
    case 'weekly':
      return { ...base, mode: 'weekly', times: schedule.times };
  }
}

function toSchedule(state: FormState): Schedule {
  switch (state.mode) {
    case 'daily':
      return { kind: 'days', days: ALL_DAYS };
    case 'weekdays':
      return { kind: 'days', days: WORK_DAYS };
    case 'custom':
      return { kind: 'days', days: state.days };
    case 'interval':
      return { kind: 'interval', every: state.every };
    case 'weekly':
      return { kind: 'weekly', times: state.times };
  }
}

export default function HabitFormScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; preset?: string }>();
  const ready = useHabitStore((s) => s.ready);
  const existing = useHabit(params.id);

  // Veri yüklenmeden form kurulursa düzenlenecek zincirin bilgileri boş gelir.
  if (!ready) return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  return <HabitForm key={params.id ?? 'new'} existing={existing} preset={params.preset} />;
}

function HabitForm({ existing, preset }: { existing: Habit | undefined; preset: string | undefined }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const editing = existing !== undefined;

  const [state, setState] = useState<FormState>(() => {
    const source = existing ?? findPreset(preset);
    if (source) {
      return { name: source.name, emoji: source.emoji, color: source.color, ...fromSchedule(source.schedule) };
    }
    const count = useHabitStore.getState().data.habits.length;
    return {
      name: '',
      emoji: '🔥',
      color: HABIT_COLORS[count % HABIT_COLORS.length].hex,
      mode: 'daily',
      days: [0, 2, 4],
      every: 2,
      times: 3,
    };
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }));

  const schedule = useMemo(() => toSchedule(state), [state]);
  const trimmed = state.name.trim();
  const daysInvalid = state.mode === 'custom' && state.days.length === 0;
  const valid = trimmed.length > 0 && !daysInvalid;
  const tint = state.color;

  const save = () => {
    if (!valid) return;
    const input = { name: trimmed, emoji: state.emoji, color: state.color, schedule };
    const store = useHabitStore.getState();
    if (existing) {
      void store.updateHabit(existing.id, input);
    } else {
      store.addHabit(input);
    }
    haptic.success();
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Zinciri sil', `“${existing.name}” ve tüm geçmişi silinecek. Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          haptic.warning();
          const id = existing.id;
          // Önce ekrandan çık, sonra sil: aksi hâlde kapanırken boş form görünür.
          router.dismissTo('/');
          setTimeout(() => void useHabitStore.getState().deleteHabit(id), 450);
        },
      },
    ]);
  };

  const topPad = Platform.OS === 'ios' ? 16 : insets.top + 8;
  const root = useRef<View>(null);
  const keyboard = useKeyboardOverlap(root);

  return (
    <View ref={root} style={[styles.screen, { backgroundColor: colors.background, paddingBottom: keyboard }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Txt variant="title" accessibilityRole="header">
          {editing ? 'Zinciri düzenle' : 'Yeni zincir'}
        </Txt>
        <IconButton icon={X} onPress={() => router.back()} accessibilityLabel="Kapat" size={36} testID="form-close" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.preview, { backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.25) }]}>
          <EmojiBadge emoji={state.emoji} tint={tint} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="headline" numberOfLines={1} tone={trimmed ? 'primary' : 'tertiary'}>
              {trimmed || 'Zincirinin adı'}
            </Txt>
            <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
              {daysInvalid ? 'Gün seç' : scheduleLabel(schedule)}
            </Txt>
            <ChainRow
              size="sm"
              tint={tint}
              style={{ marginTop: 8 }}
              slots={[
                { key: '1', state: 'done' },
                { key: '2', state: 'done' },
                { key: '3', state: 'done' },
                { key: '4', state: 'done' },
                { key: '5', state: 'pending' },
              ]}
            />
          </View>
        </View>

        <SectionTitle
          right={
            <Txt variant="caption" tone="tertiary">
              {state.name.length}/{NAME_MAX_LENGTH}
            </Txt>
          }
        >
          Ne yapacaksın?
        </SectionTitle>
        {/* Kontrolsüz: hızlı yazarken imlecin başa atlamasını ve harf kaybını önler. */}
        <TextInput
          defaultValue={state.name}
          onChangeText={(text) => set('name', text)}
          placeholder="ör. 20 dakika kitap oku"
          placeholderTextColor={colors.textTertiary}
          maxLength={NAME_MAX_LENGTH}
          autoFocus={!editing && !preset}
          returnKeyType="done"
          selectionColor={tint}
          cursorColor={tint}
          accessibilityLabel="Zincirin adı"
          testID="habit-name"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />

        <SectionTitle>Simge</SectionTitle>
        <View style={styles.section}>
          <EmojiGrid value={state.emoji} tint={tint} onChange={(emoji) => set('emoji', emoji)} />
        </View>

        <SectionTitle>Renk</SectionTitle>
        <View style={styles.section}>
          <ColorPicker value={state.color} onChange={(hex) => set('color', hex)} />
        </View>

        <SectionTitle>Ne sıklıkla?</SectionTitle>
        <View style={styles.options}>
          <OptionRow title="Her gün" subtitle="Haftanın 7 günü" selected={state.mode === 'daily'} onPress={() => set('mode', 'daily')} tint={tint} testID="mode-daily" />
          <OptionRow title="Hafta içi" subtitle="Pazartesi – Cuma" selected={state.mode === 'weekdays'} onPress={() => set('mode', 'weekdays')} tint={tint} testID="mode-weekdays" />
          <OptionRow title="Belirli günler" subtitle="Günleri sen seç" selected={state.mode === 'custom'} onPress={() => set('mode', 'custom')} tint={tint} testID="mode-custom">
            <DayPicker value={state.days} tint={tint} onChange={(days) => set('days', days)} />
          </OptionRow>
          <OptionRow title="Birkaç günde bir" subtitle="ör. 2 günde bir" selected={state.mode === 'interval'} onPress={() => set('mode', 'interval')} tint={tint} testID="mode-interval">
            <Stepper
              value={state.every}
              min={SCHEDULE_LIMITS.intervalMin}
              max={SCHEDULE_LIMITS.intervalMax}
              suffix="günde bir"
              tint={tint}
              onChange={(v) => set('every', v)}
            />
          </OptionRow>
          <OptionRow title="Haftada birkaç kez" subtitle="Günler esnek" selected={state.mode === 'weekly'} onPress={() => set('mode', 'weekly')} tint={tint} testID="mode-weekly">
            <Stepper
              value={state.times}
              min={SCHEDULE_LIMITS.weeklyMin}
              max={6}
              suffix={state.times === 1 ? 'kez (haftada bir)' : 'kez'}
              tint={tint}
              onChange={(v) => set('times', v)}
            />
          </OptionRow>
        </View>

        <View style={[styles.explain, { backgroundColor: colors.surfaceAlt }]}>
          <Txt variant="callout" tone="secondary">
            {scheduleExplanation(schedule)}
          </Txt>
        </View>

        {editing ? (
          <Pressable onPress={remove} accessibilityRole="button" style={styles.delete} hitSlop={8}>
            <Trash2 size={18} color={colors.danger} />
            <Txt variant="callout" tone="danger" weight="600">
              Zinciri sil
            </Txt>
          </Pressable>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: keyboard > 0 ? 12 : Math.max(insets.bottom, 14),
            backgroundColor: colors.background,
            borderTopColor: colors.separator,
          },
        ]}
      >
        <PrimaryButton
          label={editing ? 'Kaydet' : 'Zinciri başlat'}
          icon={Check}
          onPress={save}
          disabled={!valid}
          color={tint}
          textColor={onColor(tint)}
          testID="habit-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    gap: 0,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: 22,
  },
  input: {
    height: 56,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  options: {
    gap: 8,
  },
  explain: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.lg,
  },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 10,
  },
  section: {
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

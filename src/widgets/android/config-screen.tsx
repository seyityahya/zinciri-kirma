import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { EmojiBadge, PrimaryButton, Txt } from '@/components/ui';
import { useHabitStore } from '@/data/store';
import { scheduleLabel } from '@/domain/labels';
import { radius, useTheme, withAlpha } from '@/theme';

import { habitWidget, readWidgetConfig, setWidgetHabit } from './render';

/** Android: "Tek Zincir" widget'ı eklenirken hangi zincirin gösterileceğini seçtirir. */
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const { colors } = useTheme();
  const ready = useHabitStore((s) => s.ready);
  const habits = useHabitStore((s) => s.data.habits);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void useHabitStore.getState().init();
    void readWidgetConfig().then((config) => setSelected(config[String(widgetInfo.widgetId)] ?? null));
  }, [widgetInfo.widgetId]);

  const choose = async (habitId: string) => {
    setSelected(habitId);
    await setWidgetHabit(widgetInfo.widgetId, habitId);
    renderWidget(habitWidget(habits.find((h) => h.id === habitId)));
    setResult('ok');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: (StatusBar.currentHeight ?? 24) + 16 }]}>
      <Txt variant="overline" tone="brand">
        Zinciri Kırma
      </Txt>
      <Txt variant="display" style={{ marginTop: 4 }}>
        Hangi zincir görünsün?
      </Txt>
      <Txt variant="callout" tone="secondary" style={{ marginTop: 6, marginBottom: 18 }}>
        Widget’taki düğmeye dokunarak bu zinciri uygulamayı açmadan işaretleyebilirsin.
      </Txt>

      {ready && habits.length === 0 ? (
        <View style={styles.empty}>
          <Txt variant="headline" align="center">
            Henüz zincirin yok
          </Txt>
          <Txt variant="callout" tone="secondary" align="center" style={{ marginTop: 6, marginBottom: 18 }}>
            Önce uygulamada bir zincir oluştur, sonra widget’ı ekle.
          </Txt>
          <PrimaryButton
            label="Uygulamayı aç"
            onPress={() => {
              setResult('cancel');
              void Linking.openURL('zincirikirma://form');
            }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
          {habits.map((habit) => {
            const active = habit.id === selected;
            return (
              <Pressable
                key={habit.id}
                onPress={() => void choose(habit.id)}
                accessibilityRole="button"
                accessibilityLabel={habit.name}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                    borderColor: active ? habit.color : colors.border,
                  },
                ]}
              >
                <EmojiBadge emoji={habit.emoji} tint={habit.color} size={42} />
                <View style={{ flex: 1 }}>
                  <Txt variant="headline" numberOfLines={1}>
                    {habit.name}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {scheduleLabel(habit.schedule)}
                  </Txt>
                </View>
                {active ? (
                  <View style={[styles.check, { backgroundColor: withAlpha(habit.color, 0.16) }]}>
                    <Check size={16} color={habit.color} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Pressable onPress={() => setResult('cancel')} style={styles.cancel} accessibilityRole="button">
        <Txt variant="headline" tone="secondary" align="center">
          Vazgeç
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  cancel: {
    height: 50,
    justifyContent: 'center',
  },
});

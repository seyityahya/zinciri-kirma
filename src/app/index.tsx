import { router } from 'expo-router';
import { ArchiveRestore, ArrowDown, ArrowUp, Pencil, Plus, Settings2, Smartphone, Trash2, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/action-sheet';
import { ChainRow } from '@/components/chain-links';
import { HabitCard } from '@/components/habit-card';
import { RestoreSheet } from '@/components/restore-sheet';
import { Card, IconButton, PrimaryButton, ProgressRing, ScalePressable, Txt } from '@/components/ui';
import { usePrefs } from '@/data/prefs';
import { useHabitStore } from '@/data/store';
import { longDateLabel, unitLabel } from '@/domain/labels';
import { PRESETS } from '@/domain/presets';
import { chainAgeDays, computeStatus, countsToday } from '@/domain/streak';
import { haptic } from '@/lib/haptics';
import { useRestore } from '@/lib/use-backup';
import { radius, roundedFont, useTheme, withAlpha } from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const habits = useHabitStore((s) => s.data.habits);
  const today = useHabitStore((s) => s.today);
  const ready = useHabitStore((s) => s.ready);
  const tipDismissed = usePrefs((s) => s.widgetTipDismissed);
  const [menuId, setMenuId] = useState<string | null>(null);
  const restore = useRestore();

  const openHabit = useCallback((id: string) => router.push({ pathname: '/habit/[id]', params: { id } }), []);
  const openMenu = useCallback((id: string) => setMenuId(id), []);

  const menuHabit = habits.find((h) => h.id === menuId);
  const menuIndex = menuHabit ? habits.indexOf(menuHabit) : -1;

  const move = (delta: -1 | 1) => {
    if (menuIndex < 0) return;
    const ids = habits.map((h) => h.id);
    const j = menuIndex + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[menuIndex], ids[j]] = [ids[j], ids[menuIndex]];
    haptic.selection();
    void useHabitStore.getState().reorder(ids);
  };

  const confirmDelete = (id: string) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    Alert.alert('Zinciri sil', `“${habit.name}” ve tüm geçmişi silinecek. Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          haptic.warning();
          void useHabitStore.getState().deleteHabit(id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Txt variant="overline" tone="brand">
              Zinciri Kırma
            </Txt>
            <Txt variant="display" style={{ marginTop: 2 }} accessibilityRole="header">
              {longDateLabel(today)}
            </Txt>
          </View>
          <IconButton icon={Settings2} onPress={() => router.push('/settings')} accessibilityLabel="Ayarlar" testID="open-settings" />
        </View>

        {!ready ? null : habits.length === 0 ? (
          <EmptyState onRestore={() => void restore.start()} restoring={restore.busy} />
        ) : (
          <>
            <Summary />
            {!tipDismissed ? <WidgetTip /> : null}
            <View style={styles.list}>
              {habits.map((habit, i) => (
                <Animated.View
                  key={habit.id}
                  entering={FadeInDown.delay(Math.min(i, 8) * 45).springify().damping(18)}
                  exiting={FadeOut.duration(160)}
                  layout={LinearTransition.springify().damping(20)}
                >
                  <HabitCard habit={habit} today={today} onOpen={openHabit} onLongPress={openMenu} />
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {ready && habits.length > 0 ? (
        <Animated.View entering={FadeIn.delay(200)} style={[styles.fabWrap, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
          <ScalePressable
            onPress={() => router.push('/form')}
            accessibilityRole="button"
            accessibilityLabel="Yeni zincir"
            testID="add-habit"
            style={[styles.fab, { backgroundColor: colors.brand, shadowColor: colors.brand }]}
          >
            <Plus size={22} color={colors.onBrand} strokeWidth={2.8} />
            <Txt variant="headline" color={colors.onBrand} style={{ fontWeight: '700', fontFamily: roundedFont }}>
              Yeni zincir
            </Txt>
          </ScalePressable>
        </Animated.View>
      ) : null}

      <ActionSheet
        visible={menuHabit !== undefined}
        title={menuHabit ? `${menuHabit.emoji}  ${menuHabit.name}` : undefined}
        onClose={() => setMenuId(null)}
        actions={
          menuHabit
            ? [
                { label: 'Düzenle', icon: Pencil, onPress: () => router.push({ pathname: '/form', params: { id: menuHabit.id } }) },
                { label: 'Yukarı taşı', icon: ArrowUp, onPress: () => move(-1), disabled: menuIndex <= 0 },
                { label: 'Aşağı taşı', icon: ArrowDown, onPress: () => move(1), disabled: menuIndex >= habits.length - 1 },
                { label: 'Sil', icon: Trash2, destructive: true, onPress: () => confirmDelete(menuHabit.id) },
              ]
            : []
        }
      />
      <RestoreSheet
        backup={restore.pending}
        currentCount={habits.length}
        onRestore={(mode) => void restore.apply(mode)}
        onClose={restore.cancel}
      />
    </View>
  );
}

function Summary() {
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.data.habits);
  const today = useHabitStore((s) => s.today);
  const grace = useHabitStore((s) => s.data.settings.grace);

  const { relevant, done, best } = useMemo(() => {
    const items = habits.map((habit) => ({ habit, status: computeStatus(habit, today, grace) }));
    const rel = items.filter((x) => countsToday(x.habit.schedule, x.status));
    // Farklı birimleri (gün/hafta/kez) karşılaştırmak için zincirin kaç gündür sürdüğüne bak.
    const top = items.reduce<(typeof items)[number] | null>((acc, x) => {
      if (x.status.streak <= 0) return acc;
      if (!acc) return x;
      return chainAgeDays(x.status, today) > chainAgeDays(acc.status, today) ? x : acc;
    }, null);
    return { relevant: rel.length, done: rel.filter((x) => x.status.doneToday).length, best: top };
  }, [habits, today, grace]);

  const left = relevant - done;
  let title: string;
  let subtitle: string;
  if (relevant === 0) {
    title = 'Bugün izin günü';
    subtitle = 'Hiçbir zincirin bugün seni beklemiyor. Dinlen.';
  } else if (left === 0) {
    title = 'Bugün tamam!';
    subtitle = 'Bütün halkalar yerinde. Yarın görüşürüz.';
  } else {
    title = left === 1 ? '1 halka kaldı' : `${left} halka kaldı`;
    subtitle = done === 0 ? 'Küçük bir adımla başla.' : 'Az kaldı, zinciri kırma!';
  }

  const progress = relevant === 0 ? 1 : done / relevant;
  const complete = relevant > 0 && left === 0;

  return (
    <Card style={styles.summary}>
      <ProgressRing size={76} stroke={8} progress={progress} color={complete ? colors.success : colors.brand} track={colors.track}>
        <Txt variant="headline" style={{ fontFamily: roundedFont, fontWeight: '800', fontSize: 19 }} allowFontScaling={false}>
          {relevant === 0 ? '—' : `${done}/${relevant}`}
        </Txt>
      </ProgressRing>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="title" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="callout" tone="secondary" style={{ marginTop: 2 }}>
          {subtitle}
        </Txt>
        {best ? (
          <Txt variant="caption" tone="secondary" style={{ marginTop: 8 }} numberOfLines={1}>
            <Txt variant="caption" color={colors.flame} weight="800">
              🔥 {best.status.streak} {unitLabel(best.status.unit)}
            </Txt>
            {'  '}en uzun zincirin · {best.habit.name}
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}

function WidgetTip() {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(120)} exiting={FadeOut}>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Uygulamayı açmadan işaretle. Widget nasıl eklenir?"
        accessibilityActions={[{ name: 'dismiss', label: 'İpucunu kapat' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'dismiss') usePrefs.getState().update({ widgetTipDismissed: true });
        }}
        style={[styles.tip, { backgroundColor: withAlpha(colors.brand, 0.1), borderColor: withAlpha(colors.brand, 0.2) }]}
      >
        <View style={[styles.tipIcon, { backgroundColor: withAlpha(colors.brand, 0.16) }]}>
          <Smartphone size={20} color={colors.brand} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="callout" weight="700">
            Uygulamayı açmadan işaretle
          </Txt>
          <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            Ana ekranına widget ekle, tek dokunuşla halkanı tak. Nasıl? →
          </Txt>
        </View>
        <Pressable
          onPress={() => usePrefs.getState().update({ widgetTipDismissed: true })}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="İpucunu kapat"
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ onRestore, restoring }: { onRestore: () => void; restoring: boolean }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.empty}>
      <View style={[styles.emptyArt, { backgroundColor: withAlpha(colors.brand, 0.08) }]}>
        <ChainRow
          size="lg"
          tint={colors.brand}
          slots={[
            { key: 'a', state: 'done' },
            { key: 'b', state: 'done' },
            { key: 'c', state: 'pending' },
          ]}
        />
      </View>
      <Txt variant="display" align="center" style={{ marginTop: 26 }}>
        İlk zincirini oluştur
      </Txt>
      <Txt variant="body" tone="secondary" align="center" style={styles.emptyText}>
        Her gün küçük bir adım at, halkaları birbirine ekle. Zincir uzadıkça onu kırmak istemeyeceksin.
      </Txt>
      <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
        <PrimaryButton label="Zincir oluştur" icon={Plus} onPress={() => router.push('/form')} testID="empty-add" />
      </View>
      <Pressable
        onPress={onRestore}
        disabled={restoring}
        accessibilityRole="button"
        accessibilityLabel="Yedeğin var mı? Yedekten geri yükle"
        testID="empty-restore"
        style={({ pressed }) => [
          styles.restoreLink,
          { backgroundColor: pressed ? colors.surfacePressed : 'transparent', opacity: restoring ? 0.5 : 1 },
        ]}
      >
        <ArchiveRestore size={17} color={colors.textSecondary} strokeWidth={2.4} />
        <Txt variant="callout" tone="secondary">
          Yedeğin var mı?{' '}
          <Txt variant="callout" tone="brand" weight="700">
            Geri yükle
          </Txt>
        </Txt>
      </Pressable>

      <Txt variant="overline" tone="secondary" style={{ marginTop: 34, marginBottom: 12 }}>
        Ya da birini seç
      </Txt>
      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <ScalePressable
            key={preset.key}
            onPress={() => router.push({ pathname: '/form', params: { preset: preset.key } })}
            accessibilityRole="button"
            accessibilityLabel={`${preset.name} zinciri oluştur`}
            style={[styles.preset, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Txt style={{ fontSize: 18 }}>{preset.emoji}</Txt>
            <Txt variant="callout" weight="600">
              {preset.name}
            </Txt>
          </ScalePressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  restoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  list: {
    gap: 12,
    marginTop: 12,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 26,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 6,
  },
  emptyArt: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    maxWidth: 320,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

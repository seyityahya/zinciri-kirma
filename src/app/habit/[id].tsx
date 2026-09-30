import { router, useLocalSearchParams } from 'expo-router';
import { Check, Flame, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChainRow } from '@/components/chain-links';
import { statusTone } from '@/components/habit-card';
import { MonthCalendar } from '@/components/month-calendar';
import { BackButton, Card, EmojiBadge, IconButton, PrimaryButton, SectionTitle, Txt } from '@/components/ui';
import { useHabit, useHabitStore } from '@/data/store';
import { diffDays } from '@/domain/dates';
import { chainLengthLabel, fullDateLabel, scheduleLabel, statusText, unitLabel } from '@/domain/labels';
import { computeStatus, recentSlots } from '@/domain/streak';
import { haptic } from '@/lib/haptics';
import { onColor, radius, roundedFont, useTheme, withAlpha } from '@/theme';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function HabitDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const today = useHabitStore((s) => s.today);
  const ready = useHabitStore((s) => s.ready);
  const chainScroll = useRef<ScrollView>(null);

  const grace = useHabitStore((s) => s.data.settings.grace);
  const status = useMemo(() => (habit ? computeStatus(habit, today, grace) : null), [habit, today, grace]);
  const slots = useMemo(() => (habit ? recentSlots(habit, today, 21, grace) : []), [habit, today, grace]);

  if (!habit || !status) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        <View style={[styles.topBar, { alignSelf: 'stretch' }]}>
          <BackButton onPress={goBack} />
        </View>
        {ready ? (
          <View style={styles.missingBody}>
            <Txt variant="title" align="center">
              Bu zincir bulunamadı
            </Txt>
            <Txt variant="body" tone="secondary" align="center" style={{ marginTop: 6 }}>
              Silinmiş olabilir.
            </Txt>
          </View>
        ) : null}
      </View>
    );
  }

  const tint = habit.color;
  const unit = unitLabel(status.unit);
  const text = statusText(habit.schedule, status, today);

  const toggleToday = () => {
    const done = useHabitStore.getState().toggleToday(habit.id);
    if (done) haptic.success();
    else haptic.light();
  };

  const toggleDay = (day: string, done: boolean) => {
    if (done) haptic.success();
    else haptic.light();
    void useHabitStore.getState().setCompletion(habit.id, day, done);
  };

  const remove = () => {
    Alert.alert('Zinciri sil', `“${habit.name}” ve tüm geçmişi silinecek. Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          haptic.warning();
          const habitId = habit.id;
          // Önce geri dön, sonra sil: aksi hâlde kapanırken "bulunamadı" ekranı görünür.
          goBack();
          setTimeout(() => void useHabitStore.getState().deleteHabit(habitId), 450);
        },
      },
    ]);
  };

  const rate = status.successRate === null ? '—' : `%${Math.round(status.successRate * 100)}`;
  const chainDays = status.chainStart ? diffDays(today, status.chainStart) + 1 : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
        <BackButton onPress={goBack} />
        <View style={styles.topActions}>
          <IconButton
            icon={Pencil}
            onPress={() => router.push({ pathname: '/form', params: { id: habit.id } })}
            accessibilityLabel="Düzenle"
            testID="detail-edit"
          />
          <IconButton icon={Trash2} onPress={remove} accessibilityLabel="Sil" tone="danger" testID="detail-delete" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
          <EmojiBadge emoji={habit.emoji} tint={tint} size={80} />
          <Txt variant="display" align="center" style={{ marginTop: 14 }} accessibilityRole="header">
            {habit.name}
          </Txt>
          <Txt variant="callout" tone="secondary" align="center" style={{ marginTop: 4 }}>
            {scheduleLabel(habit.schedule)}
          </Txt>

          <View style={styles.streak} accessible accessibilityLabel={`${status.streak} ${chainLengthLabel(status.unit)}`}>
            <Animated.View key={status.streak} entering={ZoomIn.springify().damping(12)}>
              <Flame
                size={40}
                color={status.streak > 0 ? colors.flame : colors.textTertiary}
                fill={status.streak > 0 ? colors.flame : 'transparent'}
                strokeWidth={2}
              />
            </Animated.View>
            <Txt variant="hero" style={{ fontVariant: ['tabular-nums'] }} allowFontScaling={false}>
              {status.streak}
            </Txt>
          </View>
          <Txt variant="callout" tone="secondary" style={{ marginTop: -2 }}>
            {chainLengthLabel(status.unit)}
          </Txt>
          <View style={[styles.statusChip, { backgroundColor: withAlpha(statusTone(status, colors), 0.12) }]}>
            <Txt variant="callout" weight="600" color={statusTone(status, colors)} align="center">
              {text}
            </Txt>
          </View>
        </Animated.View>

        <View style={{ marginTop: 22 }}>
          {status.doneToday ? (
            <PrimaryButton label="Bugün tamamlandı · geri al" icon={RotateCcw} onPress={toggleToday} variant="soft" color={tint} testID="detail-toggle" />
          ) : (
            <PrimaryButton label="Bugün yaptım" icon={Check} onPress={toggleToday} color={tint} textColor={onColor(tint)} testID="detail-toggle" />
          )}
        </View>

        <View style={styles.stats}>
          <Stat label="En uzun" value={`${status.best}`} unit={unit} />
          <Stat label="Toplam" value={`${status.total}`} unit="kez" />
          <Stat label="Başarı" value={rate} />
        </View>

        {grace && status.state !== 'new' && status.state !== 'broken' ? (
          <View
            style={[
              styles.grace,
              { backgroundColor: status.graceUsed ? colors.warningSoft : colors.surfaceAlt },
            ]}
          >
            <ShieldCheck size={20} color={status.graceUsed ? colors.warning : colors.success} strokeWidth={2.4} />
            <Txt variant="callout" tone="secondary" style={{ flex: 1 }}>
              {status.graceUsed ? (
                <>
                  <Txt variant="callout" color={colors.warning} weight="700">
                    Hata payını kullandın.{' '}
                  </Txt>
                  Zincir sağlam ama {status.graceRenewIn} halka boyunca bir daha kaçırırsan kırılır.
                </>
              ) : (
                <>
                  <Txt variant="callout" weight="700">
                    Hata payın hazır.{' '}
                  </Txt>
                  Art arda 7 halkada 1 kez kaçırmak zinciri kırmaz.
                </>
              )}
            </Txt>
          </View>
        ) : null}

        <SectionTitle>Son halkalar</SectionTitle>
        <Card style={{ paddingVertical: 18 }}>
          <ScrollView
            ref={chainScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => chainScroll.current?.scrollToEnd({ animated: false })}
          >
            <ChainRow slots={slots} tint={tint} size="md" />
          </ScrollView>
          <Txt variant="caption" tone="secondary" style={{ marginTop: 12 }}>
            {status.chainStart
              ? `Mevcut zincir ${fullDateLabel(status.chainStart)} tarihinden beri sürüyor${status.unit === 'day' ? '' : ` (${chainDays} gün)`}.`
              : status.state === 'broken'
                ? 'Zincir kırıldı. Bugün yeni bir halka ekleyerek yeniden başla.'
                : 'İlk halkayı eklediğinde zincirin burada büyüyecek.'}
          </Txt>
        </Card>

        <View style={{ height: 24 }} />
        <SectionTitle>Takvim</SectionTitle>
        <Card>
          <MonthCalendar habit={habit} today={today} grace={grace} onToggle={toggleDay} />
        </Card>
        <Txt variant="caption" tone="tertiary" align="center" style={{ marginTop: 10 }}>
          Unuttuğun bir günü işaretlemek ya da düzeltmek için takvimde güne dokun.
        </Txt>
        <Txt variant="caption" tone="tertiary" align="center" style={{ marginTop: 4 }}>
          Başlangıç: {fullDateLabel(habit.startDate)}
        </Txt>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Txt variant="caption" tone="secondary">
        {label}
      </Txt>
      <View style={styles.statValue}>
        <Txt variant="title" style={{ fontFamily: roundedFont, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          {value}
        </Txt>
        {unit ? (
          <Txt variant="caption" tone="secondary" weight="600">
            {unit}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  missing: {
    paddingHorizontal: 18,
  },
  missingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  content: {
    paddingHorizontal: 18,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 6,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  statusChip: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 24,
  },
  grace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    marginTop: -10,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
});

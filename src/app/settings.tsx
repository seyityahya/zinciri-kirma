import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Check, Flame, FlaskConical, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react-native';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Card, PrimaryButton, SectionTitle, Txt } from '@/components/ui';
import { demoHabits } from '@/data/demo';
import { type ThemePreference, usePrefs } from '@/data/prefs';
import { useHabitStore } from '@/data/store';
import { haptic } from '@/lib/haptics';
import { radius, roundedFont, useTheme, withAlpha } from '@/theme';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Sistem', icon: Monitor },
  { value: 'light', label: 'Açık', icon: Sun },
  { value: 'dark', label: 'Koyu', icon: Moon },
];

const IOS_STEPS = [
  'Ana ekranda boş bir yere basılı tut, simgeler titremeye başlasın.',
  'Sol üstteki “Düzenle” ya da “+” düğmesine dokun, “Widget ekle”yi seç.',
  'Listeden “Zinciri Kırma”yı bul; “Tek Zincir” ya da “Bugün” widget’ını ekle.',
  'Tek Zincir widget’ına basılı tutup “Widget’ı Düzenle” ile hangi zinciri göstereceğini seç.',
];

const ANDROID_STEPS = [
  'Ana ekranda boş bir yere basılı tut ve “Widget’lar”a dokun.',
  '“Zinciri Kırma”yı bul; “Tek Zincir” ya da “Bugün” widget’ını ana ekrana sürükle.',
  'Tek Zincir widget’ını eklerken göstermek istediğin zinciri seç.',
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const theme = usePrefs((s) => s.theme);
  const haptics = usePrefs((s) => s.haptics);
  const count = useHabitStore((s) => s.data.habits.length);
  const steps = Platform.OS === 'android' ? ANDROID_STEPS : IOS_STEPS;

  const pin = async (widgetName: string) => {
    const ok = await requestPinWidget({ widgetName }).catch(() => false);
    if (!ok) {
      Alert.alert('Desteklenmiyor', 'Başlatıcın bu kısayolu desteklemiyor. Widget’ı ana ekrandan elle ekleyebilirsin.');
    }
  };

  const resetAll = () => {
    Alert.alert('Tüm zincirleri sil', 'Bütün zincirlerin ve geçmişleri silinecek. Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: () => {
          haptic.warning();
          void useHabitStore.getState().resetAll();
          router.dismissTo('/');
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Txt variant="title" accessibilityRole="header">
          Ayarlar
        </Txt>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <SectionTitle>Widget</SectionTitle>
        <Card>
          <View style={styles.widgetHero}>
            <WidgetMock />
            <View style={{ flex: 1 }}>
              <Txt variant="headline">Uygulamayı açmadan işaretle</Txt>
              <Txt variant="callout" tone="secondary" style={{ marginTop: 4 }}>
                Widget’taki düğmeye dokunduğunda o günün halkası eklenir, zincirinin kaç gündür sürdüğünü de hep görürsün.
              </Txt>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.separator }]} />
          {steps.map((step, i) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
                <Text style={[styles.stepNumberText, { color: colors.brand }]} allowFontScaling={false}>
                  {i + 1}
                </Text>
              </View>
              <Txt variant="callout" style={{ flex: 1 }}>
                {step}
              </Txt>
            </View>
          ))}
          {Platform.OS === 'android' ? (
            <View style={styles.pinRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Tek Zincir" icon={Plus} onPress={() => pin('HabitWidget')} variant="soft" />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Bugün" icon={Plus} onPress={() => pin('TodayWidget')} variant="soft" />
              </View>
            </View>
          ) : null}
        </Card>

        <View style={styles.gap} />
        <SectionTitle>Görünüm</SectionTitle>
        <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="radiogroup">
          {THEMES.map((option) => {
            const selected = theme === option.value;
            const Icon = option.icon;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  haptic.selection();
                  usePrefs.getState().update({ theme: option.value });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                style={[
                  styles.segmentItem,
                  selected ? { backgroundColor: colors.surface, shadowColor: colors.shadow } : null,
                  selected ? styles.segmentSelected : null,
                ]}
              >
                <Icon size={16} color={selected ? colors.text : colors.textSecondary} strokeWidth={2.4} />
                <Txt variant="callout" weight={selected ? '700' : '500'} tone={selected ? 'primary' : 'secondary'}>
                  {option.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.gap} />
        <SectionTitle>Tercihler</SectionTitle>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Txt variant="headline">Titreşim</Txt>
            <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Halka eklerken hafif dokunsal geri bildirim
            </Txt>
          </View>
          <Switch
            value={haptics}
            onValueChange={(value) => {
              usePrefs.getState().update({ haptics: value });
              if (value) haptic.success();
            }}
            trackColor={{ true: colors.brand, false: colors.track }}
            thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
            accessibilityLabel="Titreşim"
          />
        </Card>

        <View style={styles.gap} />
        <SectionTitle>Zinciri Kırma yöntemi</SectionTitle>
        <Card>
          <View style={styles.method}>
            <Flame size={22} color={colors.flame} fill={colors.flame} />
            <Txt variant="callout" tone="secondary" style={{ flex: 1 }}>
              Hedefini her yaptığında zincirine bir halka ekle. Birkaç gün sonra bir zincirin olur ve tek işin onu kırmamaktır.
              Planlı olmayan günler zinciri kırmaz; kaçırdığın bir gün ise zinciri yeniden başlatır.
            </Txt>
          </View>
        </Card>

        <View style={styles.gap} />
        <SectionTitle>Veriler</SectionTitle>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Txt variant="headline">Verilerin bu cihazda</Txt>
            <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Hesap gerekmez; zincirlerin yalnızca bu telefonda saklanır.
            </Txt>
          </View>
          <Check size={20} color={colors.success} strokeWidth={2.6} />
        </Card>
        <Pressable
          onPress={resetAll}
          disabled={count === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.danger,
            { backgroundColor: pressed ? colors.dangerSoft : colors.surface, borderColor: colors.border, opacity: count === 0 ? 0.5 : 1 },
          ]}
        >
          <Trash2 size={18} color={colors.danger} />
          <Txt variant="headline" tone="danger" style={{ fontSize: 16 }}>
            Tüm zincirleri sil
          </Txt>
        </Pressable>

        {__DEV__ ? (
          <View style={{ marginTop: 10 }}>
            <PrimaryButton
              label="Geliştirici: örnek zincirler ekle"
              icon={FlaskConical}
              variant="soft"
              testID="dev-seed"
              onPress={() => {
                void useHabitStore.getState().addHabits(demoHabits(useHabitStore.getState().today));
                haptic.success();
                router.dismissTo('/');
              }}
            />
          </View>
        ) : null}

        <Txt variant="caption" tone="tertiary" align="center" style={{ marginTop: 28 }}>
          Zinciri Kırma · sürüm {Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </ScrollView>
    </View>
  );
}

/** Widget'ın nasıl görüneceğine dair küçük bir örnek. */
function WidgetMock() {
  const { colors, scheme } = useTheme();
  const tint = '#FF6B3D';
  return (
    <View
      style={[
        styles.mock,
        {
          backgroundColor: scheme === 'dark' ? '#1A1816' : '#FFFFFF',
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.mockEmoji, { backgroundColor: withAlpha(tint, 0.16) }]}>
        <Text style={{ fontSize: 13 }}>📚</Text>
      </View>
      <View style={styles.mockStreak}>
        <Flame size={11} color={colors.flame} fill={colors.flame} />
        <Text style={[styles.mockNumber, { color: colors.text }]}>12</Text>
        <Text style={[styles.mockUnit, { color: colors.textSecondary }]}>gün</Text>
      </View>
      <Text style={[styles.mockName, { color: colors.text }]} numberOfLines={1}>
        Kitap oku
      </Text>
      <View style={[styles.mockButton, { backgroundColor: withAlpha(tint, 0.15) }]}>
        <Text style={[styles.mockButtonText, { color: tint }]}>Yaptım</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  gap: {
    height: 24,
  },
  widgetHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: roundedFont,
  },
  pinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
  },
  segmentSelected: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  method: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  danger: {
    marginTop: 10,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mock: {
    width: 104,
    height: 104,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  mockEmoji: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockStreak: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 6,
  },
  mockNumber: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: roundedFont,
  },
  mockUnit: {
    fontSize: 10,
    fontWeight: '700',
  },
  mockName: {
    fontSize: 10,
    fontWeight: '600',
  },
  mockButton: {
    marginTop: 'auto',
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockButtonText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: roundedFont,
  },
});

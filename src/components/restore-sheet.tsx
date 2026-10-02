import { ArchiveRestore, Combine, type LucideIcon, Replace } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { backupDateLabel, countLinks, type RestoreMode } from '@/domain/backup';
import type { PendingRestore } from '@/lib/use-backup';
import { radius, roundedFont, useTheme, withAlpha } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { PrimaryButton, Txt } from './ui';

const PREVIEW_LIMIT = 6;

interface Props {
  backup: PendingRestore | null;
  /** Bu telefondaki zincir sayısı; 0 ise seçenek sorulmadan geri yüklenir. */
  currentCount: number;
  onRestore: (mode: RestoreMode) => void;
  onClose: () => void;
}

/** Seçilen yedeğin özetini gösterip nasıl geri yükleneceğini sorar. */
export function RestoreSheet({ backup, currentCount, onRestore, onClose }: Props) {
  const { colors } = useTheme();
  // Kapanış animasyonu sürerken içerik boşalmasın ya da (zincir sayısı değiştiği için) başka görünüme atlamasın.
  const [shown, setShown] = useState(backup ? { ...backup, currentCount } : null);
  if (backup && backup.data !== shown?.data) setShown({ ...backup, currentCount });

  const habits = shown?.data.habits ?? [];
  const preview = habits.slice(0, PREVIEW_LIMIT);
  const hidden = habits.length - preview.length;

  return (
    <BottomSheet visible={backup !== null} onClose={onClose}>
      {shown ? (
        <>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
              <ArchiveRestore size={26} color={colors.brand} strokeWidth={2.2} />
            </View>
            <Txt variant="title" align="center" accessibilityRole="header">
              Yedeği geri yükle
            </Txt>
            <Txt variant="callout" tone="secondary" align="center">
              {shown.exportedAt !== null ? `${backupDateLabel(shown.exportedAt)} tarihli yedek` : 'Seçtiğin yedek dosyası'}
            </Txt>
          </View>

          <View style={[styles.summary, { backgroundColor: colors.surfaceAlt }]}>
            <View style={styles.stats}>
              <Stat value={habits.length} label="zincir" />
              <View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
              <Stat value={countLinks(habits)} label="halka" />
            </View>
            <View style={styles.chips}>
              {preview.map((habit) => (
                <View key={habit.id} style={[styles.chip, { backgroundColor: colors.surface }]}>
                  <Text style={styles.chipEmoji} allowFontScaling={false}>
                    {habit.emoji}
                  </Text>
                  <Txt variant="caption" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {habit.name}
                  </Txt>
                </View>
              ))}
              {hidden > 0 ? (
                <View style={[styles.chip, { backgroundColor: colors.surface }]}>
                  <Txt variant="caption" weight="600" tone="secondary">
                    +{hidden} zincir daha
                  </Txt>
                </View>
              ) : null}
            </View>
          </View>

          {shown.currentCount > 0 ? (
            <>
              <Txt variant="callout" tone="secondary" style={styles.question}>
                Bu telefonda şu an {shown.currentCount} zincir var. Ne yapmak istersin?
              </Txt>
              <Choice
                icon={Combine}
                title="Birleştir"
                description="Şimdikiler kalır, yedektekiler eklenir. Aynı zincirlerin işaretli günleri birleşir."
                tint={colors.brand}
                highlighted
                onPress={() => onRestore('merge')}
                testID="restore-merge"
              />
              <Choice
                icon={Replace}
                title="Yedektekilerle değiştir"
                description={`Şimdiki ${shown.currentCount} zincir silinir, yerine yedektekiler gelir.`}
                tint={colors.danger}
                onPress={() => onRestore('replace')}
                testID="restore-replace"
              />
            </>
          ) : (
            <View style={styles.confirm}>
              <PrimaryButton
                label="Geri yükle"
                icon={ArchiveRestore}
                onPress={() => onRestore('replace')}
                testID="restore-confirm"
              />
            </View>
          )}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }]}
          >
            <Txt variant="headline" tone="secondary" align="center">
              Vazgeç
            </Txt>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.statValue, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
      <Txt variant="caption" tone="secondary" weight="600">
        {label}
      </Txt>
    </View>
  );
}

function Choice({
  icon: Icon,
  title,
  description,
  tint,
  highlighted,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tint: string;
  highlighted?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: pressed ? colors.surfacePressed : highlighted ? withAlpha(tint, 0.08) : colors.surfaceAlt,
          borderColor: highlighted ? withAlpha(tint, 0.45) : 'transparent',
        },
      ]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: withAlpha(tint, 0.14) }]}>
        <Icon size={20} color={tint} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="headline" color={highlighted ? colors.text : tint}>
          {title}
        </Txt>
        <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          {description}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summary: {
    borderRadius: radius.lg,
    padding: 14,
    gap: 14,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    fontFamily: roundedFont,
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  chipEmoji: {
    fontSize: 14,
  },
  question: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  choiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    marginTop: 8,
  },
  cancel: {
    height: 50,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
});

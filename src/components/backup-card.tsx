import { ArchiveRestore, CircleCheck, FileDown, FolderDown, Share2, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useHabitStore } from '@/data/store';
import { isBackupStale, lastBackupLabel, type RestoreMode } from '@/domain/backup';
import type { AppData } from '@/domain/types';
import { useBackupExport, useRestore } from '@/lib/use-backup';
import { radius, roundedFont, useTheme, withAlpha } from '@/theme';

import { ActionSheet } from './action-sheet';
import { RestoreSheet } from './restore-sheet';
import { Card, PrimaryButton, Txt } from './ui';

const MOVE_STEPS = [
  Platform.OS === 'ios'
    ? 'Bu telefonda “Yedek al”a dokun; dosyayı Dosyalar’a (iCloud Drive) kaydet ya da kendine gönder.'
    : 'Bu telefonda “Yedek al”a dokun; dosyayı Drive’a kaydet ya da kendine gönder.',
  'Yeni telefona Zinciri Kırma’yı kur.',
  '“Yedekten geri yükle”ye dokun ve dosyayı seç. Zincirlerin kaldığı yerden devam eder.',
];

interface Notice {
  text: string;
  /** Varsa "Geri al" ile bu veriye dönülür. */
  undo?: AppData;
}

/** Ayarlar › Yedekleme: yedek dosyası al, dosyadan geri yükle. */
export function BackupCard() {
  const { colors } = useTheme();
  const count = useHabitStore((s) => s.data.habits.length);
  const lastBackupAt = usePrefs((s) => s.lastBackupAt);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const exporter = useBackupExport({
    onSaved: (folder) =>
      setNotice({ text: folder ? `Yedek “${folder}” klasörüne kaydedildi.` : 'Yedek seçtiğin klasöre kaydedildi.' }),
  });
  const restore = useRestore();

  const startBackup = () => {
    setNotice(null);
    // iOS paylaşım menüsünde "Dosyalar'a Kaydet" zaten var; Android'de klasöre kaydetme ayrı bir seçenek.
    if (Platform.OS === 'android') setChooserOpen(true);
    else void exporter.share();
  };

  const startRestore = () => {
    setNotice(null);
    void restore.start();
  };

  const applyRestore = async (mode: RestoreMode) => {
    const outcome = await restore.apply(mode);
    if (!outcome) return;
    setNotice({
      text:
        outcome.mode === 'merge'
          ? `Yedek birleştirildi. Şimdi ${outcome.habitCount} zincirin var.`
          : `${outcome.habitCount} zincir geri yüklendi.`,
      undo: outcome.previous,
    });
  };

  const undo = (previous: AppData) => {
    setNotice({ text: 'Değişiklik geri alındı.' });
    void useHabitStore.getState().importData(previous, 'replace');
  };

  const stale = count > 0 && isBackupStale(lastBackupAt);
  const status =
    count === 0 && lastBackupAt === null
      ? { text: 'Yedeklenecek zincir yok', color: colors.textSecondary, bg: colors.surfaceAlt, icon: ShieldCheck }
      : stale
        ? { text: lastBackupLabel(lastBackupAt), color: colors.warning, bg: colors.warningSoft, icon: TriangleAlert }
        : { text: lastBackupLabel(lastBackupAt), color: colors.success, bg: withAlpha(colors.success, 0.12), icon: CircleCheck };
  const StatusIcon = status.icon;

  return (
    <Card>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
          <ShieldCheck size={22} color={colors.brand} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="headline">Zincirlerin kaybolmasın</Txt>
          <Txt variant="callout" tone="secondary" style={{ marginTop: 4 }}>
            Zincirlerin yalnızca bu telefonda saklanır. Yedek dosyası alırsan uygulamayı silsen ya da telefon
            değiştirsen de hepsini geri getirirsin.
          </Txt>
        </View>
      </View>

      <View style={[styles.status, { backgroundColor: status.bg }]} accessible accessibilityLabel={status.text}>
        <StatusIcon size={15} color={status.color} strokeWidth={2.6} />
        <Txt variant="caption" weight="700" color={status.color}>
          {status.text}
        </Txt>
      </View>
      {stale ? (
        <Txt variant="caption" tone="secondary" style={styles.staleHint}>
          Ayda bir yedek almak, telefonun başına bir şey gelse bile zincirlerini korur.
        </Txt>
      ) : null}

      <View style={styles.buttons}>
        <PrimaryButton
          label="Yedek al"
          icon={FileDown}
          onPress={startBackup}
          disabled={count === 0}
          loading={exporter.busy}
          testID="backup-export"
        />
        <PrimaryButton
          label="Yedekten geri yükle"
          icon={ArchiveRestore}
          variant="soft"
          onPress={startRestore}
          loading={restore.busy}
          testID="backup-restore"
        />
      </View>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: withAlpha(colors.success, 0.12) }]} accessibilityLiveRegion="polite">
          <CircleCheck size={18} color={colors.success} strokeWidth={2.6} />
          <Txt variant="callout" weight="600" style={{ flex: 1 }}>
            {notice.text}
          </Txt>
          {notice.undo ? (
            <Pressable
              onPress={() => undo(notice.undo!)}
              hitSlop={8}
              accessibilityRole="button"
              testID="backup-undo"
              style={({ pressed }) => [styles.undo, { backgroundColor: pressed ? colors.surfacePressed : colors.surface }]}
            >
              <Txt variant="callout" weight="700" tone="brand">
                Geri al
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      <Txt variant="callout" weight="700" style={{ marginBottom: 12 }}>
        Yeni telefona geçerken
      </Txt>
      {MOVE_STEPS.map((step, i) => (
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

      <ActionSheet
        visible={chooserOpen}
        title="Yedeği nereye koyalım?"
        subtitle="Telefon değiştirirken en kolayı Drive’a kaydetmek ya da kendine göndermek."
        onClose={() => setChooserOpen(false)}
        actions={[
          {
            label: 'Drive’a kaydet ya da gönder',
            description: 'Drive, WhatsApp, e-posta, Quick Share…',
            icon: Share2,
            onPress: () => void exporter.share(),
            testID: 'backup-share',
          },
          {
            label: 'Telefona kaydet',
            description: 'Documents gibi bir klasöre dosya olarak',
            icon: FolderDown,
            onPress: () => void exporter.saveToFolder(),
            testID: 'backup-folder',
          },
        ]}
      />
      <RestoreSheet
        backup={restore.pending}
        currentCount={count}
        onRestore={(mode) => void applyRestore(mode)}
        onClose={restore.cancel}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
  },
  staleHint: {
    marginTop: 8,
  },
  buttons: {
    gap: 10,
    marginTop: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: radius.md,
  },
  undo: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
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
});

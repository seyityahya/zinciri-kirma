import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Txt } from './ui';

export interface SheetAction {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Başlığın altındaki kısa açıklama. */
  description?: string;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Alttan açılan seçenek menüsü. */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {title ? (
        <View style={styles.header}>
          <Txt variant="headline" align="center" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" tone="secondary" align="center" style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
      {actions.map((action) => {
        const Icon = action.icon;
        const color = action.destructive ? colors.danger : colors.text;
        return (
          <Pressable
            key={action.label}
            disabled={action.disabled}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.description ? `${action.label}, ${action.description}` : action.label}
            testID={action.testID}
            style={({ pressed }) => [
              styles.action,
              action.description ? styles.actionTall : null,
              {
                backgroundColor: pressed ? colors.surfacePressed : colors.surfaceAlt,
                opacity: action.disabled ? 0.4 : 1,
              },
            ]}
          >
            <Icon size={20} color={color} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Txt variant="headline" color={color} style={{ fontWeight: '600' }}>
                {action.label}
              </Txt>
              {action.description ? (
                <Txt variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  {action.description}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cancel, { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }]}
      >
        <Txt variant="headline" tone="secondary" align="center">
          Vazgeç
        </Txt>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
  },
  actionTall: {
    paddingVertical: 12,
  },
  cancel: {
    height: 50,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
});

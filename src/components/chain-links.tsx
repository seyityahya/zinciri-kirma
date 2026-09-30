import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import type { ChainSlot, SlotState } from '@/domain/streak';
import { useTheme, withAlpha } from '@/theme';

export type LinkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<LinkSize, { w: number; h: number; stroke: number; overlap: number }> = {
  sm: { w: 22, h: 13, stroke: 3, overlap: 7 },
  md: { w: 30, h: 18, stroke: 3.6, overlap: 9 },
  lg: { w: 44, h: 26, stroke: 5, overlap: 13 },
};

/** Bir sırada kaç halka sığar? */
export function linksThatFit(width: number, size: LinkSize): number {
  const { w, overlap } = SIZES[size];
  if (width <= w) return 1;
  return Math.max(1, Math.floor((width - w) / (w - overlap)) + 1);
}

export function chainWidth(count: number, size: LinkSize): number {
  const { w, overlap } = SIZES[size];
  return count <= 0 ? 0 : w + (count - 1) * (w - overlap);
}

function stadium(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

function leftHalf(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  const mid = x + w / 2 - 1.5;
  return `M ${mid} ${y} H ${x + r} A ${r} ${r} 0 0 0 ${x + r} ${y + h} H ${mid}`;
}

function rightHalf(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  const mid = x + w / 2 + 1.5;
  return `M ${mid} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${mid}`;
}

interface LinkProps {
  state: SlotState;
  tint: string;
  size: LinkSize;
  /** Haftalık zincirde kısmi ilerleme (0–1). */
  progress?: number;
}

/** Tek bir zincir halkası. */
export const ChainLink = memo(function ChainLink({ state, tint, size, progress }: LinkProps) {
  const { colors } = useTheme();
  const { w, h, stroke } = SIZES[size];
  const pad = stroke / 2 + 1.5;
  const vw = w;
  const vh = h + 4;
  const x = pad;
  const y = 2 + stroke / 2;
  const iw = vw - pad * 2;
  const ih = h - stroke;

  // Yalnızca sonradan tamamlanan halka "yerine oturur"; ilk açılışta animasyon yok.
  const scale = useSharedValue(1);
  const previous = useRef(state);
  useEffect(() => {
    if (state === 'done' && previous.current !== 'done') {
      scale.set(withSequence(withTiming(1.25, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 220 })));
    }
    previous.current = state;
  }, [state, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  let content: React.ReactNode;
  switch (state) {
    case 'done':
      content = <Path d={stadium(x, y, iw, ih)} stroke={tint} strokeWidth={stroke} fill="none" />;
      break;
    case 'pending': {
      const partial = progress !== undefined && progress > 0;
      content = (
        <Path
          d={stadium(x, y, iw, ih)}
          stroke={withAlpha(tint, 0.55)}
          strokeWidth={stroke * 0.8}
          strokeDasharray={[stroke * 0.9, stroke * 0.8]}
          strokeLinecap="round"
          fill={partial ? withAlpha(tint, 0.12 + 0.25 * (progress ?? 0)) : 'none'}
        />
      );
      break;
    }
    case 'missed':
      content = (
        <>
          <G rotation={-10} origin={`${x + iw / 4}, ${y + ih / 2}`}>
            <Path d={leftHalf(x - 1.5, y + 0.5, iw, ih)} stroke={colors.danger} strokeWidth={stroke * 0.9} strokeLinecap="round" fill="none" opacity={0.5} />
          </G>
          <G rotation={12} origin={`${x + (iw * 3) / 4}, ${y + ih / 2}`}>
            <Path d={rightHalf(x + 1.5, y - 0.5, iw, ih)} stroke={colors.danger} strokeWidth={stroke * 0.9} strokeLinecap="round" fill="none" opacity={0.5} />
          </G>
        </>
      );
      break;
    case 'forgiven':
      // Hata payıyla geçilen halka: zincir kopmadı ama "yamalı", turuncu.
      content = (
        <>
          <Path d={stadium(x, y, iw, ih)} stroke={colors.warning} strokeWidth={stroke} fill="none" />
          <Path
            d={`M ${x + iw / 2 - stroke * 0.9} ${y + ih / 2} H ${x + iw / 2 + stroke * 0.9}`}
            stroke={colors.warning}
            strokeWidth={stroke * 0.8}
            strokeLinecap="round"
          />
        </>
      );
      break;
    default:
      content = <Path d={stadium(x, y, iw, ih)} stroke={colors.emptyLink} strokeWidth={stroke} fill="none" />;
  }

  return (
    <Animated.View style={[{ width: vw, height: vh }, animated]}>
      <Svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`}>
        {/* Durum değişince yeniden oluştur: react-native-svg kaldırılan
            strokeDasharray'i sıfırlamıyor, tamamlanan halka kesikli kalıyordu. */}
        <G key={state}>{content}</G>
      </Svg>
    </Animated.View>
  );
});

interface RowProps {
  slots: ChainSlot[];
  tint: string;
  size?: LinkSize;
  style?: ViewStyle;
}

/** Yan yana, birbirine geçmiş halkalar. */
export const ChainRow = memo(function ChainRow({ slots, tint, size = 'sm', style }: RowProps) {
  const { overlap } = SIZES[size];
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={describe(slots)}
    >
      {slots.map((slot, i) => (
        <View key={slot.key} style={i === 0 ? undefined : { marginLeft: -overlap }}>
          <ChainLink state={slot.state} tint={tint} size={size} progress={slot.progress} />
        </View>
      ))}
    </View>
  );
});

function describe(slots: ChainSlot[]): string {
  const done = slots.filter((s) => s.state === 'done').length;
  const missed = slots.filter((s) => s.state === 'missed').length;
  const forgiven = slots.filter((s) => s.state === 'forgiven').length;
  return `Son ${slots.length} halkanın ${done} tanesi tamam${forgiven > 0 ? `, ${forgiven} tanesi hata payıyla geçildi` : ''}${missed > 0 ? `, ${missed} tanesi kırık` : ''}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

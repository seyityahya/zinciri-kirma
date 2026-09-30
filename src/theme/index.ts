import { Platform, useColorScheme } from 'react-native';

export type ColorSchemeName = 'light' | 'dark';

const light = {
  background: '#F7F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EBE4',
  surfacePressed: '#EAE4DC',
  text: '#1C1917',
  textSecondary: '#6F6862',
  textTertiary: '#A39C95',
  border: 'rgba(28, 25, 23, 0.08)',
  separator: 'rgba(28, 25, 23, 0.07)',
  brand: '#FF5A36',
  brandSoft: 'rgba(255, 90, 54, 0.12)',
  flame: '#FF6B3D',
  danger: '#E5484D',
  dangerSoft: 'rgba(229, 72, 77, 0.12)',
  success: '#2F9E62',
  warning: '#E08A00',
  warningSoft: 'rgba(224, 138, 0, 0.14)',
  emptyLink: 'rgba(28, 25, 23, 0.10)',
  track: 'rgba(28, 25, 23, 0.07)',
  shadow: '#3A2A1E',
  overlay: 'rgba(20, 16, 12, 0.35)',
  onBrand: '#FFFFFF',
};

const dark: typeof light = {
  background: '#0F0E0D',
  surface: '#1A1816',
  surfaceAlt: '#24211E',
  surfacePressed: '#2B2825',
  text: '#F5F2EE',
  textSecondary: '#A8A19A',
  textTertiary: '#6E6863',
  border: 'rgba(255, 255, 255, 0.07)',
  separator: 'rgba(255, 255, 255, 0.06)',
  brand: '#FF6B45',
  brandSoft: 'rgba(255, 107, 69, 0.16)',
  flame: '#FF7A4D',
  danger: '#FF6369',
  dangerSoft: 'rgba(255, 99, 105, 0.15)',
  success: '#3DD68C',
  warning: '#FFB23F',
  warningSoft: 'rgba(255, 178, 63, 0.16)',
  emptyLink: 'rgba(255, 255, 255, 0.10)',
  track: 'rgba(255, 255, 255, 0.08)',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.55)',
  onBrand: '#FFFFFF',
};

export type Palette = typeof light;
export const palettes: Record<ColorSchemeName, Palette> = { light, dark };

export interface Theme {
  scheme: ColorSchemeName;
  colors: Palette;
}

export function useTheme(): Theme {
  const scheme: ColorSchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] };
}

/** iOS'ta SF Rounded; Android'de sistem yazı tipi. */
export const roundedFont = Platform.select({ ios: 'ui-rounded', default: undefined });

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

/** Zincirler için seçilebilen renkler. */
export const HABIT_COLORS = [
  { hex: '#FF6B3D', name: 'Ateş' },
  { hex: '#F2545B', name: 'Kırmızı' },
  { hex: '#EC5FA7', name: 'Pembe' },
  { hex: '#A35CF0', name: 'Mor' },
  { hex: '#5B6CF9', name: 'Çivit' },
  { hex: '#2E9BF0', name: 'Mavi' },
  { hex: '#14B8A6', name: 'Turkuaz' },
  { hex: '#34C759', name: 'Yeşil' },
  { hex: '#F5A524', name: 'Amber' },
  { hex: '#8D6E63', name: 'Kahve' },
] as const;

export const HABIT_EMOJIS = [
  '🔥', '📚', '🏃', '💧', '🧘', '💪', '🥗', '😴',
  '✍️', '🎸', '🎨', '🧠', '💊', '🚭', '🍎', '🚶',
  '🚴', '🏊', '🧹', '💰', '📵', '🙏', '🌱', '☀️',
  '🦷', '🗣️', '💻', '🎯', '❤️', '⭐', '🧴', '🐶',
  '🎹', '📝', '🍵', '⏰', '🛏️', '🌙', '🚰', '🧩',
] as const;

/** Renk üzerine yazılacak metin rengi (açık renklerde koyu metin). */
export function onColor(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#1C1917' : '#FFFFFF';
}

/** #RRGGBB + opaklık → rgba() */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

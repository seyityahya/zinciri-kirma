import type { ChainSlot } from '@/domain/streak';

/** Android widget'ları SVG metinlerini çizer; ikonlar burada üretilir. */

const FLAME = 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4';
const CHECK = 'M20 6 9 17l-5-5';
const MOON =
  'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401';

export function flameSvg(color: string, filled: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${FLAME}" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function checkSvg(color: string, strokeWidth = 3.2, opacity = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${CHECK}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function moonSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${MOON}" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function linkSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
}

function stadium(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

export const MINI_LINK = { w: 13, h: 8, step: 10, stroke: 2.2 };

/** Yan yana geçmiş halkalar; genişlik = 13 + (n-1)*10 */
export function miniChainSvg(
  slots: ChainSlot[],
  /** `empty`: düz renk; saydamlığı SVG içinde verilir. */
  colors: { tint: string; danger: string; empty: string },
): { svg: string; width: number; height: number } {
  const { w, h, step, stroke } = MINI_LINK;
  const pad = stroke / 2;
  const width = w + Math.max(0, slots.length - 1) * step + stroke;
  const height = h + stroke;
  const paths = slots
    .map((slot, i) => {
      const x = pad + i * step;
      const d = stadium(x, pad, w, h);
      switch (slot.state) {
        case 'done':
          return `<path d="${d}" fill="none" stroke="${colors.tint}" stroke-width="${stroke}"/>`;
        case 'missed':
          return `<path d="${d}" fill="none" stroke="${colors.danger}" stroke-width="${stroke}" stroke-dasharray="7 3" opacity="0.85"/>`;
        case 'pending':
          return `<path d="${d}" fill="none" stroke="${colors.tint}" stroke-width="${stroke}" stroke-dasharray="2.4 1.8" opacity="0.6"/>`;
        default:
          return `<path d="${d}" fill="none" stroke="${colors.empty}" stroke-opacity="0.16" stroke-width="${stroke}"/>`;
      }
    })
    .join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`,
    width,
    height,
  };
}

import type React from 'react';
import type { buildWidgetTree as BuildWidgetTree } from 'react-native-android-widget/lib/typescript/api/build-widget-tree';

import { addDays, todayKey } from '@/domain/dates';
import { mediumDateLabel } from '@/domain/labels';
import { emptyData, type Habit } from '@/domain/types';

import { HABIT_MINI_WIDGET, HABIT_WIDGET, habitWidget, pickHabit, todayWidget } from '../render';

// Kütüphanenin widget'ı yerel tarafa göndermeden önce kullandığı dönüştürücü.
const { buildWidgetTree } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-android-widget/lib/commonjs/api/build-widget-tree') as { buildWidgetTree: typeof BuildWidgetTree };

interface Node {
  type: string;
  props: Record<string, unknown>;
  children?: Node[];
}

function flatten(node: Node): Node[] {
  return [node, ...(node.children ?? []).flatMap(flatten)];
}

function tree(element: React.JSX.Element): Node[] {
  return flatten(buildWidgetTree(element) as unknown as Node);
}

/** ListWidget dışındaki tıklanabilir alanlar (kütüphane hatası yüzünden en fazla 1 olmalı). */
function topLevelClickables(node: Node): Node[] {
  if (node.type === 'ListWidget') return [];
  const own = node.props.clickAction ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap(topLevelClickables)];
}

function root(element: React.JSX.Element): Node {
  return buildWidgetTree(element) as unknown as Node;
}

function texts(nodes: Node[]): string[] {
  return nodes.filter((n) => n.type === 'TextWidget').map((n) => String(n.props.text));
}

const today = todayKey();
const data = (habits: Habit[]) => ({ ...emptyData(), habits });

function habit(id: string, name: string, done: boolean, streakDays = 3): Habit {
  const completions = Array.from({ length: streakDays }, (_, i) => addDays(today, -(i + 1)));
  if (done) completions.push(today);
  return {
    id,
    name,
    emoji: '📚',
    color: '#FF6B3D',
    schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
    startDate: addDays(today, -10),
    completions: completions.sort(),
    createdAt: 0,
  };
}

describe('Android widget görünümleri', () => {
  it('tek zincir widget’ı seri ve düğme üretir', () => {
    const h = habit('a', 'Kitap oku', false);
    const rep = habitWidget(h, data([h]), HABIT_WIDGET, today) as { light: React.JSX.Element; dark: React.JSX.Element };
    for (const element of [rep.light, rep.dark]) {
      const nodes = tree(element);
      expect(texts(nodes)).toEqual(expect.arrayContaining(['Kitap oku', '3', 'gün', 'Yaptım']));
      const toggle = nodes.find((n) => n.props.clickAction === 'TOGGLE');
      expect(toggle?.props.clickActionData).toEqual({ habitId: 'a', day: today });
    }
  });

  it('bugün yapıldıysa "Yapıldı" ve bir fazla seri gösterir', () => {
    const h = habit('a', 'Kitap oku', true);
    const rep = habitWidget(h, data([h]), HABIT_WIDGET, today) as { light: React.JSX.Element };
    expect(texts(tree(rep.light))).toEqual(expect.arrayContaining(['4', 'Yapıldı']));
  });

  it('zincir yoksa boş durumu gösterir', () => {
    const rep = habitWidget(undefined, data([])) as { light: React.JSX.Element };
    const nodes = tree(rep.light);
    expect(texts(nodes)).toContain('Henüz zincir yok');
    expect(nodes[0].props.clickActionData).toEqual({ uri: 'zincirikirma://form' });
  });

  it('bugün widget’ı tüm zincirleri kaydırılabilir listede gösterir', () => {
    const habits = ['A', 'B', 'C', 'D', 'E'].map((n, i) => habit(n, `Zincir ${n}`, i === 0));
    const rep = todayWidget(data(habits), today) as { light: React.JSX.Element };
    const nodes = tree(rep.light);
    expect(nodes.filter((n) => n.type === 'ListWidget')).toHaveLength(1);
    const toggles = nodes.filter((n) => n.props.clickAction === 'TOGGLE');
    expect(toggles).toHaveLength(5);
    expect(texts(nodes)).toEqual(expect.arrayContaining(['Bugün', '1/5', 'Zincir A', 'Zincir E', 'Tamamlandı']));
  });

  it('hiçbir widget’ta liste dışında birden fazla tıklanabilir alan yok', () => {
    const habits = ['A', 'B', 'C'].map((n, i) => habit(n, `Zincir ${n}`, i === 0));
    const d = data(habits);
    const reps = [
      habitWidget(habits[0], d, HABIT_WIDGET, today),
      habitWidget(habits[1], d, HABIT_MINI_WIDGET, today),
      habitWidget(undefined, data([])),
      todayWidget(d, today),
    ] as { light: React.JSX.Element; dark: React.JSX.Element }[];
    for (const rep of reps) {
      expect(topLevelClickables(root(rep.light)).length).toBeLessThanOrEqual(1);
      expect(topLevelClickables(root(rep.dark)).length).toBeLessThanOrEqual(1);
    }
  });

  it('tek zincir widget’ında tarih yazar', () => {
    const h = habit('a', 'Kitap oku', false);
    const nodes = tree((habitWidget(h, data([h]), HABIT_WIDGET, '2026-09-29') as { light: React.JSX.Element }).light);
    expect(texts(nodes)).toContain('Sal, 29 Eyl');
  });

  it('mini widget ad, seri, tarih ve düğme içerir', () => {
    const h = habit('a', 'Kitap oku', false);
    const nodes = tree((habitWidget(h, data([h]), HABIT_MINI_WIDGET, today) as { light: React.JSX.Element }).light);
    expect(texts(nodes)).toEqual(expect.arrayContaining(['Kitap oku', '3 gün', mediumDateLabel(today)]));
    const toggle = nodes.find((n) => n.props.clickAction === 'TOGGLE');
    expect(toggle?.props.clickActionData).toEqual({ habitId: 'a', day: today });
  });

  it('seçilen zincir yoksa ilkine düşer', () => {
    const habits = [habit('a', 'A', false), habit('b', 'B', false)];
    expect(pickHabit(habits, 'b')?.id).toBe('b');
    expect(pickHabit(habits, 'silinmis')?.id).toBe('a');
    expect(pickHabit([], 'x')).toBeUndefined();
  });

});

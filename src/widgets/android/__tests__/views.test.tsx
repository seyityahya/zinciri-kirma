import type React from 'react';
import type { buildWidgetTree as BuildWidgetTree } from 'react-native-android-widget/lib/typescript/api/build-widget-tree';

import { addDays, todayKey } from '@/domain/dates';
import type { Habit } from '@/domain/types';

import { habitWidget, pickHabit, rowsFor, todayWidget } from '../render';

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

function texts(nodes: Node[]): string[] {
  return nodes.filter((n) => n.type === 'TextWidget').map((n) => String(n.props.text));
}

const today = todayKey();

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
    const rep = habitWidget(habit('a', 'Kitap oku', false)) as { light: React.JSX.Element; dark: React.JSX.Element };
    for (const element of [rep.light, rep.dark]) {
      const nodes = tree(element);
      expect(texts(nodes)).toEqual(expect.arrayContaining(['Kitap oku', '3', 'gün', 'Yaptım']));
      const toggle = nodes.find((n) => n.props.clickAction === 'TOGGLE');
      expect(toggle?.props.clickActionData).toEqual({ habitId: 'a', day: today });
      const open = nodes.find((n) => n.props.clickAction === 'OPEN_URI');
      expect(open?.props.clickActionData).toEqual({ uri: 'zincirikirma://habit/a' });
    }
  });

  it('bugün yapıldıysa "Yapıldı" ve bir fazla seri gösterir', () => {
    const rep = habitWidget(habit('a', 'Kitap oku', true)) as { light: React.JSX.Element };
    expect(texts(tree(rep.light))).toEqual(expect.arrayContaining(['4', 'Yapıldı']));
  });

  it('zincir yoksa boş durumu gösterir', () => {
    const rep = habitWidget(undefined) as { light: React.JSX.Element };
    const nodes = tree(rep.light);
    expect(texts(nodes)).toContain('Henüz zincir yok');
    expect(nodes[0].props.clickActionData).toEqual({ uri: 'zincirikirma://form' });
  });

  it('bugün widget’ı sığan kadar satır ve "daha fazla" gösterir', () => {
    const habits = ['A', 'B', 'C', 'D', 'E'].map((n, i) => habit(n, `Zincir ${n}`, i === 0));
    const rep = todayWidget(habits, 180) as { light: React.JSX.Element };
    const nodes = tree(rep.light);
    // 180dp'ye 3 satır sığar ama 5 zincir olduğu için "+N" satırına yer ayrılır → 2 satır.
    expect(rowsFor(180)).toBe(3);
    const toggles = nodes.filter((n) => n.props.clickAction === 'TOGGLE');
    expect(toggles).toHaveLength(2);
    expect(texts(nodes)).toEqual(expect.arrayContaining(['Bugün', '1/5', '+3 zincir daha', 'Zincir A', 'Tamamlandı']));

    // Hepsi sığıyorsa yer ayrılmaz
    const three = tree((todayWidget(habits.slice(0, 3), 180) as { light: React.JSX.Element }).light);
    expect(three.filter((n) => n.props.clickAction === 'TOGGLE')).toHaveLength(3);
  });

  it('seçilen zincir yoksa ilkine düşer', () => {
    const habits = [habit('a', 'A', false), habit('b', 'B', false)];
    expect(pickHabit(habits, 'b')?.id).toBe('b');
    expect(pickHabit(habits, 'silinmis')?.id).toBe('a');
    expect(pickHabit([], 'x')).toBeUndefined();
  });

  it('satır hesabı en az bir satır verir', () => {
    expect(rowsFor(40)).toBe(1);
    expect(rowsFor(110)).toBe(1);
    expect(rowsFor(250)).toBe(4);
  });
});

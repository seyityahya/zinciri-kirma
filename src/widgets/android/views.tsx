'use no memo';
// Android widget'ları React bileşeni değil, düz JSX ağacıdır: hook kullanılamaz ve
// React Compiler bu dosyayı dönüştürmemelidir.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp, HexColor } from 'react-native-android-widget';

import type { DayKey } from '@/domain/dates';
import { longDateLabel, shortStatus, unitLabel } from '@/domain/labels';
import type { HabitStatus } from '@/domain/streak';
import { computeStatus, countsToday, recentSlots } from '@/domain/streak';
import type { Habit } from '@/domain/types';
import { onColor, withAlpha } from '@/theme';

import { checkSvg, flameSvg, linkSvg, miniChainSvg, moonSvg } from './svg';

export type WidgetMode = 'light' | 'dark';

const THEME = {
  light: { bg: '#FFFFFF', text: '#1C1917', secondary: '#6F6862', flame: '#FF6B3D', danger: '#E5484D', muted: '#A39C95' },
  dark: { bg: '#1A1816', text: '#F5F2EE', secondary: '#A8A19A', flame: '#FF7A4D', danger: '#FF6369', muted: '#6E6863' },
} as const;

const hex = (value: string) => value as HexColor;
const rgba = (color: string, alpha: number) => withAlpha(color, alpha) as ColorProp;

function link(id?: string) {
  return { uri: id ? `zincirikirma://habit/${id}` : 'zincirikirma://' };
}

export function EmptyWidget({ mode }: { mode: WidgetMode }) {
  const t = THEME[mode];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'zincirikirma://form' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: hex(t.bg),
        borderRadius: 22,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <SvgWidget svg={linkSvg(t.flame)} style={{ width: 26, height: 26 }} />
      <TextWidget text="Henüz zincir yok" style={{ fontSize: 14, fontWeight: 'bold', color: hex(t.text), marginTop: 6 }} />
      <TextWidget
        text="Dokun ve ilk zincirini oluştur"
        style={{ fontSize: 11, color: hex(t.secondary), marginTop: 2, textAlign: 'center' }}
        maxLines={2}
      />
    </FlexWidget>
  );
}

// ---------------------------------------------------------------------------
// Tek zincir (2x2)
// ---------------------------------------------------------------------------

export function HabitWidgetView({ habit, today, mode }: { habit: Habit; today: DayKey; mode: WidgetMode }) {
  const t = THEME[mode];
  const status = computeStatus(habit, today);
  const tint = habit.color;
  const done = status.doneToday;
  const restDay = !status.scheduledToday && !done;
  const chain = miniChainSvg(recentSlots(habit, today, 5), { tint, danger: t.danger, empty: t.text });
  const label = done ? 'Yapıldı' : restDay ? 'İzin günü' : 'Yaptım';
  const fg = done ? onColor(tint) : tint;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={link(habit.id)}
      accessibilityLabel={`${habit.name}, ${status.streak} ${unitLabel(status.unit)} zincir`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: hex(t.bg),
        borderRadius: 22,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <FlexWidget
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: rgba(tint, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text={habit.emoji} style={{ fontSize: 18 }} allowFontScaling={false} />
        </FlexWidget>
        <SvgWidget svg={chain.svg} style={{ width: chain.width, height: chain.height }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget svg={flameSvg(status.streak > 0 ? t.flame : t.muted, status.streak > 0)} style={{ width: 16, height: 16 }} />
          <TextWidget
            text={String(status.streak)}
            style={{ fontSize: 28, fontWeight: '800', color: hex(t.text), marginLeft: 4 }}
            allowFontScaling={false}
          />
          <TextWidget
            text={unitLabel(status.unit)}
            style={{ fontSize: 13, fontWeight: '600', color: hex(t.secondary), marginLeft: 4, marginTop: 6 }}
            allowFontScaling={false}
          />
        </FlexWidget>
        <TextWidget
          text={habit.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, fontWeight: '600', color: hex(t.text) }}
        />
      </FlexWidget>

      <FlexWidget
        clickAction="TOGGLE"
        clickActionData={{ habitId: habit.id, day: today }}
        accessibilityLabel={done ? 'Tamamlandı, geri al' : 'Bugün yaptım olarak işaretle'}
        style={{
          width: 'match_parent',
          height: 36,
          borderRadius: 18,
          backgroundColor: done ? hex(tint) : rgba(tint, restDay ? 0.08 : 0.15),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget svg={restDay ? moonSvg(tint) : checkSvg(fg)} style={{ width: 15, height: 15 }} />
        <TextWidget text={label} style={{ fontSize: 13, fontWeight: 'bold', color: hex(fg), marginLeft: 6 }} allowFontScaling={false} />
      </FlexWidget>
    </FlexWidget>
  );
}

// ---------------------------------------------------------------------------
// Bugün listesi (4x2 ve üstü)
// ---------------------------------------------------------------------------

interface Row {
  habit: Habit;
  status: HabitStatus;
}

function TodayRow({ row, today, mode }: { row: Row; today: DayKey; mode: WidgetMode }) {
  const t = THEME[mode];
  const { habit, status } = row;
  const tint = habit.color;
  const done = status.doneToday;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={link(habit.id)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
      >
        <FlexWidget
          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: rgba(tint, 0.16), alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text={habit.emoji} style={{ fontSize: 15 }} allowFontScaling={false} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
          <TextWidget text={habit.name} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '600', color: hex(t.text) }} />
          <TextWidget
            text={shortStatus(habit.schedule, status, today)}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, color: hex(t.secondary) }}
          />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6, marginRight: 10 }}>
          <SvgWidget svg={flameSvg(status.streak > 0 ? t.flame : t.muted, status.streak > 0)} style={{ width: 12, height: 12 }} />
          <TextWidget
            text={String(status.streak)}
            style={{ fontSize: 13, fontWeight: 'bold', color: hex(status.streak > 0 ? t.flame : t.muted), marginLeft: 2 }}
            allowFontScaling={false}
          />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget
        clickAction="TOGGLE"
        clickActionData={{ habitId: habit.id, day: today }}
        accessibilityLabel={done ? `${habit.name} tamamlandı, geri al` : `${habit.name} yaptım`}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: done ? hex(tint) : rgba(tint, 0.12),
          borderWidth: done ? 0 : 2,
          borderColor: rgba(tint, 0.55),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgWidget svg={done ? checkSvg(onColor(tint)) : checkSvg(tint, 3, 0.4)} style={{ width: 14, height: 14 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function TodayWidgetView({
  habits,
  today,
  mode,
  maxRows,
}: {
  habits: Habit[];
  today: DayKey;
  mode: WidgetMode;
  maxRows: number;
}) {
  const t = THEME[mode];
  const rows: Row[] = habits.map((habit) => ({ habit, status: computeStatus(habit, today) }));
  const relevant = rows.filter((r) => countsToday(r.habit.schedule, r.status));
  const doneCount = relevant.filter((r) => r.status.doneToday).length;
  const visible = rows.slice(0, Math.max(1, maxRows));
  const hidden = rows.length - visible.length;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: hex(t.bg),
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={link()}
        style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}
      >
        <TextWidget text="Bugün" style={{ fontSize: 15, fontWeight: 'bold', color: hex(t.text) }} />
        <TextWidget
          text={longDateLabel(today)}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 12, color: hex(t.secondary), marginLeft: 6 }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
            backgroundColor: rgba(t.flame, 0.14),
          }}
        >
          <TextWidget
            text={relevant.length > 0 ? `${doneCount}/${relevant.length}` : 'İzin'}
            style={{ fontSize: 12, fontWeight: 'bold', color: hex(t.flame) }}
            allowFontScaling={false}
          />
        </FlexWidget>
      </FlexWidget>
      {visible.map((row) => (
        <TodayRow key={row.habit.id} row={row} today={today} mode={mode} />
      ))}
      {hidden > 0 ? (
        <TextWidget
          clickAction="OPEN_URI"
          clickActionData={link()}
          text={`+${hidden} zincir daha`}
          style={{ fontSize: 11, fontWeight: '600', color: hex(t.secondary), marginTop: 8 }}
        />
      ) : null}
    </FlexWidget>
  );
}

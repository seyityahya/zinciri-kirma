/**
 * iOS widget'ındaki Swift mantığı (targets/widget/ChainLogic.swift) ile
 * uygulamadaki TypeScript mantığının aynı sonuçları verdiğini doğrular.
 * macOS'ta Xcode araçları varsa çalışır; yoksa atlanır.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { addDays, fromEpochDay, logicalDayKey, toEpochDay } from '../dates';
import { reminderContent, scheduleLabel, shortStatus, statusText } from '../labels';
import { computeStatus, countsToday, recentSlots } from '../streak';
import { normalizeHabit, normalizeSettings } from '../validate';
import { emptyData } from '../types';
import { planReminders } from '../../notifications/plan';

const root = path.resolve(__dirname, '../../..');
const hasSwift =
  process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'swiftc']).status === 0;
const maybe = hasSwift && process.env.SKIP_SWIFT !== '1' ? describe : describe.skip;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCases(count: number) {
  const rand = mulberry32(20260929);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const base = toEpochDay('2025-06-01');
  const cases: { habit: unknown; today: string; slotCount: number; grace: boolean }[] = [];

  for (let i = 0; i < count; i++) {
    const today = fromEpochDay(base + int(0, 700));
    const kind = int(0, 2);
    let schedule: unknown;
    if (kind === 0) {
      const days = [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.55);
      schedule = { kind: 'days', days: rand() < 0.25 ? [0, 1, 2, 3, 4, 5, 6] : days };
    } else if (kind === 1) {
      schedule = { kind: 'interval', every: int(2, 6) };
    } else {
      schedule = { kind: 'weekly', times: int(1, 6) };
    }

    const span = int(0, 90);
    const density = rand();
    const completions: string[] = [];
    for (let d = -span; d <= 2; d++) {
      if (rand() < density) completions.push(addDays(today, d));
    }
    // Arada bir kirli veri: tekrar, sırasız, geçersiz tarih
    if (rand() < 0.1) completions.push(completions[0] ?? today, '2026-02-30', 'bozuk', '0008-09-29');
    if (rand() < 0.2) completions.reverse();

    const startOffset = int(-span - 10, 0);
    const habit = {
      id: `h${i}`,
      name: rand() < 0.05 ? `  Boşluklu ${i}  ` : `Zincir ${i}`,
      emoji: rand() < 0.05 ? '' : '📚',
      color: rand() < 0.05 ? 'kirmizi' : '#ff6b3d',
      schedule,
      startDate: rand() < 0.05 ? 'yok' : addDays(today, startOffset),
      completions,
      createdAt: 0,
    };
    cases.push({ habit, today, slotCount: int(3, 12), grace: rand() < 0.6 });
  }

  // Elle seçilmiş sınır durumları
  const edge = (habit: Record<string, unknown>, today: string) =>
    [true, false].forEach((grace) =>
      cases.push({ habit: { id: 'e', name: 'Kenar', emoji: '🔥', color: '#FF6B3D', createdAt: 0, ...habit }, today, slotCount: 7, grace }),
    );
  edge({ schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] }, startDate: '2026-09-29', completions: [] }, '2026-09-29');
  edge({ schedule: { kind: 'weekly', times: 3 }, startDate: '2026-10-03', completions: ['2026-10-03', '2026-10-04'] }, '2026-10-04');
  edge({ schedule: { kind: 'weekly', times: 7 }, startDate: '2026-10-04', completions: [] }, '2026-10-04');
  edge({ schedule: { kind: 'interval', every: 30 }, startDate: '2026-01-01', completions: ['2026-01-01', '2026-01-31'] }, '2026-03-02');
  edge({ schedule: { kind: 'days', days: [6] }, startDate: '2024-02-25', completions: ['2024-02-25', '2024-03-03'] }, '2024-03-09');
  edge({ schedule: { kind: 'days', days: [] }, startDate: '2026-12-30', completions: ['2026-12-31', '2027-01-01'] }, '2027-01-01');
  edge({ schedule: { kind: 'weekly', times: 99 }, startDate: '2026-09-28', completions: ['2026-09-28'] }, '2026-09-28');
  edge({ schedule: { kind: 'interval', every: 1.4 }, startDate: '2026-09-28', completions: ['2026-09-28'] }, '2026-09-30');
  edge({ schedule: { kind: 'bilinmeyen' }, startDate: '2026-09-28', completions: ['2026-09-28'] }, '2026-09-29');
  return cases;
}

function generateGroups(cases: ReturnType<typeof generateCases>) {
  const rand = mulberry32(42);
  const groups: { today: string; grace: boolean; habits: unknown[] }[] = [];
  for (let i = 0; i < 300; i++) {
    const size = 1 + Math.floor(rand() * 5);
    const today = cases[Math.floor(rand() * cases.length)].today;
    const habits = Array.from({ length: size }, (_, j) => ({
      ...(cases[Math.floor(rand() * cases.length)].habit as object),
      id: `g${i}-${j}`,
      name: `Zincir ${String.fromCharCode(65 + j)}`,
    }));
    groups.push({ today, grace: rand() < 0.6, habits });
  }
  return groups;
}

function generatePlans(groups: ReturnType<typeof generateGroups>) {
  const rand = mulberry32(99);
  return groups.slice(0, 120).map((g) => {
    const [y, m, d] = g.today.split('-').map(Number);
    const now = new Date(y, m - 1, d, Math.floor(rand() * 24), Math.floor(rand() * 60)).getTime();
    const settings = {
      dayStartHour: Math.floor(rand() * 7),
      grace: rand() < 0.6,
      reminder: { enabled: rand() < 0.9, hour: 17 + Math.floor(rand() * 7), minute: rand() < 0.5 ? 0 : 30 },
    };
    return { now, settings, habits: g.habits };
  });
}

function generateLogical() {
  const rand = mulberry32(7);
  const base = new Date(2026, 0, 1).getTime();
  return Array.from({ length: 400 }, () => ({
    ms: base + Math.floor(rand() * 400 * 86_400_000),
    hour: Math.floor(rand() * 7),
  }));
}

function g_today(now: Date, dayStartHour: number) {
  return logicalDayKey(now, dayStartHour);
}

function round(value: number) {
  return Math.round(value * 1e9) / 1e9;
}

maybe('Swift widget mantığı ile parite', () => {
  let binary = '';
  let tmp = '';

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zk-parity-'));
    binary = path.join(tmp, 'parity');
    const result = spawnSync(
      'xcrun',
      [
        'swiftc',
        '-O',
        '-o',
        binary,
        path.join(root, 'targets/widget/ChainLogic.swift'),
        path.join(root, 'scripts/swift-parity/main.swift'),
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`Swift derlenemedi:\n${result.stderr}`);
    }
  }, 240_000);

  afterAll(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('rastgele ve kenar durumlarda aynı sonucu verir', () => {
    const cases = generateCases(1500);
    const groups = generateGroups(cases);
    const logical = generateLogical();
    const plans = generatePlans(groups);
    const input = path.join(tmp, 'cases.json');
    fs.writeFileSync(input, JSON.stringify({ cases, groups, logical, plans }));
    const run = spawnSync(binary, [input], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    expect(run.status).toBe(0);
    const out = JSON.parse(run.stdout) as { cases: unknown[]; reminders: unknown[]; logical: string[]; plans: unknown[] };
    const swift = out.cases;
    expect(swift).toHaveLength(cases.length);

    // Mantıksal gün (03:00 kuralı) iki tarafta aynı
    expect(out.logical).toEqual(logical.map((l) => logicalDayKey(new Date(l.ms), l.hour)));

    // Akşam hatırlatması iki tarafta aynı
    const expectedReminders = groups.map((g) => {
      const items = g.habits
        .map((raw) => normalizeHabit(raw, g.today))
        .filter((h): h is NonNullable<typeof h> => h !== null)
        .map((h) => ({ name: h.name, emoji: h.emoji, schedule: h.schedule, status: computeStatus(h, g.today, g.grace) }));
      return reminderContent(items);
    });
    expect(out.reminders).toEqual(expectedReminders);
    expect(expectedReminders.filter(Boolean).length).toBeGreaterThan(50);

    // 7 günlük hatırlatma planı iki tarafta aynı (kimlik, an, metin)
    const expectedPlans = plans.map((p) => {
      const settings = normalizeSettings(p.settings);
      const today = new Date(p.now);
      const habits = p.habits
        .map((raw) => normalizeHabit(raw, g_today(today, settings.dayStartHour)))
        .filter((h): h is NonNullable<typeof h> => h !== null);
      return planReminders({ ...emptyData(), habits, settings }, today).map(({ id, day, at, title, body }) => ({ id, day, at, title, body }));
    });
    expect(out.plans).toEqual(expectedPlans);
    expect(expectedPlans.flat().length).toBeGreaterThan(100);

    let mismatches = 0;
    const coverage = new Set<string>();
    cases.forEach((c, i) => {
      const habit = normalizeHabit(c.habit, c.today);
      if (!habit) {
        expect(swift[i]).toBeNull();
        return;
      }
      const status = computeStatus(habit, c.today, c.grace);
      coverage.add(`${habit.schedule.kind}:${status.state}`);
      if (status.dueToday) coverage.add(`${habit.schedule.kind}:due`);
      if (status.weekLost) coverage.add('weekly:lost');
      if (status.graceUsed) coverage.add(`${habit.schedule.kind}:graceUsed`);
      const expected = {
        habit: {
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          schedule: habit.schedule,
          startDate: habit.startDate,
          completions: habit.completions,
        },
        status: {
          ...status,
          successRate: status.successRate === null ? null : round(status.successRate),
        },
        text: statusText(habit.schedule, status, c.today),
        short: shortStatus(habit.schedule, status, c.today),
        label: scheduleLabel(habit.schedule),
        counts: countsToday(habit.schedule, status),
        slots: recentSlots(habit, c.today, c.slotCount, c.grace).map((s) =>
          s.progress === undefined ? { key: s.key, state: s.state } : { key: s.key, state: s.state, progress: round(s.progress) },
        ),
      };
      try {
        expect(swift[i]).toEqual(expected);
      } catch (error) {
        mismatches++;
        if (mismatches <= 3) {
          throw new Error(`Durum #${i} farklı: ${JSON.stringify(c)}\n${(error as Error).message}`);
        }
      }
    });
    expect(mismatches).toBe(0);
    // Rastgele veri tüm durumları gerçekten kapsıyor mu?
    for (const kind of ['days', 'interval', 'weekly']) {
      for (const state of ['new', 'active', 'pending', 'broken', 'due']) {
        expect(coverage).toContain(`${kind}:${state}`);
      }
    }
    expect(coverage).toContain('weekly:lost');
    for (const kind of ['days', 'interval', 'weekly']) expect(coverage).toContain(`${kind}:graceUsed`);
  });
});

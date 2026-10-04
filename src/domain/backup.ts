/**
 * Yedek dosyası: tüm zincirler ve paylaşılan ayarlar tek bir JSON dosyasında.
 * Dosya platformdan bağımsızdır; iPhone'da alınan yedek Android'de açılabilir.
 */
import { compareDayKeys, diffDays, toDayKey } from './dates';
import { fullDateLabel } from './labels';
import type { AppData, Habit } from './types';
import { normalizeAppData } from './validate';

export const BACKUP_FORMAT = 'sozum-soz-backup';
/** Uygulamanın eski adıyla (Zinciri Kırma) alınmış yedekler de geri yüklenebilsin. */
const LEGACY_BACKUP_FORMATS: readonly unknown[] = ['zinciri-kirma-backup'];
export const BACKUP_VERSION = 1;
/** Yıllarca tutulan veri bile birkaç yüz KB eder; bundan büyüğü yedek olamaz. */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
/** Bu kadar gündür yedek alınmadıysa kullanıcıya hatırlatılır. */
export const BACKUP_STALE_DAYS = 30;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO 8601 */
  exportedAt: string;
  app: { version: string; platform: string };
  data: AppData;
}

export type RestoreMode = 'replace' | 'merge';

export type BackupError = 'read-failed' | 'not-backup' | 'newer-version' | 'empty';

export type ParsedBackup =
  | { ok: true; data: AppData; exportedAt: number | null }
  | { ok: false; error: BackupError };

export function createBackupJson(data: AppData, meta: { now: Date; appVersion: string; platform: string }): string {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: meta.now.toISOString(),
    app: { version: meta.appVersion, platform: meta.platform },
    data,
  };
  return JSON.stringify(backup);
}

/** Seçilen dosyanın içeriğini doğrular; zincirler ve ayarlar normalize edilir. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    // Bazı editörler/aktarımlar dosyanın başına BOM ekler.
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: 'not-backup' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'not-backup' };
  const v = raw as Record<string, unknown>;

  let payload: unknown;
  let exportedAt: number | null = null;
  if (v.format === BACKUP_FORMAT || LEGACY_BACKUP_FORMATS.includes(v.format)) {
    if (typeof v.version !== 'number') return { ok: false, error: 'not-backup' };
    if (v.version > BACKUP_VERSION) return { ok: false, error: 'newer-version' };
    payload = v.data;
    const time = typeof v.exportedAt === 'string' ? Date.parse(v.exportedAt) : NaN;
    exportedAt = Number.isFinite(time) ? time : null;
  } else if (Array.isArray(v.habits)) {
    // Uygulamanın kendi kayıt biçimi (sozum.data.v1) de kabul edilir.
    payload = v;
  } else {
    return { ok: false, error: 'not-backup' };
  }

  const data = normalizeAppData(payload);
  if (!data) return { ok: false, error: 'not-backup' };
  if (data.habits.length === 0) return { ok: false, error: 'empty' };
  return { ok: true, data, exportedAt };
}

/** Yedekteki zincirleri ve ayarları olduğu gibi alır. */
export function replaceAppData(current: AppData, incoming: AppData): AppData {
  return { ...current, habits: incoming.habits, settings: incoming.settings };
}

/** Türkçe büyük/küçük harf farkını ve boşlukları yok sayan isim anahtarı. */
function nameKey(name: string): string {
  return name.trim().replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

/**
 * Yedeği mevcut veriyle birleştirir; ayarlar ve mevcut zincirlerin adı/rengi/sıklığı korunur.
 * Aynı kimlikli (yoksa aynı isimli) zincirlerin işaretli günleri birleşir, yeniler sona eklenir.
 * Tekrar uygulanması sonucu değiştirmez.
 */
export function mergeAppData(current: AppData, incoming: AppData): AppData {
  const habits = [...current.habits];
  const byId = new Map(habits.map((h, i) => [h.id, i]));
  const byName = new Map<string, number>();
  habits.forEach((h, i) => {
    if (!byName.has(nameKey(h.name))) byName.set(nameKey(h.name), i);
  });
  const claimed = new Set<number>();
  const added: Habit[] = [];

  for (const habit of incoming.habits) {
    let index = byId.get(habit.id);
    if (index === undefined) {
      const sameName = byName.get(nameKey(habit.name));
      if (sameName !== undefined && !claimed.has(sameName) && !incoming.habits.some((h) => h.id === habits[sameName].id)) {
        index = sameName;
      }
    }
    if (index === undefined) {
      added.push(habit);
      continue;
    }
    claimed.add(index);
    const existing = habits[index];
    const completions = [...new Set([...existing.completions, ...habit.completions])].sort();
    const startDate = compareDayKeys(habit.startDate, existing.startDate) < 0 ? habit.startDate : existing.startDate;
    habits[index] = { ...existing, completions, startDate };
  }

  return { ...current, habits: [...habits, ...added] };
}

export function countLinks(habits: readonly Habit[]): number {
  return habits.reduce((sum, h) => sum + h.completions.length, 0);
}

/** "sozum-soz-yedek-2026-10-01.json" (her platformda sorunsuz olsun diye ASCII). */
export function backupFileName(now: Date): string {
  return `sozum-soz-yedek-${toDayKey(now)}.json`;
}

/** "1 Ekim 2026, 14:32" */
export function backupDateLabel(time: number): string {
  const date = new Date(time);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${fullDateLabel(toDayKey(date))}, ${hh}:${mm}`;
}

function daysSince(time: number, now: Date): number {
  return Math.max(0, diffDays(toDayKey(now), toDayKey(new Date(time))));
}

export function lastBackupLabel(lastBackupAt: number | null, now: Date = new Date()): string {
  if (lastBackupAt === null) return 'Henüz yedek almadın';
  const days = daysSince(lastBackupAt, now);
  if (days === 0) return 'Son yedek: bugün';
  if (days === 1) return 'Son yedek: dün';
  return `Son yedek: ${days} gün önce`;
}

export function isBackupStale(lastBackupAt: number | null, now: Date = new Date()): boolean {
  return lastBackupAt === null || daysSince(lastBackupAt, now) >= BACKUP_STALE_DAYS;
}

export function backupErrorText(error: BackupError): { title: string; message: string } {
  switch (error) {
    case 'read-failed':
      return {
        title: 'Dosya açılamadı',
        message: 'Dosya okunurken bir sorun oldu. Dosyayı önce telefona indirip tekrar seçmeyi dene.',
      };
    case 'newer-version':
      return {
        title: 'Uygulamayı güncellemelisin',
        message: 'Bu yedek Sözüm Söz’ün daha yeni bir sürümüyle alınmış. Uygulamayı güncelleyip tekrar dene.',
      };
    case 'empty':
      return { title: 'Yedek boş', message: 'Bu yedek dosyasında hiç zincir yok.' };
    case 'not-backup':
      return {
        title: 'Bu bir yedek dosyası değil',
        message: 'Sözüm Söz’den aldığın “sozum-soz-yedek-…” adlı dosyayı seç.',
      };
  }
}

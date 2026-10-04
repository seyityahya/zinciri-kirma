import {
  BACKUP_FORMAT,
  backupDateLabel,
  backupErrorText,
  backupFileName,
  countLinks,
  createBackupJson,
  isBackupStale,
  lastBackupLabel,
  mergeAppData,
  parseBackup,
  replaceAppData,
} from '../backup';
import { emptyData, type AppData, type Habit } from '../types';
import { DAILY, MON, THU, TUE, WED } from './helpers';

function habit(id: string, name: string, completions: string[], startDate = completions[0] ?? MON): Habit {
  return { id, name, emoji: '🔥', color: '#FF6B3D', schedule: DAILY, startDate, completions, createdAt: 1 };
}

function data(habits: Habit[], settings: Partial<AppData['settings']> = {}): AppData {
  const base = emptyData();
  return { ...base, habits, settings: { ...base.settings, ...settings }, updatedAt: 42 };
}

const meta = { now: new Date(2026, 9, 1, 14, 5), appVersion: '1.0.0', platform: 'ios' };

describe('yedek dosyası', () => {
  it('oluşturulan yedek geri okunur', () => {
    const original = data([habit('a', 'Kitap oku', [MON, TUE])], { grace: false, dayStartHour: 0 });
    const json = createBackupJson(original, meta);
    expect(JSON.parse(json)).toMatchObject({ format: BACKUP_FORMAT, version: 1, app: { platform: 'ios' } });

    const parsed = parseBackup(json);
    expect(parsed).toEqual({ ok: true, data: original, exportedAt: meta.now.getTime() });
  });

  it('başında BOM olan dosyayı da okur', () => {
    const json = createBackupJson(data([habit('a', 'Su', [MON])]), meta);
    expect(parseBackup(`﻿${json}`).ok).toBe(true);
  });

  it('uygulamanın kendi kayıt biçimini de kabul eder', () => {
    const parsed = parseBackup(JSON.stringify(data([habit('a', 'Koşu', [MON])])));
    expect(parsed).toMatchObject({ ok: true, exportedAt: null });
  });

  it('yedek olmayan dosyaları reddeder', () => {
    expect(parseBackup('merhaba')).toEqual({ ok: false, error: 'not-backup' });
    expect(parseBackup('[1, 2]')).toEqual({ ok: false, error: 'not-backup' });
    expect(parseBackup('{"name": "başka bir uygulama"}')).toEqual({ ok: false, error: 'not-backup' });
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, data: {} }))).toEqual({ ok: false, error: 'not-backup' });
  });

  it('uygulamanın eski adıyla (Zinciri Kırma) alınmış yedeği açar', () => {
    const json = JSON.stringify({
      format: 'zinciri-kirma-backup',
      version: 1,
      exportedAt: '2026-10-01T09:00:00.000Z',
      data: data([habit('a', 'Kitap oku', [MON, TUE])]),
    });
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error('okunamadı');
    expect(parsed.data.habits[0]).toMatchObject({ id: 'a', name: 'Kitap oku', completions: [MON, TUE] });
    expect(parsed.exportedAt).toBe(Date.parse('2026-10-01T09:00:00.000Z'));
  });

  it('daha yeni sürümün yedeğini tanır', () => {
    const json = JSON.stringify({ format: BACKUP_FORMAT, version: 2, data: data([habit('a', 'Su', [])]) });
    expect(parseBackup(json)).toEqual({ ok: false, error: 'newer-version' });
  });

  it('zinciri olmayan yedeği boş sayar', () => {
    expect(parseBackup(createBackupJson(data([]), meta))).toEqual({ ok: false, error: 'empty' });
  });

  it('bozuk zincirleri ayıklar', () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: 'tarih değil',
      data: { habits: [{ id: 'a', name: 'Yoga', completions: [MON, 'dün', MON] }, { id: 'b' }, 'x'] },
    });
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error('okunamadı');
    expect(parsed.exportedAt).toBeNull();
    expect(parsed.data.habits).toHaveLength(1);
    expect(parsed.data.habits[0]).toMatchObject({ id: 'a', name: 'Yoga', completions: [MON] });
  });

  it('her hata için Türkçe bir açıklama verir', () => {
    for (const error of ['read-failed', 'not-backup', 'newer-version', 'empty'] as const) {
      const text = backupErrorText(error);
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.message.length).toBeGreaterThan(0);
    }
  });
});

describe('geri yükleme', () => {
  it('değiştirirken zincirleri ve ayarları yedektekiyle değiştirir', () => {
    const current = data([habit('a', 'Kitap', [MON])], { grace: true });
    const incoming = data([habit('x', 'Koşu', [TUE])], { grace: false, dayStartHour: 5 });
    const result = replaceAppData(current, incoming);
    expect(result.habits.map((h) => h.id)).toEqual(['x']);
    expect(result.settings).toEqual(incoming.settings);
    expect(result.updatedAt).toBe(current.updatedAt);
  });

  it('birleştirirken aynı kimlikli zincirlerin günlerini birleştirir', () => {
    const current = data([{ ...habit('a', 'Kitap oku', [TUE, WED]), color: '#34C759' }], { grace: false });
    const incoming = data([habit('a', 'Eski ad', [MON, TUE], MON)], { grace: true });
    const result = mergeAppData(current, incoming);
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0]).toMatchObject({
      name: 'Kitap oku',
      color: '#34C759',
      completions: [MON, TUE, WED],
      startDate: MON,
    });
    expect(result.settings.grace).toBe(false);
  });

  it('aynı isimli zincirleri büyük/küçük harf farkı gözetmeden eşleştirir', () => {
    const current = data([habit('yeni', 'Işık kapat', [WED])]);
    const incoming = data([habit('eski', ' ışık KAPAT ', [MON])]);
    const result = mergeAppData(current, incoming);
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0]).toMatchObject({ id: 'yeni', completions: [MON, WED] });
  });

  it('kimliği başka bir yedek zinciriyle eşleşen zinciri isimle tekrar eşleştirmez', () => {
    const current = data([habit('a', 'Su', [WED])]);
    const incoming = data([habit('a', 'Su iç', [MON]), habit('b', 'Su', [TUE])]);
    const result = mergeAppData(current, incoming);
    expect(result.habits.map((h) => [h.id, h.completions])).toEqual([
      ['a', [MON, WED]],
      ['b', [TUE]],
    ]);
  });

  it('yeni zincirleri sona ekler ve tekrar uygulanınca değişmez', () => {
    const current = data([habit('a', 'Kitap', [MON])]);
    const incoming = data([habit('b', 'Koşu', [TUE]), habit('c', 'Yoga', [THU])]);
    const once = mergeAppData(current, incoming);
    expect(once.habits.map((h) => h.id)).toEqual(['a', 'b', 'c']);
    expect(mergeAppData(once, incoming)).toEqual(once);
  });

  it('halkaları sayar', () => {
    expect(countLinks([habit('a', 'A', [MON, TUE]), habit('b', 'B', [WED])])).toBe(3);
  });
});

describe('yedek etiketleri', () => {
  const now = new Date(2026, 9, 1, 9, 0);

  it('dosya adı tarihi içerir', () => {
    expect(backupFileName(now)).toBe('sozum-soz-yedek-2026-10-01.json');
  });

  it('yedeğin tarihini saatle gösterir', () => {
    expect(backupDateLabel(new Date(2026, 9, 1, 14, 5).getTime())).toBe('1 Ekim 2026, 14:05');
  });

  it('son yedeğin ne zaman alındığını söyler', () => {
    expect(lastBackupLabel(null, now)).toBe('Henüz yedek almadın');
    expect(lastBackupLabel(new Date(2026, 9, 1, 0, 30).getTime(), now)).toBe('Son yedek: bugün');
    expect(lastBackupLabel(new Date(2026, 8, 30, 23, 0).getTime(), now)).toBe('Son yedek: dün');
    expect(lastBackupLabel(new Date(2026, 8, 21).getTime(), now)).toBe('Son yedek: 10 gün önce');
  });

  it('30 gündür yedek yoksa eski sayar', () => {
    expect(isBackupStale(null, now)).toBe(true);
    expect(isBackupStale(new Date(2026, 8, 2).getTime(), now)).toBe(false);
    expect(isBackupStale(new Date(2026, 8, 1).getTime(), now)).toBe(true);
  });
});

import * as DocumentPicker from 'expo-document-picker';
import { Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { createBackupJson, parseBackup } from '@/domain/backup';
import { emptyData, type AppData } from '@/domain/types';

import { folderLabel, pickBackup, saveBackupToFolder, shareBackup } from '../backup-files';

// Bellek içi dosya sistemi.
const mockFiles = new Map<string, string>();

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get size() {
      return (mockFiles.get(this.uri) ?? '').length;
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(content: string) {
      mockFiles.set(this.uri, content);
    }
    async text() {
      const content = mockFiles.get(this.uri);
      if (content === undefined) throw new Error('dosya yok');
      return content;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  class Directory {
    static pickDirectoryAsync = jest.fn();
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return [...mockFiles.keys()].some((k) => k.startsWith(`${this.uri}/`));
    }
    create() {}
    delete() {
      for (const key of [...mockFiles.keys()]) if (key.startsWith(`${this.uri}/`)) mockFiles.delete(key);
    }
    createFile(name: string) {
      return new File(this, name);
    }
  }
  return { File, Directory, Paths: { cache: new Directory('file:///cache') } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const sample: AppData = {
  ...emptyData(),
  habits: [
    {
      id: 'a',
      name: 'Kitap oku',
      emoji: '📚',
      color: '#FF6B3D',
      schedule: { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] },
      startDate: '2026-09-01',
      completions: ['2026-09-01', '2026-09-02'],
      createdAt: 1,
    },
  ],
};

const now = new Date(2026, 9, 1, 12, 0);

function pickResult(uri: string, size?: number): DocumentPicker.DocumentPickerResult {
  return { canceled: false, assets: [{ uri, name: 'yedek.json', size, lastModified: 0 }] };
}

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
});

describe('yedeği paylaşma', () => {
  it('geçerli bir yedek dosyası yazıp paylaşım menüsünü açar', async () => {
    expect(await shareBackup(sample, now)).toBe(true);

    const uri = 'file:///cache/backups/sozum-soz-yedek-2026-10-01.json';
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: 'application/json' }));
    expect(parseBackup(mockFiles.get(uri)!)).toMatchObject({ ok: true, data: sample });
  });

  it('eski geçici yedekleri temizler', async () => {
    mockFiles.set('file:///cache/backups/sozum-soz-yedek-2026-01-01.json', '{}');
    await shareBackup(sample, now);
    expect([...mockFiles.keys()]).toEqual(['file:///cache/backups/sozum-soz-yedek-2026-10-01.json']);
  });

  it('paylaşım yoksa false döner', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    expect(await shareBackup(sample, now)).toBe(false);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('klasöre kaydetme (Android)', () => {
  it('seçilen klasöre yazar ve klasörün adını verir', async () => {
    const folder = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments';
    jest.mocked(Directory.pickDirectoryAsync).mockResolvedValueOnce(new Directory(folder));

    expect(await saveBackupToFolder(sample, now)).toEqual({ status: 'saved', folder: 'Documents' });
    expect(parseBackup(mockFiles.get(`${folder}/sozum-soz-yedek-2026-10-01.json`)!).ok).toBe(true);
  });

  it('klasör seçimi iptal edilirse bir şey yazmaz', async () => {
    jest.mocked(Directory.pickDirectoryAsync).mockRejectedValueOnce(
      Object.assign(new Error('The file picker was cancelled by the user'), { code: 'ERR_PICKER_CANCELLED' }),
    );
    expect(await saveBackupToFolder(sample, now)).toEqual({ status: 'canceled' });
    expect(mockFiles.size).toBe(0);
  });

  it('klasör adresinden okunur ad çıkarır', () => {
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FYedek')).toBe(
      'Documents/Yedek',
    );
    expect(folderLabel('content://com.android.externalstorage.documents/tree/primary%3A')).toBeNull();
    expect(folderLabel('file:///data/user/0')).toBeNull();
  });
});

describe('yedek dosyası seçme', () => {
  it('iptal edilirse null döner', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickBackup()).toBeNull();
  });

  it('seçilen yedeği okur ve önbellekteki kopyayı siler', async () => {
    const uri = 'file:///cache/DocumentPicker/1.json';
    mockFiles.set(uri, createBackupJson(sample, { now, appVersion: '1.0.0', platform: 'android' }));
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce(pickResult(uri));

    expect(await pickBackup()).toEqual({ ok: true, data: sample, exportedAt: now.getTime() });
    expect(mockFiles.has(uri)).toBe(false);
  });

  it('çok büyük dosyayı okumadan reddeder', async () => {
    const uri = 'file:///cache/DocumentPicker/video.mp4';
    mockFiles.set(uri, 'x');
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce(pickResult(uri, 50 * 1024 * 1024));
    expect(await pickBackup()).toEqual({ ok: false, error: 'not-backup' });
  });

  it('okunamayan dosyada read-failed döner', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce(pickResult('file:///cache/yok.json'));
    expect(await pickBackup()).toEqual({ ok: false, error: 'read-failed' });
  });
});

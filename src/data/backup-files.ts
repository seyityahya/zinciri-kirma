import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { BACKUP_MAX_BYTES, backupFileName, createBackupJson, type ParsedBackup, parseBackup } from '@/domain/backup';
import type { AppData } from '@/domain/types';

const MIME = 'application/json';
/** Android'de klasör seçici "Documents"ta açılır (Download kökü Android 11+'da seçilemiyor). */
const ANDROID_DOCUMENTS_URI = 'content://com.android.externalstorage.documents/document/primary%3ADocuments';

function backupJson(data: AppData, now: Date): string {
  return createBackupJson(data, {
    now,
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    platform: Platform.OS,
  });
}

/**
 * Yedeği geçici klasöre yazıp paylaşım menüsünü açar (Dosyalar'a kaydet, Drive, WhatsApp, e-posta…).
 * Menü kapanınca döner; kullanıcının dosyayı gerçekten kaydedip kaydetmediği bilinemez.
 */
export async function shareBackup(data: AppData, now: Date = new Date()): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const dir = new Directory(Paths.cache, 'backups');
  if (dir.exists) dir.delete();
  dir.create();
  const file = new File(dir, backupFileName(now));
  file.create();
  file.write(backupJson(data, now));
  await Sharing.shareAsync(file.uri, { mimeType: MIME, UTI: 'public.json', dialogTitle: 'Yedeği kaydet ya da gönder' });
  return true;
}

export type FolderSaveResult = { status: 'saved'; folder: string | null } | { status: 'canceled' };

/** Android: kullanıcının seçtiği klasöre (ör. Documents) yedek dosyasını yazar. */
export async function saveBackupToFolder(data: AppData, now: Date = new Date()): Promise<FolderSaveResult> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync(ANDROID_DOCUMENTS_URI);
  } catch (error) {
    if (isPickerCancel(error)) return { status: 'canceled' };
    throw error;
  }
  const file = dir.createFile(backupFileName(now), MIME);
  file.write(backupJson(data, now));
  return { status: 'saved', folder: folderLabel(dir.uri) };
}

function isPickerCancel(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === 'ERR_PICKER_CANCELLED' || (typeof e?.message === 'string' && /cancel/i.test(e.message));
}

/** SAF klasör adresinden okunur ad: ".../tree/primary%3ADocuments%2FYedek" → "Documents/Yedek". */
export function folderLabel(uri: string): string | null {
  const match = /\/tree\/([^/]+)/.exec(uri);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    const colon = id.indexOf(':');
    const path = colon >= 0 ? id.slice(colon + 1) : '';
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

/** Dosya seçiciyi açar ve seçilen yedeği doğrular; iptal edilirse null. */
export async function pickBackup(): Promise<ParsedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // iOS'ta diğer dosyalar soluk görünür; Android'de bazı uygulamalar JSON'a farklı tür verdiği için hepsi listelenir.
    type: Platform.OS === 'ios' ? ['application/json', 'text/plain'] : '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > BACKUP_MAX_BYTES) return { ok: false, error: 'not-backup' };
    return parseBackup(await file.text());
  } catch {
    return { ok: false, error: 'read-failed' };
  } finally {
    // Seçicinin önbelleğe aldığı kopya artık gereksiz.
    try {
      file.delete();
    } catch {}
  }
}

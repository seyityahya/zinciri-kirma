import Constants from 'expo-constants';

const FALLBACK_APP_GROUP = 'group.com.seyit.zincirikirma';

/**
 * iOS'ta uygulama ile widget'ın ortak kullandığı App Group.
 * app.json → ios.entitlements içinden okunur; Swift tarafında
 * targets/widget/SharedStore.swift içindeki değerle aynı olmalıdır.
 */
export const APP_GROUP: string =
  (Constants.expoConfig?.ios?.entitlements?.['com.apple.security.application-groups'] as
    | string[]
    | undefined)?.[0] ?? FALLBACK_APP_GROUP;

/** Paylaşılan verinin anahtarı (Swift: SharedStore.dataKey). */
export const DATA_KEY = 'zk.data.v1';

/** Cihaza özel tercihler (tema, titreşim). */
export const PREFS_KEY = 'zk.prefs.v1';

/** Android widget örneği → zincir eşleşmeleri. */
export const WIDGET_CONFIG_KEY = 'zk.android-widgets.v1';

export const URL_SCHEME = 'zincirikirma';

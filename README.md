# Zinciri Kırma 🔗

Hedefini koy, her yaptığında zincirine bir halka ekle ve zinciri kırma.
Ana ekran widget'ı sayesinde uygulamayı açmadan tek dokunuşla işaretleyebilir,
zincirinin kaç gündür sürdüğünü her an görebilirsin.

- **Sıklıklar:** her gün, hafta içi, belirli günler (ör. Pzt/Çar/Cum), birkaç günde bir (ör. 2 günde bir), haftada N kez
- **Widget'lar (iOS + Android):**
  - **Tek Zincir** (küçük): seçtiğin zincir, seri sayısı, son halkalar ve "Yaptım" düğmesi
  - **Bugün** (orta/büyük): tüm zincirler, bugünkü ilerleme ve her biri için işaretleme düğmesi
  - iOS'ta ayrıca kilit ekranı widget'ları (yuvarlak, dikdörtgen, satır içi)
- Takvimden geçmiş günleri işaretleme/düzeltme, en uzun seri, toplam, başarı oranı
- Açık/koyu tema, titreşimli geri bildirim, VoiceOver desteği
- Hesap ve sunucu yok: veriler yalnızca cihazda

## Çalıştırma

Gereksinimler: Node 20+, Xcode 16+ (iOS 17+ cihaz ya da simülatör), Android için Android Studio/SDK ve JDK 17.

```bash
npm install
npm run ios        # iOS simülatörde derler ve açar
npm run android    # Android emülatör/cihazda derler ve açar
```

> Widget'lar yerel (native) kod içerdiği için **Expo Go'da çalışmaz**; yukarıdaki komutlar bir geliştirme
> derlemesi oluşturur. `ios/` ve `android/` klasörleri `npx expo prebuild` ile üretilir, elle düzenlenmez.

### Gerçek iPhone'a kurmak

1. `ios/ZinciriKrma.xcworkspace` dosyasını Xcode'da aç.
2. **ZinciriKrma** ve **ZincirWidget** hedeflerinin ikisinde de *Signing & Capabilities* altında kendi
   Apple hesabını (Team) seç.
3. İki hedefte de *App Groups* altında `group.com.seyit.zincirikirma` işaretli olmalı. Bundle kimliğini
   değiştirirsen (ör. `com.adin.zincirikirma`), App Group adını şu üç yerde birlikte güncelle:
   - `app.json` → `ios.entitlements`
   - `targets/widget/SharedStore.swift` → `appGroup`
   - `src/config.ts` (yedek değer; asıl değer `app.json`'dan okunur)
4. Kalıcı olarak `app.json` içine `"ios": { "appleTeamId": "TAKIM_ID" }` ekleyebilirsin.

### Widget ekleme

- **iOS:** Ana ekranda boş bir yere basılı tut → sol üstte **Düzenle** → **Widget Ekle** → "Zinciri Kırma".
  Tek Zincir widget'ına basılı tutup **Widget'ı Düzenle** ile gösterilecek zinciri seç.
- **Android:** Ana ekranda basılı tut → **Widget'lar** → "Zinciri Kırma". Tek Zincir'i eklerken zinciri seçersin.
  Uygulamadaki **Ayarlar → Widget** bölümünden de tek dokunuşla ekleyebilirsin.

## Zincir kuralları

| Sıklık | Zincir birimi | Ne zaman kırılır? |
| --- | --- | --- |
| Her gün / hafta içi / belirli günler | gün | Planlı bir gün yapılmadan geçerse. Planlı olmayan günler zinciri kırmaz. |
| N günde bir | kez | Son yapılıştan sonra N gün içinde tekrar yapılmazsa. |
| Haftada N kez | hafta | Bir hafta (Pzt–Paz) hedef sayıya ulaşmadan biterse. İlk hafta, kalan gün sayısına göre esnetilir. |

Bugün henüz yapılmadıysa zincir kırılmaz, "bugün yap" durumunda bekler.

## Mimari

```
src/
  app/            Ekranlar (Expo Router): ana ekran, detay, form, ayarlar
  components/     Zincir halkaları, kart, takvim, form parçaları
  domain/         Saf mantık: tarih, seri hesabı, Türkçe metinler, doğrulama
  data/           Zustand deposu ve kalıcılık (widget'la paylaşılan depo)
  widgets/        Android widget'ları (JSX) ve widget senkronu
targets/widget/   iOS widget'ı (SwiftUI + WidgetKit + AppIntents)
plugins/          Yerel Expo config eklentisi
```

**Veri ve senkron.** Veritabanı sunucusu gerekmedi: hesap olmadığı ve widget'ın çevrimdışı, anında
çalışması gerektiği için veriler cihazda tutulur (MongoDB gibi bir sunucu veritabanı burada gecikme ve
bağımlılık eklerdi).

- **iOS:** Uygulama ve widget aynı JSON'u App Group `UserDefaults` içinde paylaşır. Widget'taki düğme bir
  `AppIntent` ile bu veriyi doğrudan günceller. Uygulama öne gelince değişikliği okur.
- **Android:** Widget olayları uygulamanın JS ortamında (headless) çalışır ve aynı depoyu kullanır.
- Her değişiklik diskteki **en güncel** veriye uygulanarak yazılır. Böylece widget'ın yaptığı işaretlemeler
  uygulama tarafından asla ezilmez.

**Tek mantık, iki dil.** Seri hesabı `src/domain/streak.ts` içinde. iOS widget'ı Swift'te çalıştığı için
aynı mantık `targets/widget/ChainLogic.swift` içinde de var. Bir parite testi, rastgele üretilmiş
1500'den fazla senaryoda iki tarafın birebir aynı sonucu verdiğini doğrular.

## Testler

```bash
npm test             # Birim + ekran akışı testleri (Jest), macOS'ta Swift paritesi dahil
npm run test:swift   # Yalnızca Swift ↔ TypeScript parite testi
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run verify       # Hepsi
```

## Not: klasör adı

Proje klasörünün adında "ı" harfi olduğu için CocoaPods'un bilinen bir kodlama hatası tetikleniyor.
`plugins/with-utf8-podfile.js` eklentisi bunu her `prebuild`'de otomatik olarak düzeltir. Yine de
herhangi bir yerel derleme aracı sorun çıkarırsa, klasörü `zinciri-kirma` olarak yeniden adlandırmak kesin
çözümdür.

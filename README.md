# Sözüm Söz

Hedefini koy, her yaptığında zincirine bir halka ekle ve sözünü ne kadar tuttuğunu gör.
Ana ekran widget'ı sayesinde uygulamayı açmadan tek dokunuşla işaretleyebilir,
zincirinin kaç gündür sürdüğünü her an görebilirsin.

- **Sıklıklar:** her gün, hafta içi, belirli günler (ör. Pzt/Çar/Cum), birkaç günde bir (ör. 2 günde bir), haftada N kez
- **Hata payı:** art arda 7 halkada 1 kaçırma affedilir; o halka turuncu görünür ve uyarı verilir
- **Gün bitişi:** gün varsayılan olarak gece 03:00'te biter (geç yatanlar için); ayarlardan değiştirilebilir
- **Akşam hatırlatması:** o gün yapılmamış zincirler için günde tek bir toplu bildirim (varsayılan 21:00)
- **Widget'lar (iOS + Android):**
  - **Tek Zincir** (2×2): seçtiğin zincir, tarih, seri sayısı, son halkalar ve "Yaptım" düğmesi
  - **Mini Zincir** (Android, 2×1): ince şerit hâlinde ad, seri, tarih ve işaret düğmesi
  - **Bugün** (orta/büyük): tüm zincirler, bugünkü ilerleme ve her biri için işaretleme düğmesi
  - iOS'ta ayrıca kilit ekranı widget'ları (yuvarlak, dikdörtgen, satır içi)
- Takvimden geçmiş günleri işaretleme/düzeltme, en uzun seri, toplam, başarı oranı
- Açık/koyu tema, titreşimli geri bildirim, VoiceOver desteği
- Hesap ve sunucu yok: veriler yalnızca cihazda
- **Yedekleme:** tüm zincirler tek bir dosyaya (`sozum-soz-yedek-YYYY-AA-GG.json`) alınır ve Drive'a,
  Dosyalar'a ya da kendine gönderilir; yeni telefonda (iPhone ↔ Android dahil) dosyadan geri yüklenir.
  Geri yüklerken mevcut zincirlerle birleştirme ya da onları değiştirme seçilebilir ve işlem geri alınabilir.

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

1. `ios/SzmSz.xcworkspace` dosyasını Xcode'da aç. (Expo, iOS proje adını uygulama adından Türkçe harfleri
   atarak üretir; telefonda ve mağazada görünen ad yine "Sözüm Söz"dür.)
2. **SzmSz** ve **ZincirWidget** hedeflerinin ikisinde de *Signing & Capabilities* altında kendi
   Apple hesabını (Team) seç.
3. İki hedefte de *App Groups* altında `group.com.seyit.sozumsoz` işaretli olmalı. Bundle kimliğini
   değiştirirsen (ör. `com.adin.sozumsoz`), App Group adını şu üç yerde birlikte güncelle:
   - `app.json` → `ios.entitlements`
   - `targets/widget/SharedStore.swift` → `appGroup`
   - `src/config.ts` (yedek değer; asıl değer `app.json`'dan okunur)
4. Kalıcı olarak `app.json` içine `"ios": { "appleTeamId": "TAKIM_ID" }` ekleyebilirsin.

### Widget ekleme

- **iOS:** Ana ekranda boş bir yere basılı tut → sol üstte **Düzenle** → **Widget Ekle** → "Sözüm Söz".
  Tek Zincir widget'ına basılı tutup **Widget'ı Düzenle** ile gösterilecek zinciri seç.
- **Android:** Ana ekranda basılı tut → **Widget'lar** → "Sözüm Söz". Tek Zincir'i eklerken zinciri seçersin.
  Uygulamadaki **Ayarlar → Widget** bölümünden de tek dokunuşla ekleyebilirsin.

## Zincir kuralları

| Sıklık | Zincir birimi | Ne zaman kırılır? |
| --- | --- | --- |
| Her gün / hafta içi / belirli günler | gün | Planlı bir gün yapılmadan geçerse. Planlı olmayan günler sayılmaz. |
| N günde bir | kez | Son yapılıştan sonra N gün içinde tekrar yapılmazsa. |
| Haftada N kez | hafta | Bir hafta (Pzt–Paz) hedef sayıya ulaşmadan biterse. İlk hafta, kalan gün sayısına göre esnetilir. |

Bugün henüz yapılmadıysa zincir kırılmaz, "bugün yap" durumunda bekler.

**Hata payı (ayarlardan kapatılabilir):** Her beklenen halka (gün, kez ya da haftalık hedefin her tekrarı) sırayla
değerlendirilir. İki kaçırma arasında en az 7 halka varsa kaçırma affedilir: zincir sürer ama o halka sayılmaz ve
turuncu görünür. Daha sık kaçırılırsa zincir kırılır. Örnek: haftada 3 kez hedefiyle 4 haftada 11 kez yapmak zinciri
korur, 9 kez yapmak kırar.

**Gün bitişi:** Gün, ayardaki saatte (varsayılan 03:00) biter. Gece 01:30'da işaretlediğin şey önceki güne sayılır;
uygulama, widget'lar ve bildirimler aynı "bugün"ü kullanır.

**Hatırlatma:** Her akşam seçtiğin saatte, o gün bekleyen zincirler tek bildirimde toplanır ("Bugün 3 zincir seni
bekliyor"). Hepsini yaptıysan (widget'tan bile) o günün bildirimi iptal edilir. Android 14 ve üstünde
"Alarmlar ve hatırlatıcılar" izni kapalıysa sistem bildirimi bir saate kadar geciktirebilir; tam saatinde gelmesi
için Ayarlar → Hatırlatma'daki kısayoldan bu izni açabilirsin.

## Mimari

```
src/
  app/            Ekranlar (Expo Router): ana ekran, detay, form, ayarlar
  components/     Zincir halkaları, kart, takvim, form parçaları
  domain/         Saf mantık: tarih, seri hesabı, Türkçe metinler, doğrulama
  data/           Zustand deposu ve kalıcılık (widget'la paylaşılan depo)
  notifications/  Akşam hatırlatmalarının planı ve kurulumu
  widgets/        Android widget'ları (android-home/, JSX) ve widget senkronu
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
- **Yedek dosyası:** biçim, doğrulama ve birleştirme kuralı `src/domain/backup.ts` içinde; dosya yazma,
  paylaşma ve seçme `src/data/backup-files.ts` içinde (`expo-file-system`, `expo-sharing`,
  `expo-document-picker`). Dosya `{ format, version, exportedAt, app, data }` biçiminde bir JSON'dur; `version`
  uygulamanın desteklediğinden büyükse geri yükleme "uygulamayı güncelle" uyarısıyla reddedilir.

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

## Notlar

- **Android widget'larında tıklama:** react-native-android-widget 0.22'de bir widget'taki birden çok tıklanabilir
  alan birbirinin `PendingIntent`'ini iptal edebiliyor. Bu yüzden her widget'ta liste dışında tek bir düğme var;
  "Bugün" widget'ının satırları `ListWidget` ile çiziliyor (bunu bir test de denetliyor).
- **Klasör adı `android` olmamalı:** React Native'in Gradle eklentisi `android/` adlı klasörlerdeki JS dosyalarını
  paket girdisi saymıyor; bu yüzden Android widget kodu `src/widgets/android-home/` içinde.

## Not: klasör adı

Proje klasörünün adında "ı" harfi olduğu için CocoaPods'un bilinen bir kodlama hatası tetikleniyor.
`plugins/with-utf8-podfile.js` eklentisi bunu her `prebuild`'de otomatik olarak düzeltir. Yine de
herhangi bir yerel derleme aracı sorun çıkarırsa, klasörü `sozum-soz` olarak yeniden adlandırmak kesin
çözümdür.

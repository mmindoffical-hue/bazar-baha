# PROJE.md - Bazar Baha (V1)

> Bu dosyayı her yeni yapay zekâ sohbetinin / aracın **en başına** ver.
> Sonra sadece "Adım X'i yap" de.

## 1. Proje nedir?
Türkmenistan'daki market, mağaza ve bazar satıcılarının ürün fiyatlarını
**fiyat + ürün fotoğrafları** ile güncellediği, alıcıların ise "bir ürün nerede
en ucuz ve taze?" sorusuna baktığı bir web uygulamasıdır (PWA).

- **Alıcı:** ürün arar, mağazaları fiyata göre sıralı görür, ürün fotoğraflarına bakar,
  alışveriş listesi yapar, yanlış fiyatı bildirir.
- **Dükkân sahibi:** başvuru yapar, admin onaylayınca ürün fiyatı + fotoğraf girer.
- **Admin (proje sahibi):** dükkân başvurularını onaylar/askıya alır, ürün
  kataloğunu yönetir, şikâyetleri görür.

## 2. Teknoloji (değiştirme)
| Parça | Seçim |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| PWA | vite-plugin-pwa (ana ekrana eklenir, çevrimdışı önbellek) |
| Backend | Supabase (Auth, Postgres, Realtime, Storage) |
| Harita | Leaflet + OpenStreetMap |
| Hosting | Cloudflare Pages (ücretsiz) |
| Dil | **Türkmence** (ileride Rusça/Türkçe eklenecek) |

## 3. Kesin kurallar (yapay zekâ bunlara uymak ZORUNDA)
1. **Güvenlik veritabanında (RLS) sağlanır.** Frontend'e güvenme. `schema.sql`
   dosyasındaki tablo/politika yapısını bozma, yeni tablo eklenirse RLS aç.
2. **`service_role` anahtarı asla frontend koduna girmez.** Sadece
   `anon` anahtarı kullanılır ve `.env` dosyasından okunur.
3. **Metinler koda gömülmez.** Tüm arayüz yazıları `src/i18n/tk.ts` gibi bir
   dil dosyasından gelir (sonra Rusça/Türkçe eklemek kolay olsun).
4. **Dış kaynak yok:** Google Fonts, CDN script vb. kullanma. Font ve
   kütüphaneler projeyle birlikte paketlenir.
5. **Yavaş internet için tasarla:** küçük dosya, listede küçük fotoğraf kopyası,
  tam boy fotoğraf sadece tıklanınca yüklenir, son veriler önbellekte
   tutulur (internet kopsa da eski fiyatlar "eski bilgi" etiketiyle görünür).
6. **Eski bilgi etiketi:** `updated_at` 24 saatten eskiyse gri + "Köne maglumat".
7. **Fotoğraf kuralı:** ürün başına 1-2 HD fotoğraf. Yüklemeden önce tarayıcıda
  1280px'e küçültülür, JPEG 0.8 kalite kullanılır ve 320px küçük kopyası
  oluşturulur. Telefon kamerası için `capture="environment"` kullanılır.
8. **Realtime:** atlandı. Ürün sayfası verisi yalnızca "Täzele" düğmesiyle yenilenir.
9. Fiyat para birimi: **manat**, 2 ondalık.
10. Mobil öncelikli (360px genişlik), büyük dokunma alanları.

## 4. Veritabanı (özet - tam hali schema.sql)
- `profiles` (rol: user | admin)
- `stores` (owner_id, name, phone, city, address, lat, lng, photo_path,
  **status: pending | approved | suspended**) - status sadece admin RPC'si
  `set_store_status` ile değişir
- `categories`, `products` (katalog, sadece admin yazar)
- `prices` (store_id, product_id, price, in_stock, photo_paths, video_path, updated_at)
  - her dükkân ürün başına tek satır; `updated_at` sunucuda otomatik yazılır
- `reports` (yanlış fiyat bildirimi)
- `price_list` görünümü: alıcı ekranı için birleşik liste
- Storage: `product-photos` (herkese açık), `store-videos` (eski, kullanılmıyor), `store-photos` (özel)
  - Video yolu: `{store_id}/{product_id}-{zaman}.mp4`
  - Foto yolu: `{user_id}/vitrin.jpg`

## 5. Sahte market sorununun çözümü
1. Kayıt = başvuru, durum `pending`. Bu durumda fiyat/video yazamaz.
2. Admin telefon + adres + vitrin fotoğrafı ile doğrular, onaylar.
3. Sadece `approved` dükkân fiyat yazar (RLS + storage politikası).
4. Ürün fotoğrafları kamera veya galeriden tek tek seçilir, tarayıcıda küçültülür.
5. Kullanıcı "yanlış fiyat" bildirir; çok bildirim alan dükkân askıya alınır.
> Not: Uygulama içi kamera zorunluluğu tarayıcı tarafında bir engeldir, %100
> kanıt değildir. Asıl güvenlik admin onayı + bildirim sistemidir.

## 6. Ekranlar
**Alıcı:** Ana sayfa (kategoriler + arama) -> Ürün sayfası (mağaza listesi,
fiyata göre sıralı, güncelleme saati, video) -> Harita -> Alışveriş listesi
(toplam tahmini tutar) -> Giriş.
**Dükkân:** Başvuru formu (ad, telefon, adres, haritadan konum, vitrin foto)
-> "Onay bekleniyor" -> Ürünlerim (fiyat gir + video çek) -> Hızlı güncelle.
**Admin:** Bekleyen başvurular (foto + telefon, Onayla/Reddet), Dükkânlar
(askıya al), Ürün kataloğu, Şikâyetler.

---

# ADIM ADIM YOL HARİTASI

Her adımı **ayrı bir sohbette** yaptır. Adım bitince çalıştığını telefonda
dene, sonra sonrakine geç. Bir adımda takılırsan hata mesajını olduğu gibi
yapay zekâya yapıştır.

## Adım 0 - Hazırlık (kod yok)
- [ ] supabase.com'da ücretsiz hesap + yeni proje aç (bölge: Frankfurt gibi
      Avrupa'daki bir bölge sana en yakın olandır).
- [ ] github.com'da hesap + boş bir depo (repo) aç: `bazar-baha`.
- [ ] Bilgisayara Node.js (LTS) ve VS Code kur.
- [ ] Cloudflare hesabı aç (Pages için).
- [ ] 3-5 tanıdık dükkân sahibiyle konuş: gerçekten kullanır mı?

## Adım 1 - Veritabanı
- [ ] Supabase > SQL Editor'a `schema.sql` içeriğini yapıştır > Run.
- [ ] Authentication > Providers: e-posta girişini aç. Test döneminde
      "Confirm email" kapalı olabilir. (Türkmenistan'da e-posta ulaşmayabilir;
      gerekirse telefon/OTP yerine basit e-posta + şifre ile başla.)
- [ ] Uygulamadan kayıt olduktan sonra SQL dosyasının sonundaki satırla
      kendini admin yap.
- [ ] Supabase > Project Settings > API: `Project URL` ve `anon` anahtarını not et.

## Adım 2 - Proje iskeleti (yapay zekâya ver)
> "PROJE.md'yi oku. Vite + React + TypeScript + Tailwind projesi kur,
> vite-plugin-pwa ekle, supabase-js'i bağla (.env'den VITE_SUPABASE_URL ve
> VITE_SUPABASE_ANON_KEY). Türkmence i18n dosyası, alt gezinme çubuğu ve
> boş sayfa iskeletleri oluştur."

## Adım 3 - Giriş / kayıt
> "Supabase Auth ile e-posta+şifre girişi, kayıt, çıkış. Oturum yönetimi.
> Giriş yapmayan kişi ürünlere bakabilsin ama liste/bildirim için giriş
> istensin."

## Adım 4 - Alıcı: kategori, arama, ürün sayfası
> "price_list görünümünden veri çek. Ana sayfada kategoriler ve arama,
> ürün sayfasında mağazalar fiyata göre sıralı olsun. 24 saatten eski
> fiyat gri ve 'Köne maglumat' etiketli olsun. Liste yüklenirken iskelet
> (skeleton) göster."

## Adım 5 - Dükkân başvurusu + admin onayı
> "Dükkân başvuru formu (stores insert, status otomatik pending). Foto
> store-photos/{user_id}/vitrin.jpg yoluna yüklensin. Admin sayfasında
> bekleyen başvurular listesi, foto + telefon ile, 'Onayla' ve 'Askıya al'
> butonları set_store_status RPC'sini çağırsın."

## Adım 6 - Dükkân: fiyat girme
> "Onaylı dükkân için 'Ürünlerim' sayfası: katalogdan ürün seç, fiyat ve
> stokta var/yok gir, prices tablosuna upsert (store_id, product_id)."

## Adım 7 - Fotoğraf seçme ve yükleme
> "Her ürün için 1-2 fotoğraf al. `input type=file` ile fotoğrafları tek tek
> seç; telefonda kamerayı açmak için `capture=environment` kullan. Yüklemeden
> önce tarayıcıda EXIF yönünü koruyarak 1280px'e küçült, JPEG kalite 0.8
> kullan, gerekirse 0.7/0.6 dene. 320px küçük kopya oluştur. Tam ve küçük
> kopyayı `product-photos` içine yükle; `prices.photo_paths` alanına tam boy
> yolları yaz. Fotoğraf ekleme/silme ve ilerleme göstergesi olsun."

## Adım 8 - Realtime (atlandı)
> "Realtime eklenmedi. Ürün sayfasında 'Täzele' düğmesiyle veriyi elle yenile."

## Adım 9 - Alışveriş listesi + yanlış fiyat bildirimi
> Durum: Yapıldı.

> "Alışveriş listesi (telefonda localStorage, girişte isteğe bağlı), her
> ürün için en ucuz mağaza ve toplam tutar. 'Yanlış fiyat' butonu reports
> tablosuna yazsın."

## Adım 10 - Harita
> "Leaflet + OpenStreetMap ile onaylı dükkânları göster. Dükkân başvurusunda
> haritadan konum seçilsin. Harita sadece açılınca yüklensin."

## Adım 11 - Çevrimdışı / yavaş internet
> "PWA önbelleği: uygulama dosyaları ve son yüklenen fiyat listesi çevrimdışı
> da görünsün. Fotoğraflar tembel yüklensin."

## Adım 12 - Yayına alma
- [ ] Kodu GitHub'a yükle.
- [ ] Cloudflare Pages > GitHub deposunu bağla. Build: `npm run build`,
      çıktı klasörü: `dist`. Ortam değişkenlerini (`VITE_...`) ekle.
- [ ] Telefonda ana ekrana ekle, test et.

## Adım 13 - Pilot
- [ ] 1-2 pazarda 10-30 dükkân + 50-100 alıcıyla dene.
- [ ] Neyi kullanıyorlar, neyi anlamıyorlar? Not al, düzelt, sonra genişlet.

---

## Bilinen sınırlar (V1'de dikkat)
- **Supabase ücretsiz depolama küçüktür** (yaklaşık 1 GB, güncel sınırı
  kontrol et). Fotoğraflar yüklenmeden önce tarayıcıda küçültülür.
- Ücretsiz projeler uzun süre kullanılmazsa duraklatılabilir.
- Realtime bu sürümde kullanılmaz.
- Kotalar değişir: kullanmadan önce Supabase ve Cloudflare fiyat sayfalarına bak.
- Türkmenistan'daki yerel kurallar (ticari veri yayını, kişisel veri) için
  yerel bir uzmana danışmanı öneririm.

## V2 fikirleri (şimdi yapma)
Fiyat düşünce bildirim, favori dükkânlar, fiyat geçmişi grafiği, otomatik
askıya alma (N şikâyet), Rusça/Türkçe dil, dükkân için "öne çıkma" ücretli plan.

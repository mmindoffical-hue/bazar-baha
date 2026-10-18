# Bazar Baha - Durum Notu

Değerlendirme: 2026-10-18. Adım 10A, Adım 11 ve “Harita ana sayfa” arayüzü uygulandı; `npm run build` başarılı. Vite ana JavaScript chunk büyüklüğü için hâlâ uyarı veriyor; Leaflet ve harita ekranı ayrı chunk'larda. Bu görevde tarayıcı açılmadı, canlı Supabase'e bağlanılmadı ve veritabanına yazılmadı.

## Bitenler

- Harita açılış sayfası ve ilk alt gezinme sekmesidir; harita ekranı `React.lazy` ile ilk çizimde yüklenir, yüklenirken gri iskelet gösterilir. Ekran alt gezinme dışında tam yüksekliğe yayılır ve sayfa kaydırması kapalıdır. Harita üzerinde yüzen “Haryt ýa-da dükan gözle” we “Meniň ýerim” kontrolleri vardır.
- Kategori gezintisi “Gözleg” sayfasının üstüne taşındı; arama ve kategori → ürün akışları korunuyor. Alt gezinme sırası Karta, Gözleg, Sebedim, Profil; “Baş sahypa” sekmesi kaldırıldı.
- Harita “Täzelikler” paneli kapalıyken yalnız başlığı gösterir. Cache-first haber listesi son 7 günde onaylanmış dükkânları ve en son güncellenen 10 fiyatı sunar; satırlar ilgili marker'ı odaklar, dükkân/ürün detayına geçiş sağlar. Dükkân sorguları `approved_at` alanını da alır, `phone` ve `owner_id` seçmez; son 7 günlük mağazalarda marker “Täze” rozeti gösterir.
- Harita `markerZoomAnimation: false`, `fadeAnimation: false`, karo katmanında `updateWhenIdle: true`, `keepBuffer: 1`, `updateWhenZooming: false` ile yapılandırıldı. Marker nesneleri `useMemo` ile hazırlanır; hareket sırasında React state'i güncellenmez. Başlangıç kapsamı dükkân marker'larının tümünü gösterecek şekilde `fitBounds` ile ayarlanır; harita Türkmenistan sınırları içinde tutulur. Logo marker'larında ağır gölge yoktur ve görseller async decode edilir.
- Leaflet attribution prefix kaldırıldı; OSM lisans bağlantısı küçük ve yarı saydam şekilde sağ altta kalır. “Meniň ýerim” cihaz konum iznini ister ve haritayı konuma merkezler.
- E-posta/şifre kayıt, giriş/çıkış, oturum ve `profiles.role` okuma akışları kodda mevcut.
- Kategori, arama, ürün fiyat listesi ve yenileme akışları mevcut. 2026-10-10 tarayıcı denemesinde arama ve kategori → ürün çalıştı; `Hyýar` için fiyat görüldü. Daha sonraki Supabase isteği `ERR_INTERNET_DISCONNECTED` verdi; bu nedenle fiyatı olan ürünün kategori yolundaki görüntüsü tekrar doğrulanmadı.
- Dükkân başvuru/düzenleme formunda küçük Leaflet haritası, sürüklenebilir marker, cihaz konumunu kullanma ve isteğe bağlı logo yükleme mevcut. Yeni başvuruda konum zorunlu; eski konumsuz dükkânda uyarı gösterilir.
- Admin `set_store_status` onay/askıya alma akışı mevcut; onay RPC'si seri numarasını otomatik atar. Admin listesinde seri numarası ve seri numarasıyla dükkân araması kodlandı.
- Onaylı dükkân için fiyat/stok ekleme, düzenleme ve silme; en fazla iki ürün fotoğrafı yükleme, sıkıştırma ve thumbnail üretme kodda mevcut.
- Sepet `localStorage` ile saklanıyor; miktar değiştirme, silme, en ucuz fiyat ve mağaza toplamı hesaplamaları kodda mevcut. 2026-10-10 tarayıcı denemesinde sepet ekleme/silme/yenileme ve boş sepet kontrol edildi; çökme görülmedi.
- Yanlış fiyat bildirimi ve admin şikâyet paneli mevcut. Girişsiz bildirim uyarısı tarayıcıda görüldü.
- Admin kataloğunda kategori ekleme/düzenleme; ürün ekleme/düzenleme/silme; kategori filtresi, 50'lik toplu ekleme ve yinelenen kayıt uyarısı kodda mevcut. Ürün silme öncesi ilişkili fiyatları sayıyor, sonrasında ilişkili tam boy ve thumbnail görsellerini temizlemeyi deniyor.
- OSM haritası alt gezinmeye eklendi; onaylı ve konumlu dükkânlar cluster marker'larıyla gösterilir. Ürün sayfasından fiyat rozetli harita açılır; koordinatsız dükkânlar marker'a eklenmez ve "Konum ýok" notunda sayılır. Dükkân detayında fiyat, güncellenme zamanı, "Köne maglumat" etiketi, küçük fotoğraf ve sepete ekleme bulunur.
- Harita ekranı ve konum seçici `React.lazy` ile yüklenir. OSM karo hatası/çevrimdışı durumu için Türkmence uyarı vardır; `stores` okuma sorguları `phone` ve `owner_id` alanlarını seçmez.
- Yerel tarayıcıda OSM karoları, mevcut test dükkânı/seri numarası, ürün fiyatlı marker, dükkân ürün listesi ve sepete ekleme doğrulandı. Çevrimdışı simülasyonda harita interneti uyarısı göründü.
- `npm run build` bu oturumda başarılı; Leaflet ve harita ekranları ayrı chunk'lara çıktı. Vite'ın ana JavaScript chunk uyarısı sürüyor.
- Herkese açık kategoriler, kategori/arama ürünleri, ürün ve dükkân fiyat listeleri, harita dükkânları ve ürün haritası `key`/`data`/`fetchedAt` alanlarıyla `localStorage`'da cache-first yenilenir; Supabase okuma hatasında veya 10 saniyelik zaman aşımında mevcut cache gösterilir. Fiyat listesi cache'i 50 kayıtla sınırlıdır.
- Cache'den gösterilen alıcı verisinde Türkmence çevrimdışı şeridi yalnızca arka plan yenilemesi 3 saniye içinde başarısız olursa veya `navigator.onLine` 2 saniye çevrimdışı kalırsa görünür; istek sürerken ve gizli sayfalarda gösterilmez. Başarılı yenileme şeridi kaldırır; görünürlük en az 4 saniyedir. Ürün sayfasında güncel ve stokta olan en az iki satır içindeki en düşük fiyatlar (eşitlikler dahil) yeşil çerçeve ve "Iň arzan" rozeti alır. Sepet yerel sepet öğelerini kullanır, katalog ve fiyat cache'lerinden çevrimdışı fiyat hesaplar.
- Oturum açan kullanıcının profil rolü kullanıcı kimliğiyle `localStorage`'a kaydedilir; başlangıçta cache kullanılır ve `profiles.role` arka planda doğrulanır. Oturum/profil yönetim dışındaki özel veriler ve yazma akışları public cache'e alınmaz.
- Service worker uygulama build dosyalarını precache eder; `product-photos` içindeki `-t.jpg` küçük kopyalarını CacheFirst ile en fazla 200, tam boy fotoğrafları StaleWhileRevalidate ile en fazla 30, OSM karolarını CacheFirst ile en fazla 300 kayıt ve tümünü 7 gün saklar. Supabase API uçları için özel runtime rotası yoktur; eşleşmeyen istekler doğrudan ağa gider. Yeni sürümde Türkmence “Täze wersiýa bar” bildirimi ve “Täzele” düğmesi çıkar.

## Yarım Kalanlar

| Özellik | Durum | Kanıt / sınır |
|---|---|---|
| Vitrin fotoğrafını değiştirme | Kod ve canlı politika bildirimi var; kaynak şema eksik | Kod aynı Storage yoluna `upsert: true` ile yükler. Kullanıcı canlı `store-photos` UPDATE kuralının uygulandığını bildirdi; yerel `schema.sql` bu kuralı içermiyor. |
| Girişli mağaza akışları | Elle test bekliyor | Başvuru/onay, fiyat yazma ve fotoğraf işlemleri gerçek kullanıcı/admin oturumuyla uçtan uca doğrulanmadı. |
| Yanlış fiyat bildirimi ve admin işlemleri | Elle test bekliyor | Gönderim, admin rapor inceleme/kapatma ve askıya alma gerçek hesaplarla doğrulanmadı. |
| Admin katalog yazma/silme | Elle test bekliyor | CRUD, toplu ekleme ve Storage fotoğraf temizliği yetkili oturumla canlıda denenmedi. Storage silme hataları yalnızca `console.warn` üretir. |
| İki fotoğraflı görüntüleyici | Kısmen tamam | Ok ve klavye kontrolleri kodda; iki fotoğraflı gerçek kayıt ve mobil davranış denenmedi. Dokunmatik kaydırma kodu yok. |
| Harita ve konum seçme | Masaüstünde kısmen tarayıcıda doğrulandı; telefon testi bekliyor | OSM karoları ve tek marker çalıştı; VPN'in açık olduğu bağımsız doğrulanmadı. Yüzlerce marker, cluster davranışı, mobil dokunma ve oturumlu konum seçme denenmedi. |
| Logo ve seri numarası | Kodlandı; canlı akış elle doğrulanmalı | Kaynak şeması `schema.sql` içinde; logo yükleme, RPC seri no ataması, eski logo silme ve admin seri araması yetkili Supabase hesabıyla uçtan uca denenmedi. |
| Adım 11 çevrimdışı/yavaş internet | Kodlandı; çevrimdışı elle test bekliyor | `localStorage` cache-first, 10 saniyelik istek sınırı, rol cache'i, PWA runtime cache ve sürüm bildirimi uygulandı; tarayıcı/telefon çevrimdışı testi bu oturumda özellikle yapılmadı. |

Realtime bu sürümde özellikle kapsam dışında bırakılmıştır (`PROJE.md`).

## Canlı Supabase Durumu

Kullanıcı bildirimi: canlıda aşağıdaki üç kural uygulandı ve şema kontrolündeki altı madde `true` çıktı:

- `prices` okuma kuralı admin'in askıya alınmış dükkân fiyatlarını da okuyabilmesini sağlıyor.
- `store-photos` için dükkân sahibinin mevcut vitrin fotoğrafını güncelleme kuralı uygulandı.
- `product-photos` için admin silme kuralı uygulandı.

Bu bilgiler canlıya bu oturumdan bağlanılarak bağımsız doğrulanmadı. Bu üç SQL artık çalıştırılacaklar listesinde değildir; yeniden çalıştırmayın. Yerel `schema.sql`, `prices` admin okuma ve `product-photos` admin silme kurallarını içeriyor; `store-photos` UPDATE kuralı ise hâlâ eksik. Bu konu Adım 10A kapsamı dışındadır. Tam `schema.sql` dosyasını canlıda tekrar çalıştırmayın.

Kullanıcı bildirimi: Adım 10A alanları (`stores.logo_path`, `stores.serial_no`, herkese açık `store-logos` bucket'ı ve `price_list.store_logo_path`/`store_serial_no`) canlıda zaten uygulanmıştır. Bu oturumda canlıya SQL veya yazma isteği gönderilmedi; tarayıcı denemesinde yalnızca uygulamanın normal okuma sorguları kullanıldı. Yeni alanlar, bucket, izinler ve onay RPC'sinin seri ataması yalnız yerel `schema.sql`'e işlendi. Tam `schema.sql` dosyasını canlıda çalıştırmayın.

Uygulamanın kullandığı yüzey: `profiles`, `stores`, `categories`, `products`, `prices`, `reports`; `price_list` görünümü; `set_store_status(p_store, p_status)` RPC'si; `product-photos`, `store-photos` ve `store-logos` bucket'ları.

## Kullanıcının Elle Test Etmesi Gerekenler

1. Kendi hesabınızla kayıt, giriş ve çıkışı deneyin; parola veya gizli bilgiyi sohbete göndermeyin.
2. Dükkân hesabıyla başvuru yapın; admin hesabıyla onaylayın. Dükkân hesabıyla fiyat/stok ve bir ya da iki ürün fotoğrafı ekleyin; alıcı ekranındaki görünümü ve mevcut vitrin fotoğrafını değiştirmeyi doğrulayın.
3. Girişli normal kullanıcıyla yanlış fiyat bildirimi gönderin. Admin hesabında raporu açıp kapatın; askıya alınmış dükkân fiyatının rapor bağlamında okunabildiğini kontrol edin.
4. Admin kataloğunda kategori/ürün ekleme-düzenleme, yinelenen kayıt, toplu ekleme ve fotoğraflı ürün silmeyi deneyin; Storage nesnelerinin silindiğini ayrıca kontrol edin.
5. VPN açıkken yerel uygulamada OSM tile'larını, fitBounds/cluster davranışını ve ürünün fiyat rozetli haritasını kontrol edin. Gerçek hesapla yeni başvuruda koordinat/logoyu, admin onayında seri numarasını ve seri aramasını, dükkân düzenlemesinde eski logo değişimini deneyin.
6. Telefonda harita dokunma/sürükleme, yol tarifi bağlantısı, logo boyutu ve ürünleri sepete ekleme akışlarını doğrulayın.
7. Bir kez çevrimiçiyken kategori, arama, ürün fiyatı, harita ve sepeti yükleyin; sonra interneti kapatıp tekrar açın. Cache şeridini, eski fiyatları ve çevrimdışı sepet toplamını; internet gelince şeridin kalkmasını kontrol edin. Yeni service worker sürümü için bildirimin ve “Täzele” düğmesinin davranışını ayrıca deneyin.

## Sıradaki 3 İş

1. Adım 11'in çevrimiçi/çevrimdışı geçiş ve PWA güncelleme akışını telefonda elle doğrulayın.
2. Adım 10A'nın gerçek mağaza sahibi/admin hesaplarıyla canlı uçtan uca denemesini yapın; canlı SQL çalıştırmayın.
3. Yeni harita ana sayfasını telefonda doğrulayın: dokunma/sürükleme, konum izni, haber paneli cache'i, yeni dükkân rozeti, fiyat satırından marker odağı, fitBounds ve OSM atfı. Önceki yönetim akışlarının yetkili hesap testlerini de tamamlayın.

## Git Notu

Adım 10A ve Adım 11 kapsamında uygulama, npm bağımlılıkları, yerel `schema.sql`, `PROJE.md` ve bu durum notu değiştirildi. Önceden var olan `DURUM.md` kullanıcı düzenlemeleri korunup güncel durumla birleştirildi. Adım 11 sırasında canlıda SQL çalıştırılmadı veya veri yazılmadı.

## Hata Düzeltme - 2026-10-18

- Harita cache kayıtları ve Supabase yanıtları dizi biçiminde doğrulanır; bozuk/eski cache veya null yanıt boş diziye dönüştürülür. İstek zaman aşımına uğrarsa gösterilmiş cache verisi korunur.
- Workbox `urlPattern` fonksiyonları regex ile değiştirildi ve Supabase NetworkOnly rotası kaldırıldı; OSM ve ürün fotoğrafı cache sınırları/ömürleri korundu.
- Harita `maxBounds` ile Türkmenistan'a kilitlendi (`[[34.8, 51.9], [43.2, 67.3]]`), `minZoom: 6`, `maxZoom: 17` ve `maxBoundsViscosity: 1.0` ayarlandı; marker'lar açılışta `fitBounds` ile gösterilir.
- Dükkân telefonu `store_private` tablosundan okunup başvuruda ayrı yazılır; düzenlemede aynı tabloya upsert edilir. Admin başvuru ve dükkân listeleri telefonları `store_private` sorgusuyla alır. `stores.phone` nullable bırakılır ve istemci kodu bu alanı seçmez/yazmaz; `schema.sql` tablo izinleri ve RLS politikalarını içerir. Canlı veritabanına bağlanılmadı veya SQL çalıştırılmadı.

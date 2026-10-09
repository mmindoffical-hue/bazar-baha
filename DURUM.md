# Bazar Baha - Durum Notu

Değerlendirme: 2026-10-10. Yerel build ve tarayıcı denemesi yapıldı; tarayıcı kategori verilerini Supabase'den alabildi. Admin CRUD işlemleri giriş gerektirdiğinden canlı yazma akışı denenmedi.

## Bitenler

- E-posta/şifre ile kayıt, giriş, çıkış ve oturum/rol okuma kodu mevcut.
- Kategoriler, ürün arama ve ürün fiyat listesi mevcut. Tarayıcıda arama ve kategori → ürün akışı çalıştı; aramayla açılan `Hyýar` için test mağazasının fiyatı görüntülendi. Kategori yolunda açılan `Pomidor` için fiyat kaydı yoktu. Son tekrar denemesinde Supabase isteği `ERR_INTERNET_DISCONNECTED` ile başarısız oldu; bu nedenle fiyatı olan ürüne kategori yoluyla erişim yeniden doğrulanamadı.
- Dükkân başvurusu, vitrin fotoğrafı, konum koordinatı alma ve admin `set_store_status` onay/askıya alma akışları kodlanmış.
- Vitrin fotoğrafını sonradan değiştirme yarım: uygulama aynı Storage nesnesine `upsert: true` kullanıyor, ancak yerel şemada `store-photos` için UPDATE politikası yok.
- Onaylı dükkân fiyat/stok yönetimi ile ürün başına 1-2 fotoğraf yükleme, küçültme ve küçük görsel üretme kodlanmış.
- Sepet localStorage'da tutuluyor; miktar, silme ve toplam hesaplama mevcut. Tarayıcıda üç ürün ekleme, ortadakini/ilkini/sonuncusunu silme ve yenileme denendi. Boş sepet doğru açıldı; sepet senaryosunda `qty` çökmesi veya Console/page error görülmedi. Daha sonraki kategori isteğinde Console'a `ERR_INTERNET_DISCONNECTED` kaydedildi.
- Yanlış fiyat bildirimi, oturumsuz kullanıcıya giriş uyarısı ve admin şikâyet paneli kodlanmış. Girişsiz uyarı tarayıcıda doğrulandı; bildirim gönderimi/admin işlemleri giriş gerektirdiğinden denenmedi.
- Admin katalog yönetimi eklendi: yalnızca admin rolünde sekme görünür; kategori ekleme/düzenleme, kategoriye göre ürün listeleme ve ürün ekleme/düzenleme/silme, 23505 için Türkmence uyarı, 50'lik toplu ekleme ve cascade silme öncesi fiyat sayımı uygulanmış. Fiyatlara bağlı tam boy/thumbnail suratlary `product-photos` içinden silinir; Storage hataları yalnızca `console.warn` üretir. RLS ve `schema.sql` değiştirilmedi.
- `npm run build` bu değişikliklerden sonra başarılı; Vite büyük chunk uyarısı sürüyor. Tarayıcıda ana sayfa açıldı ve Supabase'den kategori sanawy geldi; Profil'de giriş formu görüntülendi. Admin oturumu olmadığı için Katalog sekmesinin admin görünümü ve CRUD işlemleri tarayıcıda uçtan uca denenmedi. VPN'in açık olup olmadığı araçtan doğrulanamadı.
- Fotoğraf görüntüleyici tam ekran açıldı ve mevcut tek fotoğraf yüklendi. İki fotoğraflı/kaydırmalı durum canlı kayıtta yoktu; dokunmatik kaydırma kodu da bulunmuyor.
- `npm run build` başarılı. Büyük JavaScript chunk boyutu için Vite uyarısı verdi.
- `npm run dev` çalışıyor: http://127.0.0.1:5174/ (5173 kullanımdaydı).

## Yarım Kalanlar

| Özellik | Durum | Kanıt / sınır |
|---|---|---|
| Giriş/kayıt | var | Kod mevcut; gerçek kullanıcıyla kimlik doğrulama denenmedi. |
| Dükkân başvurusu ve admin onayı | var | Form ve RPC çağrısı mevcut; gerçek admin oturumuyla uçtan uca denenmedi. |
| Vitrin fotoğrafını değiştirme | yarım | Kod `upsert: true` kullanıyor; `schema.sql` `store-photos` UPDATE politikasını tanımlamıyor. |
| Fiyat girme/stok | var | Onaylı dükkân bileşeni mevcut; gerçek kullanıcıyla yazma denenmedi. |
| Ürün fotoğrafı 1-2 adet | var | En fazla iki tam görsel ve thumbnail kodu mevcut; yükleme akışı kimlik doğrulama gerektiriyor. |
| Sepet | var | Ekleme, sırayla silme ve yenileme tarayıcıda denendi; çökmeye rastlanmadı. |
| Yanlış fiyat bildirimi | var | Girişsiz uyarı denendi; gönderme için kullanıcı girişi gerekli. |
| Admin şikâyet paneli | var | Kod mevcut; admin oturumuyla denenmedi. |
| Gözleg / kategori / fiyat listesi | kısmen geçti | Arama ve kategori → ürün çalıştı; fiyatlı `Hyýar` aramayla açıldı. Kategori yolundaki `Pomidor` fiyat listesi boştu; fiyatlı ürünü kategori yoluyla yeniden deneme bağlantı hatası nedeniyle yapılamadı. |
| Fotoğraf görüntüleyici | yarım | Tam ekran tek fotoğraf açılıyor. İki fotoğraf için ok/klavye kontrolleri kodlu; dokunmatik swipe ve iki fotoğraflı kayıt doğrulanmadı. |
| Harita | eksik | Leaflet/OSM ekranı yok; yalnızca dükkân formunda tarayıcı konumunu koordinat olarak alma var. |
| Admin ürün kataloğu yönetimi | kodlandı, yetkili uçtan uca test edilmedi | Admin sekmesi kategori/ürün CRUD, kategori filtresi, 50'lik toplu ekleme, 23505 uyarısı ve fotoğraflı cascade silmeyi kapsar. Admin girişi olmadığı için tarayıcıda canlı yazma/silme doğrulanmadı. |
| Çevrimdışı fiyat verisi | eksik | PWA statik uygulama dosyalarını önbellekliyor; Supabase fiyatları için çevrimdışı/eski veri önbelleği görünmüyor. |
| Canlı Supabase şema durumu | doğrulanamadı | Uzak veritabanına erişilmedi; aşağıdaki SQL'in canlıda uygulanıp uygulanmadığı bilinmiyor. |

Realtime, `PROJE.md`'de belirtildiği üzere bu sürümde özellikle atlanmış.

## Canlı Supabase'de Çalıştırılacak SQL'ler

Canlı veritabanı incelenemedi. Yerel şemadaki commit farkı, `prices` okuma politikasında admin'e askıya alınmış dükkânların fiyatlarını da okuma izni verilmesi; ayrıca kod ile şema arasında `store-photos` UPDATE Storage politikasının eksik olmasıdır. İlki admin şikâyet panelinin askıya alınmış dükkân fiyatını görmesini sağlar; ikincisi vitrin fotoğrafını değiştirmeyi mümkün kılar. Canlı durum doğrulanmadı. Tam `schema.sql` dosyasını tekrar çalıştırmayın.

```sql
begin;

drop policy if exists "prices: onayli dukkanlarin fiyatlari herkese" on public.prices;

create policy "prices: onayli dukkanlarin fiyatlari herkese" on public.prices
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.stores s
      where s.id = store_id
        and s.status = 'approved'
    )
  );

commit;
```

Vitrin fotoğrafı güncellemesi için yerel şemada eksik olan UPDATE politikası:

```sql
begin;

drop policy if exists "photos: sahibi gunceller" on storage.objects;

create policy "photos: sahibi gunceller" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'store-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
```

Bu SQL değişiklikleri yalnızca kendi testinden sonra uygulanmalıdır. Canlıda eşdeğer politikalar olup olmadığı bu oturumda doğrulanmadı.

Admin katalog ürünü silerken `product-photos` nesnelerini temizleyebilmesi için ek gereken Storage politikası (kategori/ürün tablo RLS politikalarını değiştirmez):

```sql
begin;

drop policy if exists "product photos: onayli dukkan siler" on storage.objects;

create policy "product photos: onayli dukkan siler" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-photos'
    and (
      public.is_admin()
      or public.owns_approved_store(((storage.foldername(name))[1])::uuid)
    )
  );

commit;
```

Kodun beklediği veritabanı yüzeyi: `profiles`, `stores`, `categories`, `products`, `prices`, `reports`; `price_list` görünümü; `set_store_status(p_store, p_status)` RPC'si; `product-photos` ve `store-photos` Storage bucket'ları. İlgili sütunlar yerel şemayla eşleşiyor. Kod doğrudan `store-videos` kullanmıyor. Tablolarda RLS etkin; başvuru, onaylı dükkân fiyat yazma, kullanıcının kendi raporunu ekleme ve admin rapor görme/silme kuralları şemada tanımlı. Canlı tablo/politika/bucket/RPC varlığı doğrulanmadı.

## Kullanıcının Elle Test Etmesi Gerekenler

1. Kendi hesabıyla giriş/kayıt ve çıkışı deneyin; parola veya gizli bilgiyi sohbete göndermeyin.
2. Admin hesabıyla bekleyen dükkânı onaylayın; dükkân hesabıyla fiyat ve bir/iki fotoğraf yükleyip alıcı ekranında göründüğünü kontrol edin.
3. Girişli normal kullanıcıyla yanlış fiyat bildirimi gönderin; admin hesabında raporu açıp kapatın ve dükkânı askıya alma davranışını kontrol edin.
4. İki fotoğraflı gerçek bir fiyat kaydıyla telefonda görüntüleyiciyi deneyin. Mevcut kodda dokunmatik kaydırma uygulanmış değil; yalnızca ok düğmeleri/klavye kontrolleri var.
5. Dükkân başvurusunda konum iznini verip koordinatların kaydedildiğini doğrulayın. Bu akış harita göstermez.
6. Vitrin fotoğrafını ilk yüklemeden sonra değiştirip tekrar kaydetmeyi deneyin; Storage UPDATE politikası eksikse migration uygulanmadan bu işlem başarısız olabilir.

## Sıradaki 3 İş

1. Canlı şema sürümünü doğrulayın; gerekiyorsa yukarıdaki iki RLS migration'ını önce test projesinde, sonra canlıda uygulayın.
2. Leaflet/OSM haritasını tamamlayın.
3. Admin hesabıyla katalog ekleme/düzenleme/toplu ekleme/silme işlemlerini ve cascade fotoğraf temizliğini test edin; iki fotoğraflı görüntüleyiciye mobil swipe ekleyin ve diğer gerçek girişli mağaza/fiyat/rapor akışlarını uçtan uca test edin.

## Git Notu

Son commit `bd0c83d` (`Video yerine fotograf`). İnceleme sırasında çalışma ağacı zaten kirliydi; bu değişiklikler korunmuştur. `PROJE.md`'ye dokunulmadı. `DURUM.md` bu oturumda eklendi.

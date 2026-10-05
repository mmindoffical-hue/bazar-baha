-- =====================================================================
-- BAZAR BAHA - V1 veritabani (Supabase / PostgreSQL)
-- Kullanim: Supabase > SQL Editor > New query > hepsini yapistir > Run
-- Bir kez calistir. Hata alirsan bana hatayi oldugu gibi gonder.
-- =====================================================================

-- 1. TIPLER ------------------------------------------------------------
create type public.user_role   as enum ('user', 'admin');
create type public.store_status as enum ('pending', 'approved', 'suspended');

-- 2. TABLOLAR ----------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null default 'user',
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  phone       text not null,
  city        text,
  address     text not null,
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  photo_path  text,                                   -- vitrin fotografi (store-photos)
  status      public.store_status not null default 'pending',
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);

create table public.categories (
  id      smallint generated always as identity primary key,
  slug    text unique not null,
  name_tk text not null
);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  category_id smallint not null references public.categories(id),
  name_tk     text not null,
  unit        text not null default 'kg' check (unit in ('kg', 'dana', 'litr', 'paket')),
  created_at  timestamptz not null default now(),
  unique (category_id, name_tk)
);

create table public.prices (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price      numeric(10,2) not null check (price > 0 and price < 1000000),  -- manat
  in_stock   boolean not null default true,
  photo_paths text[] not null default '{}',
  video_path text,                                    -- store-videos icindeki yol
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);
create index prices_product_price_idx on public.prices (product_id, price);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  price_id    uuid not null references public.prices(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text check (char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  unique (price_id, reporter_id)
);

-- 3. YARDIMCI FONKSIYONLAR ----------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.owns_approved_store(p_store uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores
    where id = p_store
      and owner_id = (select auth.uid())
      and status = 'approved'
  );
$$;

-- Yeni kullanici kaydolunca otomatik profil (rol her zaman 'user')
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at'i istemci degil sunucu yazar (sahte saat yazilamaz)
create or replace function public.touch_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger prices_touch
  before insert or update on public.prices
  for each row execute function public.touch_updated_at();

-- Sadece admin dukkan durumunu degistirebilir
create or replace function public.set_store_status(p_store uuid, p_status public.store_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.stores
     set status = p_status,
         approved_at = case when p_status = 'approved' then now() else approved_at end
   where id = p_store;
end;
$$;
revoke execute on function public.set_store_status(uuid, public.store_status) from public, anon;
grant  execute on function public.set_store_status(uuid, public.store_status) to authenticated;

-- 4. YETKILER (once hepsini kapat, sonra sadece gerekeni ac) -------------
revoke all on public.profiles, public.stores, public.categories,
              public.products, public.prices, public.reports
  from anon, authenticated;

-- profiles: sadece display_name degistirilebilir (rol degistirilemez!)
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- stores: status ve owner_id istemciden degistirilemez
grant select on public.stores to anon, authenticated;
grant insert (owner_id, name, phone, city, address, lat, lng, photo_path)
  on public.stores to authenticated;
grant update (name, phone, city, address, lat, lng, photo_path)
  on public.stores to authenticated;

-- katalog: herkes okur, yazmayi RLS ile sadece admin yapar
grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;

-- prices
grant select on public.prices to anon, authenticated;
grant insert (store_id, product_id, price, in_stock, video_path) on public.prices to authenticated;
grant update (price, in_stock, video_path) on public.prices to authenticated;
grant insert (photo_paths) on public.prices to authenticated;
grant update (photo_paths) on public.prices to authenticated;
grant delete on public.prices to authenticated;

-- reports
grant select on public.reports to authenticated;
grant insert (price_id, reporter_id, reason) on public.reports to authenticated;
grant delete on public.reports to authenticated;

-- 5. RLS (satir duzeyinde guvenlik) --------------------------------------
alter table public.profiles   enable row level security;
alter table public.stores     enable row level security;
alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.prices     enable row level security;
alter table public.reports    enable row level security;

-- profiles
create policy "profiles: kendini veya admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: kendini guncelle" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- stores
create policy "stores: onayli herkese, kendi dukkani sahibine, admine hepsi" on public.stores
  for select to anon, authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or public.is_admin());
create policy "stores: basvuru olustur" on public.stores
  for insert to authenticated
  with check (owner_id = (select auth.uid()));          -- status her zaman 'pending'
create policy "stores: kendi dukkanini guncelle" on public.stores
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- categories / products
create policy "categories: herkes okur" on public.categories
  for select to anon, authenticated using (true);
create policy "categories: admin yazar" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products: herkes okur" on public.products
  for select to anon, authenticated using (true);
create policy "products: admin yazar" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- prices: sadece ONAYLI dukkan kendi fiyatini yazar
create policy "prices: onayli dukkanlarin fiyatlari herkese" on public.prices
  for select to anon, authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.status = 'approved'));
create policy "prices: onayli dukkan ekler" on public.prices
  for insert to authenticated with check (public.owns_approved_store(store_id));
create policy "prices: onayli dukkan gunceller" on public.prices
  for update to authenticated
  using (public.owns_approved_store(store_id)) with check (public.owns_approved_store(store_id));
create policy "prices: onayli dukkan siler" on public.prices
  for delete to authenticated using (public.owns_approved_store(store_id));

-- reports
create policy "reports: kendi bildirimini ekle" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "reports: kendi bildirimi veya admin" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
create policy "reports: admin siler" on public.reports
  for delete to authenticated using (public.is_admin());

-- 6. ALICI EKRANI ICIN GORUNUM -------------------------------------------
create view public.price_list with (security_invoker = true) as
select pr.id         as price_id,
       pr.price,
       pr.in_stock,
      pr.photo_paths,
       pr.updated_at,
       s.id          as store_id,
       s.name        as store_name,
       s.city,
       s.lat,
       s.lng,
       p.id          as product_id,
       p.name_tk     as product_name,
       p.unit,
       p.category_id
from public.prices pr
join public.stores   s on s.id = pr.store_id
join public.products p on p.id = pr.product_id;
grant select on public.price_list to anon, authenticated;

-- 7. DEPOLAMA (STORAGE) --------------------------------------------------
-- Video yolu: {store_id}/{product_id}-{zaman}.mp4   (max ~3 MB)
-- Foto yolu : {user_id}/vitrin.jpg                  (ozel, sadece sahibi + admin gorur)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('store-videos', 'store-videos', true,  3145728,
     array['video/mp4', 'video/webm', 'video/quicktime']),
  ('store-photos', 'store-photos', false, 2097152,
      array['image/jpeg', 'image/png', 'image/webp']),
    ('product-photos', 'product-photos', true, 512000,
      array['image/jpeg'])
on conflict (id) do nothing;

create policy "videos: herkes gorur" on storage.objects
  for select to anon, authenticated using (bucket_id = 'store-videos');
create policy "videos: onayli dukkan yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-videos'
              and public.owns_approved_store(((storage.foldername(name))[1])::uuid));
create policy "videos: onayli dukkan gunceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'store-videos'
         and public.owns_approved_store(((storage.foldername(name))[1])::uuid));
create policy "videos: onayli dukkan siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-videos'
         and public.owns_approved_store(((storage.foldername(name))[1])::uuid));

create policy "photos: sahibi yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'store-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: sahibi veya admin gorur" on storage.objects
  for select to authenticated
  using (bucket_id = 'store-photos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "photos: sahibi siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'store-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product photos: herkes gorur" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-photos');
create policy "product photos: onayli dukkan yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-photos'
              and public.owns_approved_store(((storage.foldername(name))[1])::uuid));
create policy "product photos: onayli dukkan siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-photos'
         and public.owns_approved_store(((storage.foldername(name))[1])::uuid));

-- 8. BASLANGIC VERISI (admin sonra degistirebilir) -----------------------
insert into public.categories (slug, name_tk) values
  ('vegetables', 'Gök önümler'),
  ('fruits',     'Miweler'),
  ('dairy',      'Süýt önümleri'),
  ('bread',      'Çörek we un'),
  ('meat',       'Et we guş eti'),
  ('grocery',    'Bakaleýa');

insert into public.products (category_id, name_tk, unit)
select c.id, v.name, v.unit
from (values
  ('vegetables', 'Pomidor',   'kg'),
  ('vegetables', 'Hyýar',     'kg'),
  ('vegetables', 'Kartoşka',  'kg'),
  ('vegetables', 'Sogan',     'kg'),
  ('vegetables', 'Käşir',     'kg'),
  ('fruits',     'Alma',      'kg'),
  ('dairy',      'Süýt',      'litr'),
  ('bread',      'Çörek',     'dana')
) as v(slug, name, unit)
join public.categories c on c.slug = v.slug;

-- =====================================================================
-- ILK ADMIN (sen): Uygulamada/Auth'ta normal kayit ol, sonra burada
-- kendi e-postanla calistir:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'SENIN@EPOSTAN.COM');
-- =====================================================================

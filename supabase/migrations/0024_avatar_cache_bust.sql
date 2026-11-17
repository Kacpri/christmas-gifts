-- v24: cache-busting dla awatarow.
-- Zastapienie fotki pod ta sama sciezka (<uid>/avatar.jpg) nie zmienia URL,
-- wiec browser/CDN storage serwuje stary plik. Parametr ?v=<timestamp>
-- wymusza pobranie swiezej wersji.
alter table public.profiles
  add column if not exists avatar_updated_at timestamptz;

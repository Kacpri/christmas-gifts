-- v22: awatary uczestników (własne zdjęcie + zdjęcie z OAuth)

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists oauth_avatar_url text;

-- publiczny bucket na awatary (ścieżki oparte na UUID, nie do zgadnięcia)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- użytkownik wgrywa awatar do własnego folderu
drop policy if exists "avatars_storage_insert_own" on storage.objects;
create policy "avatars_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- użytkownik usuwa własny awatar
drop policy if exists "avatars_storage_delete_own" on storage.objects;
create policy "avatars_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- awatar można zmieniać zawsze, nawet po gotowości i po losowaniu;
-- imię i gotowość pozostają zablokowane — with check porównuje nową
-- wersję wiersza ze stanem sprzed aktualizacji (podzapytanie widzi
-- poprzednią wersję wiersza w ramach tej samej instrukcji UPDATE)
drop policy if exists "profiles_update_own_avatar" on public.profiles;
create policy "profiles_update_own_avatar" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and full_name = (select p.full_name from public.profiles p where p.id = auth.uid())
    and is_ready = (select p.is_ready from public.profiles p where p.id = auth.uid())
    and is_organizer = (select p.is_organizer from public.profiles p where p.id = auth.uid())
  );

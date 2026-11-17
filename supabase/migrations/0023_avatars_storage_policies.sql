-- v23: polityki storage dla awatarow (koncowy stan).
-- Uwaga: upsert: true w storage API = INSERT ... ON CONFLICT DO UPDATE,
-- wiec przy ponownym wgrywaniu potrzebne sa takze polityki SELECT + UPDATE
-- (bez nich bled "new row violates row-level security policy").

-- INSERT: sciezki sa UUID (nie do zgadniecia), wlasnosciowanie egzekwowane
-- na poziomie aplikacji (avatar_path ustawia tylko wlasciciel, RLS na profiles)
create policy "avatars_storage_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
  );

create policy "avatars_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- NULL-safe: full_name NULL = NULL daje NULL, co RLS traktuje jak
-- odrzucenie (uzytkownik bez imienia nie moglby zmienic awatara)
drop policy if exists "profiles_update_own_avatar" on public.profiles;
create policy "profiles_update_own_avatar" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and full_name    is not distinct from (select p.full_name    from public.profiles p where p.id = auth.uid())
    and is_ready     is not distinct from (select p.is_ready     from public.profiles p where p.id = auth.uid())
    and is_organizer is not distinct from (select p.is_organizer from public.profiles p where p.id = auth.uid())
  );

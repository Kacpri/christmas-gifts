-- v29: fix upsertu awatara.
-- Storage API realizuje upsert: true jako INSERT ... ON CONFLICT DO UPDATE.
-- Gdy wiersz juz istnieje (powtorny upload), wykonywana jest galaz DO UPDATE,
-- ktora wymaga polityk SELECT + UPDATE. Bez nich upload pada z
-- "new row violates row-level security policy" mimo poprawnej polityki INSERT.

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

-- NULL-safe wersja polityki profiles: full_name NULL = NULL daje NULL,
-- co RLS traktuje jak odrzucenie (uzytkownik bez imienia nie mogl
-- zmienic awatara). is not distinct from porownuje NULL = NULL jako true.
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

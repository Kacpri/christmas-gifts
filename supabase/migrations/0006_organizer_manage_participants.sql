-- v12: organizator edytuje nazwy i gotowość uczestników

-- organizator może aktualizować dowolny profil (full_name, is_ready)
-- flaga is_organizer pozostaje chroniona przez trigger protect_organizer_flag
drop policy if exists "profiles_update_by_organizer" on public.profiles;
create policy "profiles_update_by_organizer" on public.profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles o
      where o.id = auth.uid() and o.is_organizer
    )
  );

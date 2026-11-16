-- v21: zrzut ekranu do zgłoszenia błędu (Supabase Storage)

alter table public.error_reports
  add column if not exists screenshot_path text;

-- publiczny bucket na zrzuty (ścieżki oparte na UUID, nie do zgadnięcia)
insert into storage.buckets (id, name, public)
values ('error-reports', 'error-reports', true)
on conflict (id) do nothing;

-- użytkownik wgrywa zrzut do własnego folderu
drop policy if exists "error_reports_storage_insert_own" on storage.objects;
create policy "error_reports_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'error-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- organizator usuwa zrzuty
drop policy if exists "error_reports_storage_delete_organizer" on storage.objects;
create policy "error_reports_storage_delete_organizer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'error-reports'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

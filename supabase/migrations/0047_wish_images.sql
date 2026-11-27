-- v11.25: zdjęcia produktów dla życzeń dziecka (og:image z linku -> bucket wish-images)

alter table public.child_wishes
  add column if not exists image_path text;

-- publiczny bucket na miniaturki produktów
-- (ścieżki <child_id>/<wish_id>-<losowo>.<ext>)
insert into storage.buckets (id, name, public)
values ('wish-images', 'wish-images', true)
on conflict (id) do nothing;

-- rodzic dziecka wgrywa miniaturkę do folderu tego dziecka
drop policy if exists "wish_images_insert_parent" on storage.objects;
create policy "wish_images_insert_parent" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wish-images'
    and exists (
      select 1 from public.child_parents cp
      where cp.child_id = (storage.foldername(name))[1]::bigint
        and cp.user_id = auth.uid()
    )
  );

-- rodzic dziecka usuwa miniaturkę z folderu tego dziecka
drop policy if exists "wish_images_delete_parent" on storage.objects;
create policy "wish_images_delete_parent" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wish-images'
    and exists (
      select 1 from public.child_parents cp
      where cp.child_id = (storage.foldername(name))[1]::bigint
        and cp.user_id = auth.uid()
    )
  );

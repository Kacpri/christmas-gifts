-- v11.27: okładki albumów na liście playlisty. Bucket album-covers
-- (okładki pobierane serwerowo ze Spotify przy dodawaniu utworu)
-- i playlist_tracks.cover_path.

alter table public.playlist_tracks
  add column if not exists cover_path text;

insert into storage.buckets (id, name, public)
values ('album-covers', 'album-covers', true)
on conflict (id) do nothing;

-- Każdy zalogowany uczestnik może dodać okładkę (ścieżka = track_id,
-- nadpisywana przy ponownym dodaniu tego samego utworu).
create policy "album_covers_storage_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'album-covers');

create policy "album_covers_storage_select_authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'album-covers');

create policy "album_covers_storage_update_authenticated" on storage.objects
  for update to authenticated
  using (bucket_id = 'album-covers')
  with check (bucket_id = 'album-covers');

-- v9.119: zdjęcia w czatach — image_path w trzech tabelach wiadomości,
-- pusty text dozwolony (wiadomość = samo zdjęcie), publiczny bucket chat-photos

alter table public.messages
  add column if not exists image_path text;
alter table public.group_messages
  add column if not exists image_path text;
alter table public.dm_messages
  add column if not exists image_path text;

-- text: 0–500 znaków (wcześniej 1–500)
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages
  add constraint messages_text_check check (char_length(text) between 0 and 500);

alter table public.group_messages drop constraint if exists group_messages_text_check;
alter table public.group_messages
  add constraint group_messages_text_check check (char_length(text) between 0 and 500);

alter table public.dm_messages drop constraint if exists dm_messages_text_check;
alter table public.dm_messages
  add constraint dm_messages_text_check check (char_length(text) between 0 and 500);

-- publiczny bucket na zdjęcia z czatu (ścieżki <uid>/<losowo>.<ext>, nie do zgadnięcia)
insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', true)
on conflict (id) do nothing;

-- użytkownik wgrywa zdjęcia do własnego folderu
drop policy if exists "chat_photos_insert_own" on storage.objects;
create policy "chat_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- użytkownik usuwa własne zdjęcia
drop policy if exists "chat_photos_delete_own" on storage.objects;
create policy "chat_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- organizator sprząta zdjęcia po wyczyszczeniu czatu (run_lottery,
-- cancel_lottery, clear_group_chat usuwają wiadomości wszystkich)
drop policy if exists "chat_photos_delete_organizer" on storage.objects;
create policy "chat_photos_delete_organizer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

-- ścieżki zdjęć do sprzątania — security definer, bo RLS na tabelach
-- wiadomości nie pozwala organizatorowi odczytać cudzych wątków
create function public.chat_photo_paths(p_kind smallint)
returns setof text
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_kind = 1 then
    return query select image_path from public.messages where image_path is not null;
  elsif p_kind = 2 then
    return query select image_path from public.group_messages where image_path is not null;
  elsif p_kind = 3 then
    return query select image_path from public.dm_messages where image_path is not null;
  else
    raise exception 'Nieznany typ wiadomości.';
  end if;
end;
$$;

revoke execute on function public.chat_photo_paths(smallint) from public;
grant execute on function public.chat_photo_paths(smallint) to authenticated;

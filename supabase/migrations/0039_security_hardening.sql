-- v11.21: zacieśnienie bezpieczeństwa
-- 1) reorder_wishes: brak revoke from public + NULL auth.uid() omijał
--    weryfikację właściciela (security definer omija RLS) — anonimowy
--    wywołujący mógł przestawiać listy dowolnych użytkowników
-- 2) avatars: INSERT dolewał dowolną ścieżkę w bucketcie, a ścieżki są
--    przewidywalne (<uid>/avatar.jpg) — podmiana awatara innej osoby
-- 3) chat_photo_paths: definer bez autoryzacji — każdy zalogowany mógł
--    wyliczyć ścieżki wszystkich prywatnych zdjęć z czatów

-- 1) reorder_wishes: strona wywołania + jawnie tylko authenticated
create or replace function public.reorder_wishes(p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nieuprawniony dostęp.';
  end if;

  if array_length(p_ids, 1) is null then
    return;
  end if;

  -- wszystkie id muszą istnieć i należeć do bieżącego użytkownika
  if (select count(*) from public.wishes where id = any(p_ids))
       <> array_length(p_ids, 1) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  if exists (
    select 1 from public.wishes
    where id = any(p_ids) and user_id <> auth.uid()
  ) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  update public.wishes w
  set pos = idx
  from generate_subscripts(p_ids, 1) as idx
  where w.id = p_ids[idx];
end;
$$;

revoke execute on function public.reorder_wishes(bigint[]) from public;
grant execute on function public.reorder_wishes(bigint[]) to authenticated;

-- 2) avatars: INSERT tylko do własnego folderu (wzór: SELECT/UPDATE)
drop policy if exists "avatars_storage_insert_authenticated" on storage.objects;
create policy "avatars_storage_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3) chat_photo_paths: tylko organizator (wzór: polityka delete_organizer)
create or replace function public.chat_photo_paths(p_kind smallint)
returns setof text
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Nieuprawniony dostęp.';
  end if;

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

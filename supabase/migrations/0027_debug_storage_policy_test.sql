-- v27: SONDA DIAGNOSTYCZNA (wersja 4) — testuje warunek polityki wprost.
-- Loguje: wynik storage.foldername(name), wynik porównania, i cały warunek
-- with check. To pokaże, czy warunek polityki jest true/false/NULL w
-- kontekście storage. DO USUNIĘCIA po zdiagnozowaniu.

drop trigger if exists debug_storage_trigger on storage.objects;
drop function if exists public.debug_storage_context();

create or replace function public.debug_storage_context()
returns trigger
language plpgsql
as $$
declare
  v_folders text[];
  v_folder1 text;
  v_uid text;
  v_cmp boolean;
  v_full boolean;
begin
  v_folders := storage.foldername(new.name);
  v_folder1 := v_folders[1];
  v_uid := coalesce(auth.uid()::text, 'NULL');
  v_cmp := (v_uid = v_folder1);
  v_full := (new.bucket_id = 'avatars' and v_cmp);
  raise warning 'STORAGE-CTX-DEBUG v4 folders=[%] folder1=[%] uid=[%] cmp=[%] full=[%] name=[%]',
    v_folders::text,
    coalesce(v_folder1, 'NULL'),
    v_uid,
    v_cmp,
    v_full,
    coalesce(new.name, 'NULL');
  return new;
end;
$$;

revoke execute on function public.debug_storage_context() from public;
grant execute on function public.debug_storage_context() to authenticated;

create trigger debug_storage_trigger
before insert on storage.objects
for each row
when (new.bucket_id = 'avatars')
execute function public.debug_storage_context();

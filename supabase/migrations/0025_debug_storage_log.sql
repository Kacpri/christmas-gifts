-- v25: SONDA DIAGNOSTYCZNA (wersja 2) — podmienia trigger z 0024.
-- Storage API maskuje komunikaty RAISE EXCEPTION (zwraca "database error,
-- code: P0001"), ale RAISE WARNING trafia do logów Postgresa i tam zostaje
-- (przeżywa rollback padającego INSERT). Szukaj w logach: STORAGE-CTX-DEBUG.
-- DO USUNIĘCIA po zdiagnozowaniu.

drop trigger if exists debug_storage_trigger on storage.objects;
drop function if exists public.debug_storage_context();

create or replace function public.debug_storage_context()
returns trigger
language plpgsql
as $$
begin
  raise warning 'STORAGE-CTX-DEBUG uid=[%] claims=[%] claim_sub=[%] name=[%] bucket=[%] role=[%]',
    coalesce(auth.uid()::text, 'NULL'),
    coalesce(current_setting('request.jwt.claims', true), 'NULL'),
    coalesce(current_setting('request.jwt.claim.sub', true), 'NULL'),
    coalesce(new.name, 'NULL'),
    coalesce(new.bucket_id, 'NULL'),
    coalesce(current_setting('request.jwt.role', true), 'NULL');
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

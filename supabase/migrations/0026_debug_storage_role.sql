-- v26: SONDA DIAGNOSTYCZNA (wersja 3) — dodaje current_user/session_user.
-- Poprzedni log pokazał, że auth.uid()/name/bucket są poprawne w storage,
-- a INSERT i tak pada od RLS. Podejrzenie: storage API łączy się inną rolą
-- niż 'authenticated' (polityka jest 'for insert to authenticated').
-- Sprawdzamy faktyczną rolę sesji. DO USUNIĘCIA po zdiagnozowaniu.

drop trigger if exists debug_storage_trigger on storage.objects;
drop function if exists public.debug_storage_context();

create or replace function public.debug_storage_context()
returns trigger
language plpgsql
as $$
begin
  raise warning 'STORAGE-CTX-DEBUG v3 current_user=[%] session_user=[%] uid=[%] name=[%] bucket=[%] rls_enabled=[%]',
    current_user,
    session_user,
    coalesce(auth.uid()::text, 'NULL'),
    coalesce(new.name, 'NULL'),
    coalesce(new.bucket_id, 'NULL'),
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname = 'objects' and n.nspname = 'storage');
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

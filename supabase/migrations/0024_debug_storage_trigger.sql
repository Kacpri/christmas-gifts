-- v24: SONDA DIAGNOSTYCZNA — trigger BEFORE INSERT na storage.objects
-- dla bucketa 'avatars'. Wyrzuca wyjątek z pełnym kontekstem storage API
-- (auth.uid(), request.jwt.claims, request.jwt.claim.sub, name, bucket_id).
-- Trigger fires PRZED sprawdzeniem RLS with check, więc zobaczymy wartości
-- nawet przy padającym INSERT. DO USUNIĘCIA po zdiagnozowaniu.

create or replace function public.debug_storage_context()
returns trigger
language plpgsql
as $$
begin
  raise exception 'STORAGE-CTX uid=[%] claims=[%] claim_sub=[%] name=[%] bucket=[%] role=[%]',
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

drop trigger if exists debug_storage_trigger on storage.objects;
create trigger debug_storage_trigger
before insert on storage.objects
for each row
when (new.bucket_id = 'avatars')
execute function public.debug_storage_context();

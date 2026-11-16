-- v9.90: organizator czyści czat wspólny — twarde usunięcie wszystkich
-- wiadomości. Bez DELETE policy na group_messages (RLS), więc operacja
-- idzie przez security definer RPC, który sprawdza is_organizer.

create or replace function public.clear_group_chat()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może czyścić czat wspólny.';
  end if;

  delete from public.group_messages where true;
end;
$$;

revoke execute on function public.clear_group_chat() from public;
grant execute on function public.clear_group_chat() to authenticated;

-- Bez aktywnego losowania (przed startem lub po anulowaniu) wszyscy uczestnicy
-- trafiają do głównej listy, a nie do "Dołączyli po losowaniu".
create or replace function public.participant_status()
returns table (
  profile_id uuid,
  full_name text,
  is_ready boolean,
  in_lottery boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lottery_active boolean;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może przeglądać status uczestników.';
  end if;

  select exists (select 1 from public.assignments) into lottery_active;

  return query
    select p.id, p.full_name, p.is_ready,
      case when lottery_active then
        exists (
          select 1 from public.assignments a
          where a.drawer_id = p.id or a.drawee_id = p.id
        )
      else true end
    from public.profiles p
    order by p.full_name;
end;
$$;

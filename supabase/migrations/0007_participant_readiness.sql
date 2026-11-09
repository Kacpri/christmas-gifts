-- v13: status uczestnika + has_theme / wish_count (do ostrzeżenia przy gotowości)
-- create or replace nie zmienia typu zwracanego, więc najpierw DROP FUNCTION.

drop function if exists public.participant_status();

create function public.participant_status()
returns table (
  profile_id uuid,
  full_name text,
  is_ready boolean,
  in_lottery boolean,
  has_theme boolean,
  wish_count integer
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
    select
      p.id,
      p.full_name,
      p.is_ready,
      case when lottery_active then
        exists (
          select 1 from public.assignments a
          where a.drawer_id = p.id or a.drawee_id = p.id
        )
      else true end,
      exists (select 1 from public.themes t where t.user_id = p.id),
      (select count(*) from public.wishes w where w.user_id = p.id)
    from public.profiles p
    order by p.full_name;
end;
$$;

revoke execute on function public.participant_status() from public;
grant execute on function public.participant_status() to authenticated;

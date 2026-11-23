-- Anonimizacja rezerwacji wobec rodziców dziecka:
-- imię rezerwującego widzi tylko sam rezerwujący.
create or replace function public.child_reservation_data()
returns table (
  child_wish_id bigint,
  state text,
  is_mine boolean,
  reserver_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.child_wish_id,
    r.state,
    (r.user_id = auth.uid()) as is_mine,
    case
      when r.user_id = auth.uid() then p.full_name
      else null
    end as reserver_name
  from public.child_wish_reservations r
  join public.profiles p on p.id = r.user_id;
$$;

revoke execute on function public.child_reservation_data() from public;
grant execute on function public.child_reservation_data() to authenticated;

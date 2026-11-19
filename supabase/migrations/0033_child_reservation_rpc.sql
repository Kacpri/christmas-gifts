-- v11.1: zmiana stanu rezerwacji (kupiony/cofnij/anuluj) przez security definer RPC
-- Bezpośredni update/delete przez RLS milczał (0 wierszy bez błędu);
-- RPC daje czytelny błąd i nie zależy od polityk RLS.

create or replace function public.set_child_wish_purchased(
  p_wish_id bigint,
  p_purchased boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_user uuid;
begin
  select user_id into row_user
  from public.child_wish_reservations
  where child_wish_id = p_wish_id;
  if not found then
    raise exception 'Ta rezerwacja nie istnieje.';
  end if;
  if row_user is distinct from auth.uid() then
    raise exception 'Tylko rezerwujący może zmienić stan prezentu.';
  end if;

  update public.child_wish_reservations
  set state = case when p_purchased then 'purchased' else 'reserved' end,
      purchased_at = case when p_purchased then now() else null end
  where child_wish_id = p_wish_id;
end;
$$;

revoke execute on function public.set_child_wish_purchased(bigint, boolean) from public;
grant execute on function public.set_child_wish_purchased(bigint, boolean) to authenticated;

create or replace function public.cancel_child_wish_reservation(p_wish_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_user uuid;
begin
  select user_id into row_user
  from public.child_wish_reservations
  where child_wish_id = p_wish_id;
  if not found then
    raise exception 'Ta rezerwacja nie istnieje.';
  end if;
  if row_user is distinct from auth.uid() then
    raise exception 'Tylko rezerwujący może anulować rezerwację.';
  end if;

  delete from public.child_wish_reservations
  where child_wish_id = p_wish_id;
end;
$$;

revoke execute on function public.cancel_child_wish_reservation(bigint) from public;
grant execute on function public.cancel_child_wish_reservation(bigint) to authenticated;

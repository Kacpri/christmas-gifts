-- v9.49: polubienie potrawy jako RPC (toggle w jednej transakcji) —
-- wywoływane z przeglądarki, bez re-renderu strony

create or replace function public.toggle_dish_like(p_dish_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.dish_likes
    where dish_id = p_dish_id and user_id = auth.uid()
  ) then
    delete from public.dish_likes
    where dish_id = p_dish_id and user_id = auth.uid();
  else
    insert into public.dish_likes (dish_id, user_id)
    values (p_dish_id, auth.uid());
  end if;
end;
$$;

grant execute on function public.toggle_dish_like(bigint) to authenticated;

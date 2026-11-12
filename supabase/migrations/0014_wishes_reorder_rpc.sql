-- wishes: zmiana kolejności w jednym wywołaniu (RPC) — szybsza niż N update'ów

create or replace function public.reorder_wishes(p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if array_length(p_ids, 1) is null then
    return;
  end if;

  -- wszystkie id muszą istnieć i należeć do bieżącego użytkownika
  if (select count(*) from public.wishes where id = any(p_ids))
       <> array_length(p_ids, 1) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  if exists (
    select 1 from public.wishes
    where id = any(p_ids) and user_id <> auth.uid()
  ) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  update public.wishes w
  set pos = idx
  from generate_subscripts(p_ids, 1) as idx
  where w.id = p_ids[idx];
end;
$$;

grant execute on function public.reorder_wishes(bigint[]) to authenticated;

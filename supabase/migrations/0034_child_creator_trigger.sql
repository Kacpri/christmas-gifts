-- v11.5: fix — trigger ochrony twórcy odpalał się też przy kaskadzie z
-- usunięcia dziecka (children -> child_parents), blokując legalne usunięcie.
-- Odłączenie twórcy blokujemy tylko, gdy dziecko nadal istnieje; kaskada
-- z usunięcia konta (profile) i z usunięcia dziecka zostaje dopuszczona.

create or replace function public.protect_child_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_creator
     and exists (select 1 from public.profiles where id = old.user_id)
     and exists (select 1 from public.children where id = old.child_id) then
    raise exception 'Twórca dziecka nie może zostać odłączony.';
  end if;
  return old;
end;
$$;

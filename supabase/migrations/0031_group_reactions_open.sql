-- v10.2: reakcje w czacie wspólnym — czat jest otwarty dla wszystkich
-- zalogowanych (od 0003: select_all + insert_own), więc reakcje też;
-- poprzednio RPC i polityki wymagały wiersza w assignments (błąd
-- "Nie masz dostępu do tej wiadomości" dla osób spoza losowania)

drop policy if exists "group_message_reactions_select_participant" on public.group_message_reactions;
create policy "group_message_reactions_select_all" on public.group_message_reactions
  for select to authenticated
  using (true);

drop policy if exists "group_message_reactions_insert_participant" on public.group_message_reactions;
create policy "group_message_reactions_insert_own" on public.group_message_reactions
  for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.toggle_message_reaction(
  p_kind smallint,
  p_message_id bigint,
  p_emoji text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existed boolean;
begin
  if char_length(p_emoji) not between 1 and 8 then
    raise exception 'Nieprawidłowa reakcja.';
  end if;

  if p_kind = 1 then
    if not exists (
      select 1 from public.messages m
      where m.id = p_message_id
        and (m.drawer_id = auth.uid() or m.drawee_id = auth.uid())
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  elsif p_kind = 2 then
    if not exists (
      select 1 from public.group_messages m
      where m.id = p_message_id
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.group_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.group_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.group_message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  elsif p_kind = 3 then
    if not exists (
      select 1 from public.dm_messages m
      where m.id = p_message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.dm_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.dm_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.dm_message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  else
    raise exception 'Nieznany typ wiadomości.';
  end if;

  return not existed;
end;
$$;

revoke execute on function public.toggle_message_reaction(smallint, bigint, text) from public;
grant execute on function public.toggle_message_reaction(smallint, bigint, text) to authenticated;

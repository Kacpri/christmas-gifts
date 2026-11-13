-- v9.85: samonaprawiający profil — jeśli zalogowany użytkownik nie ma profilu
-- (np. organizator go usunął), profil powstaje ponownie. Nazwa odzyskiwana
-- z auth.users.raw_user_meta_data (full_name/name) albo z prefiksu e-mail,
-- tak jak w triggerze handle_new_user. is_organizer zawsze false.

create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  name text;
begin
  if auth.uid() is null then
    return;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    return;
  end if;

  select raw_user_meta_data, email
  into u
  from auth.users
  where id = auth.uid();

  name := coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), '')
  );

  if name is null or name = '' then
    name := 'Uczestnik';
  end if;

  insert into public.profiles (id, full_name, is_organizer)
  values (auth.uid(), name, false);
end;
$$;

revoke execute on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

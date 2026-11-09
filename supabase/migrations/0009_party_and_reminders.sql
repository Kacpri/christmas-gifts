-- v15: szczegóły imprezy (data, lokalizacja, notatki) + lista niegotowych do przypomnień

create table if not exists public.party (
  id smallint primary key default 1 check (id = 1),
  starts_at timestamptz,
  location text check (location is null or char_length(location) between 1 and 200),
  notes text check (notes is null or char_length(notes) between 1 and 1000),
  updated_at timestamptz not null default now()
);

alter table public.party enable row level security;

-- wszyscy widzą szczegóły imprezy
drop policy if exists "party_select_all" on public.party;
create policy "party_select_all" on public.party
  for select to authenticated using (true);

-- zapisuje i edytuje tylko organizator
drop policy if exists "party_insert_organizer" on public.party;
create policy "party_insert_organizer" on public.party
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

drop policy if exists "party_update_organizer" on public.party;
create policy "party_update_organizer" on public.party
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

-- Maile i nazwy niegotowych uczestników (tylko organizator) — do przypomnień
create or replace function public.not_ready_emails()
returns table (email text, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  select u.email, p.full_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where not p.is_ready
    and exists (
      select 1 from public.profiles o
      where o.id = auth.uid() and o.is_organizer
    )
  order by p.full_name;
$$;

revoke execute on function public.not_ready_emails() from public;
grant execute on function public.not_ready_emails() to authenticated;

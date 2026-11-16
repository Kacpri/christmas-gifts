-- v20: zgłoszenia błędów od użytkowników (widzi i usuwa organizator)

create table if not exists public.error_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists error_reports_user_id_idx on public.error_reports (user_id);

alter table public.error_reports enable row level security;

-- użytkownik dodaje własne zgłoszenie
drop policy if exists "error_reports_insert_own" on public.error_reports;
create policy "error_reports_insert_own" on public.error_reports
  for insert to authenticated with check (user_id = auth.uid());

-- organizator widzi wszystkie zgłoszenia
drop policy if exists "error_reports_select_organizer" on public.error_reports;
create policy "error_reports_select_organizer" on public.error_reports
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

-- organizator usuwa zgłoszenia
drop policy if exists "error_reports_delete_organizer" on public.error_reports;
create policy "error_reports_delete_organizer" on public.error_reports
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

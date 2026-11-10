-- v17: czaty osobiste (DM) z dowolną osobą

create table if not exists public.dm_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists dm_messages_sender_idx
  on public.dm_messages (sender_id, created_at);
create index if not exists dm_messages_recipient_idx
  on public.dm_messages (recipient_id, created_at);

alter table public.dm_messages enable row level security;

-- widać wiadomości, w których jest się nadawcą lub odbiorcą
drop policy if exists "dm_messages_select_member" on public.dm_messages;
create policy "dm_messages_select_member" on public.dm_messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- pisze tylko jako nadawca
drop policy if exists "dm_messages_insert_sender" on public.dm_messages;
create policy "dm_messages_insert_sender" on public.dm_messages
  for insert to authenticated
  with check (sender_id = auth.uid());

-- nadawca edytuje i (miękkie) usuwa własne, nieusunięte
drop policy if exists "dm_messages_update_sender" on public.dm_messages;
create policy "dm_messages_update_sender" on public.dm_messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

create table if not exists public.dm_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  peer_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

alter table public.dm_reads enable row level security;

drop policy if exists "dm_reads_select_own" on public.dm_reads;
create policy "dm_reads_select_own" on public.dm_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "dm_reads_insert_own" on public.dm_reads;
create policy "dm_reads_insert_own" on public.dm_reads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "dm_reads_update_own" on public.dm_reads;
create policy "dm_reads_update_own" on public.dm_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime dla czatu osobistego
do $$
begin
  alter publication supabase_realtime add table public.dm_messages;
exception
  when duplicate_object then null;
end
$$;

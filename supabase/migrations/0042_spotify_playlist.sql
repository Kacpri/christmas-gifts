-- v11.24: playlista — wspólna playlista Spotify.
-- Organizator łączy swoje konto (spotify_accounts), tworzy lub podpiná
-- playlistę (party.spotify_playlist_id), każdy uczestnik dodaje do 5
-- utworów (playlist_tracks).

create table if not exists public.spotify_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  spotify_id text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id text not null,
  name text not null check (char_length(name) between 1 and 300),
  artists text not null check (char_length(artists) between 1 and 300),
  track_url text,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  added_at timestamptz not null default now()
);

create index if not exists playlist_tracks_user_id_idx on public.playlist_tracks (user_id);
create index if not exists playlist_tracks_track_id_idx on public.playlist_tracks (track_id);

alter table public.party
  add column if not exists spotify_playlist_id text,
  add column if not exists spotify_playlist_name text;

-- Konto Spotify widzi i zarządza tylko właściciel.
alter table public.spotify_accounts enable row level security;

drop policy if exists "spotify_accounts_select_own" on public.spotify_accounts;
create policy "spotify_accounts_select_own" on public.spotify_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "spotify_accounts_insert_own" on public.spotify_accounts;
create policy "spotify_accounts_insert_own" on public.spotify_accounts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "spotify_accounts_update_own" on public.spotify_accounts;
create policy "spotify_accounts_update_own" on public.spotify_accounts
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "spotify_accounts_delete_own" on public.spotify_accounts;
create policy "spotify_accounts_delete_own" on public.spotify_accounts
  for delete to authenticated using (user_id = auth.uid());

-- Wspólna lista utworów: wszyscy widzą, dodają i aktualizują (status)
-- tylko własne, usuwają własne lub — jako organizator — dowolne.
alter table public.playlist_tracks enable row level security;

drop policy if exists "playlist_tracks_select_all" on public.playlist_tracks;
create policy "playlist_tracks_select_all" on public.playlist_tracks
  for select to authenticated using (true);

drop policy if exists "playlist_tracks_insert_own" on public.playlist_tracks;
create policy "playlist_tracks_insert_own" on public.playlist_tracks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "playlist_tracks_update_own" on public.playlist_tracks;
create policy "playlist_tracks_update_own" on public.playlist_tracks
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "playlist_tracks_delete_own_or_organizer" on public.playlist_tracks;
create policy "playlist_tracks_delete_own_or_organizer" on public.playlist_tracks
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_organizer
    )
  );

-- Tokeny Spotify organizatora są potrzebne w akcjach wywoływanych w sesji
-- dowolnego uczestnika (dodawanie utworu, odświeżanie tokena), dlatego
-- odczyt i zapis idą przez funkcje security definer.
create or replace function public.spotify_org_account()
returns table (
  user_id uuid,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  display_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select sa.user_id, sa.access_token, sa.refresh_token, sa.expires_at, sa.display_name
  from public.spotify_accounts sa
  join public.profiles p on p.id = sa.user_id
  where p.is_organizer
  order by sa.updated_at desc
  limit 1;
$$;

revoke execute on function public.spotify_org_account() from public;
grant execute on function public.spotify_org_account() to authenticated;

create or replace function public.spotify_save_org_token(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.spotify_accounts
  set access_token = p_access_token,
      refresh_token = p_refresh_token,
      expires_at = p_expires_at,
      updated_at = now()
  where user_id = p_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.is_organizer
    );
$$;

revoke execute on function public.spotify_save_org_token(uuid, text, text, timestamptz) from public;
grant execute on function public.spotify_save_org_token(uuid, text, text, timestamptz) to authenticated;

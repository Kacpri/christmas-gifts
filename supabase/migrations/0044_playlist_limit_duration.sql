-- v11.26: limit piosenek na osobę ustawiany przez organizatora
-- (party.tracks_per_user) oraz czas trwania utworu
-- (playlist_tracks.duration_ms) do podsumowania „N piosenek • X min".

alter table public.party
  add column if not exists tracks_per_user integer not null default 5;

alter table public.playlist_tracks
  add column if not exists duration_ms integer;

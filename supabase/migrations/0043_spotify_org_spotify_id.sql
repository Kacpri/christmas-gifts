-- v11.25: spotify_org_account() zwraca też spotify_id — weryfikacja
-- własności podpinanej playlisty (do cudzej playlisty nie da się dodać
-- utworów, Spotify zwraca 404).

drop function if exists public.spotify_org_account();

create function public.spotify_org_account()
returns table (
  user_id uuid,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  display_name text,
  spotify_id text
)
language sql
security definer
set search_path = public
stable
as $$
  select sa.user_id, sa.access_token, sa.refresh_token, sa.expires_at,
         sa.display_name, sa.spotify_id
  from public.spotify_accounts sa
  join public.profiles p on p.id = sa.user_id
  where p.is_organizer
  order by sa.updated_at desc
  limit 1;
$$;

revoke execute on function public.spotify_org_account() from public;
grant execute on function public.spotify_org_account() to authenticated;

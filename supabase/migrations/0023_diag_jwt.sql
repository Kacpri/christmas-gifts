-- v23: tymczasowa funkcja diagnostyczna — sprawdza stan JWT/auth.uid()
-- w kontekście zalogowanego użytkownika (wołana przez uploadAvatar).
-- Do usunięcia po zdiagnozowaniu problemu z awatarami.

create or replace function public.diag_jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'auth_uid', auth.uid(),
    'claim_sub', current_setting('request.jwt.claim.sub', true),
    'claims_sub', (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  );
$$;

revoke execute on function public.diag_jwt() from public;
grant execute on function public.diag_jwt() to authenticated;

-- v26: organizator NIE widzi mapowania losowania (kto kogo wylosowal).
-- Panel uzywa istniejacego RPC participant_status() (security definer,
-- tylko organizator), ktore zwraca jedynie, kto jest w losowaniu.

drop policy if exists "assignments_select_organizer" on public.assignments;

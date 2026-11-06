-- v10: edycja i usuwanie własnych życzeń także po losowaniu

-- wishes: edycja własnych pozycji (nawet po losowaniu)
drop policy if exists "wishes_update_own" on public.wishes;
create policy "wishes_update_own" on public.wishes
  for update to authenticated
  using (user_id = auth.uid());

-- wishes: usuwanie własnych pozycji (nawet po losowaniu)
drop policy if exists "wishes_delete_own_before_lottery" on public.wishes;
drop policy if exists "wishes_delete_own" on public.wishes;
create policy "wishes_delete_own" on public.wishes
  for delete to authenticated
  using (user_id = auth.uid());

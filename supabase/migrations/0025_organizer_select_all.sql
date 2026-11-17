-- v25: panel organizatora — organizator widzi wszystkie zyczenia, tematy
-- i losy. Zapytania panelu idza rola organizatora (authenticated), a
-- wcześniejsze polityki pozwalaly widziec tylko wlasne dane (+ wylosowana
-- osoba), wiec pozostali uczestnicy mieli 0 zyczen / "brak" tematu, a
-- logika "pozni uczestnicy" byla zepsuta (brak widocznosci losow).

create policy "wishes_select_organizer" on public.wishes
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_organizer)
  );

create policy "themes_select_organizer" on public.themes
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_organizer)
  );

create policy "assignments_select_organizer" on public.assignments
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_organizer)
  );

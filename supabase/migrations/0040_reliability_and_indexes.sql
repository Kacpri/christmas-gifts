-- v11.22: niezawodność + indeksy
-- 1) anon_dm_conversations: brak polityki UPDATE — upsert z onConflict
--    (INSERT ... ON CONFLICT DO UPDATE) na istniejącej rozmowie kończył
--    się 42501, więc ponowne otwarcie anonimowego DM nie działało
-- 2) indeksy pod główne zapytania aplikacji: messages(drawer_id),
--    messages(drawee_id), thread_reads(user_id) — istniejący
--    messages_thread_idx ma lottery_type na czele i nie obsługuje
--    .or("drawer_id.eq.<me>,drawee_id.eq.<me>"); PK thread_reads ma
--    user_id na końcu, więc filtr .eq("user_id", me) też go nie używa

-- 1) aktualizuje tylko strona anonimowa (właściciel rozmowy)
drop policy if exists "anon_dm_conversations_update_sender" on public.anon_dm_conversations;
create policy "anon_dm_conversations_update_sender" on public.anon_dm_conversations
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and sender_id <> recipient_id);

-- 2)
create index if not exists messages_drawer_idx on public.messages (drawer_id);
create index if not exists messages_drawee_idx on public.messages (drawee_id);
create index if not exists thread_reads_user_idx on public.thread_reads (user_id);

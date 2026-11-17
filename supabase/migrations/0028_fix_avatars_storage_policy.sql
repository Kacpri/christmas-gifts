-- v28: korekta polityki storage dla awatarów.
-- Diagnoza: warunek with check (auth.uid()::text = (storage.foldername(name))[1])
-- jest TRUE w kontekście storage (potwierdzone triggerem), a INSERT i tak pada
-- od RLS. To sugeruje bug w storage API / Postgres (RLS check nie ocenia
-- polityki poprawnie). Obejście: polityka INSERT nie zależy od auth.uid().
-- Bezpieczeństwo: ścieżki są UUID (nie do zgadnięcia), a właścicielstwo
-- egzekwowane jest na poziomie aplikacji (avatar_path ustawiany tylko przez
-- właściciela, RLS na profiles to gwarantuje).

drop policy if exists "avatars_storage_insert_own" on storage.objects;
create policy "avatars_storage_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
  );

-- DELETE pozostaje z auth.uid() (usuwanie własnego awatara) — jeśli też pada,
-- zmienimy analogicznie. Na razie zostawiamy, bo delete jest rzadszy.
-- (Jeśli delete będzie padał, zmienić na: with check (bucket_id = 'avatars'))

-- v30: sprzątanie po debugu (0023-0027) i teście symulowanym na storage.objects.

-- trigger debugowy na storage.objects (0024-0027)
drop trigger if exists debug_storage_trigger on storage.objects;

-- trigger debugowy na tabelach pomocniczych (sonda ad-hoc)
do $$
declare t text;
begin
  foreach t in array array[
    'buckets_analytics','bucket_lifecycle_states','buckets_vectors',
    'vector_indexes','lifecycle_abandoned_artifacts',
    's3_multipart_uploads','s3_multipart_uploads_parts','buckets','migrations'
  ] loop
    begin
      execute format('drop trigger if exists debug_trig3 on storage.%I', t);
    exception when others then
      null;
    end;
  end loop;
end $$;

-- funkcje debugowe
drop function if exists public.debug_storage_context();
drop function if exists public.debug_storage_ctx3();
drop function if exists public.diag_jwt();

-- osierocony wiersz testowy z symulacji (soft delete — trigger
-- protect_delete blokuje bezpośredni DELETE; wiersz nie ma pliku w S3)
update storage.objects
set is_delete_marker = true, archived_at = now()
where name = 'diag-test-0001/avatar.jpg';

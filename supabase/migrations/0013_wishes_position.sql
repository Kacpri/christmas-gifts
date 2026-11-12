-- wishes: pozycja (kolejność / priorytet) życzeń, 1 = najważniejsze

alter table public.wishes add column if not exists pos int not null default 0;

-- backfill: zachowuj obecną kolejność (created_at, id); tylko wiersze bez pozycji
with numbered as (
  select id,
         row_number() over (partition by user_id order by created_at, id) as p
  from public.wishes
)
update public.wishes w
set pos = n.p
from numbered n
where w.id = n.id and w.pos = 0;

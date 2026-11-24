-- v11.23: wymiary zdjęć z czatu (image_width/image_height)
-- rezerwacja miejsca pod zdjęciem przed załadowaniem (eliminuje CLS)
-- wartości podawane przez klienta przy wysyłce (tylko layout, nie RLS)

alter table public.messages
  add column if not exists image_width integer,
  add column if not exists image_height integer;
alter table public.group_messages
  add column if not exists image_width integer,
  add column if not exists image_height integer;
alter table public.dm_messages
  add column if not exists image_width integer,
  add column if not exists image_height integer;

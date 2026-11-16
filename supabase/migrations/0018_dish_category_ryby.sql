-- v9.88: kategoria ryby w potrawach

alter table public.dishes drop constraint if exists dishes_category_check;
alter table public.dishes
  add constraint dishes_category_check
  check (
    category in (
      'zupa', 'przystawka', 'ryby', 'glowne',
      'dodatek', 'deser', 'napoj', 'inne'
    )
  );

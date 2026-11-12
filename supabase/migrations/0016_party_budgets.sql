-- v9.53: budżety imprezy (lista i temat)

alter table public.party
  add column if not exists list_budget int
  check (list_budget is null or (list_budget >= 1 and list_budget <= 10000)),
  add column if not exists theme_budget int
  check (theme_budget is null or (theme_budget >= 1 and theme_budget <= 10000));

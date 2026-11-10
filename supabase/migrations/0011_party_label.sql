-- v16: etykieta odliczania (do czego odliczamy)

alter table public.party
  add column if not exists label text not null default 'imprezy'
  check (char_length(label) between 1 and 100);

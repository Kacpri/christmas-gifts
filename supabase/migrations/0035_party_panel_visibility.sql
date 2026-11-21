-- v11.17: organizator może ukrywać wybrane panele przed uczestnikami
-- (party.panel_visibility = {"hidden": ["wishes", "potrawy", ...]}).

alter table public.party
  add column if not exists panel_visibility jsonb;

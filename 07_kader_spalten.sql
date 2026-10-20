-- =====================================================================
-- Trainer-App FC Seuzach · Kader-Angaben (Clubcorner) und NDS-Nummer
-- Mehrfach ausführen ist unproblematisch.
-- =====================================================================
alter table players
  add column if not exists nds_id text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_date date,
  add column if not exists street text,
  add column if not exists zip text,
  add column if not exists city text,
  add column if not exists position text,
  add column if not exists foot text,
  add column if not exists jersey int,
  add column if not exists guardian1_name text,
  add column if not exists guardian1_phone text,
  add column if not exists guardian1_email text,
  add column if not exists guardian2_name text,
  add column if not exists guardian2_phone text,
  add column if not exists guardian2_email text;
create unique index if not exists players_team_nds on players(team_id, nds_id) where nds_id is not null;

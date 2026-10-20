-- =====================================================================
-- Trainer-App FC Seuzach · Datenbank-Schema (Supabase / PostgreSQL)
-- Einmal im Supabase "SQL Editor" ausführen. Danach 02_seed.sql.
-- Reines Standard-PostgreSQL: Daten lassen sich jederzeit exportieren
-- und bei einem anderen Anbieter oder auf eigenem Server einspielen.
-- =====================================================================

-- ---------- Mannschaften und Zugriff ----------
create table if not exists teams (
  id          text primary key,              -- z. B. 'e-junioren'
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Wer gehört zu welcher Mannschaft? role: 'admin' (darf Trainer einladen) oder 'trainer'
create table if not exists team_members (
  team_id     text not null references teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'trainer' check (role in ('admin','trainer')),
  display_name text,
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Einladungen: Sobald sich jemand mit dieser E-Mail anmeldet, wird er Mitglied.
create table if not exists invites (
  team_id     text not null references teams(id) on delete cascade,
  email       text not null,
  role        text not null default 'trainer' check (role in ('admin','trainer')),
  display_name text,
  created_at  timestamptz not null default now(),
  primary key (team_id, email)
);

-- ---------- Wissen: Übungen und Vorlagen (für alle Mannschaften nutzbar) ----------
create table if not exists exercises (
  id          text primary key,
  team_id     text references teams(id) on delete cascade,  -- null = gemeinsame Bibliothek
  place       text not null check (place in ('grass','hall')),
  phase       text not null check (phase in ('auf','ein','sp','le','vi','aus')),
  name        text not null,
  page        text,                 -- Seite im J+S-Manual
  data        jsonb not null,       -- Organisation, Ablauf, Fahrplan, Coaching, Variation, Skizze
  created_at  timestamptz not null default now()
);

create table if not exists templates (
  id          text primary key,
  team_id     text references teams(id) on delete cascade,
  title       text not null,
  place       text not null check (place in ('grass','hall')),
  start_time  time not null,
  end_time    time not null,
  thema       text, ziel text, fragen text, material text,
  blocks      jsonb not null,       -- [{ph, min, ex}]
  created_at  timestamptz not null default now()
);

-- ---------- Mannschaftsdaten ----------
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  name        text not null,
  year        int,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists trainings (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  place       text not null check (place in ('grass','hall')),
  template_id text references templates(id) on delete set null,
  thema       text, ziel text, fragen text, material text,
  blocks      jsonb not null default '[]',
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists trainings_team_date on trainings(team_id, date);

create table if not exists attendance (
  training_id uuid not null references trainings(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  present     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (training_id, player_id)
);

create table if not exists tournaments (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  date        date not null,
  time_text   text,
  name        text not null,
  place       text,
  organizer   text,
  category    text,
  status      text not null default 'angemeldet'
              check (status in ('eingeteilt','angemeldet','Warteliste','abgesagt')),
  note        text,
  updated_at  timestamptz not null default now()
);
create index if not exists tournaments_team_date on tournaments(team_id, date);

-- ---------- Hilfsfunktionen für die Rechte ----------
create or replace function is_member(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid());
$$;

create or replace function is_admin(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid() and role = 'admin');
$$;

-- Einladung einlösen: beim ersten Login (neuer Benutzer) …
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members(team_id, user_id, role, display_name)
  select i.team_id, new.id, i.role, i.display_name
  from invites i where lower(i.email) = lower(new.email)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- … oder sofort, falls die Person schon ein Konto hat
create or replace function handle_new_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members(team_id, user_id, role, display_name)
  select new.team_id, u.id, new.role, new.display_name
  from auth.users u where lower(u.email) = lower(new.email)
  on conflict (team_id, user_id) do update set role = excluded.role;
  return new;
end $$;

drop trigger if exists on_invite_created on invites;
create trigger on_invite_created after insert on invites
  for each row execute function handle_new_invite();

-- Mitgliederliste mit E-Mail für die App (nur für Mitglieder derselben Mannschaft)
create or replace function team_people(t text)
returns table(user_id uuid, email text, role text, display_name text, pending boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.display_name, false
    from team_members m join auth.users u on u.id = m.user_id
   where m.team_id = t and is_member(t)
  union all
  select null, i.email, i.role, i.display_name, true
    from invites i
   where i.team_id = t and is_member(t)
     and not exists (select 1 from auth.users u join team_members m on m.user_id = u.id
                     where m.team_id = t and lower(u.email) = lower(i.email));
$$;

-- updated_at automatisch setzen
create or replace function touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists t_trainings on trainings;
create trigger t_trainings before update on trainings for each row execute function touch();
drop trigger if exists t_attendance on attendance;
create trigger t_attendance before update on attendance for each row execute function touch();
drop trigger if exists t_tournaments on tournaments;
create trigger t_tournaments before update on tournaments for each row execute function touch();

-- ---------- Row Level Security: jede/r sieht nur die eigene Mannschaft ----------
alter table teams        enable row level security;
alter table team_members enable row level security;
alter table invites      enable row level security;
alter table exercises    enable row level security;
alter table templates    enable row level security;
alter table players      enable row level security;
alter table trainings    enable row level security;
alter table attendance   enable row level security;
alter table tournaments  enable row level security;

drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (is_member(id));

drop policy if exists members_read on team_members;
create policy members_read on team_members for select using (is_member(team_id));
drop policy if exists members_admin on team_members;
create policy members_admin on team_members for all using (is_admin(team_id)) with check (is_admin(team_id));

drop policy if exists invites_read on invites;
create policy invites_read on invites for select using (is_member(team_id));
drop policy if exists invites_admin on invites;
create policy invites_admin on invites for all using (is_admin(team_id)) with check (is_admin(team_id));

-- Gemeinsame Bibliothek (team_id null) lesen alle angemeldeten Mitglieder irgendeiner Mannschaft
drop policy if exists ex_read on exercises;
create policy ex_read on exercises for select
  using ((team_id is null and exists (select 1 from team_members where user_id = auth.uid())) or is_member(team_id));
drop policy if exists ex_write on exercises;
create policy ex_write on exercises for all using (is_member(team_id)) with check (is_member(team_id));

drop policy if exists tpl_read on templates;
create policy tpl_read on templates for select
  using ((team_id is null and exists (select 1 from team_members where user_id = auth.uid())) or is_member(team_id));
drop policy if exists tpl_write on templates;
create policy tpl_write on templates for all using (is_member(team_id)) with check (is_member(team_id));

drop policy if exists players_all on players;
create policy players_all on players for all using (is_member(team_id)) with check (is_member(team_id));
drop policy if exists trainings_all on trainings;
create policy trainings_all on trainings for all using (is_member(team_id)) with check (is_member(team_id));
drop policy if exists tournaments_all on tournaments;
create policy tournaments_all on tournaments for all using (is_member(team_id)) with check (is_member(team_id));
drop policy if exists attendance_all on attendance;
create policy attendance_all on attendance for all
  using (exists (select 1 from trainings t where t.id = training_id and is_member(t.team_id)))
  with check (exists (select 1 from trainings t where t.id = training_id and is_member(t.team_id)));

-- Live-Aktualisierung zwischen Geräten (Supabase Realtime)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table attendance;  exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table trainings;   exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table tournaments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table players;     exception when duplicate_object then null; end;
  end if;
end $$;

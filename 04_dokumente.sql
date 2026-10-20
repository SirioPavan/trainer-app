-- =====================================================================
-- Trainer-App FC Seuzach · Dokumenten-Ablage (PDFs)
-- Einmal im Supabase SQL Editor ausführen (nach 01–03).
-- Dateien liegen in einem PRIVATEN Speicher: nur angemeldete Mitglieder
-- der Mannschaft können sie öffnen, nur Admins hochladen und löschen.
-- =====================================================================

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  title       text not null,
  category    text not null default 'Allgemein',
  file_path   text not null unique,      -- Pfad im Speicher: <team_id>/<datei>
  file_name   text,
  size_bytes  bigint,
  uploaded_by uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists documents_team on documents(team_id, category);

alter table documents enable row level security;
drop policy if exists docs_read on documents;
create policy docs_read on documents for select using (is_member(team_id));
drop policy if exists docs_admin on documents;
create policy docs_admin on documents for all using (is_admin(team_id)) with check (is_admin(team_id));

-- Privater Speicherbereich (max. 50 MB pro Datei im Gratis-Plan)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumente', 'dokumente', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Zugriff auf die Dateien: erster Ordner im Pfad = Mannschaft
drop policy if exists "dok lesen" on storage.objects;
create policy "dok lesen" on storage.objects for select to authenticated
  using (bucket_id = 'dokumente' and is_member((storage.foldername(name))[1]));
drop policy if exists "dok hochladen" on storage.objects;
create policy "dok hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumente' and is_admin((storage.foldername(name))[1]));
drop policy if exists "dok loeschen" on storage.objects;
create policy "dok loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'dokumente' and is_admin((storage.foldername(name))[1]));

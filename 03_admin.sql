-- =====================================================================
-- Dich selbst als Admin eintragen (nach 01 und 02 ausführen).
-- Ersetze DEINE-EMAIL@BEISPIEL.CH durch die E-Mail, mit der du dich
-- in der App anmelden willst. Weitere Trainer lädst du danach direkt
-- in der App ein (Kader → Trainerteam).
-- =====================================================================
insert into invites(team_id, email, role, display_name)
values ('e-junioren', lower('DEINE-EMAIL@BEISPIEL.CH'), 'admin', 'Sirio')
on conflict (team_id, email) do update set role = 'admin';

# CLAUDE.md – Trainer-App FC Seuzach

Projekt-Steckbrief für jede Claude-Sitzung, egal von welchem Konto oder Gerät.
Zuerst diese Datei lesen, nicht das ganze Projekt. Nach jeder grösseren Änderung den Abschnitt «Stand» nachführen.

## Ziel
Trainer-App für die Junioren des FC Seuzach: Trainingsplanung nach J+S, Anwesenheit, Kader, Turniere,
NDS-Export, Übungen mit Skizzen. Mehrere Mannschaften, strikt getrennt. Kostenlos für den Verein.

## Technik
- Statische PWA (Vanilla-JS-Module), live über GitHub Pages: https://siriopavan.github.io/trainer-app/
  - Demo mit erfundenen Daten: `?demo`, Ansicht J+S-Coach: `?demo&coach`
- Supabase-Projekt «FC Seuzach Junioren» (Postgres + RLS). Claude arbeitet über den Supabase-Connector
  (`apply_migration` für Änderungen, vorher dem Benutzer kurz sagen was und Freigabe abwarten).
- Rechte: `private.is_member(team)`, `private.is_admin(team)` (admin **oder** coach), `private.is_coach(team)`,
  `private.is_app_owner()` (Liste `private.app_owners`).
- Push bei Feedback: Edge Function `notify-feedback` + Trigger auf `feedback` (pg_net), Schlüssel in `private.push_config`.
- Dateien: `main.js` (Oberfläche), `store.js` (Daten/Demo), `pdf.js` (PDF), `plan.js`, `gen.js`, `diagram.js`, `sw.js` (Cache).

## Regeln
- **Bei jeder Veröffentlichung** `CACHE` in `sw.js` erhöhen (fcs-trainer-vNN). Bei neuen Videos zusätzlich `VID_V` in `main.js`.
- Commit auf `main` = live. Nur veröffentlichen, was der Benutzer freigegeben hat; «noch nichts bauen» heisst: nur notieren.
- **Nie ins Repo:** Schlüssel (service_role, DB-Passwort, VAPID privat), echte Kinderdaten, private SQL mit E-Mails,
  Sprachaufnahmen. Diese liegen beim Projektverantwortlichen (OneDrive, Ordner «Trainer App»).
- Datenschutz: Demo nur mit erfundenen Namen. Kindernamen nie in Videos, Screenshots oder öffentlichen Dateien.
- Sprache in der App: Deutsch (Schweiz, «ss» statt «ß»), Trainer werden geduzt.
- Testen vor dem Veröffentlichen: Demo lokal (`python3 -m http.server 8765`) mit Playwright, Handy- und PC-Breite, keine JS-Fehler.

## Rollen
- **Admin:** plant, lädt ein, NDS-Export, Generator und Übungs-Editor.
- **Trainer/in:** sieht alles, erfasst Anwesenheit.
- **J+S-Coach:** unsichtbarer Super-Admin in allen Mannschaften; schlanke Ansicht (Cockpit, Anwesenheit, Kader);
  lädt Trainer/Admins per WhatsApp ein, entfernt Personen, legt Mannschaften an. Neue Mannschaften bekommen den Coach automatisch.
- **App-Verantwortliche:** sehen Feedback unter «?» und bekommen Push.

## How-to-Videos
Werkzeuge in `tools/videos/` (Anleitung dort). Videos in `videos/`, eingebunden in der Hilfe (`HELP_VIDEOS` in `main.js`).
Nummerierung: 1 Erste Schritte, 2 Übung erfassen, 3 Team importieren, 4 Anwesenheit, 5 Training als PDF,
6 Trainer einladen, 7 NDS-Export. Eigene Stimmen: ungerade = Projektverantwortlicher, gerade = Stellvertretung.
Aufnahmen kommen als Datei (Sprachmemos), werden mit Filter bereinigt (Rauschen, Klicks, Schmatzer) und Szene für Szene geschnitten.

## Stand (24.11.2026, Cache v78)
- Fertig: J+S-Coach mit Cockpit, Mannschaft anlegen, Hilfe mit 7 Videos, Feedback mit Push und Archiv, PDF-Fix iPhone.
- Videos mit eigener Stimme: 1–5, 7. **Offen:** 6 (noch Computerstimme), 2 wird neu aufgenommen (Auto-Aufnahme).

## Offen / nächste Schritte
- Video 6 und neue Aufnahme von Video 2 einbauen
- Anmeldung J+S-Coach in der Datenbank prüfen, sobald erfolgt
- Supabase: Authentication → «Confirm email» muss aus sein (Entscheid: Anmeldung ohne Bestätigungs-Mail)
- Name für die App finden
- Stellvertretung: weitere Personen als GitHub-Mitarbeitende und Supabase-Mitglieder
- Später: E-Mail bei Feedback, Clubcorner-/NDS-Anbindung, Vereins-Rollout (13 Mannschaften G–E)

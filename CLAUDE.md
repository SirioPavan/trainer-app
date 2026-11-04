# Trainer-App FC Seuzach · Projektanleitung

Diese Datei ist für alle, die an der App entwickeln, Menschen wie KI-Assistenten (Claude).
Sie beschreibt Aufbau, Regeln und Arbeitsweise. **Vor jeder Änderung lesen.**

## Worum es geht
Web-App (PWA) für die Juniorentrainer des FC Seuzach: Trainingsplanung nach J+S-Kinderfussball,
Übungen mit Skizzen, Anwesenheit (Kinder und Leiter), Kader, Turniere, Trainer-Einsatz,
PDF-Export und NDS-Export für J+S. Mehrere Mannschaften (E-Junioren, F-Junioren, G-Junioren,
E-Juniorinnen, weitere folgen), streng getrennt.

- **Live:** https://siriopavan.github.io/trainer-app/ (GitHub Pages, Zweig `main`)
- **Demo ohne Login:** `?demo` (E), `?demo=f`, `?demo=g`, `?demo=w` (E-Juniorinnen). Erfundene Daten, nur im Browser.
- **Datenbank:** Supabase (PostgreSQL mit Row Level Security), Region und Zugang beim Projektverantwortlichen.
- **Verantwortlich:** Sirio Pavan (Admin E-Junioren). Mitentwicklung: Robby Müller (G-Junioren).

## Aufbau (flach, ohne Build-Schritt)
| Datei | Zweck |
|---|---|
| `index.html` | Seite, Content Security Policy, Theme-Vorschaltung |
| `styles.css` | Gestaltung; Abschnitt «Design 2026 · Kreide» überschreibt das Grundlayout |
| `main.js` | Oberfläche: Planung, Training, Übungen, Kader, Turniere, Wissen |
| `store.js` | Datenzugriff (Supabase oder Demo), NDS- und Clubcorner-Import/Export |
| `plan.js` | Serienplanung (Themen pro Stufe, Übungswahl) |
| `gen.js` | Übungsgenerator (ohne KI) |
| `pdf.js` | PDF-Export (html2pdf, lokal eingebunden), max. 2 Seiten |
| `diagram.js` | Spielfeld-Skizzen als SVG |
| `wissen.js`, `seed-data.js` | Kurswissen und Startdaten (Demo, gemeinsame Bibliothek) |
| `sw.js` | Service Worker: **bei jeder Änderung `CACHE` hochzählen** (`fcs-trainer-vNN`) |
| `config.js` | Supabase-URL und **öffentlicher** Schlüssel (publishable/anon) |
| `0X_*.sql` | Nur die öffentlichen Grund-Skripte 01–07; alle weiteren liegen im privaten Repository |

## Rollen und Datenmodell (Kurzfassung)
- `teams` (id, level E/F/G/EW, levels), `team_members` (role `admin` oder `trainer`), `invites`.
- **Admin:** plant Trainings und Turniere, lädt Trainer ein, verwaltet Dokumente.
- **Trainer (Assistenz):** sieht alles der eigenen Mannschaft, erfasst Anwesenheit, Notizen, eigene Verfügbarkeit.
- Übungen: `team_id null` = gemeinsame Bibliothek; eigene Übungen pro Mannschaft; `also_teams` gibt
  Übungen an andere Mannschaften frei (**nur über den SQL Editor**, ein Trigger sperrt die App-Schnittstelle).
- Rechte-Funktionen `private.is_member(team)` und `private.is_admin(team)`; alle Tabellen mit RLS.

## Eiserne Regeln
1. **Keine Personendaten auf GitHub.** Keine Kindernamen, Adressen, Geburtsdaten, E-Mails, Telefonnummern,
   Kaderlisten, Anwesenheiten. Das Repository ist öffentlich. Echte Daten gehören nur in Supabase.
2. **Keine Geheimnisse.** Der Supabase-Schlüssel «secret» bzw. «service_role» und das Datenbank-Passwort
   gehören nie in Code, Dateien, Chats oder Screenshots. Nur der öffentliche Schlüssel steht in `config.js`.
3. **Fremdes Material bleibt privat.** Übungskataloge von Trainern (z. B. Robby), PDFs und Bilder aus
   Lehrmitteln kommen nicht ins öffentliche Repository und nicht in die Demo.
4. **Zugriffsregeln nie aufweichen.** Jede neue Tabelle bekommt RLS und Policies über `private.is_member`
   bzw. `private.is_admin`; `anon` bekommt keine Rechte. Neue `security definer`-Funktionen prüfen die
   Berechtigung selbst und setzen `search_path`.
5. **Ausgaben escapen.** In `main.js` alles aus der Datenbank mit `esc()` ausgeben; Links nur `http(s)`
   (`okUrl`); Skizzen-Daten werden in `diagram.js` bereinigt. Keine Inline-Skripte (CSP).
6. **Funktionen nicht nebenbei ändern.** Design- oder Aufräumarbeiten verändern kein Verhalten.

## Arbeitsweise
1. **Eigener Zweig** pro Änderung (z. B. `robby/neue-uebungen`), nie direkt auf `main`.
2. **Testen in der Demo** (`?demo`, `?demo=g` …): betroffene Ansichten auf Handy- und PC-Breite,
   hell und dunkel, PDF-Export, keine Fehler in der Konsole.
3. **Pull Request** auf GitHub; der andere Entwickler schaut ihn an und gibt frei. Erst dann zusammenführen.
4. **`sw.js` CACHE hochzählen**, sonst sehen die Trainer die neue Version nicht.
5. **SQL-Änderungen** fortlaufend nummeriert (`25_…sql`, `26_…sql`) im **privaten Repository**;
   mehrfach ausführbar schreiben (`if not exists`, `on conflict`); im Log festhalten, wann ausgeführt.
   Grössere Umbauten zuerst im Test-Projekt von Supabase ausprobieren.
6. Kurz absprechen, wer woran arbeitet.

## Sprache und Stil
- Oberfläche auf Deutsch (Schweiz): kein «ß», Anführungszeichen «…», Datum `TT.MM.JJJJ`.
- Kinderfussball-Begriffe nach J+S: Auffangen, Einleitung, Fussball spielen, Fussball spielen lernen,
  Vielseitigkeit erleben, Ausklang; Phasen-Codes `auf`, `ein`, `sp`, `le`, `vi`, `aus`.
- Farben: Vereinsrot `#D2161E`, Schwarz `#141414`; Schriften Barlow Condensed (Titel), Source Sans 3 (Text).

## NDS (J+S) in Kürze
- Export in der App unter Kader → NDS-Export: **zuerst Aktivitäten, dann Anwesenheiten**, beide ab Kursbeginn.
- CSV: UTF-8 mit BOM, Semikolon, CRLF. Beide NDS-Importe **ersetzen** die bisherigen Daten im Kurs.
- Leiter erscheinen nur mit hinterlegter NDS-Personennummer; Kinder über `players.nds_id`
  (getrennt von der Clubcorner-Passnummer `players.pass_nr`).

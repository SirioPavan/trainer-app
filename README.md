# Trainer-App FC Seuzach

Web-App für die Juniorentrainer des FC Seuzach: Trainingsplanung nach J+S-Kinderfussball, Übungen mit
Skizzen, Anwesenheit von Kindern und Leitern, Kader, Turniere, Trainer-Einsatz, PDF- und NDS-Export.
Läuft im Browser auf Handy und PC und lässt sich als App installieren.

- **App:** https://siriopavan.github.io/trainer-app/
- **Demo mit erfundenen Daten:** https://siriopavan.github.io/trainer-app/?demo
- **Technik:** statische Dateien auf GitHub Pages, Datenbank und Login über Supabase (PostgreSQL mit
  Row Level Security). Keine Build-Schritte, keine Installation nötig.

Für Entwicklerinnen und Entwickler: **Aufbau, Regeln und Arbeitsweise stehen in [`CLAUDE.md`](CLAUDE.md).**
Datenbank-Skripte ab Nummer 08 und alles mit Personendaten liegen in einem privaten Repository.

## Grundsätze
- Das Repository ist öffentlich: keine Personendaten, keine geheimen Schlüssel.
- `config.js` enthält nur den öffentlichen Supabase-Schlüssel; geschützt werden die Daten durch Login
  und Zugriffsregeln in der Datenbank.
- Jede Mannschaft sieht nur ihre eigenen Trainer, Kinder, Trainings und Turniere.

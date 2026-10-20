# Trainer-App FC Seuzach

Web-App für Trainingsplanung, Anwesenheit, Kader, Turniere und Kurswissen (J+S-Manual Fussball Kinder).
Läuft auf iPhone und Android im Browser und lässt sich auf den Startbildschirm legen.

**Kosten: 0 Franken.** Datenbank: Supabase (Gratis-Plan). Hosting: GitHub Pages (gratis).
**Kein Lock-in:** Die Daten liegen in einer normalen PostgreSQL-Datenbank und lassen sich jederzeit
exportieren (Supabase → Database → Backups oder `pg_dump`) und woanders einspielen.

## Aufbau

| Datei | Zweck |
|---|---|
| `index.html`, `styles.css` | Seite und Gestaltung |
| `app/main.js` | Oberfläche (Planung, Training, Übungen, Kader, Turniere, Wissen) |
| `app/store.js` | Datenzugriff: Supabase oder Demo-Modus (nur dieses Gerät) |
| `app/diagram.js` | Spielfeld-Skizzen |
| `app/seed-data.js` | Startdaten für den Demo-Modus |
| `config.js` | Verbindung zur Datenbank (leer = Demo-Modus) |
| `supabase/01_schema.sql` | Tabellen und Zugriffsrechte |
| `supabase/02_seed.sql` | Übungen, Vorlagen, Hallentrainings, Turniere |
| `supabase/03_admin.sql` | Dich als Admin eintragen |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installierbar als App |

## Einrichtung (einmalig, ca. 30 Minuten)

### 1. Datenbank (Supabase)
1. Im Supabase-Projekt links **SQL Editor** öffnen → **New query**.
2. Inhalt von `supabase/01_schema.sql` einfügen → **Run**.
3. Dasselbe mit `supabase/02_seed.sql`.
4. In `supabase/03_admin.sql` deine E-Mail einsetzen → einfügen → **Run**.

### 2. App veröffentlichen (GitHub Pages)
1. Auf github.com oben rechts **+** → **New repository**, Name `trainer-app`, **Public**, → **Create repository**.
2. **uploading an existing file** anklicken und **den Inhalt** dieses Ordners (nicht den Ordner selbst)
   hineinziehen → **Commit changes**.
3. **Settings → Pages**: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.
4. Nach 1–2 Minuten ist die App unter `https://BENUTZERNAME.github.io/trainer-app/` erreichbar.

### 3. Login-Links erlauben (Supabase)
**Authentication → URL Configuration**:
- **Site URL**: `https://BENUTZERNAME.github.io/trainer-app/`
- **Redirect URLs**: dieselbe Adresse hinzufügen.

### 4. App mit der Datenbank verbinden
In `config.js` **Project URL** und **anon/publishable key** eintragen (Supabase → Project Settings → API)
und die Datei auf GitHub ersetzen. Der öffentliche Schlüssel darf im Code stehen: Ohne Login und
Einladung sieht niemand Daten (Row Level Security).

## Trainer hinzufügen
In der App unter **Kader → Trainerteam** E-Mail eintragen → **Einladen**. Die Person öffnet die App,
gibt dieselbe E-Mail ein und tippt auf den Link im Mail. Rolle **Admin** darf selbst einladen.

## Weitere Mannschaft (z. B. F-Junioren)
Im SQL Editor: `insert into teams values ('f-junioren','F-Junioren');` plus eine Einladung für den
F-Trainer in `invites`. Die App bekommt dafür später eine Mannschaftsauswahl.

## Gut zu wissen
- Supabase pausiert Gratis-Projekte nach 1 Woche ohne Nutzung. Daten bleiben erhalten;
  im Supabase-Dashboard mit **Restore project** wieder aufwecken.
- Die eingebauten Login-Mails von Supabase sind auf wenige pro Stunde begrenzt. Für ein Trainerteam reicht das.
- Ohne Eintrag in `config.js` läuft die App im **Demo-Modus** (Daten nur auf dem jeweiligen Gerät).

// Datenzugriff. Zwei Modi mit identischer Schnittstelle:
//  - "cloud": Supabase (gemeinsame Datenbank, Login per E-Mail-Link, Live-Abgleich)
//  - "demo":  nur auf diesem Gerät (localStorage), wenn config.js noch leer ist
import { SEED } from "./seed-data.js";
import { CONFIG } from "./config.js";
import { generateSeries, themesFor } from "./plan.js";

let TEAM = CONFIG.teamId || "e-junioren";   // aktuelle Mannschaft – wird nach dem Login aus den Mitgliedschaften gewählt
const TEAM_KEY = "fcs-trainer-team";
const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD lokal
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const normEx = e => Object.assign({}, e.data, { id: e.id, place: e.place, ph: e.phase, name: e.name, page: e.page, levels: e.levels || null, team_id: e.team_id || null, also_teams: e.also_teams || null });
// Übungen/Vorlagen der eigenen Stufe (G, F, E); eigene Übungen der Mannschaft immer. Ohne Stufe = E/F (bisherige Bibliothek)
// Eine Mannschaft kann mehrere Stufen sehen (z. B. E-Juniorinnen: E und G). Freigegebene Übungen anderer Mannschaften (also_teams) ebenfalls.
const forLevel = (x, lv, lvs = [lv]) => x.team_id === TEAM || (x.also_teams || []).includes(TEAM) ||
  (!x.team_id && (x.levels?.length ? x.levels.some(l => lvs.includes(l)) : lvs.some(l => l === "E" || l === "F")));

/* Gemeinsamer Zustand, den die Oberfläche liest */
export const state = {
  mode: "demo", user: null, role: "admin", team: { id: TEAM, name: "E-Junioren", level: "E" }, teams: [],
  exercises: [], templates: [], trainings: [], tournaments: [], players: [], attendance: {}, leaders: {}, avail: {}, people: [], documents: [], docUrls: {}, links: []
};

let sb = null;
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach(fn => fn()); }

/* ================= Start ================= */
export async function init() {
  const qs = new URLSearchParams(location.search), forceDemo = qs.has("demo");
  const dq = (qs.get("demo") || "").toLowerCase();
  if (forceDemo && /^[fg]/.test(dq)) TEAM = dq[0] + "-junioren";
  if (forceDemo && /^(w|ej|juniorinnen)/.test(dq)) TEAM = "e-juniorinnen";
  state.forced = forceDemo;
  if (!forceDemo && CONFIG.supabaseUrl && CONFIG.supabaseKey && window.supabase) {
    state.mode = "cloud";
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await sb.auth.getSession();
    state.user = data.session?.user || null;
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === "PASSWORD_RECOVERY") { state.recovery = true; emit(); }
      const was = state.user?.id; state.user = session?.user || null;
      if (state.user?.id !== was) load().then(emit);
    });
    if (state.user) await load();
    subscribeLive();
  } else {
    state.mode = "demo"; state.user = { email: "demo" };
    loadDemo();
  }
}

/* ================= Login ================= */
export async function sendLoginLink(email) {
  const redirect = location.origin + location.pathname;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw error;
}
export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  state.user = data.user; await load(); emit();
}
const msgDe = e => {
  const m = (e && e.message) || String(e);
  if (/invalid login credentials/i.test(m)) return "E-Mail oder Passwort stimmt nicht.";
  if (/already registered|already exists/i.test(m)) return "Für diese E-Mail gibt es schon ein Konto. Bitte «Anmelden» verwenden oder «Passwort vergessen».";
  if (/at least|password should/i.test(m)) return "Das Passwort muss mindestens 8 Zeichen haben.";
  if (/email not confirmed/i.test(m)) return "E-Mail noch nicht bestätigt. Der Admin muss in Supabase «Confirm email» ausschalten.";
  if (/rate|seconds/i.test(m)) return "Bitte kurz warten und dann nochmals versuchen.";
  return m;
};
export async function signInPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(msgDe(error));
  state.user = data.user; await load(); emit();
}
export async function signUpPassword(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(msgDe(error));
  if (!data.session) throw new Error("Konto erstellt, aber noch nicht aktiv: In Supabase ist «Confirm email» noch eingeschaltet. Bitte dem Admin melden.");
  state.user = data.user; await load(); emit();
}
export async function resetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(msgDe(error));
}
export async function setPassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(msgDe(error));
  state.recovery = false; emit();
}
export async function switchTeam(id) {
  if (!state.teams.some(t => t.id === id)) return;
  TEAM = id;
  if (state.mode === "demo") { loadDemo(); emit(); return; }
  try { localStorage.setItem(TEAM_KEY, id); } catch (e) {}
  await load(); emit();
}
export async function signOut() { if (sb) await sb.auth.signOut(); state.user = null; emit(); }

/* ================= Laden ================= */
async function load() {
  if (!state.user) return;
  const from = new Date(Date.now() - 300 * 864e5).toLocaleDateString("sv-SE");   // ganze Saison
  // 1) Mitgliedschaften: welche Mannschaften darf diese Person sehen?
  let m = await sb.from("team_members").select("role,display_name,team_id,teams(name,level,levels,min_trainers)").eq("user_id", state.user.id);
  if (m.error) m = await sb.from("team_members").select("role,display_name,team_id,teams(name,level,levels)").eq("user_id", state.user.id);
  if (m.error) m = await sb.from("team_members").select("role,display_name,team_id,teams(name,level)").eq("user_id", state.user.id);
  if (m.error) m = await sb.from("team_members").select("role,display_name,team_id,teams(name)").eq("user_id", state.user.id);   // vor 11_mannschaften.sql
  state.teams = (m.data || []).map(x => ({ id: x.team_id, name: x.teams?.name || x.team_id, level: x.teams?.level || "E", levels: x.teams?.levels?.length ? x.teams.levels : [x.teams?.level || "E"], minTrainers: x.teams?.min_trainers ?? 2, role: x.role, display_name: x.display_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  let saved = null; try { saved = localStorage.getItem(TEAM_KEY); } catch (e) {}
  const pick = state.teams.find(t => t.id === saved) || state.teams.find(t => t.id === TEAM) || state.teams[0];
  if (pick) TEAM = pick.id;
  const [ex, tp, tr, tu, pl] = await Promise.all([
    sb.from("exercises").select("*"),
    sb.from("templates").select("*"),
    sb.from("trainings").select("*").eq("team_id", TEAM).gte("date", from).order("date"),
    sb.from("tournaments").select("*").eq("team_id", TEAM).order("date"),
    sb.from("players").select("*").eq("team_id", TEAM).order("name")
  ]);
  const lk = await sb.from("exercise_links").select("*").eq("team_id", TEAM).order("created_at");
  state.links = lk.error ? [] : (lk.data || []);   // Tabelle erst ab 05_videos_sfv_karten.sql
  const mine = state.teams.find(x => x.id === TEAM);
  state.role = mine ? mine.role : null;
  state.memberName = mine?.display_name || "";
  state.team = mine ? { id: mine.id, name: mine.name, level: mine.level, levels: mine.levels, minTrainers: mine.minTrainers } : { id: TEAM, name: "", level: "E", levels: ["E"], minTrainers: 2 };
  state.exercises = (ex.data || []).map(normEx).filter(x => forLevel(x, state.team.level, state.team.levels));
  state.templates = (tp.data || []).map(t => ({ ...t, start: t.start_time.slice(0, 5), end: t.end_time.slice(0, 5) })).filter(x => forLevel(x, state.team.level, state.team.levels));
  state.trainings = (tr.data || []).map(normT);
  state.tournaments = (tu.data || []).map(normU);
  state.players = pl.data || [];
  const ids = state.trainings.map(t => t.id);
  state.attendance = {};
  if (ids.length) {
    const { data } = await sb.from("attendance").select("*").in("training_id", ids);
    (data || []).forEach(a => { (state.attendance[a.training_id] ||= {})[a.player_id] = a.present; });
  }
  // Turnier- und Leiter-Anwesenheit (Tabellen ab 10_nds_turniere.sql)
  const tid = state.tournaments.map(u => u.id);
  if (tid.length) {
    const { data, error } = await sb.from("tournament_attendance").select("*").in("tournament_id", tid);
    if (!error) (data || []).forEach(a => { (state.attendance[a.tournament_id] ||= {})[a.player_id] = a.present; });
  }
  // Trainer-Einsatz (Tabelle ab 20_trainer_einsatz.sql)
  state.avail = {};
  { const { data, error } = await sb.from("trainer_availability").select("event_id,user_id,status,note").eq("team_id", TEAM);
    if (!error) (data || []).forEach(a => { (state.avail[a.event_id] ||= {})[a.user_id] = { status: a.status, note: a.note || "" }; }); }
  state.leaders = {};
  { const { data, error } = await sb.from("leader_attendance").select("event_id,user_id,present").eq("team_id", TEAM);
    if (!error) (data || []).forEach(a => { (state.leaders[a.event_id] ||= {})[a.user_id] = a.present; }); }
  if (state.role) {
    const { data } = await sb.rpc("team_people", { t: TEAM });
    state.people = data || [];
    await loadDocs();
  }
}
async function loadDocs() {
  const { data, error } = await sb.from("documents").select("*").eq("team_id", TEAM).order("category").order("title");
  if (error) { state.documents = []; return; }   // Tabelle noch nicht angelegt (04_dokumente.sql)
  state.documents = data || [];
  const paths = state.documents.map(d => d.file_path);
  state.docUrls = {};
  if (paths.length) {
    const { data: urls } = await sb.storage.from("dokumente").createSignedUrls(paths, 12 * 3600);
    (urls || []).forEach(u => { if (u.signedUrl) state.docUrls[u.path] = u.signedUrl; });
  }
}
const normT = t => ({ ...t, start: t.start_time.slice(0, 5), end: t.end_time.slice(0, 5), tpl: t.template_id });
const normU = u => ({ ...u, time: u.time_text, org: u.organizer, cat: u.category });

let timer = null;
function subscribeLive() {
  const ch = sb.channel("team-" + TEAM);
  ["attendance", "trainings", "tournaments", "players", "tournament_attendance", "leader_attendance", "trainer_availability"].forEach(table =>
    ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      clearTimeout(timer); timer = setTimeout(() => load().then(emit), 400);
    }));
  ch.subscribe();
  // Beim Zurückkehren in die App frisch laden (z. B. nach Standby)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.user) load().then(emit);
  });
}

/* ================= Demo-Modus ================= */
const LS = "fcs-trainer-demo-v2";   // neue Version = alte Demo-Daten werden verworfen
const DEMO_PLAYERS = ["Luca M.","Noah K.","Elias B.","Mia S.","Leon F.","Lina W.","Matteo R.","Ben H.","Emma Z.","Nico T.","Sofia G.","Jonas P.","Alessio C.","Lara N."];
/* Vorführ-Daten: erfundene Kinder, Eltern und vergangene Anwesenheiten */
function demoPlayers() {
  const pos = ["Tor", "Verteidigung", "Mittelfeld", "Sturm"], foot = ["rechts", "links"];
  return DEMO_PLAYERS.map((n, i) => {
    const last = { "M.": "Meier", "K.": "Keller", "B.": "Brunner", "S.": "Schmid", "F.": "Frei", "W.": "Weber", "R.": "Rossi", "H.": "Huber", "Z.": "Zürcher", "T.": "Tanner", "G.": "Graf", "P.": "Pfister", "C.": "Conti", "N.": "Näf" }[n.split(" ")[1]] || "Muster";
    const first = n.split(" ")[0], y = 2016 + (i % 3 === 0 ? 0 : 1);
    return { id: "dp" + i, name: first + " " + last, first_name: first, last_name: last, year: y, active: true,
      birth_date: `${y}-${String(1 + i % 12).padStart(2, "0")}-${String(3 + i).padStart(2, "0")}`, nds_id: String(9000001 + i),
      position: pos[i % 4], foot: foot[i % 5 === 0 ? 1 : 0], jersey: i + 1, street: "Beispielweg " + (i + 1), zip: "8442", city: "Hettlingen",
      guardian1_name: "Elternteil " + last, guardian1_phone: "+41 79 000 00 " + String(10 + i), guardian1_email: "eltern." + last.toLowerCase() + "@beispiel.ch",
      created_at: "2026-08-01T00:00:00" };
  });
}
function demoPlayersG(lv = "G") {
  const F = lv === "F", W = lv === "EW", y0 = W ? 2016 : F ? 2018 : 2020;
  const names = W ? ["Alina", "Bea", "Chiara", "Delia", "Elin", "Fiona", "Giulia", "Hanna", "Ines", "Julia", "Kim", "Livia"]
    : F ? ["Arian", "Lea", "Fynn", "Ella", "Luis", "Malia", "Noel", "Ida", "Gian", "Sara", "Levin", "Alva"] : ["Lio", "Mila", "Nael", "Ronja", "Tim", "Yara", "Elia", "Zoe", "Jan", "Nora"];
  const last = ["Bühler", "Kunz", "Lang", "Moser", "Ott", "Roth", "Senn", "Vogt", "Wyss", "Egli", "Frey", "Hug"];
  return names.map((n, i) => ({ id: "d" + lv.toLowerCase() + i, name: n + " " + last[i], first_name: n, last_name: last[i], year: y0 + (i % 2), active: true,
    birth_date: `${y0 + (i % 2)}-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`, nds_id: String((W ? 9700001 : F ? 9600001 : 9500001) + i), street: "Beispielweg " + (i + 1), zip: "8442", city: "Hettlingen",
    guardian1_name: "Elternteil " + last[i], guardian1_phone: "+41 79 000 01 " + String(10 + i), guardian1_email: "eltern." + last[i].toLowerCase() + "@beispiel.ch", created_at: "2026-08-01T00:00:00" }));
}
function addDemoHistory(d) {
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const kids = d.players.length ? d.players : demoPlayers();
  for (let dt = new Date("2026-08-17T12:00:00Z"); dt <= new Date("2026-09-30T12:00:00Z"); dt.setUTCDate(dt.getUTCDate() + 1)) {
    const wd = dt.getUTCDay(); if (wd !== 1 && wd !== 3) continue;
    const iso = dt.toISOString().slice(0, 10), id = "hist-" + iso;
    d.trainings.push({ id, date: iso, start_time: wd === 1 ? "17:00" : "18:30", end_time: wd === 1 ? "18:30" : "20:00", place: "grass",
      thema: "Rasentraining", blocks: [], note: "Beispiel-Anwesenheit (Vorführung)" });
    d.attendance[id] = {}; kids.forEach((p, i) => d.attendance[id][p.id] = rnd() < (i === 5 ? 0.5 : i % 4 === 0 ? 0.7 : 0.88));
  }
}
// Vorführung mit zwei getrennten Mannschaften: E (Beispieldaten) und G (leer gestartet, Plan automatisch erzeugt)
const DEMO_TEAMS = [{ id: "e-junioren", name: "E-Junioren", level: "E", role: "admin" }, { id: "f-junioren", name: "F-Junioren", level: "F", role: "admin" }, { id: "g-junioren", name: "G-Junioren", level: "G", role: "admin" }, { id: "e-juniorinnen", name: "E-Juniorinnen", level: "EW", levels: ["EW", "E", "G"], role: "admin" }];
const demoKey = () => TEAM === "e-junioren" ? LS : LS + "-" + TEAM;
function loadDemo() {
  if (!DEMO_TEAMS.some(t => t.id === TEAM)) TEAM = "e-junioren";
  const team = DEMO_TEAMS.find(t => t.id === TEAM);
  const lvs = team.levels || [team.level];
  state.team = { id: team.id, name: team.name, level: team.level, levels: lvs }; state.teams = state.forced ? DEMO_TEAMS : [];
  state.exercises = SEED.exercises.map(e => normEx({ ...e, team_id: null })).filter(x => forLevel(x, team.level, lvs));
  state.templates = SEED.templates.map(t => ({ ...t, start: t.start_time, end: t.end_time })).filter(x => forLevel(x, team.level, lvs));
  let d = null;
  try { d = JSON.parse(localStorage.getItem(demoKey())); } catch (e) {}
  if (!d && team.level !== "E") {
    const from = today(), to = new Date(Date.now() + 70 * 864e5).toLocaleDateString("sv-SE");
    const slots = team.level === "G" ? [{ wd: 3, start: "16:30", end: "17:30", place: "hall" }, { wd: 6, start: "09:00", end: "10:00", place: "hall" }]
      : team.level === "EW" ? [{ wd: 1, start: "17:30", end: "19:00", place: "hall" }, { wd: 4, start: "17:30", end: "19:00", place: "hall" }]
      : [{ wd: 2, start: "17:00", end: "18:15", place: "hall" }, { wd: 5, start: "17:00", end: "18:15", place: "hall" }];
    d = { trainings: generateSeries({ from, to, slots,
            themes: themesFor(team.level), exercises: state.exercises, level: team.level }).map(t => ({ ...t, id: uid() })),
          tournaments: [], players: state.forced ? demoPlayersG(team.level) : [], attendance: {}, people: [] };
  }
  if (!d) {
    d = {
      trainings: SEED.trainings.map(t => ({ ...t, id: uid(), template_id: t.template_id })),
      tournaments: SEED.tournaments.map(u => ({ ...u, id: uid() })),
      players: state.forced ? demoPlayers() : [], attendance: {},
      people: []
    };
  }
  // Vorführ-Trainerteam (mit erfundenen NDS-Nummern)
  if (!d.people?.length || !d.people[0].user_id || !d.people[0].default_days) d.people = [
    { user_id: "demo-u1", email: "du@verein.ch", role: "admin", display_name: "Du (Demo)", pending: false, nds_id: "9100001", default_days: [3] },
    { user_id: "demo-u2", email: "assistenz@verein.ch", role: "trainer", display_name: "Assistenz (Demo)", pending: false, nds_id: "", default_days: [3, 6] },
    { user_id: "demo-u3", email: "trainer3@verein.ch", role: "trainer", display_name: "Trainer 3 (Demo)", pending: false, nds_id: "", default_days: [6] }];
  if (state.forced && team.level === "E" && !d.trainings.some(t => String(t.id).startsWith("hist-"))) addDemoHistory(d);
  state.trainings = d.trainings.map(t => ({ ...t, start: t.start_time, end: t.end_time, tpl: t.template_id }));
  state.tournaments = d.tournaments.map(normU);
  state.players = d.players; state.attendance = d.attendance; state.people = d.people; state.leaders = d.leaders || {}; state.avail = d.avail || {}; state.team.minTrainers = d.minTrainers ?? 2; state.role = "admin"; state.links = d.links || [];
  demoOwn = d.ownEx || []; demoOwn.forEach(r => state.exercises.push(normEx(r)));
  state.user = { email: "demo", id: "demo-u1" };
}
function saveDemo() {
  try {
    localStorage.setItem(demoKey(), JSON.stringify({
      trainings: state.trainings, players: state.players, attendance: state.attendance,
      people: state.people, links: state.links, leaders: state.leaders, ownEx: demoOwn, avail: state.avail, minTrainers: state.team.minTrainers,
      tournaments: state.tournaments.map(u => ({ ...u, time_text: u.time, organizer: u.org, category: u.cat }))
    }));
  } catch (e) {}
}
export function resetDemo() { try { localStorage.removeItem(demoKey()); } catch (e) {} loadDemo(); emit(); }

/* ================= Schreiben ================= */
async function run(q) { const { error } = await q; if (error) throw error; }

// Trainings und Turniere teilen sich die Anwesenheits-Logik, liegen aber in getrennten Tabellen
const attTable = id => state.tournaments.some(u => u.id === id) ? ["tournament_attendance", "tournament_id"] : ["attendance", "training_id"];
export async function setAttendance(eventId, playerId, present) {
  (state.attendance[eventId] ||= {})[playerId] = present;
  if (state.mode === "demo") return saveDemo();
  const [tb, key] = attTable(eventId);
  await run(sb.from(tb).upsert({ [key]: eventId, player_id: playerId, present }));
}
export async function setAllAttendance(eventId, present) {
  const map = (state.attendance[eventId] = {});
  state.players.filter(p => p.active !== false).forEach(p => map[p.id] = present);
  if (state.mode === "demo") return saveDemo();
  const [tb, key] = attTable(eventId);
  if (present) await run(sb.from(tb).upsert(Object.keys(map).map(p => ({ [key]: eventId, player_id: p, present: true }))));
  else await run(sb.from(tb).delete().eq(key, eventId));
}
export async function setLeader(eventId, userId, present) {
  (state.leaders[eventId] ||= {})[userId] = present;
  if (state.mode === "demo") return saveDemo();
  if (present) await run(sb.from("leader_attendance").upsert({ team_id: TEAM, event_id: eventId, user_id: userId, present: true }));
  else await run(sb.from("leader_attendance").delete().eq("event_id", eventId).eq("user_id", userId));
}
// Trainer-Einsatz: status "yes" | "maybe" | "no", null = zurück zur Einsatzplanung (Einsatztage)
export async function setAvail(eventId, userId, status, note) {
  const ev = (state.avail[eventId] ||= {});
  if (!status) delete ev[userId]; else ev[userId] = { status, note: note ?? ev[userId]?.note ?? "" };
  if (state.mode === "demo") return saveDemo();
  if (!status) await run(sb.from("trainer_availability").delete().eq("event_id", eventId).eq("user_id", userId));
  else await run(sb.from("trainer_availability").upsert({ team_id: TEAM, event_id: eventId, user_id: userId, status, note: ev[userId].note || null }));
}
// Abwesenheit von–bis: alle Trainings und Turniere in diesem Zeitraum auf «abwesend»
export async function setAbsence(userId, from, to, note) {
  const ids = [...state.trainings.filter(t => t.date >= from && t.date <= to), ...state.tournaments.filter(u => u.date >= from && u.date <= to)].map(x => x.id);
  ids.forEach(id => { (state.avail[id] ||= {})[userId] = { status: "no", note: note || "" }; });
  if (state.mode === "demo") { saveDemo(); return ids.length; }
  if (ids.length) await run(sb.from("trainer_availability").upsert(ids.map(id => ({ team_id: TEAM, event_id: id, user_id: userId, status: "no", note: note || null }))));
  return ids.length;
}
export async function setMemberDays(person, days) {
  person.default_days = days;
  if (state.mode === "demo") return saveDemo();
  await run(sb.rpc("set_member_days", { t: TEAM, uid: person.user_id || null, mail: person.email, days }));
}
export async function setMinTrainers(n) {
  state.team.minTrainers = n;
  if (state.mode === "demo") return saveDemo();
  await run(sb.rpc("set_min_trainers", { t: TEAM, n }));
}
export async function setMemberNds(userId, nr) {
  const p = state.people.find(x => x.user_id === userId); if (p) p.nds_id = nr.trim();
  if (state.mode === "demo") return saveDemo();
  await run(sb.rpc("set_member_nds", { t: TEAM, uid: userId, nr: nr.trim() }));
}

export async function swapExercise(trainingId, idx, exId) {
  const t = state.trainings.find(x => x.id === trainingId);
  t.blocks = t.blocks.map((b, i) => i === idx ? { ...b, ex: exId } : b);
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("trainings").update({ blocks: t.blocks }).eq("id", trainingId));
}
export async function saveNote(trainingId, note) {
  const t = state.trainings.find(x => x.id === trainingId); t.note = note;
  if (state.mode === "demo") return saveDemo();
  // über eine Funktion, damit auch Assistenztrainer (ohne Planungsrechte) Notizen schreiben können
  const r = await sb.rpc("set_training_note", { tid: trainingId, txt: note });
  if (r.error) await run(sb.from("trainings").update({ note }).eq("id", trainingId));   // vor 13_rollen_planung.sql
}
export async function addTraining(date, templateId) {
  const tp = state.templates.find(t => t.id === templateId);
  const row = { team_id: TEAM, date, start_time: tp.start, end_time: tp.end, place: tp.place, template_id: tp.id,
    thema: tp.thema, ziel: tp.ziel, fragen: tp.fragen, material: tp.material, blocks: tp.blocks };
  if (state.mode === "demo") { state.trainings.push({ ...row, id: uid(), start: tp.start, end: tp.end, tpl: tp.id }); return saveDemo(); }
  const { data, error } = await sb.from("trainings").insert(row).select().single(); if (error) throw error;
  state.trainings.push(normT(data));
}
export async function deleteTraining(id) {
  state.trainings = state.trainings.filter(t => t.id !== id); delete state.attendance[id]; delete state.leaders[id];
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("trainings").delete().eq("id", id));
}

// Mehrere Trainings auf einmal anlegen (Planungs-Assistent)
export async function addTrainings(rows) {
  const full = rows.map(r => ({ team_id: TEAM, ...r }));
  if (state.mode === "demo") { full.forEach(r => state.trainings.push(normT({ ...r, id: uid() }))); return saveDemo(); }
  for (let i = 0; i < full.length; i += 100) {
    const { data, error } = await sb.from("trainings").insert(full.slice(i, i + 100)).select(); if (error) throw error;
    (data || []).forEach(d => state.trainings.push(normT(d)));
  }
}
// Ein Training ändern: Datum, Zeit, Ort, Thema … oder Blöcke
export async function updateTraining(id, patch) {
  const t = state.trainings.find(x => x.id === id); if (!t) return;
  Object.assign(t, patch, normT({ ...t, ...patch }));
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("trainings").update(patch).eq("id", id));
}
// Mehrere Trainings gleich ändern (z. B. neue Zeit für alle Mittwoche)
export async function updateTrainings(ids, patch) {
  ids.forEach(id => { const t = state.trainings.find(x => x.id === id); if (t) Object.assign(t, patch, normT({ ...t, ...patch })); });
  if (state.mode === "demo") return saveDemo();
  for (let i = 0; i < ids.length; i += 100) await run(sb.from("trainings").update(patch).in("id", ids.slice(i, i + 100)));
}
export async function deleteTrainings(ids) {
  const set = new Set(ids);
  state.trainings = state.trainings.filter(t => !set.has(t.id)); ids.forEach(id => { delete state.attendance[id]; delete state.leaders[id]; });
  if (state.mode === "demo") return saveDemo();
  for (let i = 0; i < ids.length; i += 100) await run(sb.from("trainings").delete().in("id", ids.slice(i, i + 100)));
}

// Eigene Übung der Mannschaft speichern (z. B. aus dem Übungsgenerator)
export async function addOwnExercise(g) {
  const id = "own-" + uid().slice(0, 13).replace(/[^a-z0-9-]/gi, "");
  const data = { org: g.org, ablauf: g.ablauf, offen: g.offen, ueben: g.ueben, wett: g.wett, coach: g.coach, var: g.var, own: g.own, d: g.d, src: g.src, both: g.both || false };
  Object.keys(data).forEach(k => data[k] == null && delete data[k]);
  const row = { id, team_id: TEAM, place: g.place, phase: g.ph, name: g.name.replace(/ – angepasst$/, "") + " (eigene)", page: null, data, levels: [state.team.level] };
  if (state.mode === "demo") { state.exercises.push(normEx(row)); ownDemo().push(row); saveDemo(); return id; }
  await run(sb.from("exercises").insert(row));
  state.exercises.push(normEx(row));
  return id;
}
export async function deleteOwnExercise(id) {
  state.exercises = state.exercises.filter(e => e.id !== id);
  if (state.mode === "demo") { const o = ownDemo(); o.splice(0, o.length, ...o.filter(r => r.id !== id)); return saveDemo(); }
  await run(sb.from("exercises").delete().eq("id", id).eq("team_id", TEAM));
}
let demoOwn = [];
const ownDemo = () => demoOwn;

export async function addPlayer(name, year, nds_id) {
  const row = { team_id: TEAM, name, year: year || null, active: true };
  if (nds_id) row.nds_id = String(nds_id).trim();
  if (state.mode === "demo") { state.players.push({ ...row, id: uid() }); return saveDemo(); }
  const { data, error } = await sb.from("players").insert(row).select().single(); if (error) throw error;
  state.players.push(data);
}
export async function setPlayerActive(id, active) {
  state.players.find(p => p.id === id).active = active;
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("players").update({ active }).eq("id", id));
}

export async function updatePlayer(id, patch) {
  const p = state.players.find(x => x.id === id); Object.assign(p, patch);
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("players").update(patch).eq("id", id));
}

/* Clubcorner-Import: Spielerliste (CSV, Semikolon, Windows-1252) */
const CC = { "Name": "last_name", "Vorname": "first_name", "Strasse": "street", "PLZ": "zip", "Ort": "city",
  "E-Mail gesetzliche Vertretung": "guardian1_email", "E-Mail gesetzliche Vertretung 2": "guardian2_email",
  "Tel. Mobil gesetzliche Vertretung": "guardian1_phone", "Name/Vorname gesetzliche Vertretung": "guardian1_name",
  "Tel. Mobil gesetzliche Vertretung 2": "guardian2_phone", "Name/Vorname gesetzliche Vertretung 2": "guardian2_name",
  "Geburtsdatum": "birth_date", "Passnummer": "nds_id", "Rückennummer": "jersey", "Spielposition": "position", "Starker Fuss": "foot" };
function parseCsv(text, sep) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(x => x !== "")) rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some(x => x !== "")) rows.push(row); }
  return rows;
}
export function parseClubcorner(buf) {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (text.includes("\ufffd")) text = new TextDecoder("windows-1252").decode(buf);
  const rows = parseCsv(text.replace(/^\ufeff/, ""), text.split("\n")[0].includes(";") ? ";" : ",");
  const head = rows.shift().map(h => h.trim());
  if (!head.includes("Passnummer") || !head.includes("Vorname")) throw new Error("Das sieht nicht nach einer Clubcorner-Spielerliste aus (Spalten «Vorname» und «Passnummer» fehlen).");
  return rows.map(r => {
    const o = {};
    head.forEach((h, i) => { const k = CC[h]; const v = (r[i] || "").trim(); if (k && v && v !== "?") o[k] = v; });
    if (o.birth_date) { const [d, m, y] = o.birth_date.split("."); o.birth_date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; o.year = +y; }
    if (o.jersey !== undefined) o.jersey = /^\d+$/.test(o.jersey) ? +o.jersey : null;
    o.name = ((o.first_name || "").split(" ")[0] + " " + (o.last_name || "")).trim();
    return o;
  }).filter(o => o.nds_id && o.name);
}
export async function importPlayers(list) {
  let added = 0, updated = 0;
  for (const o of list) {
    const ex = state.players.find(p => p.nds_id === o.nds_id);
    if (ex) { await updatePlayer(ex.id, { ...o, active: true }); updated++; }
    else {
      const row = { team_id: TEAM, active: true, ...o };
      if (state.mode === "demo") state.players.push({ ...row, id: uid() });
      else { const { data, error } = await sb.from("players").insert(row).select().single(); if (error) throw error; state.players.push(data); }
      added++;
    }
  }
  if (state.mode === "demo") saveDemo();
  return { added, updated };
}

/* ================= NDS-Export (J+S) =================
   Vorlagen aus der NDS: UTF-8 mit BOM, Semikolon, CRLF, Spalten in fester Reihenfolge.
   anwesenheitskontrolle: PERSONENNUMMER;FUNKTION;DATUM;AKTIVITÄTSTYP;ZEIT;DAUER;ORT  (eine Zeile pro anwesende Person)
   aktivitaeten:          AKTIVITAETSTYP;DATUM;ZEIT;DAUER;ORT;FOKUS
   Training: Zeit, Dauer (60/75/90) und Ort Pflicht · Wettkampf: ohne Zeit, Dauer und Ort */
export const NDS_ORT_DEFAULT = { hall: "Turnhalle Hettlingen", grass: "Sportplatz Hettlingen" };
const NDS_DUR = [45, 60, 75, 90];
const chDate = iso => iso.split("-").reverse().join(".");
const minsOf = (a, b) => { const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number); return h2 * 60 + m2 - (h1 * 60 + m1); };
const ndsDur = t => { const m = minsOf(t.start, t.end); return NDS_DUR.filter(d => d <= m).pop() || NDS_DUR[0]; };
const csvCell = v => String(v ?? "").replace(/[;\r\n]+/g, " ").trim();
const csvOut = rows => "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
const TOUR_OK = ["eingeteilt", "angemeldet"];
function ndsEvents(from, to, ort, onlyWithAtt) {
  const has = id => Object.values(state.attendance[id] || {}).some(Boolean) || Object.values(state.leaders[id] || {}).some(Boolean);
  const tr = state.trainings.filter(t => t.date >= from && t.date <= to && (!onlyWithAtt || has(t.id)))
    .map(t => ({ id: t.id, date: t.date, sort: t.date + t.start, typ: "Training", zeit: t.start, dauer: ndsDur(t), ort: ort[t.place] || "" }));
  const tu = state.tournaments.filter(u => u.date >= from && u.date <= to && (onlyWithAtt ? has(u.id) : TOUR_OK.includes(u.status)))
    .map(u => ({ id: u.id, date: u.date, sort: u.date + "99", typ: "Wettkampf", zeit: "", dauer: "", ort: "" }));
  return [...tr, ...tu].sort((a, b) => a.sort.localeCompare(b.sort));
}
export function ndsExport(from, to, ort = NDS_ORT_DEFAULT) {
  const ev = ndsEvents(from, to, ort, true);
  const rows = [["PERSONENNUMMER", "FUNKTION", "DATUM", "AKTIVITÄTSTYP", "ZEIT", "DAUER", "ORT"]];
  const missingKids = new Set(), missingLeaders = new Set();
  let kidRows = 0, leaderRows = 0;
  for (const e of ev) {
    const base = [chDate(e.date), e.typ, e.zeit, e.dauer, e.ort];
    for (const p of state.people.filter(x => x.user_id && (state.leaders[e.id] || {})[x.user_id])) {
      if (!p.nds_id) { missingLeaders.add(p.display_name || p.email); continue; }
      rows.push([p.nds_id, "Leiter/in", ...base]); leaderRows++;
    }
    const a = state.attendance[e.id] || {};
    for (const p of state.players.filter(x => a[x.id]).sort((x, y) => x.name.localeCompare(y.name, "de"))) {
      if (!p.nds_id) { missingKids.add(p.name); continue; }
      rows.push([p.nds_id, "Teilnehmer/in", ...base]); kidRows++;
    }
  }
  return { csv: csvOut(rows), trainings: ev.filter(e => e.typ === "Training").length, tournaments: ev.filter(e => e.typ === "Wettkampf").length,
    rows: rows.length - 1, kidRows, leaderRows, missing: [...missingKids], missingLeaders: [...missingLeaders] };
}
export function ndsActivities(from, to, ort = NDS_ORT_DEFAULT) {
  const ev = ndsEvents(from, to, ort, false);
  return { csv: csvOut([["AKTIVITAETSTYP", "DATUM", "ZEIT", "DAUER", "ORT", "FOKUS"], ...ev.map(e => [e.typ, chDate(e.date), e.zeit, e.dauer, e.ort, ""])]),
    trainings: ev.filter(e => e.typ === "Training").length, tournaments: ev.filter(e => e.typ === "Wettkampf").length };
}

export async function addTournament(u) {
  const row = { team_id: TEAM, date: u.date, name: u.name, place: u.place, status: u.status, time_text: u.time || null };
  if (state.mode === "demo") { state.tournaments.push(normU({ ...row, id: uid() })); return saveDemo(); }
  const { data, error } = await sb.from("tournaments").insert(row).select().single(); if (error) throw error;
  state.tournaments.push(normU(data));
}
// Turnierliste aus Excel (kopieren und einfügen) oder CSV lesen. Spalten werden an der Kopfzeile erkannt.
const MON = { jan: 1, feb: 2, mär: 3, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
export function parseDate(v) {
  v = String(v || "").trim(); let m;
  if ((m = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = v.match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})/))) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  if ((m = v.match(/(\d{1,2})\.?\s+([A-Za-zÄäÖöÜü]{3})[a-zäöü]*\.?\s+(\d{4})/)) && MON[m[2].toLowerCase()]) return `${m[3]}-${String(MON[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}(\.\d+)?$/.test(v) && +v > 40000 && +v < 60000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5).toISOString().slice(0, 10);   // Excel-Datumszahl
  return null;
}
const normStatus = v => /einget/i.test(v) ? "eingeteilt" : /warte/i.test(v) ? "Warteliste" : /abges|absage/i.test(v) ? "abgesagt" : "angemeldet";
export function parseTournaments(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : (lines[0].split(";").length > lines[0].split(",").length ? ";" : ",");
  const rows = lines.map(l => sep === "\t" ? l.split("\t") : parseCsv(l, sep)[0] || []).map(r => r.map(c => String(c ?? "").trim()));
  const H = { date: /datum|date|^tag$/i, time: /zeit|uhr|beginn|time/i, name: /turnier|name|bezeichnung|anlass|event|wettbewerb/i, place: /^ort$|spielort|platz|anlage|ort\b|halle/i,
    org: /veranstalt|organisat|verein|club/i, cat: /kat|stärke|klasse|gruppe|kategorie/i, status: /status|anmeldung/i };
  const head = rows[0], hasHead = head.some(c => H.date.test(c)) && !head.some(c => parseDate(c));
  const col = {};
  if (hasHead) for (const [k, re] of Object.entries(H)) { const i = head.findIndex((c, j) => re.test(c) && !Object.values(col).includes(j)); if (i >= 0) col[k] = i; }
  const out = [];
  for (const r of hasHead ? rows.slice(1) : rows) {
    let date = col.date != null ? parseDate(r[col.date]) : null;
    if (!date) { const j = r.findIndex(c => parseDate(c)); if (j < 0) continue; date = parseDate(r[j]); if (col.date == null) col._d = j; }
    const pick = k => col[k] != null ? r[col[k]] || "" : "";
    let name = pick("name"), time = pick("time"), place = pick("place");
    if (!hasHead) {   // ohne Kopfzeile: Zeit erkennen, längster Text = Name, nächster = Ort
      const rest = r.filter((c, j) => j !== col._d && c);
      time = rest.find(c => /^\d{1,2}[:.]\d{2}/.test(c)) || "";
      const txt = rest.filter(c => c !== time && !parseDate(c)).sort((a, b) => b.length - a.length);
      name = txt[0] || ""; place = txt[1] || "";
    }
    if (!name) continue;
    out.push({ date, time: time.replace(/(\d)\.(\d\d)/g, "$1:$2"), name, place, org: pick("org"), cat: pick("cat"), status: normStatus(pick("status")) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Turniere einlesen (Liste aus Excel/CSV) – Duplikate (gleiches Datum + Name) werden übersprungen
export async function importTournaments(list) {
  const key = u => u.date + "|" + u.name.trim().toLowerCase();
  const have = new Set(state.tournaments.map(key));
  const rows = list.filter(u => !have.has(key(u))).map(u => ({ team_id: TEAM, date: u.date, name: u.name, place: u.place || "Ort offen",
    organizer: u.org || null, category: u.cat || null, status: u.status || "angemeldet", time_text: u.time || null }));
  if (rows.length) {
    if (state.mode === "demo") rows.forEach(r => state.tournaments.push(normU({ ...r, id: uid() })));
    else { const { data, error } = await sb.from("tournaments").insert(rows).select(); if (error) throw error; (data || []).forEach(d => state.tournaments.push(normU(d))); }
  }
  if (state.mode === "demo") saveDemo();
  return { added: rows.length, skipped: list.length - rows.length };
}
export async function updateTournament(id, u) {
  const patch = { date: u.date, name: u.name, place: u.place || "Ort offen", time_text: u.time || null, organizer: u.org || null, category: u.cat || null };
  const t = state.tournaments.find(x => x.id === id); Object.assign(t, normU({ ...t, ...patch }));
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("tournaments").update(patch).eq("id", id));
}
export async function setTournamentStatus(id, status) {
  state.tournaments.find(u => u.id === id).status = status;
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("tournaments").update({ status }).eq("id", id));
}
export async function deleteTournament(id) {
  state.tournaments = state.tournaments.filter(u => u.id !== id); delete state.attendance[id]; delete state.leaders[id];
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("tournaments").delete().eq("id", id));
}

export async function inviteTrainer(email, displayName, role) {
  email = email.trim().toLowerCase();
  if (state.mode === "demo") { state.people.push({ email, display_name: displayName, role, pending: true }); return saveDemo(); }
  await run(sb.from("invites").upsert({ team_id: TEAM, email, display_name: displayName || null, role }));
  const { data } = await sb.rpc("team_people", { t: TEAM }); state.people = data || [];
}
export async function removeInvite(email) {
  state.people = state.people.filter(p => !(p.pending && p.email === email));
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("invites").delete().eq("team_id", TEAM).eq("email", email));
}

export async function removeMember(person) {
  state.people = state.people.filter(p => p !== person);
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("invites").delete().eq("team_id", TEAM).eq("email", person.email));
  if (person.user_id) await run(sb.from("team_members").delete().eq("team_id", TEAM).eq("user_id", person.user_id));
}

/* ================= Video-Links ================= */
export async function addLink(exerciseId, title, url) {
  if (!/^https?:\/\//i.test(url)) throw new Error("Der Link muss mit https:// beginnen");
  const row = { team_id: TEAM, exercise_id: exerciseId, title, url };
  if (state.mode === "demo") { state.links.push({ ...row, id: uid() }); return saveDemo(); }
  const { data, error } = await sb.from("exercise_links").insert(row).select().single(); if (error) throw error;
  state.links.push(data);
}
export async function deleteLink(id) {
  state.links = state.links.filter(l => l.id !== id);
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("exercise_links").delete().eq("id", id));
}

/* ================= Dokumente ================= */
export async function uploadDocument(file, title, category) {
  if (state.mode === "demo") throw new Error("Dokumente gibt es nur in der echten App mit Login");
  const safe = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const path = TEAM + "/" + uid().slice(0, 8) + "-" + safe;
  const up = await sb.storage.from("dokumente").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (up.error) throw up.error;
  await run(sb.from("documents").insert({ team_id: TEAM, title, category, file_path: path, file_name: file.name, size_bytes: file.size }));
  await loadDocs();
}
export async function deleteDocument(doc) {
  await run(sb.storage.from("dokumente").remove([doc.file_path]));
  await run(sb.from("documents").delete().eq("id", doc.id));
  await loadDocs();
}

export { today };

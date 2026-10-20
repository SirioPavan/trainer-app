// Datenzugriff. Zwei Modi mit identischer Schnittstelle:
//  - "cloud": Supabase (gemeinsame Datenbank, Login per E-Mail-Link, Live-Abgleich)
//  - "demo":  nur auf diesem Gerät (localStorage), wenn config.js noch leer ist
import { SEED } from "./seed-data.js";
import { CONFIG } from "./config.js";

const TEAM = CONFIG.teamId || "e-junioren";
const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD lokal
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const normEx = e => Object.assign({}, e.data, { id: e.id, place: e.place, ph: e.phase, name: e.name, page: e.page });

/* Gemeinsamer Zustand, den die Oberfläche liest */
export const state = {
  mode: "demo", user: null, role: "admin", team: { id: TEAM, name: "E-Junioren" },
  exercises: [], templates: [], trainings: [], tournaments: [], players: [], attendance: {}, people: [], documents: [], docUrls: {}, links: []
};

let sb = null;
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach(fn => fn()); }

/* ================= Start ================= */
export async function init() {
  const forceDemo = new URLSearchParams(location.search).has("demo");
  state.forced = forceDemo;
  if (!forceDemo && CONFIG.supabaseUrl && CONFIG.supabaseKey && window.supabase) {
    state.mode = "cloud";
    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await sb.auth.getSession();
    state.user = data.session?.user || null;
    sb.auth.onAuthStateChange((_e, session) => {
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
export async function signOut() { if (sb) await sb.auth.signOut(); state.user = null; emit(); }

/* ================= Laden ================= */
async function load() {
  if (!state.user) return;
  const from = new Date(Date.now() - 300 * 864e5).toLocaleDateString("sv-SE");   // ganze Saison
  const [m, ex, tp, tr, tu, pl] = await Promise.all([
    sb.from("team_members").select("role,display_name,team_id,teams(name)").eq("user_id", state.user.id),
    sb.from("exercises").select("*"),
    sb.from("templates").select("*"),
    sb.from("trainings").select("*").eq("team_id", TEAM).gte("date", from).order("date"),
    sb.from("tournaments").select("*").eq("team_id", TEAM).order("date"),
    sb.from("players").select("*").eq("team_id", TEAM).order("name")
  ]);
  const lk = await sb.from("exercise_links").select("*").eq("team_id", TEAM).order("created_at");
  state.links = lk.error ? [] : (lk.data || []);   // Tabelle erst ab 05_videos_sfv_karten.sql
  const mine = (m.data || []).find(x => x.team_id === TEAM);
  state.role = mine ? mine.role : null;
  state.memberName = mine?.display_name || "";
  if (mine?.teams?.name) state.team.name = mine.teams.name;
  state.exercises = (ex.data || []).map(normEx);
  state.templates = (tp.data || []).map(t => ({ ...t, start: t.start_time.slice(0, 5), end: t.end_time.slice(0, 5) }));
  state.trainings = (tr.data || []).map(normT);
  state.tournaments = (tu.data || []).map(normU);
  state.players = pl.data || [];
  const ids = state.trainings.map(t => t.id);
  state.attendance = {};
  if (ids.length) {
    const { data } = await sb.from("attendance").select("*").in("training_id", ids);
    (data || []).forEach(a => { (state.attendance[a.training_id] ||= {})[a.player_id] = a.present; });
  }
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
  ["attendance", "trainings", "tournaments", "players"].forEach(table =>
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
function loadDemo() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
  if (!d) {
    d = {
      trainings: SEED.trainings.map(t => ({ ...t, id: uid(), template_id: t.template_id })),
      tournaments: SEED.tournaments.map(u => ({ ...u, id: uid() })),
      players: state.forced ? demoPlayers() : [], attendance: {},
      people: [{ email: "du@verein.ch", role: "admin", display_name: "Du (Demo)", pending: false }]
    };
  }
  if (state.forced && !d.trainings.some(t => t.date < today())) addDemoHistory(d);
  state.exercises = SEED.exercises.map(normEx);
  state.templates = SEED.templates.map(t => ({ ...t, start: t.start_time, end: t.end_time }));
  state.trainings = d.trainings.map(t => ({ ...t, start: t.start_time, end: t.end_time, tpl: t.template_id }));
  state.tournaments = d.tournaments.map(normU);
  state.players = d.players; state.attendance = d.attendance; state.people = d.people; state.role = "admin"; state.links = d.links || [];
}
function saveDemo() {
  try {
    localStorage.setItem(LS, JSON.stringify({
      trainings: state.trainings, players: state.players, attendance: state.attendance,
      people: state.people, links: state.links,
      tournaments: state.tournaments.map(u => ({ ...u, time_text: u.time, organizer: u.org, category: u.cat }))
    }));
  } catch (e) {}
}
export function resetDemo() { try { localStorage.removeItem(LS); } catch (e) {} loadDemo(); emit(); }

/* ================= Schreiben ================= */
async function run(q) { const { error } = await q; if (error) throw error; }

export async function setAttendance(trainingId, playerId, present) {
  (state.attendance[trainingId] ||= {})[playerId] = present;
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("attendance").upsert({ training_id: trainingId, player_id: playerId, present }));
}
export async function setAllAttendance(trainingId, present) {
  const map = (state.attendance[trainingId] = {});
  state.players.filter(p => p.active !== false).forEach(p => map[p.id] = present);
  if (state.mode === "demo") return saveDemo();
  if (present) await run(sb.from("attendance").upsert(Object.keys(map).map(p => ({ training_id: trainingId, player_id: p, present: true }))));
  else await run(sb.from("attendance").delete().eq("training_id", trainingId));
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
  await run(sb.from("trainings").update({ note }).eq("id", trainingId));
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
  state.trainings = state.trainings.filter(t => t.id !== id); delete state.attendance[id];
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("trainings").delete().eq("id", id));
}

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

/* NDS-Export im Format der J+S-Anwesenheitsliste:
   NDS-Personen-ID,Datum,Aktivität-Typ,Anwesend  (Ja/Nein) */
export function ndsExport(from, to) {
  const kids = state.players.filter(p => p.nds_id);
  const trs = state.trainings.filter(t => t.date >= from && t.date <= to && Object.keys(state.attendance[t.id] || {}).length)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const lines = ["NDS-Personen-ID,Datum,Aktivität-Typ,Anwesend"];
  for (const t of trs) {
    const a = state.attendance[t.id] || {};
    for (const p of kids.slice().sort((x, y) => x.nds_id.localeCompare(y.nds_id))) {
      const joined = !p.created_at || p.created_at.slice(0, 10) <= t.date;   // erst ab Eintritt ins Kader
      if (a[p.id] !== undefined || (p.active !== false && joined))
        lines.push(`${p.nds_id},${t.date},J+S Training,${a[p.id] ? "Ja" : "Nein"}`);
    }
  }
  return { csv: lines.join("\n") + "\n", trainings: trs.length, rows: lines.length - 1, missing: state.players.filter(p => p.active !== false && !p.nds_id).map(p => p.name) };
}

export async function addTournament(u) {
  const row = { team_id: TEAM, date: u.date, name: u.name, place: u.place, status: u.status, time_text: u.time || null };
  if (state.mode === "demo") { state.tournaments.push(normU({ ...row, id: uid() })); return saveDemo(); }
  const { data, error } = await sb.from("tournaments").insert(row).select().single(); if (error) throw error;
  state.tournaments.push(normU(data));
}
export async function setTournamentStatus(id, status) {
  state.tournaments.find(u => u.id === id).status = status;
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("tournaments").update({ status }).eq("id", id));
}
export async function deleteTournament(id) {
  state.tournaments = state.tournaments.filter(u => u.id !== id);
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

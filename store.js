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
  exercises: [], templates: [], trainings: [], tournaments: [], players: [], attendance: {}, people: []
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
  const from = new Date(Date.now() - 60 * 864e5).toLocaleDateString("sv-SE");
  const [m, ex, tp, tr, tu, pl] = await Promise.all([
    sb.from("team_members").select("role,display_name,team_id,teams(name)").eq("user_id", state.user.id),
    sb.from("exercises").select("*"),
    sb.from("templates").select("*"),
    sb.from("trainings").select("*").eq("team_id", TEAM).gte("date", from).order("date"),
    sb.from("tournaments").select("*").eq("team_id", TEAM).order("date"),
    sb.from("players").select("*").eq("team_id", TEAM).order("name")
  ]);
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
const LS = "fcs-trainer-demo-v1";
const DEMO_PLAYERS = ["Luca M.","Noah K.","Elias B.","Mia S.","Leon F.","Lina W.","Matteo R.","Ben H.","Emma Z.","Nico T.","Sofia G.","Jonas P.","Alessio C.","Lara N."];
function loadDemo() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
  if (!d) {
    d = {
      trainings: SEED.trainings.map(t => ({ ...t, id: uid(), template_id: t.template_id })),
      tournaments: SEED.tournaments.map(u => ({ ...u, id: uid() })),
      players: state.forced ? DEMO_PLAYERS.map((n, i) => ({ id: "dp" + i, name: n, year: 2016 + (i % 3 === 0 ? 1 : 0), active: true })) : [], attendance: {},
      people: [{ email: "du@verein.ch", role: "admin", display_name: "Du (Demo)", pending: false }]
    };
  }
  state.exercises = SEED.exercises.map(normEx);
  state.templates = SEED.templates.map(t => ({ ...t, start: t.start_time, end: t.end_time }));
  state.trainings = d.trainings.map(t => ({ ...t, start: t.start_time, end: t.end_time, tpl: t.template_id }));
  state.tournaments = d.tournaments.map(normU);
  state.players = d.players; state.attendance = d.attendance; state.people = d.people; state.role = "admin";
}
function saveDemo() {
  try {
    localStorage.setItem(LS, JSON.stringify({
      trainings: state.trainings, players: state.players, attendance: state.attendance,
      people: state.people,
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

export async function addPlayer(name, year) {
  const row = { team_id: TEAM, name, year: year || null, active: true };
  if (state.mode === "demo") { state.players.push({ ...row, id: uid() }); return saveDemo(); }
  const { data, error } = await sb.from("players").insert(row).select().single(); if (error) throw error;
  state.players.push(data);
}
export async function setPlayerActive(id, active) {
  state.players.find(p => p.id === id).active = active;
  if (state.mode === "demo") return saveDemo();
  await run(sb.from("players").update({ active }).eq("id", id));
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

export { today };

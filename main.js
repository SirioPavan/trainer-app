// Oberfläche der Trainer-App
import * as db from "./store.js";
import { state } from "./store.js";
import { PH, drawDiagram } from "./diagram.js";
import { WHEEL_VAR, WHEEL_MOT } from "./wissen.js";

const PLACE = { grass: "Rasen", hall: "Halle" };
const ST = { eingeteilt: "ok", angemeldet: "ok", Warteliste: "wait", abgesagt: "open" };
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"], MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const V = document.getElementById("view");

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
function dparts(iso) { const d = new Date(iso + "T12:00:00"); return { wd: WD[d.getDay()], d: d.getDate(), m: MO[d.getMonth()], y: d.getFullYear(), full: WD[d.getDay()] + ", " + d.getDate() + ". " + MO[d.getMonth()] + " " + d.getFullYear() }; }
const mins = t => t.blocks.reduce((a, b) => a + b.min, 0);
const ex = id => state.exercises.find(e => e.id === id);
const activePlayers = () => state.players.filter(p => p.active !== false);
const attCount = t => Object.entries(state.attendance[t.id] || {}).filter(([pid, v]) => v && activePlayers().some(p => p.id === pid)).length;
const isAdmin = () => state.role === "admin";

function toast(msg, bad) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.className = "toast", 2600);
}
async function act(fn, ok) {
  try { await fn(); if (ok) toast(ok); }
  catch (e) { console.error(e); toast("Speichern hat nicht geklappt: " + (e.message || e) + ". Bitte Verbindung prüfen.", true); }
  render(true);
}

/* ================= Navigation ================= */
const NAV = [
  ["trainings", "Planung", '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'],
  ["uebungen", "Übungen", '<circle cx="12" cy="12" r="8"/><path d="M12 4l2.5 5h-5zM6 14l3-1.5M18 14l-3-1.5M9.5 19l1-4h3l1 4"/>'],
  ["kader", "Kader", '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.3.2 3.9 1.6 4.5 4"/>'],
  ["turniere", "Turniere", '<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8"/>'],
  ["wissen", "Wissen", '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>']
];
let route = { tab: "trainings" };
function go(r) { route = r; history.pushState(r, ""); render(); window.scrollTo({ top: 0 }); }
window.addEventListener("popstate", e => { route = e.state || { tab: "trainings" }; render(); });
const navEl = document.getElementById("nav");
navEl.innerHTML = NAV.map(([k, l, p]) => `<button data-tab="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>${l}</button>`).join("");
navEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) go({ tab: b.dataset.tab }); });

/* ================= Rahmen ================= */
function render(keepScroll) {
  const y = window.scrollY;
  const nav = document.querySelector(".nav"), top = document.querySelector(".top");
  document.getElementById("modeBadge").textContent = state.mode === "demo" ? "Demo" : (isAdmin() ? "Admin" : "Trainer");
  document.getElementById("who").textContent = state.mode === "demo" ? "nur dieses Gerät" : (state.memberName || state.user?.email || "");
  document.getElementById("teamName").textContent = state.team.name;
  if (!state.user) { nav.hidden = true; top.classList.add("bare"); viewLogin(); return; }
  if (state.mode === "cloud" && !state.role) { nav.hidden = true; viewNoAccess(); return; }
  nav.hidden = false; top.classList.remove("bare");
  navEl.querySelectorAll("button").forEach(b => b.dataset.tab === route.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  const T = { trainings: "Planung", uebungen: "Übungen", kader: "Kader", turniere: "Turniere", wissen: "Wissen" };
  document.getElementById("title").textContent = route.training ? "Training" : route.exercise ? "Übung" : T[route.tab];
  if (route.training) viewTraining(route.training);
  else if (route.exercise) viewExercise(route.exercise);
  else ({ trainings: viewDashboard, uebungen: viewLibrary, kader: viewKader, turniere: viewTurniere, wissen: viewWissen })[route.tab]();
  if (keepScroll) window.scrollTo({ top: y });
}

/* ================= Login ================= */
function viewLogin() {
  document.getElementById("title").textContent = "Anmelden";
  V.innerHTML = `
   <section class="card pad login">
     <h2>Willkommen</h2>
     <p>Melde dich mit deiner E-Mail an. Du bekommst einen Link, mit dem du direkt in der App bist. Ein Passwort brauchst du nicht.</p>
     <form id="login"><label for="em" class="lbl">E-Mail</label>
       <input id="em" type="email" autocomplete="email" required placeholder="name@beispiel.ch">
       <button class="btn">Login-Link senden</button></form>
     <p class="small muted" id="loginMsg"></p>
   </section>`;
  V.querySelector("#login").onsubmit = async e => {
    e.preventDefault();
    const em = V.querySelector("#em").value.trim(), msg = V.querySelector("#loginMsg");
    msg.textContent = "Sende Link …";
    try { await db.sendLoginLink(em); msg.innerHTML = `Link an <b>${esc(em)}</b> gesendet. Öffne die E-Mail auf diesem Gerät und tippe auf den Link. Kein Mail? Schau im Spam-Ordner nach.`; }
    catch (err) { msg.textContent = "Das hat nicht geklappt: " + (err.message || err); }
  };
}
function viewNoAccess() {
  document.getElementById("title").textContent = "Kein Zugriff";
  V.innerHTML = `<section class="card pad login"><h2>Noch kein Zugriff</h2>
    <p>Du bist als <b>${esc(state.user.email)}</b> angemeldet, gehörst aber noch zu keiner Mannschaft. Bitte die Trainerin oder den Trainer, dich in der App unter «Kader → Trainerteam» mit genau dieser E-Mail einzuladen. Danach hier neu laden.</p>
    <div class="btnrow"><button class="btn" data-reload>Neu laden</button><button class="btn ghost" data-out>Abmelden</button></div></section>`;
  V.querySelector("[data-reload]").onclick = () => location.reload();
  V.querySelector("[data-out]").onclick = () => db.signOut();
}

/* ================= Planung ================= */
let filt = "all", showAll = false;
function viewDashboard() {
  const td = db.today();
  const list = state.trainings.filter(t => t.date >= td).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const tours = state.tournaments.filter(u => u.date >= td && u.status !== "abgesagt").sort((a, b) => a.date.localeCompare(b.date));
  const next = list[0], nt = tours[0];
  const items = [...(filt !== "tour" ? list.map(x => ({ k: "t", date: x.date, o: x })) : []), ...(filt !== "train" ? state.tournaments.filter(u => u.date >= td).map(x => ({ k: "u", date: x.date, o: x })) : [])]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.k === "u" ? 1 : -1));
  const vis = showAll ? items : items.slice(0, 12);
  const n = next && dparts(next.date);
  V.innerHTML = `
   ${state.mode === "demo" ? `<p class="demo-note">${state.forced ? "Vorführ-Version mit Beispieldaten: Probier alles aus, nichts davon landet in der echten Datenbank. Die Kinder-Namen sind erfunden." : "Demo-Modus: Die Daten bleiben nur auf diesem Gerät. Sobald die Datenbank verbunden ist, sehen alle Trainer denselben Stand."}</p>` : ""}
   ${next ? `<button class="hero" data-open="${next.id}">
     <span class="k">Nächstes Training</span><span class="d">${n.full}</span>
     <span class="meta">${next.start}–${next.end} · ${PLACE[next.place]} · ${mins(next)} Min.<br>${esc(next.thema)}</span>
     <span class="go">Training öffnen</span></button>` : `<p class="card pad empty">Keine kommenden Trainings. Lege unten eines aus einer Vorlage an.</p>`}
   ${nt ? `<button class="card pad tourcard" data-tab-go="turniere"><span class="k">Nächstes Turnier</span>
     <b>${dparts(nt.date).full}${nt.time ? " · " + esc(nt.time) : ""}</b>
     <span class="muted small">${esc(nt.place)}${nt.org ? " · Veranstalter: " + esc(nt.org) : ""}</span></button>` : ""}
   <div class="sec-head"><h2>Termine</h2><span class="note">${list.length} Trainings · ${tours.length} Turniere</span></div>
   <div class="chips" role="group" aria-label="Filter">
     ${[["all", "Alles"], ["train", "Trainings"], ["tour", "Turniere"]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filt === k}">${l}</button>`).join("")}</div>
   <div class="card list">${vis.map(it => it.k === "t" ? rowT(it.o) : rowU(it.o)).join("") || '<p class="empty">Nichts geplant.</p>'}</div>
   ${items.length > 12 ? `<button class="btn ghost" data-more>${showAll ? "Weniger anzeigen" : "Alle " + items.length + " Termine anzeigen"}</button>` : ""}
   <details class="card pad addbox"><summary class="lbl">+ Training hinzufügen</summary>
     <form class="inline" id="addt" style="margin-top:10px">
       <input id="tdate" type="date" required aria-label="Datum" min="${td}">
       <select id="ttpl" aria-label="Vorlage">${state.templates.map(t => `<option value="${t.id}">${esc(t.title)} (${t.start}–${t.end})</option>`).join("")}</select>
       <button class="btn">Anlegen</button></form></details>
   <div class="sec-head"><h2>Vorlagen</h2><span class="note">aus dem J+S-Manual</span></div>
   <div class="card list">${state.templates.map(tp => `<button class="row" data-tpl="${tp.id}" style="grid-template-columns:minmax(0,1fr) auto">
      <span class="mid"><b>${esc(tp.title)}</b><span>${esc(tp.thema)} · ${mins(tp)}'</span></span><span class="chev">›</span></button>`).join("")}</div>`;
  V.querySelectorAll("[data-open]").forEach(b => b.onclick = () => go({ tab: "trainings", training: b.dataset.open }));
  V.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => go({ tab: "trainings", training: "tpl:" + b.dataset.tpl }));
  V.querySelectorAll("[data-tab-go],[data-u]").forEach(b => b.onclick = () => go({ tab: "turniere" }));
  V.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filt = b.dataset.f; render(); });
  const mb = V.querySelector("[data-more]"); if (mb) mb.onclick = () => { showAll = !showAll; render(true); };
  V.querySelector("#addt").onsubmit = e => { e.preventDefault(); act(() => db.addTraining(V.querySelector("#tdate").value, V.querySelector("#ttpl").value), "Training angelegt"); };
}
function rowT(t) {
  const d = dparts(t.date), c = attCount(t), n = activePlayers().length, clash = state.tournaments.filter(u => u.date === t.date && u.status !== "abgesagt");
  return `<button class="row" data-open="${t.id}">
    <span class="date"><span class="dw">${d.wd}</span><br><span class="dd">${d.d}</span><br><span class="dm">${d.m}</span></span>
    <span class="mid"><b>Training · ${esc(t.thema)}</b><span>${t.start}–${t.end} · <span class="tag ${t.place === "grass" ? "rasen" : "halle"}">${PLACE[t.place]}</span> · ${mins(t)}'</span>${clash.length ? `<span class="warnline">Gleicher Tag: ${esc(clash[0].name)} (${clash[0].status})</span>` : ""}</span>
    <span class="pill ${c ? "ok" : "open"}">${c ? c + "/" + n : "offen"}</span></button>`;
}
function rowU(u) {
  const d = dparts(u.date);
  return `<button class="row turn" data-u="${u.id}">
    <span class="date tour"><span class="dw">${d.wd}</span><br><span class="dd">${d.d}</span><br><span class="dm">${d.m}</span></span>
    <span class="mid"><b>${/^turnier/i.test(u.name) ? "" : "Turnier · "}${esc(u.name)}</b><span>${u.time ? esc(u.time) + " · " : ""}${esc(u.place)}</span></span>
    <span class="pill ${ST[u.status] || "open"}">${esc(u.status)}</span></button>`;
}

/* ================= Training ================= */
function exCard(e, idx, t) {
  if (!e) return `<p class="card pad empty">Übung nicht gefunden.</p>`;
  const others = t ? state.exercises.filter(x => x.ph === e.ph && x.id !== e.id) : [];
  return `<article class="card ex">${e.d ? drawDiagram(e.d) : ""}
    <div class="body">
      <div class="tr"><h3>${esc(e.name)}</h3>${e.page ? `<span class="pg">S. ${esc(e.page)}</span>` : ""}</div>
      ${e.org ? `<p><span class="lbl">Organisation:</span> ${esc(e.org)}</p>` : ""}
      ${e.ablauf ? `<p><span class="lbl">Ablauf:</span> ${esc(e.ablauf)}</p>` : ""}
      ${e.offen ? `<div class="fahr"><div><b>Offen starten</b>${esc(e.offen)}</div><div><b>Üben</b>${esc(e.ueben)}</div><div><b>Wetteifern</b>${esc(e.wett)}</div></div>` : ""}
      ${e.own ? `<p class="own">${esc(e.own)}</p>` : ""}
      ${e.coach?.length ? `<div><span class="lbl">Coaching:</span><ul>${e.coach.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${e.var ? `<p class="var"><span class="lbl">Rad der Variation:</span> ${esc(e.var)}</p>` : ""}
      ${t && others.length ? `<div class="swap"><label for="sw${idx}" class="muted">Übung tauschen:</label>
        <select id="sw${idx}" data-swap="${idx}"><option value="">– andere Übung derselben Phase –</option>${others.map(o => `<option value="${o.id}">${esc(o.name)} (${PLACE[o.place]})</option>`).join("")}</select></div>` : ""}
    </div></article>`;
}
function viewTraining(id) {
  const isTpl = id.startsWith("tpl:");
  const t = isTpl ? state.templates.find(x => x.id === id.slice(4)) : state.trainings.find(x => x.id === id);
  if (!t) { route = { tab: "trainings" }; return render(); }
  const d = isTpl ? { full: "Vorlage" } : dparts(t.date), total = mins(t), a = state.attendance[t.id] || {}, ap = activePlayers(), c = attCount(t), n = ap.length;
  const used = [...new Set(t.blocks.map(b => b.ph))];
  V.innerHTML = `
   <button class="back" data-back>‹ Planung</button>
   <section class="dhead">
     <h2>${isTpl ? esc(t.title) : d.full}</h2>
     <div><span class="tag ${t.place === "grass" ? "rasen" : "halle"}">${PLACE[t.place]}</span> <span class="muted small">${t.start}–${t.end} · ${total} Min.</span></div>
     <dl class="card pad facts"><dt>Thema</dt><dd>${esc(t.thema)}</dd><dt>Ziel</dt><dd>${esc(t.ziel)}</dd><dt>Fragen</dt><dd>${esc(t.fragen)}</dd><dt>Material</dt><dd>${esc(t.material)}</dd></dl>
     <div class="tl" aria-label="Zeitablauf ${total} Minuten">${t.blocks.map(b => `<div style="flex:${b.min};background:var(${PH[b.ph].c})" title="${PH[b.ph].t}">${b.min}'</div>`).join("")}</div>
     <div class="legend">${used.map(p => `<span><i style="background:var(${PH[p].c})"></i>${PH[p].t.replace("Hauptteil · ", "")}</span>`).join("")}</div>
   </section>
   ${isTpl ? `<p class="small muted card pad">Vorlage: So sieht ein Training aus, das du mit dieser Vorlage anlegst. Änderungen an einem einzelnen Training gelten nur für diesen Tag.</p>` : `
   <section class="card pad stack">
     <div class="sec-head"><h3>Anwesenheit</h3><span class="pill ${c ? "ok" : "open"}">${c}/${n} da</span></div>
     <div class="attbar"><i style="width:${n ? c / n * 100 : 0}%"></i></div>
     ${n ? `<details class="more" id="attd" ${c ? "" : "open"}><summary>${c ? "Liste anzeigen" : "Jetzt erfassen"}</summary>
       <div class="att">${ap.map(p => `<button data-att="${p.id}" aria-pressed="${!!a[p.id]}"><span class="dot">${a[p.id] ? "✓" : ""}</span><span>${esc(p.name)}</span></button>`).join("")}</div>
       <div class="btnrow"><button class="btn ghost" data-all>Alle anwesend</button><button class="btn ghost" data-none>Zurücksetzen</button></div></details>`
      : `<p class="small muted">Noch keine Kinder im Kader. Trage sie unter «Kader» ein.</p>`}
   </section>
   <section class="card pad stack"><label for="note" class="lbl">Notiz zum Training</label>
     <textarea id="note" rows="2" placeholder="z. B. Halle B statt A, Bälle mitnehmen">${esc(t.note || "")}</textarea></section>`}
   ${t.blocks.map((b, i) => `<section class="phase" style="--pc:var(${PH[b.ph].c})"><div class="phase-h">${PH[b.ph].t}<span class="min">${b.min} Min.</span></div>${exCard(ex(b.ex), i, isTpl ? null : t)}</section>`).join("")}
   ${isTpl ? "" : `<button class="btn ghost danger" data-deltr>Training absagen und löschen</button>`}`;
  V.querySelector("[data-back]").onclick = () => history.length > 1 ? history.back() : go({ tab: "trainings" });
  if (isTpl) return;
  const keepOpen = () => { const dd = V.querySelector("#attd"); if (dd) dd.open = true; };
  V.querySelectorAll("[data-att]").forEach(b => b.onclick = async () => { const p = b.dataset.att; await act(() => db.setAttendance(t.id, p, !a[p])); keepOpen(); });
  const all = V.querySelector("[data-all]"); if (all) all.onclick = async () => { await act(() => db.setAllAttendance(t.id, true)); keepOpen(); };
  const none = V.querySelector("[data-none]"); if (none) none.onclick = async () => { await act(() => db.setAllAttendance(t.id, false)); keepOpen(); };
  V.querySelectorAll("[data-swap]").forEach(s => s.onchange = () => s.value && act(() => db.swapExercise(t.id, +s.dataset.swap, s.value), "Übung getauscht"));
  const note = V.querySelector("#note"); note.onchange = () => act(() => db.saveNote(t.id, note.value), "Notiz gespeichert");
  const del = V.querySelector("[data-deltr]");
  del.onclick = () => {
    if (del.dataset.armed) { act(() => db.deleteTraining(t.id), "Training gelöscht").then(() => go({ tab: "trainings" })); }
    else { del.dataset.armed = 1; del.textContent = "Wirklich löschen? Nochmals tippen"; setTimeout(() => { delete del.dataset.armed; del.textContent = "Training absagen und löschen"; }, 4000); }
  };
}

/* ================= Übungen ================= */
let q = "", fph = "all", fpl = "all";
function viewLibrary() {
  const items = state.exercises.filter(e => (fph === "all" || e.ph === fph) && (fpl === "all" || e.place === fpl) && (!q || (e.name + " " + (e.org || "") + " " + (e.ablauf || e.offen || "")).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Object.keys(PH).indexOf(a.ph) - Object.keys(PH).indexOf(b.ph));
  V.innerHTML = `
   <div class="sec-head"><h2>Übungen</h2><span class="note">${state.exercises.length} Lernbausteine</span></div>
   <input class="search" id="q" type="search" placeholder="Übung suchen, z. B. Tigerball" value="${esc(q)}" aria-label="Übung suchen">
   <div class="chips" role="group" aria-label="Phase">${[["all", "Alle Phasen"], ["auf", "Auffangen"], ["ein", "Einleitung"], ["sp", "Spielen"], ["le", "Lernen"], ["vi", "Vielseitigkeit"], ["aus", "Ausklang"]].map(([k, l]) => `<button class="chip" data-ph="${k}" aria-pressed="${fph === k}">${l}</button>`).join("")}</div>
   <div class="chips" role="group" aria-label="Ort">${[["all", "Rasen & Halle"], ["grass", "Rasen"], ["hall", "Halle"]].map(([k, l]) => `<button class="chip" data-pl="${k}" aria-pressed="${fpl === k}">${l}</button>`).join("")}</div>
   <div class="card list">${items.map(e => `<button class="row" data-ex="${e.id}" style="grid-template-columns:8px minmax(0,1fr) auto">
      <span class="phbar" style="background:var(${PH[e.ph].c})"></span>
      <span class="mid"><b>${esc(e.name)}</b><span>${PH[e.ph].t.replace("Hauptteil · ", "")} · ${PLACE[e.place]}${e.page ? " · S. " + esc(e.page) : ""}</span></span><span class="chev">›</span></button>`).join("") || '<p class="empty">Keine Übung passt zum Filter.</p>'}</div>`;
  const qi = V.querySelector("#q"); qi.oninput = () => { q = qi.value; const p = qi.selectionStart; render(); const n2 = V.querySelector("#q"); n2.focus(); n2.setSelectionRange(p, p); };
  V.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { fph = b.dataset.ph; render(true); });
  V.querySelectorAll("[data-pl]").forEach(b => b.onclick = () => { fpl = b.dataset.pl; render(true); });
  V.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => go({ tab: "uebungen", exercise: b.dataset.ex }));
}
function viewExercise(id) {
  const e = ex(id); const td = db.today();
  const usedIn = state.trainings.filter(t => t.date >= td && t.blocks.some(b => b.ex === id));
  V.innerHTML = `<button class="back" data-back>‹ Übungen</button>
   <div class="phase-h" style="--pc:var(${PH[e.ph].c})">${PH[e.ph].t}<span class="min">${PLACE[e.place]}</span></div>
   ${exCard(e)}
   <p class="small muted">${usedIn.length ? "Eingeplant: " + usedIn.slice(0, 6).map(t => dparts(t.date).wd + " " + dparts(t.date).d + ". " + dparts(t.date).m).join(", ") + (usedIn.length > 6 ? " …" : "") : "In keinem kommenden Training eingeplant."}</p>`;
  V.querySelector("[data-back]").onclick = () => history.length > 1 ? history.back() : go({ tab: "uebungen" });
}

/* ================= Kader ================= */
function viewKader() {
  const td = db.today();
  const past = state.trainings.filter(t => t.date <= td && Object.keys(state.attendance[t.id] || {}).length);
  const ap = activePlayers(), inactive = state.players.filter(p => p.active === false);
  V.innerHTML = `
   <div class="sec-head"><h2>Kader ${esc(state.team.name)}</h2><span class="note">${ap.length} Kinder</span></div>
   <div class="card list">${ap.map(p => {
     const da = past.filter(t => state.attendance[t.id][p.id]).length;
     return `<div class="row static" style="grid-template-columns:38px minmax(0,1fr) auto">
       <span class="avatar">${esc(p.name[0] || "?")}</span>
       <span class="mid"><b>${esc(p.name)}</b><span>${p.year ? "Jahrgang " + p.year : ""}${past.length ? (p.year ? " · " : "") + da + "/" + past.length + " Trainings" : ""}</span></span>
       <button class="linkbtn" data-off="${p.id}">Austragen</button></div>`; }).join("") || '<p class="empty">Noch keine Kinder eingetragen. Füge das erste unten hinzu.</p>'}</div>
   <form class="inline card pad" id="addp"><input id="pn" placeholder="Vorname (Nachname-Initial)" required aria-label="Name" autocomplete="off">
     <input id="py" type="number" min="2010" max="2023" placeholder="Jahrgang" aria-label="Jahrgang"><button class="btn">Kind hinzufügen</button></form>
   <p class="small muted">Tipp zum Datenschutz: Vorname und Initial reichen, zum Beispiel «Luca M.».</p>
   ${inactive.length ? `<details class="card pad"><summary class="lbl">Ausgetragene Kinder (${inactive.length})</summary><div class="list">${inactive.map(p => `<div class="row static" style="grid-template-columns:minmax(0,1fr) auto"><span class="mid"><b>${esc(p.name)}</b></span><button class="linkbtn" data-on="${p.id}">Wieder aufnehmen</button></div>`).join("")}</div></details>` : ""}
   <div class="sec-head"><h2>Trainerteam</h2><span class="note">${state.people.length} Personen</span></div>
   <div class="card list">${state.people.map((p, i) => `<div class="row static" style="grid-template-columns:minmax(0,1fr) auto">
      <span class="mid"><b>${esc(p.display_name || p.email)}</b><span>${esc(p.email)} · ${p.role === "admin" ? "Admin" : "Trainer/in"}</span></span>
      <span class="stackr"><span class="pill ${p.pending ? "wait" : "ok"}">${p.pending ? "eingeladen" : "aktiv"}</span>
      ${isAdmin() && p.email !== state.user?.email ? `<button class="linkbtn" data-rm="${i}">Entfernen</button>` : ""}</span></div>`).join("")}</div>
   ${isAdmin() ? `<form class="inline card pad" id="inv">
      <input id="ie" type="email" required placeholder="E-Mail der Trainerin / des Trainers" aria-label="E-Mail">
      <input id="iname" placeholder="Name" aria-label="Name">
      <select id="irole" aria-label="Rolle"><option value="trainer">Trainer/in</option><option value="admin">Admin (darf einladen)</option></select>
      <button class="btn">Einladen</button></form>
      <p class="small muted">So funktioniert es: Die Person öffnet die App, gibt genau diese E-Mail ein und tippt auf den Link im Mail. Sie hat dann Zugriff auf diese Mannschaft.</p>` : ""}
   ${state.mode === "cloud" ? `<button class="btn ghost" data-out>Abmelden (${esc(state.user.email)})</button>` : `<button class="btn ghost" data-reset>Demo-Daten zurücksetzen</button>`}`;
  V.querySelector("#addp").onsubmit = e => { e.preventDefault(); const n = V.querySelector("#pn").value.trim(); if (n) act(() => db.addPlayer(n, +V.querySelector("#py").value || null), n + " hinzugefügt"); };
  V.querySelectorAll("[data-off]").forEach(b => b.onclick = () => act(() => db.setPlayerActive(b.dataset.off, false), "Ausgetragen"));
  V.querySelectorAll("[data-on]").forEach(b => b.onclick = () => act(() => db.setPlayerActive(b.dataset.on, true), "Wieder aufgenommen"));
  const inv = V.querySelector("#inv");
  if (inv) inv.onsubmit = e => { e.preventDefault(); act(() => db.inviteTrainer(V.querySelector("#ie").value, V.querySelector("#iname").value.trim(), V.querySelector("#irole").value), "Einladung gespeichert"); };
  V.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) act(() => db.removeMember(state.people[+b.dataset.rm]), "Entfernt");
    else { b.dataset.armed = 1; b.textContent = "Sicher? Nochmals tippen"; }
  });
  const out = V.querySelector("[data-out]"); if (out) out.onclick = () => db.signOut();
  const rs = V.querySelector("[data-reset]"); if (rs) rs.onclick = () => { db.resetDemo(); toast("Demo zurückgesetzt"); };
}

/* ================= Turniere ================= */
function viewTurniere() {
  const td = db.today();
  const all = state.tournaments.slice().sort((a, b) => a.date.localeCompare(b.date));
  const list = all.filter(u => u.date >= td);
  const cnt = s => list.filter(u => u.status === s).length;
  V.innerHTML = `
   <div class="sec-head"><h2>Turniere</h2><span class="note">${cnt("eingeteilt") + cnt("angemeldet")} fix · ${cnt("Warteliste")} Warteliste</span></div>
   <div class="card list">${list.map(u => { const d = dparts(u.date); return `<div class="row turn static">
      <span class="date tour"><span class="dw">${d.wd}</span><br><span class="dd">${d.d}</span><br><span class="dm">${d.m} ${String(d.y).slice(2)}</span></span>
      <span class="mid"><b>${esc(u.name)}</b><span>${u.time ? esc(u.time) + " · " : ""}${esc(u.place)}</span>${u.org || u.cat ? `<span>${[u.org && "Veranstalter: " + esc(u.org), esc(u.cat || "")].filter(Boolean).join(" · ")}</span>` : ""}</span>
      <span class="stackr"><select class="stsel" data-st="${u.id}" aria-label="Status">${["eingeteilt", "angemeldet", "Warteliste", "abgesagt"].map(s => `<option ${s === u.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <button class="linkbtn" data-del="${u.id}">Löschen</button></span></div>`; }).join("") || '<p class="empty">Keine kommenden Turniere.</p>'}</div>
   <form class="inline card pad" id="addu"><input id="un" placeholder="Name des Turniers" required aria-label="Name"><input id="ud" type="date" required aria-label="Datum">
     <input id="ut" placeholder="Zeit, z. B. 10:00–12:00" aria-label="Zeit"><input id="uo" placeholder="Ort" aria-label="Ort">
     <select id="us" aria-label="Status"><option>angemeldet</option><option>eingeteilt</option><option>Warteliste</option></select><button class="btn">Turnier anlegen</button></form>`;
  V.querySelector("#addu").onsubmit = e => { e.preventDefault(); act(() => db.addTournament({ name: V.querySelector("#un").value.trim(), date: V.querySelector("#ud").value, time: V.querySelector("#ut").value.trim(), place: V.querySelector("#uo").value.trim() || "Ort offen", status: V.querySelector("#us").value }), "Turnier angelegt"); };
  V.querySelectorAll("[data-st]").forEach(s => s.onchange = () => act(() => db.setTournamentStatus(s.dataset.st, s.value), "Status gespeichert"));
  V.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) act(() => db.deleteTournament(b.dataset.del), "Gelöscht");
    else { b.dataset.armed = 1; b.textContent = "Sicher? Nochmals tippen"; }
  });
}

/* ================= Wissen ================= */
let dq = "";
function docsSection() {
  if (state.mode === "demo") return `<section class="card pad stack"><h3>Dokumente</h3><p class="small muted">Die Dokumenten-Ablage mit den Kurs-PDFs gibt es nur in der echten App mit Login.</p></section>`;
  const docs = state.documents.filter(d => !dq || (d.title + " " + d.category).toLowerCase().includes(dq.toLowerCase()));
  const cats = [...new Set(state.documents.map(d => d.category))];
  const groups = [...new Set(docs.map(d => d.category))];
  const mb = b => b ? (b / 1048576 >= 1 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB") : "";
  return `<section class="card pad stack" id="docs">
    <div class="sec-head"><h3>Dokumente</h3><span class="note">${state.documents.length} PDFs</span></div>
    ${state.documents.length > 5 ? `<input class="search" id="dq" type="search" placeholder="Dokument suchen" value="${esc(dq)}" aria-label="Dokument suchen">` : ""}
    ${groups.map(g => `<div class="docgroup"><div class="doccat">${esc(g)}</div>
      ${docs.filter(d => d.category === g).map(d => `<div class="docrow">
        <a class="doclink" href="${esc(state.docUrls[d.file_path] || "#")}" target="_blank" rel="noopener">
          <span class="pdf" aria-hidden="true">PDF</span><span class="dt"><b>${esc(d.title)}</b><span>${mb(d.size_bytes)}</span></span></a>
        ${isAdmin() ? `<button class="linkbtn" data-deldoc="${d.id}">Löschen</button>` : ""}</div>`).join("")}</div>`).join("")
      || `<p class="small muted">${state.documents.length ? "Kein Dokument passt zur Suche." : "Noch keine Dokumente. " + (isAdmin() ? "Lade das erste unten hoch." : "Der Admin kann hier PDFs ablegen.")}</p>`}
    ${isAdmin() ? `<details class="addbox" ${state.documents.length ? "" : "open"}><summary class="lbl">+ PDFs hochladen</summary>
      <form id="upl" class="stack" style="margin-top:10px">
        <input id="ufile" type="file" accept="application/pdf" multiple required aria-label="PDF-Dateien">
        <input id="ucat" list="ucats" placeholder="Kategorie, z. B. J+S-Manuals" value="${esc(cats[0] || "J+S-Manuals")}" aria-label="Kategorie" required>
        <datalist id="ucats">${[...new Set([...cats, "J+S-Manuals", "Übungssammlungen", "Verein & Organisation", "Turniere & Spielbetrieb"])].map(c => `<option value="${esc(c)}">`).join("")}</datalist>
        <p class="small muted">Mehrere Dateien auf einmal möglich. Der Titel wird aus dem Dateinamen gebildet, max. 50 MB pro Datei.</p>
        <button class="btn">Hochladen</button><p class="small" id="uplmsg" aria-live="polite"></p></form></details>` : ""}
  </section>`;
}
function bindDocs() {
  const dqi = V.querySelector("#dq");
  if (dqi) dqi.oninput = () => { dq = dqi.value; const p = dqi.selectionStart; render(true); const n = V.querySelector("#dq"); n.focus(); n.setSelectionRange(p, p); };
  V.querySelectorAll("[data-deldoc]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) act(() => db.deleteDocument(state.documents.find(d => d.id === b.dataset.deldoc)), "Dokument gelöscht");
    else { b.dataset.armed = 1; b.textContent = "Sicher? Nochmals tippen"; }
  });
  const f = V.querySelector("#upl");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const files = [...V.querySelector("#ufile").files], cat = V.querySelector("#ucat").value.trim() || "Allgemein", msg = V.querySelector("#uplmsg"), btn = f.querySelector(".btn");
    btn.disabled = true; let ok = 0;
    for (const [i, file] of files.entries()) {
      msg.textContent = `Lade ${i + 1} von ${files.length}: ${file.name} …`;
      const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      try { await db.uploadDocument(file, title, cat); ok++; }
      catch (err) { console.error(err); toast(file.name + ": " + (err.message || err), true); }
    }
    toast(ok + " von " + files.length + " hochgeladen"); render(true);
  };
}
function viewWissen() {
  const bar = p => `<div class="bar">${p.map(([c, f, m, l]) => `<div style="flex:${f};background:${c}"><b>${m}</b>${l}</div>`).join("")}</div>`;
  const R = "var(--red)", K = "#141414", G = "#7a7a7a", L = "#5a5a5a";
  V.innerHTML = `
   <div class="sec-head"><h2>Wissen</h2><span class="note">Kurs & Dokumente</span></div>
   ${docsSection()}
   <section class="card pad stack"><h3>Trainingsaufbau <span class="muted small">S. 37</span></h3>
     <div class="steps">
      <div class="step"><b>Auffangen</b><p>Wer ankommt, spielt sofort: kleine Spiele (z. B. 3:3) auf vorbereiteten Kleinfeldern.</p></div>
      <div class="step"><b>Einleitung</b><p>Jedes Kind hat einen eigenen Ball, möglichst viele Ballkontakte.</p></div>
      <div class="step main"><b>Hauptteil</b><p>Fussball spielen · Fussball spielen lernen · Vielseitigkeit erleben. Das Spielen rahmt den Hauptteil ein.</p></div>
      <div class="step"><b>Ausklang</b><p>Ruhiges Spiel, Schlusswort, persönliche Verabschiedung.</p></div></div></section>
   <section class="card pad stack"><h3>Zeitplan</h3><div class="tbars">
     <div><b class="small">90 Min.</b> <span class="small muted">Beispiel Kat. E, S. 58–59</span>${bar([[G, 15, "15'", "Einleitung"], [R, 15, "15'", "Spielen"], [K, 15, "15'", "Lernen"], [L, 15, "15'", "Vielseitigk."], [R, 20, "20'", "Match"], [G, 10, "10'", "Ausklang"]])}</div>
     <div><b class="small">75 Min.</b> <span class="small muted">Beispiel Kat. G, S. 54–55</span>${bar([[G, 10, "10'", "Einleitung"], [R, 10, "10'", "Spielen"], [K, 15, "15'", "Lernen"], [L, 10, "10'", "Vielseitigk."], [R, 20, "20'", "Match"], [G, 10, "10'", "Ausklang"]])}</div>
     </div><p class="small muted">Auffangen läuft offen vor dem Trainingsbeginn.</p></section>
   <section class="card pad stack"><h3>Methodischer Fahrplan <span class="muted small">S. 41</span></h3>
     <div class="arrows"><div><b>Offen starten</b>Kinder tasten sich heran, lernen Ablauf und Regeln, probieren aus.</div><div><b>Üben</b>Fragen stellen, Lösungen anbieten, Qualität, beidseitig, viele Wiederholungen.</div><div><b>Wetteifern</b>«Wer kann?», «Wie viel schaffst du?», «Schaffst du es fehlerfrei?»</div></div></section>
   <section class="card pad"><h3>Rad der Variation <span class="muted small">S. 41</span></h3>${WHEEL_VAR}<p class="small muted">Übungen niveaugerecht erleichtern oder erschweren. Im Zentrum steht immer das Trainingsziel.</p></section>
   <section class="card pad"><h3>Motivationskreislauf <span class="muted small">S. 34</span></h3>${WHEEL_MOT}<p class="small muted">Das erste «L», das Lachen, bringt den Kreislauf zum Laufen.</p></section>
   <section class="card pad"><h3>Merkpunkte <span class="muted small">S. 52</span></h3><ul class="plain">
     <li>Alle Kinder spielen mit, keine Ersatzspieler/innen.</li><li>Jedes Kind hat (s)einen Ball und erzielt Tore.</li><li>Kleine Teams und viele Tore garantieren Erfolgserlebnisse.</li><li>Viele Wiederholungen, möglichst wenig Wartezeiten.</li><li>Dabeibleiben statt ausscheiden.</li><li>Regeln gemeinsam festlegen und einhalten.</li><li>Alle helfen beim Auf- und Abbau.</li><li>Alle begrüssen und verabschieden sich voneinander.</li></ul></section>`;
  bindDocs();
}

/* ================= Start ================= */
db.onChange(() => render(true));
(async () => {
  try { await db.init(); }
  catch (e) { console.error(e); toast("Verbindung zur Datenbank fehlgeschlagen. Bitte später erneut versuchen.", true); }
  history.replaceState(route, "");
  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

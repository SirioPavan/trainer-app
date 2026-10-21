// Oberfläche der Trainer-App
import * as db from "./store.js";
import { state } from "./store.js";
import { PH, drawDiagram } from "./diagram.js";
import { WHEEL_VAR, WHEEL_MOT } from "./wissen.js";
import * as pdf from "./pdf.js";

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


/* ================= PDF ================= */
const PDF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>';
async function makePdf(btn, job) {
  if (btn.disabled) return;
  const txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = PDF_ICON + "PDF wird erstellt …";
  try { pdf.offer(await job()); }
  catch (e) { console.error(e); toast("PDF ging nicht: " + (e.message || e), true); }
  finally { btn.disabled = false; btn.innerHTML = txt; }
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
  document.getElementById("modeBadge").textContent = state.mode === "demo" ? "Demo" : !state.user || !state.role ? "" : (isAdmin() ? "Admin" : "Trainer");
  document.getElementById("who").textContent = state.mode === "demo" ? "nur dieses Gerät" : (state.memberName || state.user?.email || "");
  document.getElementById("teamName").textContent = state.team.name;
  if (!state.user) { nav.hidden = true; top.classList.add("bare"); viewLogin(); return; }
  if (state.recovery) { nav.hidden = true; viewSetPassword(); return; }
  if (state.mode === "cloud" && !state.role) { nav.hidden = true; viewNoAccess(); return; }
  nav.hidden = false; top.classList.remove("bare");
  navEl.querySelectorAll("button").forEach(b => b.dataset.tab === route.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  const T = { trainings: "Planung", uebungen: "Übungen", kader: "Kader", turniere: "Turniere", wissen: "Wissen" };
  document.getElementById("title").textContent = route.training ? (route.training.startsWith("tpl:") ? "Vorlage" : "Training") : route.exercise ? "Übung" : T[route.tab];
  if (route.training) viewTraining(route.training);
  else if (route.exercise) viewExercise(route.exercise);
  else ({ trainings: viewDashboard, uebungen: viewLibrary, kader: viewKader, turniere: viewTurniere, wissen: viewWissen })[route.tab]();
  if (keepScroll) window.scrollTo({ top: y });
}

/* ================= Login ================= */
let loginMode = "in";
function viewLogin() {
  document.getElementById("title").textContent = "Anmelden";
  const tabs = [["in", "Anmelden"], ["up", "Erstes Mal hier?"]];
  V.innerHTML = `
   <section class="card pad login">
     <div class="seg" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-lm="${k}" aria-selected="${loginMode === k}">${l}</button>`).join("")}</div>
     ${loginMode === "in" ? `<h2>Willkommen zurück</h2>` : loginMode === "up" ? `<h2>Konto erstellen</h2>
       <p class="small">Nimm die E-Mail, mit der du eingeladen wurdest, und wähle ein eigenes Passwort (mind. 8 Zeichen).</p>` : `<h2>Passwort vergessen</h2>
       <p class="small">Du bekommst ein Mail mit einem Link. Darüber legst du ein neues Passwort fest.</p>`}
     <form id="auth" class="stack">
       <label class="lbl" for="em">E-Mail</label><input id="em" type="email" autocomplete="email" required placeholder="name@beispiel.ch">
       ${loginMode !== "reset" ? `<label class="lbl" for="pw">Passwort</label>
       <input id="pw" type="password" minlength="8" required autocomplete="${loginMode === "up" ? "new-password" : "current-password"}">` : ""}
       ${loginMode === "up" ? `<label class="lbl" for="pw2">Passwort wiederholen</label><input id="pw2" type="password" minlength="8" required autocomplete="new-password">` : ""}
       <button class="btn">${loginMode === "in" ? "Anmelden" : loginMode === "up" ? "Konto erstellen" : "Link senden"}</button></form>
     <p class="small" id="loginMsg" aria-live="polite"></p>
     ${loginMode === "in" ? `<button class="linkbtn" data-lm="reset">Passwort vergessen?</button>` : loginMode === "reset" ? `<button class="linkbtn" data-lm="in">‹ Zurück zum Anmelden</button>` : ""}
   </section>`;
  V.querySelectorAll("[data-lm]").forEach(b => b.onclick = () => { loginMode = b.dataset.lm; viewLogin(); });
  V.querySelector("#auth").onsubmit = async e => {
    e.preventDefault();
    const em = V.querySelector("#em").value.trim().toLowerCase(), msg = V.querySelector("#loginMsg"), btn = e.target.querySelector(".btn");
    const pw = V.querySelector("#pw")?.value, pw2 = V.querySelector("#pw2")?.value;
    if (loginMode === "up" && pw !== pw2) { msg.textContent = "Die beiden Passwörter stimmen nicht überein."; return; }
    btn.disabled = true; msg.textContent = "Einen Moment …";
    try {
      if (loginMode === "in") await db.signInPassword(em, pw);
      else if (loginMode === "up") await db.signUpPassword(em, pw);
      else { await db.resetPassword(em); msg.innerHTML = `Mail an <b>${esc(em)}</b> gesendet. Link öffnen und dort ein neues Passwort festlegen (evtl. im Spam-Ordner).`; btn.disabled = false; }
    } catch (err) { msg.textContent = err.message || String(err); btn.disabled = false; }
  };
}
function viewSetPassword() {
  document.getElementById("title").textContent = "Neues Passwort";
  V.innerHTML = `<section class="card pad login"><h2>Neues Passwort festlegen</h2>
    <form id="np" class="stack"><label class="lbl" for="np1">Neues Passwort (mind. 8 Zeichen)</label><input id="np1" type="password" minlength="8" required autocomplete="new-password">
    <label class="lbl" for="np2">Wiederholen</label><input id="np2" type="password" minlength="8" required autocomplete="new-password">
    <button class="btn">Speichern</button></form><p class="small" id="npMsg"></p></section>`;
  V.querySelector("#np").onsubmit = async e => {
    e.preventDefault(); const a = V.querySelector("#np1").value, b = V.querySelector("#np2").value, msg = V.querySelector("#npMsg");
    if (a !== b) { msg.textContent = "Die beiden Passwörter stimmen nicht überein."; return; }
    try { await db.setPassword(a); toast("Passwort gespeichert"); } catch (err) { msg.textContent = err.message; }
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
   ${state.mode === "demo" ? `<p class="demo-note">${state.forced ? `Vorführ-Version mit Beispieldaten: Probier alles aus, nichts davon landet in der echten Datenbank. Die Kinder-Namen sind erfunden. <a href="${location.origin + location.pathname}" class="demolink">Zur echten App mit Login →</a>` : "Demo-Modus: Die Daten bleiben nur auf diesem Gerät. Sobald die Datenbank verbunden ist, sehen alle Trainer denselben Stand."}</p>` : ""}
   ${next ? `<button class="hero" data-open="${next.id}">
     <span class="k">Nächstes Training</span><span class="d">${n.full}</span>
     <span class="meta">${next.start}–${next.end} · ${PLACE[next.place]} · ${mins(next)} Min.<br>${esc(next.thema)}</span>
     <span class="go">Training öffnen</span></button>` : `<p class="card pad empty">Keine kommenden Trainings. Lege unten eines aus einer Vorlage an.</p>`}
   ${nt ? `<button class="card pad tourcard" data-tab-go="turniere"><span class="k">Nächstes Turnier</span>
     <b>${dparts(nt.date).full}${nt.time ? " · " + esc(nt.time) : ""}</b>
     <span class="muted small">${esc(nt.place)}${nt.org ? " · Veranstalter: " + esc(nt.org) : ""}</span></button>` : ""}
   <div class="sec-head"><h2>Termine</h2><span class="note">${list.length} Trainings · ${tours.length} Turniere</span></div>
   <div class="dtools"><button class="btn ghost pdfbtn" data-planpdf>${PDF_ICON}Trainingsplan als PDF</button></div>
   <div class="chips" role="group" aria-label="Filter">
     ${[["all", "Alles"], ["train", "Trainings"], ["tour", "Turniere"]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${filt === k}">${l}</button>`).join("")}</div>
   <div class="card list">${vis.map(it => it.k === "t" ? rowT(it.o) : rowU(it.o)).join("") || '<p class="empty">Nichts geplant.</p>'}</div>
   ${items.length > 12 ? `<button class="btn ghost" data-more>${showAll ? "Weniger anzeigen" : "Alle " + items.length + " Termine anzeigen"}</button>` : ""}
   <details class="card pad addbox"><summary class="lbl">+ Training hinzufügen</summary>
     <form class="inline" id="addt" style="margin-top:10px">
       <input id="tdate" type="date" required aria-label="Datum" min="${td}">
       <select id="ttpl" aria-label="Vorlage">${state.templates.map(t => `<option value="${t.id}">${esc(t.title)} (${t.start}–${t.end})</option>`).join("")}</select>
       <button class="btn">Anlegen</button></form></details>`;
  V.querySelectorAll("[data-open]").forEach(b => b.onclick = () => go({ tab: "trainings", training: b.dataset.open }));
  V.querySelectorAll("[data-tab-go],[data-u]").forEach(b => b.onclick = () => go({ tab: "turniere" }));
  V.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filt = b.dataset.f; render(); });
  const mb = V.querySelector("[data-more]"); if (mb) mb.onclick = () => { showAll = !showAll; render(true); };
  V.querySelector("[data-planpdf]").onclick = e => makePdf(e.currentTarget, () => pdf.planPdf());
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
function videoBlock(e) {
  const own = state.links.filter(l => l.exercise_id === e.id);
  const vids = (e.videos || []);
  return `<div class="videos" data-vfor="${e.id}">
    ${vids.length || own.length ? `<span class="lbl">Videos:</span>` : ""}
    ${vids.map(v => `<a class="vlink" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="play" aria-hidden="true">▶</span>${esc(v.title)}</a>`).join("")}
    ${own.map(l => `<span class="vrow"><a class="vlink own" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="play" aria-hidden="true">▶</span>${esc(l.title)}</a><button class="linkbtn" data-dellink="${l.id}">Entfernen</button></span>`).join("")}
    <details class="addvid"><summary>+ Video-Link hinzufügen</summary>
      <form class="inline" data-addlink="${e.id}" style="margin-top:8px">
        <input name="title" placeholder="Titel, z. B. Finte vorgezeigt" required aria-label="Titel">
        <input name="url" type="url" placeholder="https://youtube.com/…" required aria-label="Link">
        <button class="btn">Speichern</button></form></details></div>`;
}
function bindVideos() {
  V.querySelectorAll("[data-addlink]").forEach(f => f.onsubmit = e => {
    e.preventDefault();
    act(() => db.addLink(f.dataset.addlink, f.title.value.trim(), f.url.value.trim()), "Video-Link gespeichert");
  });
  V.querySelectorAll("[data-dellink]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) act(() => db.deleteLink(b.dataset.dellink), "Entfernt");
    else { b.dataset.armed = 1; b.textContent = "Sicher?"; }
  });
}
function exCard(e, idx, t, surface) {
  if (!e) return `<p class="card pad empty">Übung nicht gefunden.</p>`;
  const others = t ? state.exercises.filter(x => x.ph === e.ph && x.id !== e.id) : [];
  return `<article class="card ex">${e.d ? drawDiagram(surface ? { ...e.d, s: surface } : e.d) : ""}
    <div class="body">
      <div class="tr"><h3>${esc(e.name)}</h3>${e.page ? `<span class="pg">${/^\d/.test(e.page) ? "S. " : ""}${esc(e.page)}</span>` : ""}</div>
      ${e.org ? `<p><span class="lbl">Organisation:</span> ${esc(e.org)}</p>` : ""}
      ${e.ablauf ? `<p><span class="lbl">Ablauf:</span> ${esc(e.ablauf)}</p>` : ""}
      ${e.offen ? `<div class="fahr"><div><b>Offen starten</b>${esc(e.offen)}</div><div><b>Üben</b>${esc(e.ueben)}</div><div><b>Wetteifern</b>${esc(e.wett)}</div></div>` : ""}
      ${e.own ? `<p class="own">${esc(e.own)}</p>` : ""}
      ${e.coach?.length ? `<div><span class="lbl">Coaching:</span><ul>${e.coach.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${e.var ? `<p class="var"><span class="lbl">Rad der Variation:</span> ${esc(e.var)}</p>` : ""}
      ${videoBlock(e)}
      ${t && others.length ? `<div class="swap"><label for="sw${idx}" class="muted">Übung tauschen:</label>
        <select id="sw${idx}" data-swap="${idx}"><option value="">– andere Übung derselben Phase –</option>${others.map(o => `<option value="${o.id}">${esc(o.name)} (${PLACE[o.place]})</option>`).join("")}</select></div>` : ""}
    </div></article>`;
}
const attOpen = {};
function viewTraining(id) {
  const isTpl = id.startsWith("tpl:");
  const t = isTpl ? state.templates.find(x => x.id === id.slice(4)) : state.trainings.find(x => x.id === id);
  if (!t) { route = { tab: "trainings" }; return render(); }
  const d = isTpl ? { full: "Vorlage" } : dparts(t.date), total = mins(t), a = state.attendance[t.id] || {}, ap = activePlayers(), c = attCount(t), n = ap.length;
  const used = [...new Set(t.blocks.map(b => b.ph))];
  V.innerHTML = `
   <div class="sec-head"><button class="back" data-back>‹ ${isTpl ? "Trainingsvorlagen" : "Planung"}</button><button class="btn ghost pdfbtn" data-trpdf>${PDF_ICON}Als PDF</button></div>
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
     ${n ? `<details class="more" id="attd" ${(attOpen[t.id] ?? !c) ? "open" : ""}><summary>${c ? "Liste" : "Jetzt erfassen"}</summary>
       <div class="att">${ap.slice().sort((x, y) => x.name.localeCompare(y.name, "de")).map(p => `<button data-att="${p.id}" aria-pressed="${!!a[p.id]}"><span class="dot">${a[p.id] ? "✓" : ""}</span><span>${esc(p.name)}</span></button>`).join("")}</div>
       <div class="btnrow"><button class="btn ghost" data-all>Alle anwesend</button><button class="btn ghost" data-none>Zurücksetzen</button></div></details>`
      : `<p class="small muted">Noch keine Kinder im Kader. Trage sie unter «Kader» ein.</p>`}
   </section>
   <section class="card pad stack"><label for="note" class="lbl">Notiz zum Training</label>
     <textarea id="note" rows="2" placeholder="z. B. Halle B statt A, Bälle mitnehmen">${esc(t.note || "")}</textarea></section>`}
   ${t.blocks.map((b, i) => `<section class="phase" style="--pc:var(${PH[b.ph].c})"><div class="phase-h">${PH[b.ph].t}<span class="min">${b.min} Min.</span></div>${exCard(ex(b.ex), i, isTpl ? null : t, t.place === "hall" ? "hall" : "grass")}</section>`).join("")}
   ${isTpl ? "" : `<button class="btn ghost danger" data-deltr>Training absagen und löschen</button>`}`;
  V.querySelector("[data-back]").onclick = () => history.length > 1 ? history.back() : go({ tab: isTpl ? "uebungen" : "trainings" });
  V.querySelector("[data-trpdf]").onclick = e => makePdf(e.currentTarget, () => pdf.trainingPdf(t, isTpl));
  bindVideos();
  if (isTpl) return;
  const dd = V.querySelector("#attd"); if (dd) dd.ontoggle = () => { attOpen[t.id] = dd.open; };
  V.querySelectorAll("[data-att]").forEach(b => b.onclick = () => { attOpen[t.id] = true; const p = b.dataset.att; act(() => db.setAttendance(t.id, p, !a[p])); });
  const all = V.querySelector("[data-all]"); if (all) all.onclick = () => { attOpen[t.id] = true; act(() => db.setAllAttendance(t.id, true), "Alle anwesend"); };
  const none = V.querySelector("[data-none]"); if (none) none.onclick = () => { attOpen[t.id] = true; act(() => db.setAllAttendance(t.id, false)); };
  V.querySelectorAll("[data-swap]").forEach(s => s.onchange = () => s.value && act(() => db.swapExercise(t.id, +s.dataset.swap, s.value), "Übung getauscht"));
  const note = V.querySelector("#note"); note.onchange = () => act(() => db.saveNote(t.id, note.value), "Notiz gespeichert");
  const del = V.querySelector("[data-deltr]");
  del.onclick = () => {
    if (del.dataset.armed) { act(() => db.deleteTraining(t.id), "Training gelöscht").then(() => go({ tab: "trainings" })); }
    else { del.dataset.armed = 1; del.textContent = "Wirklich löschen? Nochmals tippen"; setTimeout(() => { delete del.dataset.armed; del.textContent = "Training absagen und löschen"; }, 4000); }
  };
}

/* ================= Übungen ================= */
let q = "", fph = "all", fpl = "all", libMode = "ex";
function viewTemplates() {
  const groups = [["Eigene Planung (J+S-Manual)", state.templates.filter(t => !t.id.startsWith("tpl-sfv"))], ["SFV-Trainingskarten Kat. E", state.templates.filter(t => t.id.startsWith("tpl-sfv"))]];
  return groups.filter(g => g[1].length).map(([g, list]) => `<div class="sec-head"><h3>${esc(g)}</h3><span class="note">${list.length}</span></div>
    <div class="card list">${list.map(tp => `<button class="row" data-tpl="${tp.id}" style="grid-template-columns:minmax(0,1fr) auto">
      <span class="mid"><b>${esc(tp.title)}</b><span>${esc(tp.thema)} · ${mins(tp)}' · ${tp.blocks.length} Übungen</span></span><span class="chev">›</span></button>`).join("")}</div>`).join("")
    + `<p class="small muted">Eine Vorlage ist ein komplettes Training. Unter «Planung → + Training hinzufügen» legst du mit einer Vorlage ein Training an einem bestimmten Tag an.</p>`;
}
function viewLibrary() {
  const modeBar = `<div class="seg" role="tablist" aria-label="Ansicht">${[["ex", "Übungen"], ["tpl", "Trainingsvorlagen"]].map(([k, l]) => `<button role="tab" data-mode="${k}" aria-selected="${libMode === k}">${l}</button>`).join("")}</div>`;
  if (libMode === "tpl") {
    V.innerHTML = modeBar + viewTemplates();
    V.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { libMode = b.dataset.mode; render(); });
    V.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => go({ tab: "uebungen", training: "tpl:" + b.dataset.tpl }));
    return;
  }
  const items = state.exercises.filter(e => (fph === "all" || e.ph === fph) && true && (!q || (e.name + " " + (e.org || "") + " " + (e.ablauf || e.offen || "")).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Object.keys(PH).indexOf(a.ph) - Object.keys(PH).indexOf(b.ph));
  V.innerHTML = modeBar + `
   <div class="sec-head"><h2>Übungen</h2><span class="note">${state.exercises.length} Lernbausteine</span></div>
   <input class="search" id="q" type="search" placeholder="Übung suchen, z. B. Tigerball" value="${esc(q)}" aria-label="Übung suchen">
   <div class="chips" role="group" aria-label="Phase">${[["all", "Alle Phasen"], ["auf", "Auffangen"], ["ein", "Einleitung"], ["sp", "Spielen"], ["le", "Lernen"], ["vi", "Vielseitigkeit"], ["aus", "Ausklang"]].map(([k, l]) => `<button class="chip" data-ph="${k}" aria-pressed="${fph === k}">${l}</button>`).join("")}</div>
   <div class="card list">${items.map(e => `<button class="row" data-ex="${e.id}" style="grid-template-columns:8px minmax(0,1fr) auto">
      <span class="phbar" style="background:var(${PH[e.ph].c})"></span>
      <span class="mid"><b>${esc(e.name)}</b><span>${PH[e.ph].t.replace("Hauptteil · ", "")}${e.page ? " · " + (/^\d/.test(e.page) ? "S. " : "") + esc(e.page) : ""}${(e.videos || []).length || state.links.some(l => l.exercise_id === e.id) ? " · ▶ Video" : ""}</span></span><span class="chev">›</span></button>`).join("") || '<p class="empty">Keine Übung passt zum Filter.</p>'}</div>`;
  const qi = V.querySelector("#q"); qi.oninput = () => { q = qi.value; const p = qi.selectionStart; render(); const n2 = V.querySelector("#q"); n2.focus(); n2.setSelectionRange(p, p); };
  V.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { fph = b.dataset.ph; render(true); });
  V.querySelectorAll("[data-pl]").forEach(b => b.onclick = () => { fpl = b.dataset.pl; render(true); });
  V.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => go({ tab: "uebungen", exercise: b.dataset.ex }));
  V.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { libMode = b.dataset.mode; render(); });
}
function viewExercise(id) {
  const e = ex(id); const td = db.today();
  const usedIn = state.trainings.filter(t => t.date >= td && t.blocks.some(b => b.ex === id));
  V.innerHTML = `<button class="back" data-back>‹ Übungen</button>
   <div class="phase-h" style="--pc:var(${PH[e.ph].c})">${PH[e.ph].t}<span class="min">${PLACE[e.place]}</span></div>
   ${exCard(e)}
   <p class="small muted">${usedIn.length ? "Eingeplant: " + usedIn.slice(0, 6).map(t => dparts(t.date).wd + " " + dparts(t.date).d + ". " + dparts(t.date).m).join(", ") + (usedIn.length > 6 ? " …" : "") : "In keinem kommenden Training eingeplant."}</p>`;
  V.querySelector("[data-back]").onclick = () => history.length > 1 ? history.back() : go({ tab: "uebungen" });
  bindVideos();
}

/* ================= Kader ================= */
let shareFor = null;
const APP_URL = location.origin + location.pathname;
function inviteText(p) {
  const name = (p.display_name || "").split(" ")[0];
  return `Hallo${name ? " " + name : ""}! Du hast jetzt Zugriff auf die Trainer-App der ${state.team.name} (FC Seuzach).\n\n` +
    `1. Öffne ${APP_URL}\n2. Tippe auf «Erstes Mal hier?»\n3. Gib deine E-Mail ${p.email} ein, wähle ein eigenes Passwort und tippe auf «Konto erstellen»\n\n` +
    `Tipp: Danach im Browser-Menü «Zum Startbildschirm hinzufügen», dann hast du die App wie eine normale App auf dem Handy.`;
}
function shareBox(p) {
  const t = inviteText(p), enc = encodeURIComponent(t);
  return `<div class="sharebox"><p class="small lbl">Einladung für ${esc(p.display_name || p.email)}</p>
    <textarea readonly rows="7" id="invtext">${esc(t)}</textarea>
    <div class="btnrow" style="margin-top:6px">
      <a class="btn" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">Per WhatsApp</a>
      <a class="btn ghost" href="mailto:${esc(p.email)}?subject=${encodeURIComponent("Zugang Trainer-App " + state.team.name)}&body=${enc}">Per E-Mail</a>
      <button class="btn ghost" data-copy>Text kopieren</button></div></div>`;
}
let editP = null, openP = null, kaderMode = "kader", statRange = "season";
function statData(range) {
  const td = db.today();
  const start = { season: td.slice(0, 4) + (td.slice(5, 7) >= "07" ? "-08-01" : "-01-01"), d30: new Date(Date.now() - 30 * 864e5).toLocaleDateString("sv-SE"), hall: "2026-10-21" }[range]
    || (+td.slice(5, 7) >= 7 ? td.slice(0, 4) : String(+td.slice(0, 4) - 1)) + "-08-01";
  const trs = state.trainings.filter(t => t.date <= td && t.date >= start && Object.keys(state.attendance[t.id] || {}).length).sort((a, b) => a.date.localeCompare(b.date));
  const kids = state.players.filter(p => p.active !== false);
  const elig = (p, t) => !p.created_at || p.created_at.slice(0, 10) <= t.date || (state.attendance[t.id] || {})[p.id] !== undefined;
  const per = trs.map(t => { const a = state.attendance[t.id] || {}; const e = kids.filter(p => elig(p, t)); return { t, da: e.filter(p => a[p.id]).length, of: e.length }; });
  const byKid = kids.map(p => { const mine = trs.filter(t => elig(p, t)); const da = mine.filter(t => (state.attendance[t.id] || {})[p.id]).length; return { p, da, of: mine.length, pct: mine.length ? da / mine.length : 0 }; })
    .sort((a, b) => b.pct - a.pct || a.p.name.localeCompare(b.p.name, "de"));
  const wd = {}; per.forEach(x => { const k = WD[new Date(x.t.date + "T12:00:00").getDay()]; (wd[k] ||= []).push(x.of ? x.da / x.of : 0); });
  const tot = per.reduce((s, x) => s + x.da, 0), totOf = per.reduce((s, x) => s + x.of, 0);
  return { start, trs, per, byKid, wd, avg: totOf ? tot / totOf : 0, avgKids: per.length ? tot / per.length : 0 };
}
function viewStats() {
  const s = statData(statRange), pct = v => Math.round(v * 100) + "%";
  const lvl = v => v >= .8 ? "ok" : v >= .6 ? "wait" : "bad";
  const W = 340, H = 120, bw = s.per.length ? Math.max(4, Math.min(22, (W - 30) / s.per.length - 3)) : 10, maxN = Math.max(1, ...s.per.map(x => x.of));
  const chart = s.per.length ? `<svg class="statchart" viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="Anwesende Kinder pro Training">
    ${[0, .5, 1].map(f => `<line x1="24" x2="${W}" y1="${H - f * H + 4}" y2="${H - f * H + 4}" class="grid"/><text x="20" y="${H - f * H + 8}" text-anchor="end" class="axis">${Math.round(f * maxN)}</text>`).join("")}
    ${s.per.map((x, i) => { const h = x.da / maxN * H, xx = 28 + i * (bw + 3); return `<rect x="${xx}" y="${H - h + 4}" width="${bw}" height="${h}" rx="2" class="bar ${lvl(x.of ? x.da / x.of : 0)}"><title>${dparts(x.t.date).full}: ${x.da}/${x.of}</title></rect>${i % Math.ceil(s.per.length / 6) === 0 ? `<text x="${xx + bw / 2}" y="${H + 20}" text-anchor="middle" class="axis">${dparts(x.t.date).d}.${dparts(x.t.date).m}</text>` : ""}`; }).join("")}
  </svg>` : `<p class="empty">Noch keine erfassten Trainings in diesem Zeitraum.</p>`;
  return `<div class="chips" role="group" aria-label="Zeitraum">${[["season", "Ganze Saison"], ["hall", "Hallensaison"], ["d30", "Letzte 30 Tage"]].map(([k, l]) => `<button class="chip" data-sr="${k}" aria-pressed="${statRange === k}">${l}</button>`).join("")}</div>
   <div class="tiles">
     <div class="tile"><b>${s.trs.length}</b><span>Trainings erfasst</span></div>
     <div class="tile"><b>${pct(s.avg)}</b><span>Ø Anwesenheit</span></div>
     <div class="tile"><b>${s.avgKids.toFixed(1)}</b><span>Ø Kinder pro Training</span></div>
   </div>
   <section class="card pad stack"><h3>Kinder pro Training</h3>${chart}
     <div class="legend"><span><i class="lg ok"></i>ab 80 %</span><span><i class="lg wait"></i>60–79 %</span><span><i class="lg bad"></i>unter 60 %</span></div>
     ${Object.keys(s.wd).length ? `<p class="small muted">Nach Wochentag: ${Object.entries(s.wd).map(([k, v]) => `${k} ${pct(v.reduce((a, b) => a + b, 0) / v.length)}`).join(" · ")}</p>` : ""}</section>
   <section class="card pad stack"><h3>Pro Kind</h3>
     <div class="kidstats">${s.byKid.map(k => `<div class="ks"><span class="kn">${esc(k.p.name)}</span>
       <span class="kbar"><i class="${lvl(k.pct)}" style="width:${k.of ? k.pct * 100 : 0}%"></i></span>
       <span class="kv">${k.of ? `${k.da}/${k.of} · ${pct(k.pct)}` : "–"}</span></div>`).join("")}</div>
     <p class="small muted">Gezählt werden nur Trainings mit erfasster Anwesenheit, und für jedes Kind erst ab seinem Eintritt ins Kader.</p></section>`;
}
const tel = n => n ? `<a href="tel:${esc(n.replace(/[^+\d]/g, ""))}">${esc(n)}</a>` : "";
const mail = e => e ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : "";
function playerInfo(p) {
  const bd = p.birth_date ? p.birth_date.split("-").reverse().join(".") : "";
  const g = [[p.guardian1_name, p.guardian1_phone, p.guardian1_email], [p.guardian2_name, p.guardian2_phone, p.guardian2_email]]
    .filter(x => x[0]).filter((x, i, arr) => i === 0 || (x.join() !== arr[0].join() && x[0] !== arr[0][0]));
  const facts = [["Geboren", bd], ["Position", p.position], ["Starker Fuss", p.foot], ["Rückennummer", p.jersey ?? ""],
    ["Adresse", [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")]].filter(f => f[1] !== "" && f[1] != null);
  if (!facts.length && !g.length) return "";
  return `<div class="pinfo">${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
    ${g.map(([n, t, e]) => `<div class="guard"><b>${esc(n)}</b>${t ? `<span>📞 ${tel(t)}</span>` : ""}${e ? `<span>✉ ${mail(e)}</span>` : ""}</div>`).join("")}</div>`;
}
function importBox() {
  return `<details class="card pad addbox"><summary class="lbl">+ Clubcorner-Spielerliste importieren</summary>
    <div class="stack" style="margin-top:10px"><p class="small">CSV-Export der Spielerliste aus Clubcorner wählen. Bestehende Kinder (gleiche Passnummer) werden aktualisiert, neue hinzugefügt.</p>
    <input type="file" id="ccfile" accept=".csv,text/csv" aria-label="Clubcorner-CSV"><p class="small" id="ccmsg" aria-live="polite"></p></div></details>`;
}
function ndsBox() {
  const td = db.today(), from = td.slice(0, 4) + (td.slice(5, 7) >= "07" ? "-08-01" : "-01-01");
  const r = db.ndsExport(from, td);
  return `<section class="card pad stack"><div class="sec-head"><h3>NDS-Export</h3><span class="note">J+S-Anwesenheit</span></div>
    <p class="small">Erstellt eine CSV-Datei im Format der J+S-Anwesenheitsliste (NDS-Personen-ID, Datum, Aktivität-Typ, Anwesend) für alle Trainings mit erfasster Anwesenheit.</p>
    <form class="inline" id="ndsx"><input id="nfrom" type="date" value="${from}" aria-label="Von"><input id="nto" type="date" value="${td}" aria-label="Bis"><button class="btn">CSV herunterladen</button></form>
    <p class="small muted">Aktuell: ${r.trainings} Trainings mit Anwesenheit seit ${from.split("-").reverse().join(".")}.${r.missing.length ? ` Ohne NDS-Nr. (nicht im Export): ${r.missing.map(esc).join(", ")}.` : ""}</p></section>`;
}
function viewKader() {
  const td = db.today();
  const past = state.trainings.filter(t => t.date <= td && Object.keys(state.attendance[t.id] || {}).length);
  const ap = activePlayers().slice().sort((a, b) => a.name.localeCompare(b.name, "de")), inactive = state.players.filter(p => p.active === false);
  const seg = `<div class="seg" role="tablist" aria-label="Ansicht">${[["kader", "Kader & Team"], ["stats", "Statistik"]].map(([k, l]) => `<button role="tab" data-km="${k}" aria-selected="${kaderMode === k}">${l}</button>`).join("")}</div>`;
  if (kaderMode === "stats") {
    V.innerHTML = seg + viewStats();
    V.querySelectorAll("[data-km]").forEach(b => b.onclick = () => { kaderMode = b.dataset.km; render(); });
    V.querySelectorAll("[data-sr]").forEach(b => b.onclick = () => { statRange = b.dataset.sr; render(true); });
    return;
  }
  V.innerHTML = seg + `
   <div class="sec-head"><h2>Kader ${esc(state.team.name)}</h2><span class="note">${ap.length} Kinder</span></div>
   <div class="card list">${ap.map(p => {
     const da = past.filter(t => state.attendance[t.id][p.id]).length;
     const open = openP === p.id;
     return `<button class="row prow" data-open-p="${p.id}" aria-expanded="${open}" style="grid-template-columns:38px minmax(0,1fr) auto">
       <span class="avatar">${esc(p.name[0] || "?")}</span>
       <span class="mid"><b>${esc(p.name)}</b><span>${[p.year ? "Jg. " + p.year : "", past.length ? da + "/" + past.length + " Trainings" : "", p.nds_id ? "NDS " + esc(p.nds_id) : "ohne NDS-Nr."].filter(Boolean).join(" · ")}</span></span>
       <span class="chev">${open ? "⌄" : "›"}</span></button>
       ${open ? `<div class="pdetail">${playerInfo(p) || `<p class="small muted pad">Keine weiteren Angaben. Importiere die Clubcorner-Liste, um Eltern-Kontakte zu ergänzen.</p>`}
         <div class="btnrow pad" style="margin-top:0;padding-top:0"><button class="btn ghost" data-edit="${p.id}">${editP === p.id ? "Bearbeiten schliessen" : "Bearbeiten"}</button></div></div>` : ""}
       ${open && editP === p.id ? `<form class="inline editp" data-save="${p.id}">
         <input name="name" value="${esc(p.name)}" required aria-label="Name"><input name="year" type="number" min="2010" max="2023" value="${p.year || ""}" aria-label="Jahrgang" placeholder="Jahrgang">
         <input name="nds" value="${esc(p.nds_id || "")}" inputmode="numeric" placeholder="NDS-Personen-ID" aria-label="NDS-Personen-ID">
         <button class="btn">Speichern</button><button type="button" class="btn ghost" data-off="${p.id}">Austragen</button></form>` : ""}`; }).join("") || '<p class="empty">Noch keine Kinder eingetragen. Füge das erste unten hinzu.</p>'}</div>
   <form class="inline card pad" id="addp"><input id="pn" placeholder="Vorname (Nachname-Initial)" required aria-label="Name" autocomplete="off">
     <input id="py" type="number" min="2010" max="2023" placeholder="Jahrgang" aria-label="Jahrgang">
     <input id="pnds" inputmode="numeric" placeholder="NDS-Nr. (Passnummer)" aria-label="NDS-Personen-ID"><button class="btn">Kind hinzufügen</button></form>
   <p class="small muted">Tipp zum Datenschutz: Vorname und Initial reichen, zum Beispiel «Luca M.».</p>
   ${inactive.length ? `<details class="card pad"><summary class="lbl">Ausgetragene Kinder (${inactive.length})</summary><div class="list">${inactive.map(p => `<div class="row static" style="grid-template-columns:minmax(0,1fr) auto"><span class="mid"><b>${esc(p.name)}</b></span><button class="linkbtn" data-on="${p.id}">Wieder aufnehmen</button></div>`).join("")}</div></details>` : ""}
   ${isAdmin() ? importBox() + ndsBox() : ""}
   <div class="sec-head"><h2>Trainerteam</h2><span class="note">${state.people.length} Personen</span></div>
   <div class="card list">${state.people.map((p, i) => `<div class="row static" style="grid-template-columns:minmax(0,1fr) auto">
      <span class="mid"><b>${esc(p.display_name || p.email)}</b><span>${esc(p.email)} · ${p.role === "admin" ? "Admin" : "Trainer/in"}</span></span>
      <span class="stackr"><span class="pill ${p.pending ? "wait" : "ok"}">${p.pending ? "eingeladen" : "aktiv"}</span>
      ${isAdmin() && p.pending ? `<button class="linkbtn" data-share="${i}">${shareFor === p.email ? "Schliessen" : "Einladung senden"}</button>` : ""}
      ${isAdmin() && p.email !== state.user?.email ? `<button class="linkbtn" data-rm="${i}">Entfernen</button>` : ""}</span></div>
      ${shareFor === p.email ? shareBox(p) : ""}`).join("")}</div>
   ${isAdmin() ? `<form class="inline card pad" id="inv">
      <input id="ie" type="email" required placeholder="E-Mail der Trainerin / des Trainers" aria-label="E-Mail">
      <input id="iname" placeholder="Name" aria-label="Name">
      <select id="irole" aria-label="Rolle"><option value="trainer">Trainer/in</option><option value="admin">Admin (darf einladen)</option></select>
      <button class="btn">Einladen</button></form>
      <p class="small muted">«Einladen» schaltet die E-Mail frei. Danach schickst du der Person die Einladungsnachricht (per WhatsApp, E-Mail oder kopiert). Sie öffnet die App, tippt auf «Erstes Mal hier?» und erstellt mit genau dieser E-Mail ein Konto mit eigenem Passwort.</p>` : ""}
   ${state.mode === "cloud" ? `<details class="card pad addbox"><summary class="lbl">Mein Passwort festlegen / ändern</summary>
      <form class="inline" id="mypw" style="margin-top:10px"><input id="mypw1" type="password" minlength="8" required placeholder="Neues Passwort (mind. 8 Zeichen)" autocomplete="new-password" aria-label="Neues Passwort"><button class="btn">Speichern</button></form></details>
      <button class="btn ghost" data-out>Abmelden (${esc(state.user.email)})</button>` : `<button class="btn ghost" data-reset>Demo-Daten zurücksetzen</button>`}`;
  V.querySelectorAll("[data-km]").forEach(b => b.onclick = () => { kaderMode = b.dataset.km; render(); });
  V.querySelector("#addp").onsubmit = e => { e.preventDefault(); const n = V.querySelector("#pn").value.trim(); if (n) act(() => db.addPlayer(n, +V.querySelector("#py").value || null, V.querySelector("#pnds").value), n + " hinzugefügt"); };
  V.querySelectorAll("[data-open-p]").forEach(b => b.onclick = () => { const id = b.dataset.openP; openP = openP === id ? null : id; if (openP !== id) editP = null; render(true); });
  V.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { editP = editP === b.dataset.edit ? null : b.dataset.edit; render(true); });
  V.querySelectorAll("[data-save]").forEach(f => f.onsubmit = e => { e.preventDefault(); const id = f.dataset.save; editP = null;
    act(() => db.updatePlayer(id, { name: f.name.value.trim(), year: +f.year.value || null, nds_id: f.nds.value.trim() || null }), "Gespeichert"); });
  const cc = V.querySelector("#ccfile");
  if (cc) cc.onchange = async () => {
    const f = cc.files[0]; if (!f) return; const msg = V.querySelector("#ccmsg");
    try {
      const list = db.parseClubcorner(await f.arrayBuffer());
      msg.textContent = `${list.length} Kinder gefunden, importiere …`;
      const r = await db.importPlayers(list);
      toast(`${r.added} neu, ${r.updated} aktualisiert`); render(true);
    } catch (e) { console.error(e); msg.textContent = e.message || String(e); }
  };
  const nx = V.querySelector("#ndsx");
  if (nx) nx.onsubmit = e => {
    e.preventDefault();
    const r = db.ndsExport(V.querySelector("#nfrom").value, V.querySelector("#nto").value);
    if (!r.rows) { toast("Keine erfassten Anwesenheiten im gewählten Zeitraum", true); return; }
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `NDS_Anwesenheit_${V.querySelector("#nfrom").value}_${V.querySelector("#nto").value}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`${r.trainings} Trainings, ${r.rows} Zeilen exportiert`);
  };
  V.querySelectorAll("[data-off]").forEach(b => b.onclick = () => { editP = null; act(() => db.setPlayerActive(b.dataset.off, false), "Ausgetragen"); });
  V.querySelectorAll("[data-on]").forEach(b => b.onclick = () => act(() => db.setPlayerActive(b.dataset.on, true), "Wieder aufgenommen"));
  const inv = V.querySelector("#inv");
  if (inv) inv.onsubmit = e => { e.preventDefault(); const em = V.querySelector("#ie").value.trim().toLowerCase(); shareFor = em;
    act(() => db.inviteTrainer(em, V.querySelector("#iname").value.trim(), V.querySelector("#irole").value), "Freigeschaltet – jetzt Einladung senden"); };
  V.querySelectorAll("[data-share]").forEach(b => b.onclick = () => { const p = state.people[+b.dataset.share]; shareFor = shareFor === p.email ? null : p.email; render(true); });
  const cp = V.querySelector("[data-copy]");
  if (cp) cp.onclick = async () => { const ta = V.querySelector("#invtext");
    try { await navigator.clipboard.writeText(ta.value); toast("Text kopiert"); } catch (e) { ta.select(); toast("Text markiert – jetzt kopieren"); } };
  V.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) act(() => db.removeMember(state.people[+b.dataset.rm]), "Entfernt");
    else { b.dataset.armed = 1; b.textContent = "Sicher? Nochmals tippen"; }
  });
  const mp = V.querySelector("#mypw");
  if (mp) mp.onsubmit = e => { e.preventDefault(); act(() => db.setPassword(V.querySelector("#mypw1").value), "Passwort gespeichert"); };
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
function rulesSection() {
  return `<details class="card pad rules"><summary><h3>Turnierregeln Kat. E <span class="muted small">BRACK.CH play more football</span></h3></summary>
    <div class="rgrid">
      <div class="rbox"><b>Kleinfeld 3 vs. 3</b><ul>
        <li>Feld 25–30 × 20–25 m, Mini-Tore</li><li>Spieldauer 8–10 Min.</li>
        <li>Anspiel, Abstoss, Eckball und Einwurf flach mit dem Fuss, als Pass oder Dribbling</li>
        <li>Ball im Aus: sofort mit Ersatzball weiter. Wer zuletzt berührt hat, holt den Ball (Team kurz in Unterzahl)</li>
        <li>Kein Penalty, Freistösse indirekt, Gegner 5 Kinderschritte weg</li>
        <li>Wechsel idealerweise nach jedem Tor</li></ul></div>
      <div class="rbox"><b>Grossfeld 6 vs. 6</b><ul>
        <li>Feld 43–48 × 25–30 m, 5-m-Tore, Strafraum 10 m</li><li>Spieldauer 15 Min., mit Torspieler/in</li>
        <li>Mind. 2 verschiedene Torspieler/innen pro Turnier, Rückpass nicht in die Hände</li>
        <li>Abstoss als Abwurf aus den Händen. Legt die Torspielerin den Ball auf den Boden: führen und passen</li>
        <li>Penalty 2 Kinderschritte vor der Strafraumlinie, Freistösse indirekt</li>
        <li>Jedes Kind in den ersten 2 Runden insgesamt mind. 15 Min. im 6 vs. 6</li></ul></div>
      <div class="rbox"><b>Turnier</b><ul>
        <li>4 Teams, 6 Spielrunden nach Rotation, ca. 120 Min.</li>
        <li>Pause 3 Min. zwischen den Runden, 5–10 Min. nach 3 Runden</li>
        <li>Teamgrösse optimal 8–9 Kinder, Ball Grösse 4</li></ul></div>
      <div class="rbox"><b>Für alle</b><ul>
        <li>Kein Abseits, keine Strafen, keine Ranglisten</li>
        <li>Kinder regeln das Spiel selbst. Strittig: Schere-Stein-Papier</li>
        <li>Schienbeinschoner Pflicht, keine Stollenschuhe</li>
        <li>Shakehands nach jedem Spiel, Trainer in der Coachingzone, Eltern in der Zuschauerzone</li></ul></div>
    </div><p class="small muted">Zusammenfassung der Ausführungsbestimmungen Kat. E / FF12. Massgebend ist das Original-Dokument.</p></details>`;
}
function viewWissen() {
  const bar = p => `<div class="bar">${p.map(([c, f, m, l]) => `<div style="flex:${f};background:${c}"><b>${m}</b>${l}</div>`).join("")}</div>`;
  const R = "var(--red)", K = "#141414", G = "#7a7a7a", L = "#5a5a5a";
  V.innerHTML = `
   <div class="sec-head"><h2>Wissen</h2><span class="note">Kurs & Dokumente</span></div>
   ${docsSection()}
   ${rulesSection()}
   <section class="card pad stack"><h3>Trainingsaufbau <span class="muted small">S. 37</span></h3>
     <ol class="flow4">
      <li style="--pc:var(--p-auf)"><span class="fn">1</span><div><b>Auffangen</b><span class="fw">vor Trainingsbeginn</span><p>Wer ankommt, spielt sofort: kleine Spiele (z. B. 3:3) auf vorbereiteten Kleinfeldern.</p></div></li>
      <li style="--pc:var(--p-ein)"><span class="fn">2</span><div><b>Einleitung</b><span class="fw">10–15 Min.</span><p>Jedes Kind hat einen eigenen Ball, möglichst viele Ballkontakte.</p></div></li>
      <li class="hp4" style="--pc:var(--p-sp)"><span class="fn">3</span><div><b>Hauptteil</b><span class="fw">55–65 Min.</span>
        <div class="hpgrid">
          <span class="hpc" style="--hc:var(--p-sp)">Fussball spielen</span>
          <span class="hpc" style="--hc:var(--p-le)">Fussball spielen lernen</span>
          <span class="hpc" style="--hc:var(--p-vi)">Vielseitigkeit erleben</span>
          <span class="hpc" style="--hc:var(--p-sp)">Fussball spielen</span>
        </div><p>Das Spielen rahmt den Hauptteil ein: Am Anfang und am Ende wird gespielt, dazwischen gelernt und vielseitig bewegt.</p></div></li>
      <li style="--pc:var(--p-aus)"><span class="fn">4</span><div><b>Ausklang</b><span class="fw">ca. 10 Min.</span><p>Ruhiges Spiel, Schlusswort, persönliche Verabschiedung.</p></div></li>
     </ol></section>
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

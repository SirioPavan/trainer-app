// PDF-Export: Trainingsplan (A4 quer, max. 2 Seiten) und einzelnes Training (A4 hoch, mit Skizzen).
// Die Seiten werden als HTML gesetzt, mit html2pdf (lokal im Repo, MIT-Lizenz) gerendert und als Datei geteilt/gespeichert.
import { state, today } from "./store.js";
import { PH, drawDiagram } from "./diagram.js";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"], WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MOL = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const PLACE = { grass: "Rasen", hall: "Halle" };
// feste helle Farben – das PDF sieht auch im Dunkelmodus gleich aus
const LIGHT = { "--grass": "#3D8B4C", "--grass2": "#378145", "--wood": "#DDB884", "--wood2": "#D6AF79", "--teamA": "#E3561B", "--teamB": "#2A5BD7", "--joker": "#F2C230",
  "--p-auf": "#A8A2A2", "--p-ein": "#6E6868", "--p-sp": "#D2161E", "--p-le": "#141414", "--p-vi": "#8B1016", "--p-aus": "#4A4545" };
const fixVars = s => s.replace(/var\((--[\w-]+)\)/g, (m, k) => LIGHT[k] || m);
const pc = ph => LIGHT[PH[ph]?.c] || "#888";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const D = iso => new Date(iso + "T12:00:00");
const dshort = iso => { const d = D(iso); return WD[d.getDay()] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "."; };
const dlong = iso => { const d = D(iso); return WDL[d.getDay()] + ", " + d.getDate() + ". " + MOL[d.getMonth()] + " " + d.getFullYear(); };
const dch = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const ex = id => state.exercises.find(e => e.id === id);
const mins = t => t.blocks.reduce((a, b) => a + b.min, 0);
const SHORT = { auf: "Auffangen", ein: "Einleitung", sp: "Fussball spielen", le: "Fussball spielen lernen", vi: "Vielseitigkeit", aus: "Ausklang" };

/* ---------- Bibliothek nachladen (nur beim ersten PDF) ---------- */
let libP;
function loadLib() {
  if (window.html2pdf) return Promise.resolve();
  return libP ||= new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = "html2pdf.bundle.min.js"; s.onload = ok;
    s.onerror = () => { libP = null; bad(new Error("PDF-Baustein konnte nicht geladen werden (offline?)")); };
    document.head.appendChild(s);
  });
}

/* ---------- Seitenbau: Inhalte fliessen auf A4-Seiten ---------- */
const SIZE = { landscape: [1123, 794], portrait: [794, 1123] };
function makeHost(orient) {
  const host = document.createElement("div");
  host.className = "pdfhost";
  host.style.width = SIZE[orient][0] + "px";
  document.body.appendChild(host);
  return host;
}
function newPage(host, orient, head) {
  const [w, h] = SIZE[orient];
  const p = document.createElement("div");
  p.className = "pdfp " + orient;
  p.style.width = w + "px"; p.style.height = (h - 2) + "px";
  p.innerHTML = head + `<div class="pdfp-body"></div><div class="pdfp-foot"></div>`;
  host.appendChild(p);
  return p;
}
// Elemente der Reihe nach einfüllen; passt eines nicht mehr, beginnt eine neue Seite
function flow(host, orient, head, items) {
  let body = newPage(host, orient, head).querySelector(".pdfp-body");
  for (const html of items) {
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    body.appendChild(el);
    if (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) {
      el.remove();
      body = newPage(host, orient, head).querySelector(".pdfp-body");
      body.appendChild(el);
    }
  }
  return [...host.querySelectorAll(".pdfp")];
}
function footers(pages, left) {
  pages.forEach((p, i) => p.querySelector(".pdfp-foot").innerHTML = `<span>${left}</span><span>Seite ${i + 1} von ${pages.length}</span>`);
}
function headBand(title, sub, right) {
  return `<header class="pdf-band"><img src="logo-white.png" alt=""><div class="pdf-tt"><span class="pdf-club">FC Seuzach · ${esc(state.team?.name || "E-Junioren")}</span><b>${esc(title)}</b>${sub ? `<span class="pdf-sub">${sub}</span>` : ""}</div>${right ? `<div class="pdf-right">${right}</div>` : ""}</header>`;
}

/* ---------- Rendern ---------- */
async function render(pages, orient, name) {
  await loadLib();
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all([...pages[0].ownerDocument.querySelectorAll(".pdfhost img")].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const [w] = SIZE[orient];
  const opt = { margin: 0, filename: name, image: { type: "jpeg", quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: orient }, pagebreak: { mode: [] } };
  let wk = window.html2pdf().set(opt).from(pages[0]).toPdf();
  for (const p of pages.slice(1)) wk = wk.get("pdf").then(pdf => pdf.addPage()).from(p).toContainer().toCanvas().toPdf();
  return await wk.outputPdf("blob");
}
async function build(orient, fill, name) {
  const host = makeHost(orient);
  try {
    const pages = fill(host);
    const blob = await render(pages, orient, name);
    return { blob, name, pages: pages.length };
  } finally { host.remove(); }
}

/* ---------- 1) Trainingsplan als Übersicht ---------- */
const COLS = [["auf"], ["ein"], ["sp"], ["le"], ["vi"], ["aus"]];
function planItems(from) {
  const tr = state.trainings.filter(t => t.date >= from).map(t => ({ k: "t", date: t.date, s: t.start, o: t }));
  const tu = state.tournaments.filter(u => u.date >= from && u.status !== "abgesagt").map(u => ({ k: "u", date: u.date, s: "", o: u }));
  return [...tr, ...tu].sort((a, b) => a.date.localeCompare(b.date) || (a.k === "u" ? 1 : -1) || a.s.localeCompare(b.s));
}
function planRow(it, skip) {
  if (it.k === "u") {
    const u = it.o;
    return `<tr class="pdf-tour"><td class="c-d">${dshort(u.date)}</td><td class="c-z">${esc(u.time || "")}</td>
      <td colspan="${1 + COLS.length}"><b>${/^turnier/i.test(u.name) ? "" : "Turnier · "}${esc(u.name)}</b> · ${esc(u.place || "")}${u.org ? " · " + esc(u.org) : ""}<span class="pdf-st">${esc(u.status)}</span></td></tr>`;
  }
  const t = it.o;
  const sel = ph => { const bl = t.blocks.filter(b => b.ph === ph), keep = bl.filter(b => !skip.has(b.ex)); return keep.length ? keep : bl; };
  const cell = ph => [...new Set(sel(ph).map(b => ex(b.ex)?.name).filter(Boolean))].map(esc).join(" + ");
  const mm = ph => sel(ph).reduce((a, b) => a + b.min, 0);
  return `<tr><td class="c-d">${dshort(t.date)}</td><td class="c-z">${t.start}–${t.end}<br><span class="pdf-mut">${PLACE[t.place]} · ${mins(t)}'</span></td>
    <td class="c-t"><b>${esc(t.thema)}</b></td>${COLS.map(([ph]) => `<td>${cell(ph)}${mm(ph) ? `<span class="pdf-min">${mm(ph)}'</span>` : ""}</td>`).join("")}</tr>`;
}
export async function planPdf() {
  const from = today();
  const items = planItems(from);
  if (!items.length) throw new Error("Keine kommenden Termine");
  const last = items[items.length - 1].date, nT = items.filter(i => i.k === "t").length, nU = items.length - nT;
  const head = headBand("Trainingsplan", `${dch(from)} bis ${dch(last)} · ${nT} Trainings · ${nU} Turniere`, `Stand ${dch(from)}`);
  const thead = `<table class="pdf-plan"><colgroup><col style="width:66px"><col style="width:84px"><col style="width:150px">${COLS.map(() => "<col>").join("")}</colgroup>
    <thead><tr><th>Datum</th><th>Zeit · Ort</th><th>Thema</th>${COLS.map(([ph]) => `<th style="border-top-color:${pc(ph)}">${SHORT[ph]}</th>`).join("")}</tr></thead><tbody></tbody></table>`;
  // Übungen, die in (fast) jedem Training vorkommen (z. B. der Abschluss-Match), nur einmal in der Fusszeile nennen
  const trs = items.filter(i => i.k === "t").map(i => i.o), cnt = {};
  trs.forEach(t => new Set(t.blocks.map(b => b.ex)).forEach(id => cnt[id] = (cnt[id] || 0) + 1));
  const skip = new Set(trs.length >= 4 ? Object.keys(cnt).filter(id => cnt[id] >= trs.length * 0.8) : []);
  const always = [...skip].map(id => ex(id)?.name).filter(Boolean);
  // Monatsüberschriften dazwischen
  const rows = []; let mon = "";
  for (const it of items) {
    const m = it.date.slice(0, 7);
    if (m !== mon) { mon = m; const d = D(it.date); rows.push(`<tr class="pdf-month"><td colspan="${3 + COLS.length}">${MOL[d.getMonth()]} ${d.getFullYear()}</td></tr>`); }
    rows.push(planRow(it, skip));
  }
  const name = `Trainingsplan_${(state.team?.name || "E-Junioren").replace(/\W+/g, "-")}_${from}.pdf`;
  // Schrift schrittweise verkleinern, bis alles auf 2 Seiten passt
  return build("landscape", host => {
    let pages;
    for (const fs of [10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7]) {
      host.innerHTML = "";
      pages = flowRows(host, head, thead, rows, fs);
      if (pages.length <= 2) break;
    }
    footers(pages, "FC Seuzach · Trainer-App" + (always.length ? " · In jedem Training zusätzlich: " + always.map(esc).join(", ") : "") + " · Zahlen = Minuten");
    return pages;
  }, name);
}
// Tabellenzeilen auf Seiten verteilen; jede Seite bekommt den Tabellenkopf
function flowRows(host, head, thead, rows, fs) {
  let page, tb, body;
  const fresh = () => { page = newPage(host, "landscape", head); page.style.setProperty("--pfs", fs + "px"); body = page.querySelector(".pdfp-body"); body.innerHTML = thead; tb = body.querySelector("tbody"); };
  fresh();
  for (const r of rows) {
    const tmp = document.createElement("tbody"); tmp.innerHTML = r;
    const tr = tmp.firstElementChild; tb.appendChild(tr);
    if (body.scrollHeight > body.clientHeight + 1 && tb.children.length > 1) {
      tr.remove();
      const carry = tb.lastElementChild?.classList.contains("pdf-month") ? tb.lastElementChild : null;
      if (carry) carry.remove();
      fresh(); if (carry) tb.appendChild(carry); tb.appendChild(tr);
    }
  }
  return [...host.querySelectorAll(".pdfp")];
}

/* ---------- 2) Einzelnes Training ---------- */
// Skizze als Bild mit fester Grösse – so übernimmt html2canvas den ganzen Ausschnitt
const SKW = 220, SKH = Math.round(SKW * 74 / 110);
function sketchImg(d, place) {
  const svg = fixVars(drawDiagram({ ...d, s: place === "hall" ? "hall" : "grass" }))
    .replace("<svg ", `<svg width="${SKW * 2}" height="${SKH * 2}" `);
  return `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" width="${SKW}" height="${SKH}" alt="">`;
}
function exBlock(b, place) {
  const e = ex(b.ex);
  const ph = `<div class="pdf-ph" style="border-color:${pc(b.ph)}"><i style="background:${pc(b.ph)}"></i>${esc(PH[b.ph]?.t || b.ph)}<span>${b.min} Min.</span></div>`;
  if (!e) return `<section class="pdf-ex">${ph}<p class="pdf-mut">Übung nicht gefunden.</p></section>`;
  const sk = e.d ? `<div class="pdf-sk">${sketchImg(e.d, place)}</div>` : "";
  return `<section class="pdf-ex">${ph}<div class="pdf-exb">${sk}<div class="pdf-ext">
    <h4>${esc(e.name)}${e.page ? `<span class="pdf-pg">${/^\d/.test(e.page) ? "S. " : ""}${esc(e.page)}</span>` : ""}</h4>
    ${e.org ? `<p><b>Organisation:</b> ${esc(e.org)}</p>` : ""}
    ${e.ablauf ? `<p><b>Ablauf:</b> ${esc(e.ablauf)}</p>` : ""}
    ${e.offen ? `<div class="pdf-fahr"><div><b>Offen starten</b>${esc(e.offen)}</div><div><b>Üben</b>${esc(e.ueben)}</div><div><b>Wetteifern</b>${esc(e.wett)}</div></div>` : ""}
    ${e.own ? `<p>${esc(e.own)}</p>` : ""}
    ${e.coach?.length ? `<p><b>Coaching:</b></p><ul>${e.coach.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
    ${e.var ? `<p class="pdf-var"><b>Variation:</b> ${esc(e.var)}</p>` : ""}
  </div></div></section>`;
}
export async function trainingPdf(t, isTpl) {
  const total = mins(t);
  const title = isTpl ? (t.title || "Trainingsvorlage") : dlong(t.date);
  const head = headBand(title, `${t.start}–${t.end} · ${PLACE[t.place]} · ${total} Min.${isTpl ? "" : " · " + esc(t.thema)}`, "");
  const intro = `<div class="pdf-intro"><dl class="pdf-facts">
      <dt>Thema</dt><dd>${esc(t.thema)}</dd><dt>Ziel</dt><dd>${esc(t.ziel)}</dd><dt>Fragen</dt><dd>${esc(t.fragen)}</dd><dt>Material</dt><dd>${esc(t.material)}</dd>
      ${t.note ? `<dt>Notiz</dt><dd>${esc(t.note)}</dd>` : ""}</dl>
    <div class="pdf-tl">${t.blocks.map(b => `<div style="flex:${b.min};background:${pc(b.ph)}"><b>${b.min}'</b><span>${SHORT[b.ph]}</span></div>`).join("")}</div></div>`;
  const items = [intro, ...t.blocks.map(b => exBlock(b, t.place))];
  const name = isTpl ? `Vorlage_${(t.title || "Training").replace(/\W+/g, "-")}.pdf` : `Training_${t.date}_${(t.thema || "").replace(/[^\wäöüÄÖÜ]+/g, "-")}.pdf`;
  return build("portrait", host => {
    const pages = flow(host, "portrait", head, items);
    footers(pages, `FC Seuzach · ${isTpl ? esc(t.title || "") : dch(t.date) + " · " + esc(t.thema)}`);
    return pages;
  }, name);
}

/* ---------- Ergebnis: teilen oder speichern ---------- */
export function offer({ blob, name, pages }) {
  const file = new File([blob], name, { type: "application/pdf" });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const url = URL.createObjectURL(blob);
  const box = document.createElement("div");
  box.className = "pdfsheet";
  box.innerHTML = `<div class="pdfsheet-in" role="dialog" aria-label="PDF bereit">
    <b>PDF bereit</b><span class="muted small">${esc(name)} · ${pages} ${pages === 1 ? "Seite" : "Seiten"}</span>
    <div class="btnrow">${canShare ? `<button class="btn" data-share>Teilen …</button>` : ""}
      <a class="btn ${canShare ? "ghost" : ""}" href="${url}" download="${esc(name)}" data-dl>Herunterladen</a>
      <button class="btn ghost" data-close>Schliessen</button></div></div>`;
  document.body.appendChild(box);
  const close = () => { box.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  box.querySelector("[data-close]").onclick = close;
  box.onclick = e => { if (e.target === box) close(); };
  const sh = box.querySelector("[data-share]");
  if (sh) sh.onclick = () => navigator.share({ files: [file], title: name.replace(/\.pdf$/, "") }).then(close).catch(() => {});
  box.querySelector("[data-dl]").onclick = () => setTimeout(close, 400);
}

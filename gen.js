// Übungsgenerator (ohne KI): wählt die passendste Übung aus der Bibliothek und passt sie
// an die Situation an – Kinderzahl, Bälle, Tore, Material, Untergrund und Schwierigkeit
// (nach dem Rad der Variation: Raum, Zeit, Regeln, Anzahl, Material).

export const FOCUS = {
  dribbeln: ["Dribbeln und 1:1", /dribbel|finte|1:1|1 gegen 1|übersteiger|ausweich|tempo/i],
  passen: ["Passen und Zusammenspiel", /pass|zuspiel|anbiet|freilauf|kombin|rondo|zusammen/i],
  schiessen: ["Torschuss", /schuss|schiess|abschluss|tor erzielen|treff/i],
  erobern: ["Ball erobern", /erober|jagen|verteidig|umschalt|zweikampf|stehlen|klau/i],
  koordination: ["Koordination und Bewegung", /parcours|fangis|fangen|stafette|balanc|hüpf|lauf|reaktion|signal/i],
  spass: ["Spass und Teamgeist", /team|geschichte|pirat|zoo|feuer|hai|ritual|lustig|spiel/i]
};
const NEEDS = {
  goals: /minitor|(?<!kegel)tor(?!hüter)|handballtor|5-m-tor|unihockeytor/i,
  mats: /matte|bank|kasten|langbank/i,
  hoops: /reifen|ringe/i,
  bibs: /leibchen|überzieher/i,
  everyBall: /jede[sr]? (kind|spielerin)[^.]{0,20}(mit )?ball|jedes kind hat einen ball|alle (kinder )?(haben|mit) (einen )?ball/i
};
const AREA = { G: { hall: 15, grass: 25 }, F: { hall: 20, grass: 32 }, E: { hall: 25, grass: 40 }, EW: { hall: 25, grass: 40 } };
const EASIER = [
  ["Raum", "Feld etwas grösser machen – mehr Zeit und Platz am Ball."],
  ["Anzahl", "Eine Jokerin / ein Joker spielt immer mit dem Team in Ballbesitz (Überzahl)."],
  ["Regeln", "Berührungen frei, kein Zeitdruck."],
  ["Material", "Grössere Tore oder breitere Kegeltore."],
  ["Regeln", "Verteidigung startet etwas später (z. B. erst nach dem ersten Pass)."]
];
const HARDER = [
  ["Raum", "Feld verkleinern – weniger Zeit am Ball."],
  ["Regeln", "Nur zwei Ballkontakte pro Kind."],
  ["Regeln", "Nur mit dem schwächeren Fuss."],
  ["Zeit", "Zeitlimit: Abschluss innert 10 Sekunden."],
  ["Material", "Kleinere Tore oder schmalere Kegeltore."],
  ["Anzahl", "Unterzahl für das angreifende Team (z. B. 2 gegen 3)."]
];
const PHASE_MIN = { auf: [8, 10], ein: [10, 15], sp: [12, 20], le: [15, 20], vi: [10, 12], aus: [5, 10] };

// kleiner, reproduzierbarer Zufall
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const textOf = e => [e.name, e.org, e.ablauf, e.offen, e.ueben, e.wett, (e.coach || []).join(" "), e.var].filter(Boolean).join(" ");
const round5 = x => Math.max(5, Math.round(x / 5) * 5);

function score(e, o) {
  const t = textOf(e); let s = 0;
  if (e.place === o.place || e.both) s += 3;
  if (o.focus && FOCUS[o.focus][1].test(t)) s += 4;
  if (!o.goals && NEEDS.goals.test(t)) s -= 2;
  if (o.goals && NEEDS.goals.test(t)) s += 1;
  if (!o.mats && NEEDS.mats.test(t)) s -= 3;
  if (!o.hoops && NEEDS.hoops.test(t)) s -= 1;
  if (e.d) s += 1;
  return s;
}

// Spielform «3:3», «2 gegen 1» usw. im Text finden
function spielform(t) {
  const all = [...t.matchAll(/(\d)\s*(?::|gegen|vs\.?)\s*(\d)/gi)].map(m => [+m[1], +m[2]]).filter(([a, b]) => a >= 1 && b >= 1 && a <= 7 && b <= 7);
  return all.length ? all.sort((x, y) => (y[0] + y[1]) - (x[0] + x[1]))[0] : null;   // grösste Spielform im Text
}

export function generate(exercises, o, seed = 1) {
  const R = rng(seed * 7919 + o.n * 31 + (o.balls || 0));
  const pool = exercises.filter(e => e.ph === o.phase);
  if (!pool.length) return null;
  let ranked = pool.map(e => ({ e, s: score(e, o) + R() * 1.5 })).sort((a, b) => b.s - a.s);
  const fresh = ranked.filter(r => !(o.exclude || []).includes(r.e.id)).slice(0, 6);   // «Andere Variante»: bereits gezeigte Übungen überspringen
  if (fresh.length) ranked = fresh;
  const base = ranked[Math.min(ranked.length - 1, Math.floor(R() * Math.min(3, ranked.length)))].e;
  const t = textOf(base), n = Math.max(2, o.n | 0), lv = AREA[o.level] ? o.level : "E";
  const notes = [];

  // Organisation: Teams/Felder bzw. Gruppen
  const sf = spielform(t);
  let org, L, W, swapForm = null;
  const dims = players => { L = Math.max(8, Math.round(Math.sqrt(AREA[lv][o.place] * players * 1.33))); W = Math.max(6, Math.round(L * 0.75)); };
  if (sf && sf[0] === 1 && sf[1] === 1 && o.phase !== "vi") {   // 1:1-Duelle: Paare im Wechsel
    const stations = Math.max(1, Math.round(n / 4)), wait = n - stations * 2;
    dims(4);
    org = `${n} Kinder: ${stations} ${stations === 1 ? "Duellfeld" : "Duellfelder"} à ca. ${L} × ${W} m, pro Feld spielen zwei Kinder 1 gegen 1` +
      (wait > 0 ? `, die übrigen ${wait} warten kurz am Feldrand und lösen nach jedem Duell ab.` : ".");
  } else if (sf && sf[0] === sf[1] && o.phase !== "vi") {     // Spielform k gegen k
    const per = sf[0] * 2, fields = Math.max(1, Math.round(n / per));
    const sizes = Array.from({ length: fields }, (_, i) => Math.floor(n / fields) + (i < n % fields ? 1 : 0));
    const desc = s => s % 2 ? `${(s - 1) / 2} gegen ${(s - 1) / 2} plus Joker` : `${s / 2} gegen ${s / 2}`;
    const k = Math.floor(sizes[0] / 2);
    dims(sizes[0]);
    swapForm = [new RegExp(`${sf[0]}\\s*(:|gegen|vs\\.?)\\s*${sf[1]}`, "gi"), `${k}:${k}`];
    const kinds = [...new Set(sizes)];
    org = `${n} Kinder: ${fields} ${fields === 1 ? "Feld" : "Felder"} – ` +
      kinds.map(s => `${sizes.filter(x => x === s).length > 1 && kinds.length > 1 ? sizes.filter(x => x === s).length + "× " : ""}${desc(s)}`).join(", ") +
      `, je ca. ${L} × ${W} m.` + (sizes.some(s => s % 2) ? " Joker spielt immer mit dem Team in Ballbesitz, nach jedem Tor wechseln." : "");
  } else if (sf && o.phase !== "vi") {                          // Übungsform a gegen b (z. B. 2:1)
    const per = sf[0] + sf[1], groups = Math.max(1, Math.floor(n / per)), rest = n - groups * per;
    dims(per * 2);
    org = `${n} Kinder: ${groups} ${groups === 1 ? "Gruppe" : "Gruppen"} à ${per} (${sf[0]} gegen ${sf[1]}) parallel, Feld je ca. ${L} × ${W} m` +
      (rest > 0 ? `, ${rest} ${rest === 1 ? "Kind wechselt" : "Kinder wechseln"} nach jedem Durchgang ein.` : ".");
  } else {
    const groups = Math.max(1, Math.ceil(n / 4));
    dims(Math.min(n, 16));
    org = `${n} Kinder, Feld ca. ${L} × ${W} m. ` + (/kolonne|stafette|reihe|nacheinander/i.test(t)
      ? `${groups} ${groups === 1 ? "Gruppe" : "Gruppen"} à höchstens 4 Kinder, damit niemand lange wartet.`
      : "Alle gleichzeitig in Bewegung.");
  }
  // Feldmasse im Originaltext an die neue Grösse anpassen
  const baseOrg = (base.org || "").replace(/^(Halle|Rasen)( oder (Halle|Rasen))?\.\s*/i, "")
    .replace(/(ca\.\s*)?\d+\s*[×x]\s*\d+\s*m/g, `ca. ${L} × ${W} m`)
  const fixForm = x => x && swapForm ? x.replace(swapForm[0], swapForm[1]) : x;

  // Bälle
  const needEvery = NEEDS.everyBall.test(t);
  if (o.balls < n && needEvery) notes.push(o.balls >= Math.ceil(n / 2) ? `Nur ${o.balls} Bälle: zu zweit mit einem Ball, abwechselnd.` : `Nur ${o.balls} Bälle: in Kleingruppen mit einem Ball pro Gruppe, kurze Wechsel.`);
  else if (o.balls === 0) notes.push("Ohne Bälle: als Lauf- oder Fangform durchführen.");

  // Tore
  if (NEEDS.goals.test(t)) {
    if (!o.goals) notes.push("Keine Tore vorhanden: Kegeltore (2 Kegel, ca. 1.5 m) oder eine Endlinie, auf der der Ball gestoppt wird.");
    else if (o.goals === "mini2") notes.push("Zwei Minitore: je eines pro Seite. Fehlende Tore mit Kegeltoren ergänzen.");
    else if (o.goals === "mini4") notes.push("Vier Minitore: zwei pro Seite – mehr Tore und mehr Abschlüsse gleichzeitig.");
    else if (o.goals === "big") notes.push("Grosse Tore: mit Torhüter/in, die nach jeder Runde wechselt.");
  }
  if (!o.mats && NEEDS.mats.test(t)) notes.push("Ohne Matten/Bank: Stationen mit Kegeln oder Linien markieren.");
  if (!o.hoops && NEEDS.hoops.test(t)) notes.push("Ohne Reifen: Kegelquadrate oder Teller als Felder verwenden.");
  if (!o.bibs && NEEDS.bibs.test(t)) notes.push("Ohne Leibchen: Teams z. B. mit Mütze/Shirt-Farbe unterscheiden.");

  // Schwierigkeit nach dem Rad der Variation
  const list = o.diff === "easy" ? EASIER : o.diff === "hard" ? HARDER : [];
  const pick = list.slice().sort(() => R() - 0.5).slice(0, 2);

  // Material
  const mat = [o.balls ? `${o.balls} Bälle` : null, o.goals === "mini2" ? "2 Minitore" : o.goals === "mini4" ? "4 Minitore" : o.goals === "big" ? "2 grosse Tore" : NEEDS.goals.test(t) ? "Kegel für Kegeltore" : null,
    o.cones !== false ? "Kegel/Hütchen" : null, o.hoops ? "Reifen" : null, o.mats ? "Matten/Bank" : null, o.bibs ? "Leibchen in 2–3 Farben" : null].filter(Boolean);
  const [m1, m2] = PHASE_MIN[o.phase] || [10, 15];

  // Skizze: Untergrund anpassen, fehlende Tore durch Kegel ersetzen
  let d = base.d ? JSON.parse(JSON.stringify(base.d)) : null;
  if (d) {
    d.s = o.place === "hall" ? "hall" : "grass";
    if (!o.goals) d.items = d.items.flatMap(it => it[0] === "m" ? [["c", it[1], it[2] - 4], ["c", it[1], it[2] + 4]]
      : it[0] === "G" ? [["c", it[1] === "L" ? 1 : 99, 26], ["c", it[1] === "L" ? 1 : 99, 38]] : [it]);
  }

  const diffLbl = o.diff === "easy" ? "leichter" : o.diff === "hard" ? "schwerer" : "";
  return {
    id: "gen-" + base.id + "-" + seed, ph: o.phase, place: o.place, both: false,
    name: fixForm(base.name) + (diffLbl ? ` (${diffLbl})` : "") + " – angepasst",
    org: org + (baseOrg ? " Aufbau: " + fixForm(baseOrg) : ""),
    ablauf: base.ablauf, offen: base.offen, ueben: base.ueben, wett: base.wett,
    coach: base.coach, var: base.var || null,
    own: ["Angepasst: " + [...notes, ...pick.map(([k, v]) => `${k} – ${v}`)].join(" ") , `Dauer ${m1}–${m2} Min. · Material: ${mat.join(", ")}`].filter(x => x !== "Angepasst: ").join(" · "),
    gen: { base: base.id, baseName: base.name, page: base.page, minutes: `${m1}–${m2} Min.`, material: mat.join(", "), notes, changes: pick, focus: o.focus ? FOCUS[o.focus][0] : null },
    d, page: null, src: "Übungsgenerator, Basis: " + base.name + (base.page ? ` (S. ${base.page})` : "")
  };
}

// Trainingsplanung: erzeugt eine Serie von Trainings nach dem J+S-Aufbau
// (Auffangen · Einleitung · Hauptteil: Spielen, Lernen, Vielseitigkeit, Match · Ausklang)
// mit wechselnden Themen und abwechselnden Übungen.

export const PHASES = ["auf", "ein", "sp", "le", "vi", "sp", "aus"];
const BASE90 = [10, 12, 15, 20, 10, 15, 8];
const FIXED = { 75: [8, 10, 12, 15, 10, 12, 8], 90: BASE90, 60: [5, 8, 10, 13, 8, 10, 6] };
export const WDN = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Minuten auf die 7 Blöcke verteilen
export function splitMinutes(total) {
  if (FIXED[total]) return FIXED[total].slice();
  const m = BASE90.map(x => Math.max(3, Math.round(x * total / 90)));
  m[3] += total - m.reduce((a, b) => a + b, 0);
  return m;
}
export const minutesBetween = (a, b) => { const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number); return h2 * 60 + m2 - h1 * 60 - m1; };

// Themen je Stufe. ein/sp/le = bevorzugte Übungen (IDs); fehlt etwas, nimmt der Planer passende Übungen aus der Bibliothek.
export const THEMES = {
  E: [
    { name: "Den Ball entschlossen erobern", ziel: "Die Kinder jagen den Ball nach Ballverlust sofort und schliessen nach Ballgewinn schnell ab.",
      fragen: "Wie hast du den Ball erobert? Was hast du nach dem Ballgewinn als Erstes gemacht?",
      ein: ["ex15", "ex40", "ex27", "ex02"], sp: ["ex42", "ex43", "ex03", "ex16"], le: ["ex17", "ex04", "ex48"] },
    { name: "Breite und Tiefe", ziel: "Die Kinder können Breite und Tiefe schaffen: Die Blume öffnet sich bei eigenem Ballbesitz (S. 70).",
      fragen: "Hat sich die Blume geöffnet und konnte dich die Sonne anscheinen, oder standst du im Schatten? (S. 70)",
      ein: ["ex22", "ex09", "ex41"], sp: ["ex44", "ex45", "ex10", "ex23"], le: ["ex24", "ex49", "ex50", "ex11"] },
    { name: "Mutig Tore erzielen", ziel: "Die Kinder können den Ball beidfüssig präzise aufs Tor schiessen (S. 75).",
      fragen: "Hast du die freie Ecke auf dem Foto festgehalten und getroffen? (S. 75)",
      ein: ["ex37", "ex02", "ex38"], sp: ["ex16", "ex10", "ex44"], le: ["ex28", "ex54", "ex52"] },
    { name: "Überzahl nutzen", ziel: "Die Kinder erkennen Überzahl und nutzen sie mit schnellem Zusammenspiel zum Torerfolg.",
      fragen: "Wann hast du gepasst, wann selbst gedribbelt? Warum?",
      ein: ["ex09", "ex39", "ex22"], sp: ["ex45", "ex03", "ex16"], le: ["ex46", "ex47", "ex31", "ex11"] },
    { name: "Dribbling und Finten", ziel: "Die Kinder suchen mutig das 1:1, kennen passende Finten und wenden diese an (S. 65).",
      fragen: "Wie hast du das Dribbling gemacht? Was ist dir gut gelungen, was kannst du noch besser machen? (S. 65)",
      ein: ["ex40", "ex34", "ex15"], sp: ["ex42", "ex23", "ex43"], le: ["ex53", "ex17", "ex04"] },
    { name: "Freilaufen und Passen", ziel: "Die Kinder können sich freilaufen und anbieten: Die Sonne scheint dich an (S. 70).",
      fragen: "Was kannst du tun, damit deine Pässe noch präziser ankommen? (S. 70)",
      ein: ["ex39", "ex41", "ex09"], sp: ["ex23", "ex44", "ex45"], le: ["ex51", "ex35", "ex24"] }
  ],
  F: [{"name":"Dribbeln und 1:1","ziel":"Die Kinder suchen mutig das 1:1 und setzen eine Finte ein.","fragen":"Welche Finte hat heute geklappt?","ein":["f09","f05","f06"],"sp":["f16","f11"],"le":["f17","f21"]},{"name":"Tore schiessen","ziel":"Die Kinder schliessen mit links und rechts mutig ab.","fragen":"Wohin hast du gezielt?","ein":["f08","f10"],"sp":["f13","f14"],"le":["f20","f18"]},{"name":"Passen und Freilaufen","ziel":"Die Kinder passen flach zum freien Gspändli und bieten sich an.","fragen":"Wo hast du dich hingestellt, damit du den Ball bekommst?","ein":["f07","f10"],"sp":["f13","f14"],"le":["f19","f22"]},{"name":"Ball erobern und umschalten","ziel":"Die Kinder jagen den Ball nach Ballverlust sofort und schalten nach Ballgewinn schnell um.","fragen":"Was machst du sofort nach dem Ballgewinn?","ein":["f06","f05"],"sp":["f11","f16"],"le":["f21","f17"]},{"name":"Zusammenspiel 2:1","ziel":"Die Kinder erkennen Überzahl und entscheiden: selber gehen oder passen.","fragen":"Wann hast du gepasst, wann bist du selber gegangen?","ein":["f07","f09"],"sp":["f14","f13"],"le":["f18","f19"]},{"name":"Orientierung: Kopf hoch","ziel":"Die Kinder schauen vor der Ballannahme, wo es frei ist.","fragen":"Was hast du gesehen, bevor der Ball kam?","ein":["f10","f05"],"sp":["f13","f16"],"le":["f22","f19"]}],
  G: [{"name":"Ich und mein Ball","ziel":"Die Kinder führen den Ball mit vielen kleinen Berührungen und können ihn auf Zuruf stoppen.","fragen":"Mit welchem Teil vom Fuss hast du den Ball gestoppt?","ein":["gr07","gr08","gr01","g05","g08","g12"],"sp":["g13","g17"],"le":["gr22","gr18","gr21","g23"]},{"name":"Tore schiessen","ziel":"Die Kinder schiessen mutig mit links und rechts aufs Tor.","fragen":"Wohin hast du geschaut, bevor du geschossen hast?","ein":["gr10","gr01","g11","g07"],"sp":["g15","g16","g17"],"le":["gr20","gr25","gr16","gr26","g21","g24"]},{"name":"Dribbeln und Ausweichen","ziel":"Die Kinder dribbeln mutig auf den Gegner zu und weichen ihm aus.","fragen":"Wie bist du am Fuchs vorbeigekommen?","ein":["gr03","gr05","gr12","g09","g12","g06"],"sp":["g19","g13"],"le":["gr15","gr23","g22","g25"]},{"name":"Ball erobern","ziel":"Die Kinder wollen den Ball zurück, sobald sie ihn verloren haben.","fragen":"Was machst du, wenn der andere den Ball hat?","ein":["gr08","gr12","g07","g09"],"sp":["g16","g20"],"le":["gr17","gr23","gr15","g22","g25"]},{"name":"Zusammen spielen","ziel":"Die Kinder spielen den Ball dem freien Gspändli zu.","fragen":"Wann hast du deinem Freund den Ball gegeben?","ein":["gr01","gr02","g10","g07"],"sp":["g20","g15"],"le":["gr24","gr27","gr22","g26","g23"]},{"name":"Feuerwehr und Tiere","ziel":"Die Kinder reagieren schnell auf Signale und wechseln das Tempo mit Ball.","fragen":"Welches Tier war am schnellsten?","ein":["gr11","gr04","gr06","g06","g08","g05"],"sp":["g13","g19"],"le":["gr19","gr28","gr17","g21","g26"]}]
};
export const MATERIAL = {
  hall: "Handballtore oder Minitore, Markierkegel und -teller, Reifen, Hallenbälle (Gr. 4), Überzieher in 3 Farben",
  grass: "Minitore, Markierkegel und -teller, Bälle (Gr. 4), Überzieher in 3 Farben, Stangen"
};
export const themesFor = level => (THEMES[level]?.length ? THEMES[level] : THEMES.E);

/* Serie erzeugen
   opt = { from, to, slots:[{wd, start, end, place}], holidays:[[von,bis]], skip:Set(Daten), themes:[…], exercises:[…], offset } */
export function generateSeries(opt) {
  const { from, to, slots, holidays = [], skip = new Set(), themes, exercises, offset = 0, material = MATERIAL } = opt;
  const inHol = iso => holidays.some(([a, b]) => a && b && iso >= a && iso <= b);
  const byId = Object.fromEntries(exercises.map(e => [e.id, e]));
  const pools = {};
  const pool = (ph, place) => (pools[ph + place] ||= (() => {
    const all = exercises.filter(e => e.ph === ph);
    const same = all.filter(e => e.place === place);
    return (same.length >= 2 ? same : all).slice().sort((a, b) => a.id.localeCompare(b.id));
  })());
  const used = {};   // Zähler pro Pool, damit sich Übungen abwechseln
  const next = (ph, place, avoid) => {
    const p = pool(ph, place); if (!p.length) return null;
    const k = ph + place; let i = used[k] || 0, e = p[i % p.length];
    if (avoid && e.id === avoid && p.length > 1) { i++; e = p[i % p.length]; }
    used[k] = i + 1; return e.id;
  };
  const isMatch = e => /match|abschlussspiel|turnierspiel/i.test(e.name);
  const rows = [];
  let n = offset;
  const d0 = new Date(from + "T12:00:00Z"), d1 = new Date(to + "T12:00:00Z");
  for (let d = d0; d <= d1; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10), wd = d.getUTCDay();
    if (inHol(iso) || skip.has(iso)) continue;
    for (const s of slots.filter(x => +x.wd === wd)) {
      const th = themes[n % themes.length], round = Math.floor(n / themes.length);
      const fav = (list, ph) => {
        const ok = (list || []).filter(id => byId[id] && byId[id].ph === ph);
        const okPlace = ok.filter(id => byId[id].place === s.place);
        const L = okPlace.length ? okPlace : ok;
        return L.length ? L[round % L.length] : null;
      };
      const ein = fav(th.ein, "ein") || next("ein", s.place);
      const sp = fav(th.sp, "sp") || next("sp", s.place);
      const le = fav(th.le, "le") || next("le", s.place);
      const matchPool = pool("sp", s.place).filter(isMatch).sort((a, b) => (a.levels?.length || 9) - (b.levels?.length || 9));   // stufeneigener Match zuerst
      const match = matchPool.length ? matchPool[0].id : next("sp", s.place, sp);
      const ex = [next("auf", s.place), ein, sp, le, next("vi", s.place), match, next("aus", s.place)];
      const min = splitMinutes(minutesBetween(s.start, s.end));
      const blocks = PHASES.map((ph, i) => ({ ph, min: min[i], ex: ex[i] })).filter(b => b.ex);
      rows.push({ date: iso, start_time: s.start, end_time: s.end, place: s.place, template_id: null,
        thema: th.name, ziel: th.ziel, fragen: th.fragen, material: material[s.place] || "", blocks });
      n++;
    }
  }
  return rows;
}

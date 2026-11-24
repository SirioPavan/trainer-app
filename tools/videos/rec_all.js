// How-to-Videos der Trainer-App: klickt sich durch die Demo und speichert Standbilder (Dauer, Szene, Klick).
// Aufruf: node rec_all.js <name>
const { chromium } = require('playwright');
const fs = require('fs'), { execSync } = require('child_process');
const NAME = process.argv[2];
const OUT = `/home/claude/video/f_${NAME}`; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const list = []; let n = 0, scene = 0;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, locale: 'de-CH' });
  const p = await ctx.newPage();
  if (NAME === 'pdf') await p.addInitScript(() => { navigator.canShare = () => true; navigator.share = async () => {}; });   // Teilen-Knopf wie auf dem Handy zeigen
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  if (NAME === 'start') {
    await p.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript', body: `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({error:null}),signUp:async()=>({data:{},error:null})},from:()=>({select:async()=>({data:[]})}),rpc:async()=>({data:null})})};` }));
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(1500);
  } else { await p.goto('http://localhost:8765/?demo'); await p.waitForTimeout(1500); }
  await p.addStyleTag({ content: `
    .toast{display:none!important}
    #vcap{pointer-events:none;position:fixed;left:14px;right:14px;bottom:104px;z-index:9999;background:#141414;color:#fff;border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.35);border-left:6px solid #D2161E;font-family:'Source Sans 3',sans-serif}
    #vcap b{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;color:#FF6B70;line-height:1;min-width:26px}
    #vcap span{font-size:18px;line-height:1.3;font-weight:600}
    #vtap{position:fixed;z-index:9998;border-radius:50%;border:4px solid #FFD21F;background:rgba(255,210,31,.22);box-shadow:0 0 0 2px #141414,inset 0 0 0 2px #141414;pointer-events:none;display:none;transform:translate(-50%,-50%)}` });
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'vcap'; c.style.display = 'none'; document.body.append(c); const t = document.createElement('div'); t.id = 'vtap'; document.body.append(t); });

  const snap = async (sec, click = false) => { const f = `${OUT}/${String(n++).padStart(4, '0')}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); list.push({ f, d: sec, scene, click }); };
  const still = (f, sec) => list.push({ f, d: sec, scene, click: false });
  const cap = async (num, txt, top = false) => { scene = num; await p.evaluate(([num, txt, top]) => { const c = document.getElementById('vcap'); c.style.display = 'flex'; c.style.top = top ? '130px' : ''; c.style.bottom = top ? 'auto' : ''; c.innerHTML = `<b>${num}</b><span>${txt}</span>`; }, [num, txt, top]); };
  const ring = (x, y, s) => p.evaluate(([x, y, s]) => { const t = document.getElementById('vtap'); Object.assign(t.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', display: 'block' }); }, [x, y, s]);
  const noTap = () => p.evaluate(() => { document.getElementById('vtap').style.display = 'none'; });
  const center = async sel => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox(); return [bx.x + bx.width / 2, bx.y + bx.height / 2]; };
  const pulse = async (x, y) => { await ring(x, y, 64); await snap(0.25); await ring(x, y, 50); await snap(0.25); await ring(x, y, 42); await snap(0.35, true); };
  const tap = async (sel, after = 1.6, doClick = true) => { const [x, y] = await center(sel); await pulse(x, y); if (doClick) await p.click(sel); await noTap(); await p.waitForTimeout(450); await snap(after); };
  const type = async (sel, text, step = 2) => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await p.click(sel);
    for (let i = step; i < text.length + step; i += step) { await p.fill(sel, text.slice(0, i)); await snap(0.1); } };
  const scrollTo = async (sel, off) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - o); }, [sel, off]); await p.waitForTimeout(300); };

  const S = {
    start: async () => {
      await cap(1, 'Link öffnen: siriopavan.github.io/trainer-app', true); await snap(2.2);
      await cap(2, '«Erstes Mal hier?» antippen', true); await tap('[data-lm=up]', 1.4);
      await cap(3, 'Die E-Mail, an die du eingeladen wurdest, und ein eigenes Passwort', true);
      await type('#em', 'laura@beispiel.ch', 2); for (const id of ['#pw', '#pw2']) { if (await p.$(id)) { await p.click(id); await p.fill(id, 'Geheim1234'); await snap(0.4); } } await snap(1.0);
      { const b2 = await p.$$('#auth button'); for (const x of b2) if ((await x.textContent()).includes('Konto erstellen')) await x.evaluate(e => e.id = 'mkacc'); }
      await cap(4, '«Konto erstellen» – und du bist drin', true); await tap('#mkacc', 1.6, false);
      const html = `<html><body style="margin:0;width:390px;height:844px;background:#141414;color:#fff;font-family:'Source Sans 3';padding:120px 26px 0;box-sizing:border-box">
        <p style="font-family:'Barlow Condensed';font-weight:700;letter-spacing:.2em;color:#FF6B70;font-size:15px;margin:0 0 6px;text-transform:uppercase">Tipp</p>
        <h1 style="font-family:'Barlow Condensed';font-weight:800;font-size:46px;line-height:.95;margin:0 0 26px;text-transform:uppercase">Als App auf den Home-Bildschirm</h1>
        ${[['iPhone (Safari)', 'Unten auf «Teilen» <b>⬆︎</b> tippen, dann «Zum Home-Bildschirm».'], ['Android (Chrome)', 'Oben rechts auf <b>⋮</b> tippen, dann «App installieren» oder «Zum Startbildschirm hinzufügen».']].map(([h, t]) =>
          `<div style="background:#1f1d1d;border-radius:16px;padding:16px 18px;margin-bottom:14px;border-left:6px solid #D2161E"><b style="font-size:20px">${h}</b><p style="margin:6px 0 0;font-size:18px;line-height:1.35;color:#e8e2e2">${t}</p></div>`).join('')}
        <p style="font-size:18px;color:#d8d0d0;line-height:1.35">Danach startest du die Trainer-App wie jede andere App – mit dem FC-Seuzach-Wappen.</p></body></html>`;
      fs.writeFileSync(`${OUT}/inst.html`, html); const q = await ctx.newPage(); await q.goto(`file://${OUT}/inst.html`); await q.waitForTimeout(300);
      scene = 5; await q.screenshot({ path: `${OUT}/zz_inst.jpg`, type: 'jpeg', quality: 92 }); still(`${OUT}/zz_inst.jpg`, 4.0); await q.close();
    },
    import: async () => {
      fs.writeFileSync('/home/claude/video/clubcorner_demo.csv', 'Name;Vorname;Geburtsdatum;Passnummer\nAebi;Aaron;12.03.2016;9900001\nAmmann;Alina;04.07.2016;9900002\nArnold;Amir;21.01.2017;9900003\n');
      await cap(1, 'Unten auf «Kader» tippen'); await snap(1.0); await tap('[data-tab=kader]', 1.6);
      await cap(2, '«Clubcorner-Spielerliste importieren» öffnen'); await scrollTo('.addbox summary', 300); await snap(1.0);
      { const s = await p.$$('summary'); for (const x of s) { if ((await x.textContent()).includes('Clubcorner')) { await x.evaluate(e => e.id = 'ccsum'); break; } } }
      await tap('#ccsum', 1.6);
      await cap(3, 'CSV-Datei aus Clubcorner auswählen'); await snap(1.0); await tap('#ccfile', 0.4, false);
      await p.setInputFiles('#ccfile', '/home/claude/video/clubcorner_demo.csv'); await p.waitForTimeout(1200); await snap(1.0);
      await cap(4, 'Fertig: neue Kinder sind im Kader'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await snap(1.0);
      await scrollTo('[data-open-p]', 230); await snap(3.0);
    },
    anwesenheit: async () => {
      await cap(1, 'Auf der Startseite «Training öffnen»'); await snap(1.2); await tap('.go', 1.6);
      await cap(2, 'Nach unten zur Anwesenheit, «Liste» antippen'); await p.evaluate(() => { const d = document.querySelector('[data-attd]'); d.open = false; d.querySelector('summary').textContent = 'Liste'; });
      await scrollTo('[data-attd]', 250); await snap(1.4); await tap('[data-attd] > summary', 0.4); await scrollTo('[data-attd]', 150); await snap(1.4);
      await cap(3, 'Anwesende Kinder antippen'); await snap(0.8);
      const kids = await p.$$('[data-att]'); for (let i = 0; i < Math.min(7, kids.length); i++) { const sel = `[data-att]:nth-of-type(${i + 1})`;
        const id = await kids[i].getAttribute('data-att'); await tap(`[data-att="${id}"]`, 0.35); }
      await snap(1.2);
      await cap(4, 'Auch die Leiter/innen abhaken'); { const l = await p.$$('[data-lead]'); if (l.length) { await scrollTo('.attl', 260); await snap(0.8);
        for (const x of l.slice(0, 2)) { const id = await x.getAttribute('data-lead'); await tap(`[data-lead="${id}"]`, 0.5); } } } await snap(1.4);
      await cap(5, 'Fertig – alles wird sofort gespeichert'); await scrollTo('[data-attd]', 200); await snap(3.0);
    },
    pdf: async () => {
      await cap(1, 'Auf der Startseite «Training öffnen»'); await snap(1.2); await tap('.go', 1.6);
      await cap(2, 'Oben rechts «Als PDF» antippen'); await snap(0.8);
      const dl = p.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await tap('[data-trpdf]', 0.2); await p.waitForSelector('.pdfsheet', { timeout: 30000 }); await p.waitForTimeout(300);
      await cap(3, 'Teilen (z. B. per WhatsApp) oder herunterladen', true); await snap(2.4);
      await tap('.pdfsheet [data-dl]', 0.3); const d = await dl;
      if (d) { await d.saveAs(`${OUT}/t.pdf`); execSync(`pdftoppm -r 110 -f 1 -l 1 -png ${OUT}/t.pdf ${OUT}/pg`);
        const pg = fs.readdirSync(OUT).find(f => f.startsWith('pg') && f.endsWith('.png'));
        const html = `<html><body style="margin:0;width:390px;height:844px;background:#141414;display:flex;align-items:center;justify-content:center"><img src="file://${OUT}/${pg}" style="width:370px;box-shadow:0 10px 30px rgba(0,0,0,.6);border-radius:6px"></body></html>`;
        fs.writeFileSync(`${OUT}/pg.html`, html); const q = await ctx.newPage(); await q.goto(`file://${OUT}/pg.html`); await q.waitForTimeout(300);
        scene = 4; await q.screenshot({ path: `${OUT}/zz_pdf.jpg`, type: 'jpeg', quality: 92 }); still(`${OUT}/zz_pdf.jpg`, 4.0); await q.close(); }
    },
    einladen: async () => {
      await cap(1, 'Unten auf «Kader» tippen'); await snap(1.0); await tap('[data-tab=kader]', 1.4);
      await cap(2, 'Nach unten zum Trainerteam'); await scrollTo('#inv', 330); await snap(2.0);
      await cap(3, 'E-Mail, Name und Rolle eintragen'); await type('#ie', 'laura@beispiel.ch', 2); await type('#iname', 'Laura Muster', 2);
      await p.selectOption('#irole', 'trainer'); await snap(1.4);
      await cap(4, '«Einladen» antippen'); await tap('#inv button', 1.0);
      await p.waitForSelector('.sharebox'); await scrollTo('.sharebox', 160);
      await p.evaluate(() => { const t = document.querySelector('#invtext'); t.value = t.value.replace(/http:\/\/localhost:8765\/(\?demo)?/g, 'https://siriopavan.github.io/trainer-app/'); });
      await snap(2.0);
      await cap(5, '«Per WhatsApp» – Nachricht ist fertig vorbereitet'); await tap('.sharebox a[href^="https://wa.me"]', 2.5, false); await snap(1.0);
    },
    turniere: async () => {
      await cap(1, 'Unten auf «Turniere» tippen'); await snap(1.0); await tap('[data-tab=turniere]', 2.4);
      await cap(2, 'Neues Turnier unten anlegen – oder aus Excel einlesen'); await scrollTo('#addu', 420); await snap(0.8);
      await type('#un', 'Hallencup Seuzach', 3); await p.evaluate(() => { const d = document.querySelector('#ud'); d.type = 'text'; d.value = '16.01.2027'; }); await snap(0.5); await type('#ut', '09:00–12:00', 3); await type('#uo', 'Turnhalle', 3); await snap(1.0);
      { const sm = await p.$$('details.card > summary.lbl'); for (const x of sm) if ((await x.textContent()).includes('einlesen')) await x.evaluate(e => e.id = 'impsum'); }
      await tap('#impsum', 2.0);
      await cap(3, '«Trainer & Anwesenheit» antippen'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await snap(0.6);
      await tap('[data-topen]', 1.0); await scrollTo('.tatt', 130); await snap(1.4);
      { const kids = await p.$$('.tatt [data-att]'); for (const k of kids.slice(0, 4)) { const id = await k.getAttribute('data-att'); await tap(`.tatt [data-att="${id}"]`, 0.35); } } await snap(1.0);
      await cap(4, 'Nächstes Turnier auf der Startseite – Turnierregeln unter «Wissen»'); await tap('[data-tab=trainings]', 0.3); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await snap(2.0);
      await tap('[data-tab=wissen]', 0.6); await scrollTo('details.rules', 200); await snap(0.6); await tap('details.rules > summary', 0.6); await scrollTo('details.rules', 140); await snap(2.0);
      await cap(5, 'Vergangene Turniere nachtragen – NDS: als «Wettkampf»'); await tap('[data-tab=turniere]', 1.0);
      { const sm = await p.$$('details.card > summary.lbl'); for (const x of sm) if ((await x.textContent()).includes('Vergangene')) await x.evaluate(e => e.id = 'pastsum'); }
      if (await p.$('#pastsum')) { await tap('#pastsum', 0.6); await scrollTo('#pastsum', 160); await snap(2.6); } else await snap(2.6);
    },
    nds: async () => {
      await cap(1, 'Unten auf «Kader» tippen'); await snap(1.0); await tap('[data-tab=kader]', 1.4);
      await cap(2, 'Nach unten zum «NDS-Export»'); await scrollTo('#ndsx', 230); await snap(2.2);
      await cap(3, 'Zeitraum ab Kursbeginn und Orte prüfen'); await tap('#nfrom', 1.2, false); await tap('#ohall', 1.6, false);
      await scrollTo('[data-kind=akt]', 330); await snap(0.6);
      await cap(4, 'Zuerst «1 · Aktivitäten» herunterladen'); await tap('[data-kind=akt]', 1.8);
      await cap(5, 'Danach «2 · Anwesenheiten» herunterladen'); await tap('[data-kind=awk]', 1.8);
      await cap(6, 'In der NDS in derselben Reihenfolge importieren'); await snap(3.0);
    }
  };
  await S[NAME]();
  fs.writeFileSync(`/home/claude/video/list_${NAME}.json`, JSON.stringify(list));
  console.log(NAME, 'frames', list.length, 'sek', list.reduce((s, x) => s + x.d, 0).toFixed(1), 'scenes', [...new Set(list.map(x => x.scene))].join(','), 'errs', errs);
  await b.close();
})();

// Pilotvideo «Übung erfassen», langsam: Standbilder mit Dauer, Szenen und Klick-Zeitpunkten.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'tools/videos/frames2'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const list = []; let n = 0, scene = 0;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('http://localhost:8765/?demo'); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: `
    .toast{display:none!important}
    #vcap{position:fixed;left:14px;right:14px;bottom:104px;z-index:9999;background:#141414;color:#fff;border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.35);border-left:6px solid #D2161E;font-family:'Source Sans 3',sans-serif}
    #vcap b{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;color:#FF6B70;line-height:1;min-width:26px}
    #vcap span{font-size:18px;line-height:1.3;font-weight:600}
    #vtap{position:fixed;z-index:9998;border-radius:50%;border:4px solid #D2161E;background:rgba(210,22,30,.18);pointer-events:none;display:none;transform:translate(-50%,-50%)}` });
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'vcap'; c.style.display = 'none'; document.body.append(c); const t = document.createElement('div'); t.id = 'vtap'; document.body.append(t); });

  const snap = async (sec, click = false) => { const f = `${OUT}/${String(n++).padStart(4, '0')}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); list.push({ f, d: sec, scene, click }); };
  const cap = async (num, txt) => { scene = num; await p.evaluate(([num, txt]) => { const c = document.getElementById('vcap'); c.style.display = 'flex'; c.innerHTML = `<b>${num}</b><span>${txt}</span>`; }, [num, txt]); };
  const ring = (x, y, s) => p.evaluate(([x, y, s]) => { const t = document.getElementById('vtap'); Object.assign(t.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', display: 'block' }); }, [x, y, s]);
  const noTap = () => p.evaluate(() => { document.getElementById('vtap').style.display = 'none'; });
  const pulse = async (x, y) => { await ring(x, y, 64); await snap(0.25); await ring(x, y, 50); await snap(0.25); await ring(x, y, 42); await snap(0.35, true); };
  const tap = async (sel, after = 1.6) => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox();
    await pulse(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.click(sel); await noTap(); await p.waitForTimeout(400); await snap(after); };
  const type = async (sel, text, step = 2) => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await p.click(sel);
    for (let i = step; i < text.length + step; i += step) { await p.fill(sel, text.slice(0, i)); await snap(0.1); } };
  const scrollTo = async (sel, off) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - o); }, [sel, off]); await p.waitForTimeout(250); };
  const fieldTap = async (fx, fy, after = 0.5) => { const r = await (await p.$('#edfield svg')).boundingBox(); const x = r.x + r.width * fx, y = r.y + r.height * fy;
    await ring(x, y, 46); await snap(0.3, true); await p.mouse.click(x, y); await noTap(); await p.waitForTimeout(150); await snap(after); };

  await cap(1, 'Unten auf «Übungen» tippen'); await snap(1.0); await tap('[data-tab=uebungen]', 1.8);
  await cap(2, 'Oben «Generator» wählen'); await snap(0.8); await tap('[data-mode=gen]', 1.8);
  await cap(3, '«Eigene Übung erfassen» antippen'); await snap(0.8); await tap('[data-gt=edit]', 1.8);
  await cap(4, 'Name eingeben, Phase und Ort wählen'); await scrollTo('#edf [name=name]', 230); await snap(1.0);
  await type('#edf [name=name]', 'Fische fangen', 1); await snap(0.8);
  await p.selectOption('#edf [name=ph]', 'ein'); await snap(1.0); await p.selectOption('#edf [name=where]', 'hall'); await snap(1.6);
  await cap(5, 'Werkzeug wählen, dann aufs Feld tippen'); await scrollTo('.edtools', 96); await snap(1.2);
  await tap('[data-tool=A]', 0.8);
  for (const [x, y] of [[.3, .35], [.45, .65], [.62, .4]]) await fieldTap(x, y);
  await tap('[data-tool=B]', 0.8);
  for (const [x, y] of [[.2, .7], [.75, .65]]) await fieldTap(x, y);
  await tap('[data-tool=c]', 0.8);
  for (const [x, y] of [[.08, .1], [.92, .1], [.08, .9], [.92, .9]]) await fieldTap(x, y, 0.35);
  await snap(1.5);
  await cap(6, 'Laufweg: Werkzeug wählen und mit dem Finger ziehen'); await snap(1.0); await tap('[data-tool=run]', 1.2);
  { const r = await (await p.$('#edfield svg')).boundingBox(); const a = [r.x + r.width * .3, r.y + r.height * .35], z = [r.x + r.width * .55, r.y + r.height * .2];
    await ring(a[0], a[1], 46); await snap(0.6, true); await p.mouse.move(a[0], a[1]); await p.mouse.down();
    for (let i = 1; i <= 12; i++) { const x = a[0] + (z[0] - a[0]) * i / 12, y = a[1] + (z[1] - a[1]) * i / 12; await p.mouse.move(x, y); await ring(x, y, 46); await snap(0.1); }
    await p.mouse.up(); await noTap(); await p.waitForTimeout(200); await snap(2.0); }
  await cap(7, 'Ablauf und Coaching-Punkte eintragen'); await scrollTo('#edf [name=ablauf]', 200); await snap(1.0);
  await type('#edf [name=ablauf]', 'Die Fischer (rot) fangen die Fische (blau). Wer gefangen ist, wird selbst zum Fischer.', 3); await snap(0.8);
  await scrollTo('#edf [name=coach]', 260);
  await type('#edf [name=coach]', 'Kopf hoch\nRichtungswechsel nutzen', 2); await snap(1.5);
  await cap(8, '«Übung speichern» – fertig!'); await scrollTo('#edf button.btn:not(.ghost)', 380); await snap(1.0);
  await tap('#edf button.btn:not(.ghost)', 0.6); await p.waitForTimeout(500); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await cap(8, 'Die Übung steht jetzt allen Trainer/innen deiner Mannschaft zur Verfügung'); await snap(3.0);
  fs.writeFileSync('tools/videos/list2.json', JSON.stringify(list));
  console.log('frames', list.length, 'sek', list.reduce((s, x) => s + x.d, 0).toFixed(1), 'errs', errs);
  await b.close();
})();

"""Baut ein How-to-Video aus den Standbildern, Titelkarten, Computerstimme (Piper/Thorsten) und Klicks."""
import json, wave, subprocess, sys, base64, os
import numpy as np

V = {
 "uebung": ("Eigene Übung erfassen", "In 8 Schritten zur eigenen Übung mit Skizze.", [
   "Hallo zusammen! So erfasst du eine eigene Übung in der Trainer-App.",
   "Tippe unten auf Übungen.", "Wähle oben den Generator.", "Dann tippst du auf: Eigene Übung erfassen.",
   "Gib einen Namen ein, und wähle Phase und Ort.",
   "Jetzt kommt die Skizze. Wähle ein Werkzeug, zum Beispiel Team Rot, und tippe aufs Feld. Genauso mit Team Blau und den Hütchen.",
   "Für einen Laufweg wählst du Laufweg, und ziehst mit dem Finger.",
   "Danach trägst du den Ablauf und die Coaching-Punkte ein.",
   "Zum Schluss: Übung speichern. Fertig! Jetzt sieht das ganze Trainerteam deine Übung."]),
 "start": ("Erste Schritte", "Konto erstellen und die App aufs Handy holen.", [
   "Hallo zusammen! So startest du mit der Trainer-App.",
   "Öffne den Link zur Trainer-App, den du mit der Einladung bekommen hast.",
   "Tippe auf: Erstes Mal hier.",
   "Gib die E-Mail ein, an die du eingeladen wurdest, und wähle ein eigenes Passwort.",
   "Tippe auf: Konto erstellen. Und schon bist du drin.",
   "Tipp: Hol dir die App auf den Home-Bildschirm. Auf dem iPhone über Teilen, und Zum Home-Bildschirm. Auf Android über das Menü, und App installieren."]),
 "import": ("Team importieren", "Kinder aus Clubcorner in einem Schritt übernehmen.", [
   "Hallo zusammen! So importierst du dein Team aus Clubcorner.",
   "Exportiere zuerst in Clubcorner die Spielerliste als CSV-Datei. Dann tippst du in der App unten auf Kader.",
   "Öffne: Clubcorner-Spielerliste importieren.",
   "Wähle die CSV-Datei aus. Die App liest alle Kinder ein.",
   "Fertig! Neue Kinder werden hinzugefügt, bestehende werden aktualisiert."]),
 "anwesenheit": ("Anwesenheit erfassen", "Wer war im Training? In wenigen Sekunden erfasst.", [
   "Hallo zusammen! So erfasst du die Anwesenheit im Training.",
   "Tippe auf der Startseite auf: Training öffnen.",
   "Scrolle nach unten zur Anwesenheit.",
   "Tippe alle Kinder an, die da sind.",
   "Hake auch die Leiterinnen und Leiter ab. Das braucht es für den NDS-Export.",
   "Fertig! Alles wird sofort gespeichert."]),
 "pdf": ("Training als PDF", "Das Trainingsblatt für den Platz – aufs Handy oder zum Ausdrucken.", [
   "Hallo zusammen! So erstellst du ein Training als PDF.",
   "Tippe auf der Startseite auf: Training öffnen.",
   "Oben rechts tippst du auf: Als PDF.",
   "Jetzt kannst du das PDF teilen, zum Beispiel per WhatsApp, oder herunterladen.",
   "So sieht das Trainingsblatt aus: Ablauf, Zeiten und alle Übungen mit Skizze."]),
 "einladen": ("Trainer/in einladen", "Neue Trainer/innen in zwei Minuten dabei.", [
   "Hallo zusammen! So lädst du eine neue Trainerin oder einen neuen Trainer ein.",
   "Tippe unten auf Kader.",
   "Scrolle nach unten zum Trainerteam.",
   "Trage E-Mail und Namen ein, und wähle die Rolle.",
   "Tippe auf: Einladen.",
   "Mit: Per WhatsApp, schickst du die fertige Einladung. Die Person tippt dann in der App auf: Erstes Mal hier, und erstellt ihr Konto."]),
 "turniere": ("Turniere", "Anlegen, Trainer einteilen, Anwesenheit – und ab in die NDS.", [
   "Hoi zäme. I däm Video zeig ich eu, wie ihr i de App Turnier verwalted.",
   "Under Turnier gsehnd ihr alli chömede Turnier mit Datum, Ort und Status.",
   "Es neus Turnier leged ihr une aa, oder ihr läsed sie us em Excel ii.",
   "Tippet es Turnier aa: Trainer und Aawäseheit.",
   "S nächste Turnier chunnt au uf de Startsiite, une d Turnierregle.",
   "Vergangeni Turnier chönd ihr nachträglich ergänze, bim NDS-Export als Wettkampf."]),
 "nds": ("NDS-Export", "Aktivitäten und Anwesenheiten für J+S – in der richtigen Reihenfolge.", [
   "Hallo zusammen! So exportierst du die Anwesenheiten für die NDS.",
   "Tippe unten auf Kader.",
   "Scrolle nach unten zum NDS-Export.",
   "Prüfe den Zeitraum ab Kursbeginn und die Orte.",
   "Lade zuerst die Aktivitäten herunter.",
   "Danach die Anwesenheiten.",
   "In der NDS importierst du die beiden Dateien in genau dieser Reihenfolge: zuerst Aktivitäten, dann Anwesenheiten."]),
}
OUTRO = "Weitere Hilfe findest du oben rechts, beim Fragezeichen."
name = sys.argv[1]; title, sub, texts = V[name]
D = "/home/claude/video"; TTS = "/home/claude/tts"; SR = 16000

# Titelkarten
logo = "data:image/png;base64," + base64.b64encode(open('/home/claude/trainer-app/logo-white.png', 'rb').read()).decode()
def card(t, s, ey):
    return f"""<!doctype html><html><head><meta charset=utf-8><style>
body{{margin:0;width:390px;height:844px;background:#141414;color:#fff;font-family:'Source Sans 3';display:flex;flex-direction:column;justify-content:center;padding:0 30px;box-sizing:border-box;position:relative;overflow:hidden}}
body::after{{content:"";position:absolute;right:-120px;bottom:-120px;width:340px;height:340px;border:6px solid rgba(255,255,255,.07);border-radius:50%}}
img{{width:84px;margin-bottom:26px}}.ey{{font-family:'Barlow Condensed';font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#FF6B70;font-size:16px;margin:0 0 8px}}
h1{{font-family:'Barlow Condensed';font-weight:800;text-transform:uppercase;font-size:56px;line-height:.95;margin:0}}
p{{font-size:20px;color:#d8d0d0;line-height:1.35;margin:18px 0 0}}.bar{{width:70px;height:6px;background:#D2161E;border-radius:3px;margin-top:26px}}
</style></head><body><img src="{logo}"><p class=ey>{ey}</p><h1>{t}</h1><div class=bar></div><p>{s}</p></body></html>"""
open(f"{D}/in_{name}.html", "w").write(card(title, sub, "Trainer-App · So geht's"))
subprocess.run(["node", "-e", f"""const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();const p=await b.newPage({{viewport:{{width:390,height:844}},deviceScaleFactor:2}});
await p.goto('file://{D}/in_{name}.html');await p.waitForTimeout(300);await p.screenshot({{path:'{D}/in_{name}.jpg',type:'jpeg',quality:92}});await b.close();}})();"""], check=True)

# Stimme
os.makedirs(f"{D}/vo_{name}", exist_ok=True)
def say(i, t):
    f = f"{D}/vo_{name}/{i}.wav"
    subprocess.run(f"LD_LIBRARY_PATH={TTS}/piper {TTS}/piper/piper --model {TTS}/thorsten/de-thorsten-low.onnx --length_scale 1.08 --sentence_silence 0.35 --output_file {f}", shell=True, input=t.encode(), capture_output=True, check=True)
    w = wave.open(f); return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
own = os.environ.get("OWN")   # eigene Aufnahme: "datei.wav:a-b,a-b,..." (Sekunden je Szene, Schnitt mitten in den Pausen)
if own:
    SR = 48000
    fpath, cuts = own.split(":", 1); w = wave.open(fpath); full = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    vo = []
    for c in cuts.split(","):
        a0, a1 = (float(x) for x in c.split("-")); seg = full[max(0, int(a0 * SR)):int(a1 * SR)].copy()
        # Schmatzer/Knackser vor dem ersten und nach dem letzten Wort wegschneiden: Sprache = mind. 150 ms durchgehend hörbar
        win = int(.03 * SR); rms = np.array([np.sqrt(np.mean(seg[i:i + win] ** 2)) for i in range(0, len(seg) - win, win)])
        on = rms > 10 ** (-36 / 20); run_ = 3
        st = next((i for i in range(len(on) - run_) if on[i:i + run_].all()), 0)
        lo_ = rms > 10 ** (-46 / 20); tail = np.where(lo_[:-1] & lo_[1:])[0] + 1   # Ende: leise Wortenden bleiben, einzelne Klicks nicht
        en = int(tail[-1]) if len(tail) else len(on) - 1
        soft = rms > 10 ** (-56 / 20)   # leise Anlaute (S, F, Sch) und Wortenden mitnehmen, solange es nicht still wird
        while st > 0 and soft[st - 1]: st -= 1
        while en < len(soft) - 1 and soft[en + 1]: en += 1
        seg = seg[max(0, st * win - int(.12 * SR)):min(len(seg), (en + 1) * win + int(.25 * SR))]
        f = int(.08 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f); vo.append(seg)
    vo.append(np.zeros(1, dtype=np.float32))   # Schlusskarte ohne Stimme
    assert len(vo) == len(texts) + 1, "Anzahl Schnitte passt nicht zu den Szenen"
    name_out = name + "_eigen"
else:
    vo = [say(i, t) for i, t in enumerate(texts)] + [say(99, OUTRO)]
    name_out = name

L = json.load(open(f"{D}/list_{name}.json"))
nsc = len(texts) - 1
scenes = [[{"f": f"{D}/in_{name}.jpg", "d": 2.8, "click": False}]] + [[dict(x) for x in L if x["scene"] == s] for s in range(1, nsc + 1)] + [[{"f": f"{D}/outro.jpg", "d": 3.2, "click": False}]]
assert all(scenes), "Szene ohne Bilder"
LEAD, TAIL = (0.25, 0.7) if own else (0.4, 0.7)
t = np.arange(int(SR * 0.012)) / SR
click = (np.random.default_rng(1).uniform(-1, 1, len(t)) * np.exp(-t * 450)).astype(np.float32); click = np.diff(np.concatenate([[0], click])) * 0.9
items, audio = [], []
for k, sc in enumerate(scenes):
    vis = sum(x["d"] for x in sc); need = LEAD + len(vo[k]) / SR + TAIL
    if need > vis: sc[-1]["d"] += need - vis
    elif own and k > 0 and vis > need * 1.15:   # eigene Stimme kürzer: Bild straffen, damit keine langen Pausen entstehen
        f = max(need / vis, 0.75)
        for x in sc: x["d"] = max(0.06, x["d"] * f)
    length = sum(x["d"] for x in sc)
    a = np.zeros(int(round(length * SR)), dtype=np.float32)
    s0 = int(LEAD * SR); v = vo[k][:len(a) - s0]; a[s0:s0 + len(v)] += v * 0.95
    tt = 0.0
    for x in sc:
        tt += x["d"]
        if x["click"]:
            i = int(tt * SR) - 1; j = min(len(a), i + len(click))
            if not own and 0 <= i < len(a): a[i:j] += click[:j - i] * 0.35
    audio.append(a); items += [(x["f"], x["d"]) for x in sc]
A = np.clip(np.concatenate(audio), -1, 1)
if own:   # einzelne Klicks in leisen Stellen (Handy, Mund) ausblenden: kurzer Ausschlag, der weit über seiner Umgebung liegt
    win = int(.005 * SR); r = 20 * np.log10(np.array([np.sqrt(np.mean(A[i:i + win] ** 2)) for i in range(0, len(A) - win, win)]) + 1e-9)
    for i in range(12, len(r) - 12):   # nur in Stille: rundherum (±20–60 ms) leiser als -45 dB, sonst ist es Sprache (z. B. «t» in «Liste»)
        nb = max(r[i - 12:i - 3].max(), r[i + 4:i + 13].max())
        if r[i] > -50 and nb < -45 and r[i] - nb > 12:
            s0, s1 = max(0, (i - 2) * win), min(len(A), (i + 3) * win)
            A[s0:s1] *= np.concatenate([np.linspace(1, 0, 48), np.zeros(s1 - s0 - 96), np.linspace(0, 1, 48)]) if s1 - s0 > 96 else 0
with wave.open(f"{D}/a_{name}.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((A * 32767).astype(np.int16).tobytes())
with open(f"{D}/c_{name}.txt", "w") as f:
    for pth, d in items: f.write(f"file '{pth}'\nduration {d:.3f}\n")
    f.write(f"file '{items[-1][0]}'\n")
out = f"{D}/How-to_{name_out}.mp4"
subprocess.run(f"ffmpeg -v error -y -f concat -safe 0 -i {D}/c_{name}.txt -vf 'fps=30,scale=780:1688:flags=lanczos,format=yuv420p' -c:v libx264 -crf 20 -preset veryfast {D}/tv_{name}.mp4", shell=True, check=True)
subprocess.run(f"ffmpeg -v error -y -i {D}/tv_{name}.mp4 -i {D}/a_{name}.wav -map 0:v -map 1:a -c:v copy -af 'aresample=48000,loudnorm=I=-16:TP=-1.5' -c:a aac -b:a 128k -shortest -movflags +faststart {D}/tmp_{name}.mp4", shell=True, check=True)
os.replace(f"{D}/tmp_{name}.mp4", out)
print(name, round(len(A) / SR, 1), "s", os.path.getsize(out) // 1024, "KB")

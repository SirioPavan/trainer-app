"""Lernvideo «J+S Kinderfussball – das Wichtigste»: Textkarten im FCS-Stil, Punkte erscheinen mit der Stimme (Piper/Thorsten)."""
import base64, os, subprocess, wave, json
import numpy as np

D = "/home/claude/video/lern"; TTS = "/home/claude/tts"; SR = 16000
os.makedirs(D, exist_ok=True)
logo = "data:image/png;base64," + base64.b64encode(open('/home/claude/trainer-app/logo-white.png', 'rb').read()).decode()

INTRO = ("J+S Kinderfussball", "Das Wichtigste für Trainerinnen und Trainer – in gut zwei Minuten.",
         "Hallo zusammen! Hier sind die wichtigsten Inhalte aus J+S Kinderfussball. Kurz und kompakt.")
S = [
 ("1", "Grundhaltung", [
   ("Spielen statt anstehen", "Kinder wollen spielen. Darum gilt: spielen statt anstehen."),
   ("Viele Ballkontakte, kleine Gruppen", "Möglichst viele Ballkontakte, in kleinen Gruppen und auf kleinen Feldern."),
   ("Freude vor Resultat", "Die Freude am Spiel kommt vor dem Resultat.")]),
 ("2", "Trainingsaufbau", [
   ("<b>Auffangen</b> · wer kommt, spielt sofort", "Beim Auffangen spielt jedes Kind, das ankommt, sofort mit. Zum Beispiel drei gegen drei."),
   ("<b>Einleitung</b> · 10–15 Min., jedes Kind mit Ball", "In der Einleitung, zehn bis fünfzehn Minuten, hat jedes Kind einen eigenen Ball."),
   ("<b>Hauptteil</b> · 55–65 Min.: spielen – lernen – vielseitig – spielen", "Im Hauptteil wird am Anfang und am Ende gespielt. Dazwischen lernen die Kinder, und bewegen sich vielseitig."),
   ("<b>Ausklang</b> · ca. 10 Min.", "Zum Ausklang: ein ruhiges Spiel, ein Schlusswort, und eine persönliche Verabschiedung.")]),
 ("3", "Spielformen", [
   ("Kleine Teams, kleine Felder", "Im Kinderfussball wird in kleinen Teams auf kleinen Feldern gespielt."),
   ("Je jünger, desto kleiner das Spiel", "Je jünger die Kinder, desto kleiner das Spiel. So kommt jedes Kind oft an den Ball."),
   ("Kein Abseits, keine Ranglisten", "Es gibt kein Abseits, keine Strafen und keine Ranglisten."),
   ("Kinder regeln das Spiel selbst", "Die Kinder regeln das Spiel selbst. Die Regeln für deine Stufe findest du hier unter Wissen.")]),
 ("4", "Coaching", [
   ("Kurz erklären, viel spielen lassen", "Erkläre kurz, und lass viel spielen."),
   ("Loben – konkret und oft", "Lobe konkret und oft."),
   ("Fragen statt Anweisungen", "Stell Fragen, statt alles vorzugeben. So finden die Kinder selber Lösungen."),
   ("Fair Play vorleben", "Und lebe Fair Play vor. Zum Beispiel mit dem Shakehands nach jedem Spiel.")]),
 ("5", "Sicherheit", [
   ("Platz, Tore und Material prüfen", "Prüfe vor dem Training Platz, Tore und Material. Tore müssen gesichert sein."),
   ("Schienbeinschoner tragen", "Schienbeinschoner gehören dazu."),
   ("Apotheke und Notfallnummer 144 dabei", "Eine Apotheke und die Notfallnummer eins vier vier sind immer dabei.")]),
 ("6", "Administratives", [
   ("Anwesenheit nach jedem Training und Turnier", "Erfasse die Anwesenheit nach jedem Training und jedem Turnier."),
   ("NDS-Export = Grundlage für die J+S-Beiträge", "Mit dem NDS-Export gehen die Anwesenheiten an J+S. Sie sind die Grundlage für die J+S-Beiträge an den Verein."),
   ("Weiterbildung alle 2 Jahre", "Und denk daran: Deine J+S-Anerkennung verlängerst du mit einer Weiterbildung, alle zwei Jahre.")]),
]
OUTRO = "Mehr dazu findest du in der App, unter Wissen. Viel Spass im Training!"

CSS = """body{margin:0;width:390px;height:844px;background:#141414;color:#fff;font-family:'Source Sans 3';box-sizing:border-box;position:relative;overflow:hidden}
body::after{content:"";position:absolute;right:-120px;bottom:-120px;width:340px;height:340px;border:6px solid rgba(255,255,255,.07);border-radius:50%}
.ey{font-family:'Barlow Condensed';font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#FF6B70;font-size:16px;margin:0 0 8px}
h1{font-family:'Barlow Condensed';font-weight:800;text-transform:uppercase;line-height:.95;margin:0}
.bar{width:70px;height:6px;background:#D2161E;border-radius:3px}"""

def page(body, extra=""):
    return f"<!doctype html><html><head><meta charset=utf-8><style>{CSS}{extra}</style></head><body>{body}</body></html>"

def intro():
    t, s, _ = INTRO
    return page(f"""<div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:0 30px;box-sizing:border-box">
      <img src="{logo}" style="width:84px;margin-bottom:26px"><p class=ey>Trainer-App · Wissen</p><h1 style="font-size:56px">{t}</h1>
      <div class=bar style="margin-top:26px"></div><p style="font-size:20px;color:#d8d0d0;line-height:1.35;margin:18px 0 0">{s}</p></div>""")

def scene(num, title, items, k):
    li = "".join(f"""<div class="it {'on' if i == k - 1 else ''}" style="opacity:{1 if i < k else 0}"><b>{i + 1}</b><span>{txt}</span></div>""" for i, (txt, _) in enumerate(items))
    return page(f"""<div style="padding:92px 26px 0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><img src="{logo}" style="width:46px"><p class=ey style="margin:0">J+S Kinderfussball · {num}/6</p></div>
      <h1 style="font-size:50px">{title}</h1><div class=bar style="margin:20px 0 30px"></div>{li}</div>""",
      """.it{display:flex;gap:14px;align-items:flex-start;background:#1f1d1d;border-radius:16px;padding:16px 18px;margin-bottom:14px;border-left:6px solid #3a3535}
      .it.on{border-left-color:#D2161E;background:#2a2424}
      .it b{font-family:'Barlow Condensed';font-weight:800;font-size:28px;color:#FF6B70;line-height:1;min-width:20px}
      .it span{font-size:21px;line-height:1.3;color:#f2eeee}.it span b{font-family:'Source Sans 3';font-size:21px;color:#fff;font-weight:700}""")

def say(key, text):
    f = f"{D}/{key}.wav"; text = text.replace("J+S", "J und S")
    subprocess.run(f"LD_LIBRARY_PATH={TTS}/piper {TTS}/piper/piper --model {TTS}/thorsten/de-thorsten-low.onnx --length_scale 1.08 --sentence_silence 0.35 --output_file {f}",
                   shell=True, input=text.encode(), capture_output=True, check=True)
    w = wave.open(f); return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768

# Bilder zeichnen
pages = {"intro": intro()}
for num, title, items in S:
    for k in range(len(items) + 1): pages[f"s{num}_{k}"] = scene(num, title, items, k)
for key, html in pages.items(): open(f"{D}/{key}.html", "w").write(html)
keys = json.dumps(list(pages))
subprocess.run(["node", "-e", f"""const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();const p=await b.newPage({{viewport:{{width:390,height:844}},deviceScaleFactor:2}});
for (const k of {keys}) {{ await p.goto('file://{D}/'+k+'.html'); await p.waitForTimeout(150); await p.screenshot({{path:'{D}/'+k+'.jpg',type:'jpeg',quality:92}}); }} await b.close();}})();"""], check=True)

# Zeitplan: Bild + Stimme
items, audio = [], []
def add(img, voice, lead, tail):
    d = lead + len(voice) / SR + tail; a = np.zeros(int(round(d * SR)), dtype=np.float32)
    a[int(lead * SR):int(lead * SR) + len(voice)] = voice * 0.95; items.append((f"{D}/{img}.jpg", d)); audio.append(a)
add("intro", say("v_intro", INTRO[2]), 0.6, 0.9)
for num, title, its in S:
    add(f"s{num}_0", say(f"v{num}_t", title), 0.4, 0.5)
    for k, (_, v) in enumerate(its, 1): add(f"s{num}_{k}", say(f"v{num}_{k}", v), 0.15, 0.55 if k < len(its) else 1.2)
add("../outro", say("v_outro", OUTRO), 0.4, 1.4)
A = np.clip(np.concatenate(audio), -1, 1)
with wave.open(f"{D}/a.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((A * 32767).astype(np.int16).tobytes())
with open(f"{D}/c.txt", "w") as f:
    for pth, d in items: f.write(f"file '{pth}'\nduration {d:.3f}\n")
    f.write(f"file '{items[-1][0]}'\n")
out = "/home/claude/video/Lernvideo_JS.mp4"
subprocess.run(f"ffmpeg -v error -y -f concat -safe 0 -i {D}/c.txt -vf 'fps=30,scale=780:1688:flags=lanczos,format=yuv420p' -c:v libx264 -crf 20 -preset veryfast {D}/tv.mp4", shell=True, check=True)
subprocess.run(f"ffmpeg -v error -y -i {D}/tv.mp4 -i {D}/a.wav -map 0:v -map 1:a -c:v copy -af 'aresample=48000,loudnorm=I=-16:TP=-1.5' -c:a aac -b:a 128k -shortest -movflags +faststart {D}/tmp.mp4", shell=True, check=True)
os.replace(f"{D}/tmp.mp4", out)
print(round(len(A) / SR, 1), "s", os.path.getsize(out) // 1024, "KB")

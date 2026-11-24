# How-to-Videos neu erstellen

1. Bilder aufnehmen (Demo der App lokal starten: `python3 -m http.server 8765` im App-Ordner):
   `node rec_all.js <start|import|anwesenheit|pdf|einladen|nds>` (rec2.js = Übung erfassen)
2. Video bauen:
   - Computerstimme: `python3 build.py <name>` (braucht Piper TTS + Stimme «thorsten», von github.com/rhasspy/piper)
   - Eigene Stimme: `OWN="aufnahme.wav:a-b,a-b,..." python3 build.py <name>` (Schnitte in Sekunden, je Szene, mitten in den Pausen)
   - Aufnahme vorher: `ffmpeg -i in.m4a -ac 1 -ar 48000 -af "highpass=f=80,adeclick=w=55:o=75,afftdn=nr=10:nf=-62:tn=1" out.wav`
3. Fertiges Video nach `videos/<datei>.mp4` im App-Repo, `VID_V` in main.js und Cache in sw.js erhöhen.

Schnittpunkte der eigenen Aufnahmen (Stand 24.11.2026):
- start (1): 1.0-6.3,6.3-11.54,11.54-14.7,14.7-20.59,20.59-25.17,25.17-36.98
- uebung (2, Röbby): 0.0-4.71,4.71-6.74,6.74-9.0,9.0-11.55,11.55-14.76,14.76-22.15,22.15-29.05,29.05-32.64,32.64-39.38
- import (3): 0.9-7.47,7.47-17.4,17.4-21.77,21.77-27.6,28.29-34.45
- pdf (5): 2.5-7.3,7.3-11.44,11.44-15.95,15.95-21.39,21.39-28.45
- nds (7): 2.2-7.9,7.9-10.85,10.85-14.6,14.6-19.3,19.3-23.3,23.3-26.1,26.1-35.35

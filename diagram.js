// Spielfeld-Skizzen und Trainingsphasen
export const PH={
  auf:{t:"Auffangen",c:"--p-auf"},
  ein:{t:"Einleitung",c:"--p-ein"},
  sp:{t:"Hauptteil · Fussball spielen",c:"--p-sp"},
  le:{t:"Hauptteil · Fussball spielen lernen",c:"--p-le"},
  vi:{t:"Hauptteil · Vielseitigkeit erleben",c:"--p-vi"},
  aus:{t:"Ausklang",c:"--p-aus"}
};
/* ---------- Diagramm-Renderer ---------- */
let uid=0;
const NS="http://www.w3.org/2000/svg";
function svgEsc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")}
function arrowHead(id,color){return `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`}
function wavy(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),n=Math.max(3,Math.round(L/3.2));
  const ux=dx/L,uy=dy/L,px=-uy,py=ux;let d=`M${x1},${y1}`;
  for(let i=1;i<=n;i++){const t=i/n,a=(i===n)?0:(i%2?1.2:-1.2);d+=` L${(x1+dx*t+px*a).toFixed(2)},${(y1+dy*t+py*a).toFixed(2)}`}
  return d}
const F='font-family="\x27Source Sans 3\x27,Arial,sans-serif" font-weight="700"';
export function drawDiagram(d){
  const id="m"+(uid++);
  const hall=d.s==="hall";
  const surf=hall?"var(--wood)":"var(--grass)", surf2=hall?"var(--wood2)":"var(--grass2)";
  const lineC=hall?"rgba(60,40,20,.55)":"rgba(255,255,255,.85)";
  const arrC=hall?"#23180C":"#FFFFFF";
  const shotC=hall?"#B3230F":"#FFD84A";
  let o=`<svg viewBox="-5 -5 110 74" xmlns="${NS}" role="img" aria-label="Spielfeld-Skizze"><defs>${arrowHead(id+"a",arrC)}${arrowHead(id+"s",shotC)}</defs>`;
  o+=`<rect x="-5" y="-5" width="110" height="74" fill="${surf}"/>`;
  for(let i=0;i<10;i+=2)o+=`<rect x="${i*10}" y="0" width="10" height="64" fill="${surf2}"/>`;
  o+=`<rect x="0" y="0" width="100" height="64" fill="none" stroke="${lineC}" stroke-width=".5"/>`;
  if(d.full){o+=`<line x1="50" y1="0" x2="50" y2="64" stroke="${lineC}" stroke-width=".5"/><circle cx="50" cy="32" r="8" fill="none" stroke="${lineC}" stroke-width=".5"/><rect x="0" y="16" width="16" height="32" fill="none" stroke="${lineC}" stroke-width=".5"/><rect x="84" y="16" width="16" height="32" fill="none" stroke="${lineC}" stroke-width=".5"/>`}
  const L=[],P=[];
  for(const it of d.items){
    const [t,...a]=it;
    switch(t){
      case "area":L.push(`<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="rgba(255,255,255,.08)" stroke="${lineC}" stroke-width=".6" stroke-dasharray="1.6 1.2"/>`);break;
      case "zone":L.push(`<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" fill="rgba(255,255,255,.16)" stroke="${lineC}" stroke-width=".5"/>`);if(a[4])L.push(`<text x="${a[0]+a[2]/2}" y="${a[1]+a[3]/2+1.2}" text-anchor="middle" font-size="3.2" ${F} fill="${arrC}" opacity=".85">${svgEsc(a[4])}</text>`);break;
      case "line":L.push(`<line x1="${a[0]}" y1="0" x2="${a[0]}" y2="64" stroke="${arrC}" stroke-width=".6" stroke-dasharray="2 1.5"/>`);break;
      case "G":{const x=a[0]==="L"?-3:100;L.push(`<rect x="${x}" y="26" width="3" height="12" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width=".7"/>`);break}
      case "m":{const x=a[2]?a[0]:a[0]-2;L.push(`<rect x="${x}" y="${a[1]-4}" width="2" height="8" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width=".6"/>`);break}
      case "c":L.push(`<path d="M${a[0]-1.4},${a[1]+1.2} L${a[0]},${a[1]-1.6} L${a[0]+1.4},${a[1]+1.2} z" fill="#FF8A1F" stroke="#7a3a00" stroke-width=".25"/>`);break;
      case "hoop":L.push(`<circle cx="${a[0]}" cy="${a[1]}" r="2.6" fill="none" stroke="#FFD84A" stroke-width=".7"/>`);break;
      case "bench":case "mat":case "box":{const fill=t==="mat"?"#5B7FA6":t==="box"?"#8A5A2B":"#6E4A26";L.push(`<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx=".6" fill="${fill}" stroke="#2a1a0a" stroke-width=".3"/>`);if(a[4])L.push(`<text x="${a[0]+a[2]/2}" y="${a[1]+a[3]+3.6}" text-anchor="middle" font-size="3" ${F} fill="${arrC}">${svgEsc(a[4])}</text>`);break}
      case "pass":L.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${arrC}" stroke-width=".6" stroke-dasharray="1.5 1.1" marker-end="url(#${id}a)"/>`);break;
      case "run":L.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${arrC}" stroke-width=".6" marker-end="url(#${id}a)"/>`);break;
      case "drib":L.push(`<path d="${wavy(...a)}" fill="none" stroke="${arrC}" stroke-width=".55" stroke-linejoin="round" marker-end="url(#${id}a)"/>`);break;
      case "shot":L.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="${shotC}" stroke-width="1" marker-end="url(#${id}s)"/>`);break;
      case "txt":L.push(`<text x="${a[0]}" y="${a[1]}" text-anchor="middle" font-size="3.2" ${F} fill="${arrC}">${svgEsc(a[2])}</text>`);break;
      case "ball":P.push(`<circle cx="${a[0]}" cy="${a[1]}" r="1.1" fill="#fff" stroke="#222" stroke-width=".3"/>`);break;
      default:P.push(player(t,a[0],a[1],a[2]));
    }
  }
  return o+L.join("")+P.join("")+"</svg>";
}
function player(t,x,y,withBall){
  const fill=t==="A"?"var(--teamA)":t==="B"?"var(--teamB)":"var(--joker)";
  let s=`<circle cx="${x}" cy="${y}" r="2.5" fill="${fill}" stroke="#fff" stroke-width=".5"/>`;
  if(withBall)s+=`<circle cx="${x+2.4}" cy="${y+2}" r="1.1" fill="#fff" stroke="#222" stroke-width=".3"/>`;
  return s;
}



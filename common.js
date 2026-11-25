/* ใช้ร่วมกันทุกหน้า: ภาษา, ตัวช่วยจัดรูปแบบ, เรขาคณิตเส้นทาง, ไอคอน */
"use strict";
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

const store = {
  get(k, d){ try { const v = localStorage.getItem("bankaew-" + k); return v == null ? d : JSON.parse(v); } catch(_){ return d; } },
  set(k, v){ try { localStorage.setItem("bankaew-" + k, JSON.stringify(v)); } catch(_){} }
};

/* ---------- language ---------- */
let lang = new URLSearchParams(location.search).get("lang") || store.get("lang", "th");
if (!I18N[lang]) lang = "th";
const LANGS = [["th","ไทย"],["en","EN"],["zh","中文"]];
const t = (key, vars) => {
  let s = I18N[lang][key] ?? I18N.th[key] ?? key;
  if (vars && typeof s === "string") for (const [k,v] of Object.entries(vars)) s = s.replaceAll("{" + k + "}", v);
  return s;
};
const pick = v => (v && typeof v === "object" && !Array.isArray(v)) ? (v[lang] ?? v.th) : v;
const langListeners = [];
function onLang(fn){ langListeners.push(fn); }

function applyI18n(){
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  $$("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  $$("[data-i18n-html]").forEach(el => el.innerHTML = t(el.dataset.i18nHtml));   // only our own I18N strings
  $$(".lang-switch button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
  // carry language to links between our pages
  $$("a[data-keep-lang]").forEach(a => { const u = new URL(a.getAttribute("href"), location.href); u.searchParams.set("lang", lang); a.href = u.href; });
  langListeners.forEach(fn => fn());
}
function setLang(l){
  lang = l; store.set("lang", l);
  try { const u = new URL(location.href); u.searchParams.set("lang", l); history.replaceState(null, "", u); } catch(_){}
  applyI18n();
}
function mountLangSwitch(){
  $$(".lang-switch").forEach(box => {
    box.innerHTML = LANGS.map(([c,l]) => `<button type="button" data-lang="${c}">${l}</button>`).join("");
    box.addEventListener("click", e => { const b = e.target.closest("button[data-lang]"); if (b) setLang(b.dataset.lang); });
  });
}

/* ---------- geometry (local metres) ----------
   ROUTE = approach (Gate 1 → palace) followed by the tour inside the palace grounds.
   Segments [0, APPROACH_SEGS) are the approach; the rest is the tour. */
const ROUTE = APPROACH.concat(TOUR_ROUTE.slice(1));
const APPROACH_SEGS = APPROACH.length - 1;
const lat0 = ROUTE[0][0], lng0 = ROUTE[0][1];
const KX = 111320 * Math.cos(lat0 * Math.PI/180), KY = 110540;
const toXY = ll => [(ll[1]-lng0)*KX, (ll[0]-lat0)*KY];
const toLL = xy => [xy[1]/KY + lat0, xy[0]/KX + lng0];
const dist = (a,b) => { const p = toXY(a), q = toXY(b); return Math.hypot(p[0]-q[0], p[1]-q[1]); };
const RXY = ROUTE.map(toXY);
const CUM = [0];
for (let i=1;i<RXY.length;i++) CUM.push(CUM[i-1] + Math.hypot(RXY[i][0]-RXY[i-1][0], RXY[i][1]-RXY[i-1][1]));
const TOTAL = CUM[CUM.length-1];
const APPROACH_LEN = CUM[APPROACH_SEGS];      // Gate 1 → palace (navigation only)
const TOUR_LEN = TOTAL - APPROACH_LEN;         // the tour itself

function snapToRoute(ll, minSeg = 0, maxSeg = RXY.length-2){
  const p = toXY(ll); let best = { off: Infinity };
  for (let i=minSeg;i<=maxSeg;i++){
    const a = RXY[i], b = RXY[i+1], dx = b[0]-a[0], dy = b[1]-a[1], L2 = dx*dx+dy*dy;
    let u = L2 ? ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L2 : 0; u = Math.max(0, Math.min(1, u));
    const x = a[0]+u*dx, y = a[1]+u*dy, off = Math.hypot(p[0]-x, p[1]-y);
    if (off < best.off) best = { off, along: CUM[i] + u*Math.sqrt(L2), xy:[x,y], seg:i };
  }
  best.ll = toLL(best.xy);
  return best;
}
function pointAt(along){
  along = Math.max(0, Math.min(TOTAL, along));
  let i = 0; while (i < CUM.length-2 && CUM[i+1] < along) i++;
  const segLen = CUM[i+1]-CUM[i] || 1, u = (along-CUM[i]) / segLen;
  return toLL([RXY[i][0] + u*(RXY[i+1][0]-RXY[i][0]), RXY[i][1] + u*(RXY[i+1][1]-RXY[i][1])]);
}
function routeUpTo(along){
  const out = []; for (let i=0;i<ROUTE.length && CUM[i] <= along;i++) out.push(ROUTE[i]);
  out.push(pointAt(along)); return out;
}
// stops are in walking order on the tour part, so each one is snapped only to the route after the previous stop
(() => { let prevSeg = APPROACH_SEGS;
  STOPS.forEach((s,i) => {
    const sn = snapToRoute([s.lat,s.lng], prevSeg);
    s.along = i === 0 ? APPROACH_LEN : i === STOPS.length-1 ? TOTAL : sn.along; prevSeg = sn.seg;
    s.tourAlong = s.along - APPROACH_LEN;     // distance from the start of the tour
    s.radius = s.radius || CONFIG.arriveRadius;
  });
})();

const UNIT = { th:{m:"ม.",km:"กม.",min:"นาที"}, en:{m:"m",km:"km",min:"min"}, zh:{m:"米",km:"公里",min:"分钟"} };
const fmtDist = m => m < 1000 ? `${Math.round(m)} ${UNIT[lang].m}` : `${(m/1000).toFixed(2)} ${UNIT[lang].km}`;
const fmtEta  = m => `${Math.max(1, Math.round(m / (CONFIG.walkSpeedKmh*1000/60)))} ${UNIT[lang].min}`;
const fmtTime = ms => { const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60;
  return (h ? h + ":" + String(m).padStart(2,"0") : m) + ":" + String(x).padStart(2,"0"); };

/* ---------- icons (inline SVG, stroke = currentColor) ---------- */
const ICON = {
  back:   '<path d="M15 5l-7 7 7 7" stroke-width="2"/>',
  chev:   '<path d="M9 5l7 7-7 7" stroke-width="2"/>',
  pin:    '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  pulse:  '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  book:   '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>',
  globe:  '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
  clock:  '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  ticket: '<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2z"/><path d="M12 7v10" stroke-dasharray="2 2"/>',
  shirt:  '<path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>',
  phone:  '<path d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 6 6L16 13.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
  users:  '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3 2.8-5 5.5-5s5 2 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14c2.5 0 4 1.6 4.5 4"/>',
  golf:   '<path d="M8 21V3l9 4-9 4"/><path d="M4 21c2.5-1.3 5.5-2 8-2s5.5.7 8 2"/>',
  wc:     '<circle cx="8" cy="5.5" r="1.6"/><path d="M8 9v11M5.5 9h5l-.5 6H6z"/><circle cx="16" cy="5.5" r="1.6"/><path d="M16 9l-3 7h6zM15 16v4M17 16v4"/>',
  park:   '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  water:  '<path d="M12 4s6 6.5 6 10.5a6 6 0 0 1-12 0C6 10.5 12 4 12 4z"/>',
  bench:  '<path d="M4 11h16M5 15h14M7 11V8h10v3M7 15v4M17 15v4"/>',
  access: '<circle cx="12" cy="5" r="1.6"/><path d="M12 8v6h4l2 5M12 11h4"/><path d="M9.5 11.5A5 5 0 1 0 15 19"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.3"/>',
  quiet:  '<path d="M5 9h3l4-4v14l-4-4H5z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  ban:    '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  check:  '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.2"/>',
  play:   '<path d="M8 6l11 6-11 6z" fill="currentColor" stroke="none"/>',
  stop:   '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
  pause:  '<path d="M9 6v12M15 6v12" stroke-width="2.4"/>',
  flag:   '<path d="M6 21V4"/><path d="M6 5h11l-2.5 4L17 13H6"/>',
  list:   '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
  locate: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M12 6l2.5 6h-5z" fill="currentColor"/><path d="M12 18l-2.5-6h5z"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  route:  '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" stroke-dasharray="2 3"/>',
  sim:    '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
  photo:  '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4 4 3 3-2 4 3"/>'
};
const icon = (name, size = 22, cls = "") =>
  `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

/* photo with fallback placeholder when images/ has no file yet */
function photoHTML(stop, cls = ""){
  return `<div class="photo ${cls}" style="--tone:${stop.tone || "#EDE4D3"}">
    <img src="${esc(stop.img)}" alt="${esc(pick(stop.title))}" loading="lazy" onerror="this.remove()">
    ${icon("photo", 26, "photo-ph")}
  </div>`;
}

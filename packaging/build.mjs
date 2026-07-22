// GRFT+ vinyl toy sleeve — die-cut packaging artwork generator.
// Units: 5 units = 1 mm.  Trim 400 × 100 mm.  Bleed 3 mm.
// Output: packaging/grft-toy-sleeve.svg  (layered, die line on its own <g>)

import fs from 'fs';

const G = JSON.parse(fs.readFileSync(new URL('./glyphs.json', import.meta.url)));

const MM = 5;
const BLEED = 3 * MM;                       // 15
const TRIM_W = 400 * MM, TRIM_H = 100 * MM; // 2000 × 500
const W = TRIM_W + BLEED * 2, H = TRIM_H + BLEED * 2;

// ── window (Option A: rounded rect with exaggerated graffiti corners) ──
const WIN = { x: 495, y: 115, w: 640, h: 320 };
const FRAME = 12 * MM;   // 12 mm illustrated border
const SAFE = 9 * MM;     // 9 mm keep-out from cut line

// ── palette ──
const C = {
  wall: '#c5bfb4', wallHi: '#d2ccc1', wallLo: '#b0a99e',
  ink: '#121212',
  pink: '#ee3a80', pinkD: '#c72866',
  blue: '#35a8de', blueD: '#2288bb',
  yellow: '#ffd028', yellowD: '#e0ab00',
  orange: '#f47b20',
  cream: '#f4efe3',
};

// ── seeded rng ──
let _s = 20260720;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const n = (v) => Math.round(v * 10) / 10;

const P = []; // output buffer
const push = (s) => P.push(s);

// ═══ helpers ═══════════════════════════════════════════════════════

// keep-out: true if (x,y) sits inside the window + safety margin
function inWindow(x, y, pad = SAFE) {
  return x > WIN.x - pad && x < WIN.x + WIN.w + pad &&
         y > WIN.y - pad && y < WIN.y + WIN.h + pad;
}
// clear of the illustrated frame too (for background scatter)
function inFrame(x, y, pad = 0) {
  const f = FRAME + pad;
  return x > WIN.x - f && x < WIN.x + WIN.w + f &&
         y > WIN.y - f && y < WIN.y + WIN.h + f;
}

// a single paint drip hanging from (x,y)
function drip(x, y, len, w, fill, seedWobble = true) {
  const halfW = w / 2;
  const bulge = w * rr(0.55, 0.95);
  const wob = seedWobble ? rr(-w * 0.5, w * 0.5) : 0;
  const tipY = y + len;
  return `<path d="M${n(x - halfW)},${n(y)} `
    + `C${n(x - halfW)},${n(y + len * 0.62)} ${n(x - bulge + wob)},${n(tipY - bulge * 1.4)} ${n(x + wob)},${n(tipY)} `
    + `C${n(x + bulge + wob)},${n(tipY - bulge * 1.4)} ${n(x + halfW)},${n(y + len * 0.62)} ${n(x + halfW)},${n(y)} Z" fill="${fill}"/>`
    + `<circle cx="${n(x + wob)}" cy="${n(tipY - bulge * 0.35)}" r="${n(bulge * 0.72)}" fill="${fill}"/>`;
}

// row of drips along the underside of a shape
function dripRow(x1, x2, y, fill, count, minL, maxL, wMin = 5, wMax = 11) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = rr(x1, x2);
    s += drip(x, y + rr(-4, 6), rr(minL, maxL), rr(wMin, wMax), fill);
  }
  return s;
}

// bubble-cloud (throwie) built from overlapping circles: black outline pass + colour pass
function cloud(cx, cy, rw, rh, color, opts = {}) {
  const lobes = opts.lobes ?? ri(6, 9);
  const ow = opts.outline ?? 16;
  const circles = [];
  for (let i = 0; i < lobes; i++) {
    const t = (i / (lobes - 1)) * Math.PI;
    const x = cx - rw + (i / (lobes - 1)) * rw * 2 + rr(-12, 12);
    const y = cy - Math.sin(t) * rh * 0.35 + rr(-10, 10);
    circles.push({ x, y, r: rr(rh * 0.62, rh * 0.98) });
  }
  // body ellipse keeps the union solid
  circles.push({ x: cx, y: cy, r: rh * 0.95 });
  let out = '<g filter="url(#rough)">';
  out += circles.map(c => `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(c.r + ow)}" fill="${C.ink}"/>`).join('');
  out += circles.map(c => `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(c.r)}" fill="${color}"/>`).join('');
  out += '</g>';
  // cream highlight blobs inside the fill (reference has these)
  if (opts.hi !== false) {
    for (let i = 0; i < ri(2, 4); i++) {
      const c = circles[ri(0, circles.length - 2)];
      out += `<ellipse cx="${n(c.x + rr(-14, 14))}" cy="${n(c.y - c.r * 0.35)}" rx="${n(c.r * rr(0.3, 0.5))}" ry="${n(c.r * rr(0.16, 0.26))}" fill="${C.cream}" opacity="${n(rr(0.16, 0.3))}"/>`;
    }
  }
  // drips off the bottom — long and thin, like the reference
  const btm = Math.max(...circles.map(c => c.y + c.r));
  out += dripRow(cx - rw * 0.92, cx + rw * 0.92, btm - 2, C.ink, ri(7, 11), 60, 260, 5, 11);
  out += dripRow(cx - rw * 0.65, cx + rw * 0.65, btm - 18, color, ri(3, 6), 40, 150, 4, 8);
  return out;
}

// asterisk / sparkle star
function star(x, y, r, sw, fill = C.ink, spokes = 6) {
  let s = '';
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + 0.2;
    s += `<line x1="${n(x - Math.cos(a) * r)}" y1="${n(y - Math.sin(a) * r)}" x2="${n(x + Math.cos(a) * r)}" y2="${n(y + Math.sin(a) * r)}" stroke="${fill}" stroke-width="${n(sw)}" stroke-linecap="round"/>`;
  }
  return s;
}

// spray splatter cluster
function splat(x, y, r, fill, count = 26, op = 1) {
  let s = `<g opacity="${op}">`;
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.55) * r;
    s += `<circle cx="${n(x + Math.cos(a) * d)}" cy="${n(y + Math.sin(a) * d)}" r="${n(rr(0.8, r * 0.075))}" fill="${fill}"/>`;
  }
  s += '</g>';
  return s;
}

// text from the GRFT+ display font, scaled + positioned
function tag(str, x, y, size, fill = C.ink, rot = 0, op = 1) {
  const g = G[str];
  if (!g) return '';
  const k = size / 100;
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${rot}) scale(${n(k * 1000) / 1000})" opacity="${op}">`
    + `<path d="${g.d}" fill="${fill}"/></g>`;
}
const tagW = (str, size) => (G[str] ? (G[str].bb.x2 - G[str].bb.x1) * (size / 100) : 0);

// small stencil/mono text (not the display font) for easter eggs
function mono(str, x, y, size, fill = C.ink, op = 0.75, rot = 0, weight = 700) {
  return `<text x="${n(x)}" y="${n(y)}" font-family="Helvetica,Arial,sans-serif" font-size="${n(size)}" font-weight="${weight}" letter-spacing="${n(size * 0.08)}" fill="${fill}" opacity="${op}" transform="rotate(${rot} ${n(x)} ${n(y)})">${str}</text>`;
}

// masking tape strip
function tape(x, y, w, h, rot, note) {
  let s = `<g transform="rotate(${rot} ${n(x)} ${n(y)})" opacity="0.85">`
    + `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#e8e2d2" opacity="0.9"/>`
    + `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="#00000022" stroke-width="1.5"/>`;
  if (note) s += mono(note, x + 8, y + h * 0.68, h * 0.5, '#333', 0.8);
  s += '</g>';
  return s;
}

// ═══ 0. defs ═══════════════════════════════════════════════════════
push(`<defs>
  <filter id="grain" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.42"/></feComponentTransfer>
    <feComposite operator="in" in2="SourceGraphic"/>
  </filter>
  <filter id="rough" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="roughHard" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="3" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="sprayEdge" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="9" result="b"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="5" result="t"/>
    <feDisplacementMap in="b" in2="t" scale="26" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <pattern id="halftonePink" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="4" cy="4" r="3.1" fill="${C.pink}"/><circle cx="11" cy="11" r="3.1" fill="${C.pink}"/>
  </pattern>
  <pattern id="halftoneBlue" width="16" height="16" patternUnits="userSpaceOnUse">
    <circle cx="4" cy="4" r="3.4" fill="${C.blue}"/><circle cx="12" cy="12" r="3.4" fill="${C.blue}"/>
  </pattern>
  <pattern id="halftoneInk" width="12" height="12" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="2.6" fill="${C.ink}"/><circle cx="9" cy="9" r="2.6" fill="${C.ink}"/>
  </pattern>
  <pattern id="caution" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="46" height="46" fill="${C.yellow}"/><rect width="23" height="46" fill="${C.ink}"/>
  </pattern>
</defs>`);

// ═══ 1. wall ═══════════════════════════════════════════════════════
push(`<g id="WALL">`);
push(`<rect width="${W}" height="${H}" fill="${C.wall}"/>`);
// broad tonal blotches
for (let i = 0; i < 26; i++) {
  const x = rr(0, W), y = rr(0, H);
  push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rr(90, 320))}" ry="${n(rr(50, 160))}" fill="${rnd() > 0.5 ? C.wallHi : C.wallLo}" opacity="${n(rr(0.12, 0.3))}" filter="url(#sprayEdge)"/>`);
}
// roller marks — wide soft horizontal bands
for (let i = 0; i < 7; i++) {
  const y = rr(0, H), h = rr(28, 74);
  push(`<rect x="${n(rr(-80, 300))}" y="${n(y)}" width="${n(rr(500, 1500))}" height="${n(h)}" fill="${rnd() > 0.5 ? C.wallHi : C.wallLo}" opacity="${n(rr(0.14, 0.26))}" filter="url(#rough)"/>`);
}
// ghosts of old graffiti — faint buffed shapes
for (let i = 0; i < 16; i++) {
  const x = rr(40, W - 40), y = rr(40, H - 40);
  push(`<g opacity="${n(rr(0.05, 0.11))}" filter="url(#rough)"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rr(60, 190))}" ry="${n(rr(30, 80))}" fill="none" stroke="${C.ink}" stroke-width="${n(rr(6, 16))}"/></g>`);
}
push(tag('STAY', 250, 470, 210, C.ink, -4, 0.07));
push(tag('KEEP PAINTING', 1180, 200, 90, C.ink, 3, 0.06));
push(tag('NO BUFF', 1560, 480, 130, C.ink, -2, 0.06));
// hairline cracks
for (let i = 0; i < 9; i++) {
  let x = rr(0, W), y = rr(0, H), d = `M${n(x)},${n(y)}`;
  for (let j = 0; j < ri(3, 6); j++) { x += rr(-70, 70); y += rr(20, 70); d += ` L${n(x)},${n(y)}`; }
  push(`<path d="${d}" fill="none" stroke="${C.wallLo}" stroke-width="${n(rr(1.2, 2.6))}" opacity="${n(rr(0.3, 0.55))}"/>`);
}
push(`</g>`);

// ═══ 2. spray halos (colour zones) ═════════════════════════════════
push(`<g id="HALOS" opacity="0.5">`);
[[120, 90, 300, 170, C.pink], [1500, 80, 330, 160, C.blue],
 [1680, 430, 320, 165, C.yellow], [260, 450, 300, 150, C.pink],
 [980, 40, 150, 80, C.orange], [1180, 500, 140, 75, C.orange]]
  .forEach(([x, y, rx, ry, col]) =>
    push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}" filter="url(#sprayEdge)"/>`));
push(`</g>`);

// ═══ 3. throwie clouds — corners ═══════════════════════════════════
push(`<g id="THROWIES">`);
push(cloud(150, 105, 250, 92, C.pink, { lobes: 8 }));      // top-left  pink
push(cloud(1560, 78, 235, 84, C.blue, { lobes: 7 }));      // top-right blue
push(cloud(1740, 445, 250, 92, C.yellow, { lobes: 8 }));   // bottom-right yellow
push(cloud(300, 470, 245, 88, C.pink, { lobes: 7 }));      // bottom-left pink
push(cloud(1010, 508, 165, 62, C.pink, { lobes: 6 }));     // bottom-centre filler
push(`</g>`);

// ═══ 4. mid-ground graffiti furniture ══════════════════════════════
push(`<g id="ELEMENTS">`);

// caution stripe fragments
push(`<g transform="rotate(-7 130 300)"><rect x="30" y="292" width="180" height="34" fill="url(#caution)" opacity="0.9"/><rect x="30" y="292" width="180" height="34" fill="none" stroke="${C.ink}" stroke-width="4"/></g>`);
push(`<g transform="rotate(5 1900 300)"><rect x="1832" y="286" width="176" height="32" fill="url(#caution)" opacity="0.85"/><rect x="1832" y="286" width="176" height="32" fill="none" stroke="${C.ink}" stroke-width="4"/></g>`);

// halftone patches
push(`<rect x="1235" y="470" width="150" height="52" fill="url(#halftonePink)" opacity="0.75" transform="rotate(-4 1310 496)"/>`);
push(`<rect x="330" y="30" width="140" height="46" fill="url(#halftoneBlue)" opacity="0.6" transform="rotate(6 400 53)"/>`);
push(`<rect x="1640" y="205" width="120" height="42" fill="url(#halftoneInk)" opacity="0.35" transform="rotate(-3 1700 226)"/>`);

// arrows
function arrow(x, y, len, rot, sw, fill = C.ink) {
  return `<g transform="rotate(${rot} ${n(x)} ${n(y)})">`
    + `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + len)}" y2="${n(y)}" stroke="${fill}" stroke-width="${n(sw)}" stroke-linecap="round"/>`
    + `<path d="M${n(x + len)},${n(y)} L${n(x + len - sw * 2.2)},${n(y - sw * 1.9)} L${n(x + len - sw * 2.2)},${n(y + sw * 1.9)} Z" fill="${fill}"/></g>`;
}
push(arrow(300, 245, 120, -28, 13));
push(arrow(1420, 165, 110, 22, 12));
push(arrow(1500, 545, 96, -14, 11));
push(arrow(120, 380, 88, 34, 10));

// crowns
function crown(x, y, w, sw = 9, fill = C.ink) {
  const h = w * 0.62;
  return `<path d="M${n(x)},${n(y)} L${n(x + w * 0.18)},${n(y - h)} L${n(x + w * 0.36)},${n(y - h * 0.35)} L${n(x + w * 0.5)},${n(y - h * 1.15)} L${n(x + w * 0.64)},${n(y - h * 0.35)} L${n(x + w * 0.82)},${n(y - h)} L${n(x + w)},${n(y)} Z" fill="none" stroke="${fill}" stroke-width="${n(sw)}" stroke-linejoin="round"/>`;
}
push(crown(196, 268, 92));
push(crown(1786, 168, 76, 8));

// lightning bolts
function bolt(x, y, s, fill = C.ink, rot = 0) {
  return `<g transform="rotate(${rot} ${n(x)} ${n(y)})"><path d="M${n(x)},${n(y)} l${n(s * 0.55)},${n(-s)} l${n(-s * 0.1)},${n(s * 0.55)} l${n(s * 0.5)},${n(-s * 0.12)} l${n(-s * 0.78)},${n(s * 1.1)} l${n(s * 0.12)},${n(-s * 0.6)} Z" fill="${fill}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/></g>`;
}
push(bolt(1380, 420, 62, C.yellow, 8));
push(bolt(392, 178, 52, C.yellow, -12));

// stencil X's and circles
[[262, 348, 30], [1660, 330, 26], [1140, 60, 24], [880, 545, 22]].forEach(([x, y, r]) => {
  push(`<g stroke="${C.ink}" stroke-width="${n(r * 0.32)}" stroke-linecap="round" opacity="0.85">`
    + `<line x1="${n(x - r)}" y1="${n(y - r)}" x2="${n(x + r)}" y2="${n(y + r)}"/>`
    + `<line x1="${n(x + r)}" y1="${n(y - r)}" x2="${n(x - r)}" y2="${n(y + r)}"/></g>`);
});
[[1300, 108, 34], [430, 545, 30], [1905, 200, 28]].forEach(([x, y, r]) =>
  push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="${n(r * 0.3)}" opacity="0.8"/>`));

// smiley
push(`<g transform="translate(1852,352)"><circle r="40" fill="${C.yellow}" stroke="${C.ink}" stroke-width="10"/><circle cx="-13" cy="-9" r="5.5" fill="${C.ink}"/><circle cx="13" cy="-9" r="5.5" fill="${C.ink}"/><path d="M-18,10 Q0,27 18,10" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/></g>`);

// skull + crossbones
push(`<g transform="translate(178,196) rotate(-9) scale(0.9)">
  <path d="M-26,-30 h52 v34 q0,16 -16,18 l-4,12 h-12 l-4,-12 q-16,-2 -16,-18 Z" fill="${C.cream}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>
  <circle cx="-11" cy="-6" r="7" fill="${C.ink}"/><circle cx="11" cy="-6" r="7" fill="${C.ink}"/>
  <line x1="-36" y1="30" x2="36" y2="46" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>
  <line x1="-36" y1="46" x2="36" y2="30" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/></g>`);

// tiny ghost
push(`<g transform="translate(1218,168) scale(0.95)"><path d="M-22,10 v-16 a22,24 0 0 1 44,0 v16 l-8,-7 -7,8 -7,-8 -7,8 -8,-8 Z" fill="${C.cream}" stroke="${C.ink}" stroke-width="6.5" stroke-linejoin="round"/><circle cx="-8" cy="-6" r="4" fill="${C.ink}"/><circle cx="8" cy="-6" r="4" fill="${C.ink}"/></g>`);

// eyeball
push(`<g transform="translate(452,112)"><circle r="27" fill="${C.cream}" stroke="${C.ink}" stroke-width="8"/><circle cx="6" cy="-2" r="12" fill="${C.blue}"/><circle cx="6" cy="-2" r="6" fill="${C.ink}"/></g>`);
push(drip(452, 138, 46, 7, C.ink));

// spray cans
function can(x, y, s, body, rot = 0) {
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${rot}) scale(${s})">
    <rect x="-20" y="-34" width="40" height="76" rx="7" fill="${body}" stroke="${C.ink}" stroke-width="7"/>
    <rect x="-11" y="-50" width="22" height="18" fill="${C.cream}" stroke="${C.ink}" stroke-width="6"/>
    <rect x="-20" y="-8" width="40" height="15" fill="${C.ink}" opacity="0.85"/>
    <circle cx="0" cy="-54" r="6" fill="${C.ink}"/></g>`;
}
push(can(1876, 500, 1.05, C.pink, 8));
push(can(80, 250, 0.72, C.blue, -14));
push(can(1120, 560, 0.6, C.yellow, 5));

// paint cap icons
function cap(x, y, s, col) {
  return `<g transform="translate(${n(x)},${n(y)}) scale(${s})"><path d="M-15,12 v-14 a15,15 0 0 1 30,0 v14 Z" fill="${col}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/><circle cx="0" cy="-6" r="4.5" fill="${C.ink}"/></g>`;
}
push(cap(560, 62, 0.9, C.pink)); push(cap(1330, 552, 0.8, C.blue)); push(cap(1958, 118, 0.85, C.yellow));

// safety cone pictograms (orange integration)
function cone(x, y, s) {
  return `<g transform="translate(${n(x)},${n(y)}) scale(${s})">
    <path d="M0,-34 L20,26 H-20 Z" fill="${C.orange}" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>
    <rect x="-27" y="26" width="54" height="12" rx="4" fill="${C.orange}" stroke="${C.ink}" stroke-width="7"/>
    <line x1="-11" y1="0" x2="11" y2="0" stroke="${C.cream}" stroke-width="8"/></g>`;
}
push(cone(1462, 258, 0.82)); push(cone(352, 330, 0.62)); push(cone(1690, 552, 0.55));

// peeling sticker
push(`<g transform="rotate(-8 1938 296)"><rect x="1900" y="262" width="78" height="68" rx="6" fill="${C.cream}" stroke="${C.ink}" stroke-width="5"/>${mono('GRFT+', 1911, 300, 20, C.ink, 1)}<path d="M1900,330 q22,-14 40,2 q-22,10 -40,-2 Z" fill="${C.wallLo}" stroke="${C.ink}" stroke-width="4"/></g>`);

// marker scribbles / handstyle practice
for (let i = 0; i < 5; i++) {
  const x = rr(60, W - 200), y = rr(50, H - 40);
  if (inFrame(x, y, 60)) continue;
  let d = `M${n(x)},${n(y)}`;
  for (let j = 0; j < 7; j++) d += ` q${n(rr(10, 26))},${n(rr(-26, 26))} ${n(rr(20, 42))},${n(rr(-8, 8))}`;
  push(`<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${n(rr(3, 5.5))}" stroke-linecap="round" opacity="${n(rr(0.35, 0.6))}"/>`);
}
push(`</g>`);

// ═══ 5. STAY UP! speech bubble ═════════════════════════════════════
push(`<g id="STAYUP" transform="translate(1490,300)">`);
push(`<ellipse cx="0" cy="0" rx="188" ry="128" fill="${C.ink}"/>`);
push(`<path d="M-58,104 L-92,196 L4,116 Z" fill="${C.ink}"/>`);
push(`<ellipse cx="0" cy="0" rx="172" ry="112" fill="${C.cream}"/>`);
push(`<path d="M-56,96 L-80,172 L-2,108 Z" fill="${C.cream}"/>`);
{
  const s1 = 128, w1 = tagW('STAY', s1);
  push(tag('STAY', -w1 / 2, -8, s1, C.ink, -3));
  const s2 = 128, w2 = tagW('UP!', s2);
  push(tag('UP!', -w2 / 2, 86, s2, C.ink, 2));
}
push(`<line x1="-96" y1="102" x2="86" y2="106" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>`);
push(dripRow(-150, 150, 108, C.ink, 5, 30, 86, 5, 9));
push(drip(-88, 190, 62, 8, C.ink));
push(`</g>`);

// ═══ 6. die-cut window frame (the illustrated border) ══════════════
// graffiti-cornered rounded rect path
function windowPath(inset = 0) {
  const x = WIN.x - inset, y = WIN.y - inset;
  const w = WIN.w + inset * 2, h = WIN.h + inset * 2;
  const R = 52 + inset * 0.35, r2 = 30 + inset * 0.3, R3 = 74 + inset * 0.4, r4 = 40 + inset * 0.3;
  return `M${n(x + R)},${n(y)} `
    + `L${n(x + w - r2)},${n(y)} Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r2)} `      // TR tight
    + `L${n(x + w)},${n(y + h - R3)} Q${n(x + w)},${n(y + h)} ${n(x + w - R3)},${n(y + h)} ` // BR fat
    + `L${n(x + r4)},${n(y + h)} Q${n(x)},${n(y + h)} ${n(x)},${n(y + h - r4)} `      // BL
    + `L${n(x)},${n(y + R)} Q${n(x)},${n(y)} ${n(x + R)},${n(y)} Z`;                   // TL fat
}

push(`<g id="FRAME">`);
// overspray halo around the opening
push(`<path d="${windowPath(FRAME + 26)}" fill="none" stroke="${C.pink}" stroke-width="34" opacity="0.32" filter="url(#sprayEdge)"/>`);
push(`<path d="${windowPath(FRAME + 14)}" fill="none" stroke="${C.blue}" stroke-width="20" opacity="0.22" filter="url(#sprayEdge)"/>`);
// the painted band — single continuous frame, 12 mm wide
push(`<g filter="url(#roughHard)">`);
push(`<path d="${windowPath(FRAME * 0.46)}" fill="none" stroke="${C.ink}" stroke-width="${n(FRAME * 0.8)}"/>`);
push(`</g>`);
// a second, looser repaint pass just outside it (artists kept going over the edge)
push(`<path d="${windowPath(FRAME * 1.15)}" fill="none" stroke="${C.ink}" stroke-width="9" opacity="0.5" filter="url(#rough)"/>`);
// drips off the frame's bottom edge
push(dripRow(WIN.x + 40, WIN.x + WIN.w - 40, WIN.y + WIN.h + FRAME * 1.5, C.ink, 9, 30, 120, 6, 12));
// drips off the top edge of the frame, running down over the window edge
push(dripRow(WIN.x + 60, WIN.x + WIN.w - 60, WIN.y - FRAME * 1.4, C.ink, 6, 24, 74, 5, 10));
// colour re-paint marks on the frame
push(splat(WIN.x - 30, WIN.y + 40, 60, C.pink, 30, 0.8));
push(splat(WIN.x + WIN.w + 26, WIN.y + WIN.h - 60, 58, C.yellow, 28, 0.75));
push(splat(WIN.x + WIN.w * 0.5, WIN.y - FRAME - 18, 52, C.blue, 24, 0.6));
// scratches across the band
for (let i = 0; i < 12; i++) {
  const side = ri(0, 3);
  let x, y, len = rr(20, 60), rot = rr(-40, 40);
  if (side === 0) { x = rr(WIN.x, WIN.x + WIN.w); y = WIN.y - FRAME * rr(0.3, 1.4); }
  else if (side === 1) { x = rr(WIN.x, WIN.x + WIN.w); y = WIN.y + WIN.h + FRAME * rr(0.3, 1.4); }
  else if (side === 2) { x = WIN.x - FRAME * rr(0.3, 1.4); y = rr(WIN.y, WIN.y + WIN.h); }
  else { x = WIN.x + WIN.w + FRAME * rr(0.3, 1.4); y = rr(WIN.y, WIN.y + WIN.h); }
  push(`<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + len)}" y2="${n(y)}" stroke="${C.wallHi}" stroke-width="${n(rr(1.6, 3.4))}" opacity="${n(rr(0.3, 0.6))}" transform="rotate(${n(rot)} ${n(x)} ${n(y)})"/>`);
}
// tape + stickers on the frame
push(tape(WIN.x - 74, WIN.y + WIN.h - 34, 128, 30, -9, 'WET PAINT'));
push(tape(WIN.x + WIN.w - 42, WIN.y - 44, 116, 28, 7, 'SHAKE WELL'));
push(`<g transform="rotate(6 ${WIN.x + WIN.w + 6} ${WIN.y + 46})"><rect x="${WIN.x + WIN.w - 30}" y="${WIN.y + 22}" width="72" height="48" rx="5" fill="${C.yellow}" stroke="${C.ink}" stroke-width="5"/>${mono('NO', WIN.x + WIN.w - 18, WIN.y + 44, 17, C.ink, 1)}${mono('TOYS', WIN.x + WIN.w - 22, WIN.y + 62, 15, C.ink, 1)}</g>`);
// tiny caps + cone hidden on the frame
push(cap(WIN.x + 96, WIN.y - FRAME - 4, 0.5, C.orange));
push(cone(WIN.x + WIN.w - 120, WIN.y + WIN.h + FRAME + 6, 0.42));
push(`</g>`);

// ═══ 7. lettering + easter eggs ════════════════════════════════════
push(`<g id="TYPE">`);
// GRFT+ '26 bottom-left handstyle
push(tag('GRFT+', 52, 508, 76, C.ink, -3));
push(tag('26', 52 + tagW('GRFT+', 76) + 14, 504, 52, C.ink, -3));
push(drip(74, 512, 30, 5.5, C.ink));
// secondary tags, small — discovery rewards
push(tag('STAY FRESH', 1196, 592, 44, C.ink, -2, 0.85));
push(tag('MAKE YOUR MARK', 244, 42, 40, C.ink, 2, 0.8));
push(tag('KEEP PAINTING', 1660, 596, 38, C.ink, -3, 0.75));
push(tag('NO BUFF', 40, 340, 46, C.pink, -88, 0.9));

// easter eggs — colour swatches, formulas, reg marks, barcode, stencil numbers
push(`<g id="EGGS">`);
// swatch strip
[[C.pink, 'PMS 806'], [C.blue, 'PMS 306'], [C.yellow, 'PMS 116'], [C.orange, 'PMS 021']]
  .forEach(([col, name], i) => {
    const x = 706 + i * 46, y = 574;
    push(`<rect x="${x}" y="${y}" width="36" height="22" fill="${col}" stroke="${C.ink}" stroke-width="2.5"/>`);
    push(mono(name, x, y + 34, 9, C.ink, 0.55));
  });
// registration marks
[[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]].forEach(([x, y]) =>
  push(`<g opacity="0.5" stroke="${C.ink}" stroke-width="2" fill="none"><circle cx="${x}" cy="${y}" r="11"/><line x1="${x - 17}" y1="${y}" x2="${x + 17}" y2="${y}"/><line x1="${x}" y1="${y - 17}" x2="${x}" y2="${y + 17}"/></g>`));
// stencil barcode
push(`<g transform="translate(1246,36)">${Array.from({ length: 22 }, (_, i) => `<rect x="${i * 6}" y="0" width="${rnd() > 0.5 ? 3.4 : 1.8}" height="30" fill="${C.ink}" opacity="0.7"/>`).join('')}${mono('GRFT-26-VNL-001', 0, 42, 11, C.ink, 0.6)}</g>`);
// paint formula + stencil numbers
push(mono('MIX 60/40 · 2 COATS · CAP: FAT', 620, 44, 12, C.ink, 0.5, -1));
push(mono('№ 026 / 500', 1786, 596, 13, C.ink, 0.55, 2));
push(mono('ORANGE CRUSH', 1400, 96, 13, C.orange, 0.9, -4));
push(mono('NO TOYS', 92, 424, 13, C.ink, 0.6, 88));
push(mono('WET PAINT', 1930, 372, 12, C.ink, 0.55, 90));
push(mono('SHAKE WELL', 862, 30, 12, C.ink, 0.5, 1));
push(mono('STAY UP', 1092, 592, 12, C.ink, 0.5, -2));
// handwritten tape note
push(tape(920, 566, 150, 30, -3, 'FRONT PANEL / DIE 001'));
push(`</g>`);
push(`</g>`);

// ═══ 8. splatter + dots overlay ════════════════════════════════════
push(`<g id="SPECKS">`);
for (let i = 0; i < 15; i++) {
  const x = rr(0, W), y = rr(0, H);
  if (inFrame(x, y, 34)) continue;
  push(splat(x, y, rr(28, 78), pick([C.ink, C.ink, C.pink, C.blue, C.yellow, C.orange]), ri(12, 30), rr(0.35, 0.8)));
}
// scattered solid dots + dashes, reference-style
for (let i = 0; i < 190; i++) {
  const x = rr(0, W), y = rr(0, H);
  if (inWindow(x, y, 20)) continue;
  const r = rr(1.6, 7);
  if (rnd() > 0.86) push(`<rect x="${n(x)}" y="${n(y)}" width="${n(r * 3.4)}" height="${n(r * 1.1)}" rx="${n(r * 0.5)}" fill="${C.ink}" opacity="${n(rr(0.5, 0.9))}" transform="rotate(${n(rr(-30, 30))} ${n(x)} ${n(y)})"/>`);
  else push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${C.ink}" opacity="${n(rr(0.45, 0.92))}"/>`);
}
// sparkle stars
[[690, 96, 40, 11], [1236, 300, 34, 9], [1370, 520, 30, 8], [560, 470, 36, 10],
 [1620, 240, 26, 7], [206, 148, 22, 6], [1830, 92, 28, 8], [1042, 430, 24, 7]]
  .forEach(([x, y, r, sw]) => { if (!inWindow(x, y, 12)) push(star(x, y, r, sw)); });
push(`</g>`);

// ═══ 9. grain pass ═════════════════════════════════════════════════
push(`<rect width="${W}" height="${H}" fill="${C.wallLo}" filter="url(#grain)" opacity="0.34" style="mix-blend-mode:multiply"/>`);
push(`<rect width="${W}" height="${H}" fill="#ffffff" filter="url(#grain)" opacity="0.26" style="mix-blend-mode:screen"/>`);
// concrete pitting over everything, colour included — this is what sells the wall


// ═══ 10. die line + trim + safety (separate layers, non-printing) ══
push(`<g id="DIE_CUT" data-note="CutContour — remove before print, keep as spot channel">`);
push(`<path d="${windowPath(0)}" fill="none" stroke="#ff00ff" stroke-width="3" stroke-dasharray="14 9"/>`);
push(`</g>`);
push(`<g id="GUIDES" data-note="trim + safety, delete before output">`);
push(`<rect x="${BLEED}" y="${BLEED}" width="${TRIM_W}" height="${TRIM_H}" fill="none" stroke="#00c2ff" stroke-width="2" stroke-dasharray="10 8" opacity="0.9"/>`);
push(`<path d="${windowPath(SAFE)}" fill="none" stroke="#00c2ff" stroke-width="2" stroke-dasharray="6 7" opacity="0.75"/>`);
push(`</g>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>GRFT+ vinyl toy sleeve — 400 × 100 mm trim, 3 mm bleed, die-cut window</title>
${P.join('\n')}
</svg>`;

fs.writeFileSync(new URL('./grft-toy-sleeve.svg', import.meta.url), svg);
console.log('wrote grft-toy-sleeve.svg —', (svg.length / 1024).toFixed(0), 'kB');
console.log(`artboard ${W}×${H} u  =  ${W / MM}×${H / MM} mm (incl. 3mm bleed)`);
console.log(`window ${WIN.w / MM}×${WIN.h / MM} mm at (${WIN.x / MM}, ${WIN.y / MM}) mm`);
console.log(`frame ${FRAME / MM} mm · safety ${SAFE / MM} mm`);

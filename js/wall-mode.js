/* ────────────────────────────────────────────────────────────────────────────
   GRFT+ WALL MODE — fable experiment
   ────────────────────────────────────────────────────────────────────────────
   The site is the wall. A Graffiti+ can is held in-grip at the pointer:
   press and drag to spray over the live page using the real paint-engine
   (drips, halo, wetness — the actual product physics).

   POINTER GATING — this is a CURSOR experience, so it runs on DESKTOP ONLY
   (mouse/trackpad, `pointer: fine`). On touch devices nothing loads — no
   three.js, no model — and the site behaves exactly as normal. (A finger
   occludes the can and fights scroll, so touch is intentionally left out.)

   EASTER EGG — the can is not on by default. It rests on the page at a saved
   3D transform; click it to "pick it up" and arm paint mode. "Stop painting"
   (or Esc) sets it back down on the page. Add #place to the URL or press
   Shift+P to open the placement editor (drag to move; sliders for size + 3
   rotation axes; values save to localStorage and a Copy button bakes them in).

   Layers: page paint (z90, scrolls, under nav) · bar paint (z101, fixed with
   the bar) · jet mist · the 3D can (z9999, on top of everything). B = Clear.
   ──────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ACCENT = '#FEBD17';
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;   // primary pointer is a mouse/trackpad

/* ════════════════════════════════════════════════════════════════════════════
   ENTRY GATE — decide if/when to boot. Everything heavy lives in initWallMode()
   so a phone (finger only, no pencil) never loads it.
   ════════════════════════════════════════════════════════════════════════════ */
/* Desktop only: a fine pointer (mouse/trackpad) must be present. On touch
   devices nothing loads — the site behaves exactly as normal. */
let booted = false;
if (FINE) {
  booted = true;
  initWallMode();   // boots in REST mode: the can sits on the page as an easter egg
}

/* ════════════════════════════════════════════════════════════════════════════ */
function initWallMode() {

/* ---------------- DOM scaffolding ---------------- */
const css = `
  .wm-layer { position: fixed; inset: 0; width: 100vw; height: 100vh; }
  /* paint lives ON the page (scrolls), UNDER the sticky nav (z100), over content */
  #wm-paint { position: absolute; top: 0; left: 0; width: 100%; z-index: 90; pointer-events: none; }
  /* paint ON the bar — fixed with the bar so it never scrolls away */
  #wm-paint-nav { position: fixed; top: 0; left: 0; width: 100vw; z-index: 101; pointer-events: none; }
  #wm-jet   { z-index: 9001; pointer-events: none; }
  #wm-gl    { z-index: 9999; pointer-events: none; }   /* the can rides on top of EVERYTHING */
  body.wm-armed { cursor: none; }
  body.wm-armed a, body.wm-armed button { cursor: none; }
  body.wm-spraying { user-select: none; -webkit-user-select: none; }

  /* ── expanded toolbar: one wide row, minimal, sharp-cornered (brand grid) ── */
  .wm-bar {
    position: fixed; z-index: 9004;
    left: 14px; right: 14px; bottom: 14px;
    display: flex; align-items: stretch; gap: 16px;
    flex-wrap: nowrap; overflow-x: auto;
    background: rgba(0,13,16,0.92);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 10px 16px;
    font: 700 9px/1 'Inter', sans-serif;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    backdrop-filter: blur(10px);
  }
  .wm-bar::-webkit-scrollbar { height: 0; }
  body.wm-armed .wm-bar, body.wm-armed .wm-bar * { cursor: pointer !important; }
  .wm-bar input[type=range] { cursor: ew-resize !important; }

  .wm-sec { display: flex; align-items: center; gap: 9px; flex: none; }
  .wm-sec-col { flex-direction: column; align-items: flex-start; gap: 5px; justify-content: center; }
  .wm-lbl { font-size: 8px; color: rgba(255,255,255,0.4); letter-spacing: 0.16em; white-space: nowrap; }
  .wm-div { width: 1px; background: rgba(255,255,255,0.12); flex: none; }

  .wm-cap {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    border: 1px solid rgba(255,255,255,0.16); background: none; color: rgba(255,255,255,0.7);
    font: 700 8px/1 'Inter', sans-serif; letter-spacing: .04em; text-transform: uppercase;
    padding: 7px 8px; cursor: pointer; min-width: 52px;
    transition: background .16s, color .16s, border-color .16s;
  }
  .wm-capimg { width: 30px; height: 26px; object-fit: contain; display: block; -webkit-user-drag: none; }
  .wm-cap:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
  .wm-cap.active { border-color: ${ACCENT}; color: ${ACCENT}; background: rgba(254,189,23,0.12); }

  .wm-range { width: 96px; height: 3px; -webkit-appearance: none; appearance: none;
    background: rgba(255,255,255,0.2); outline: none; border-radius: 0; }
  .wm-range::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px;
    background: ${ACCENT}; border: 0; cursor: ew-resize; }
  .wm-range::-moz-range-thumb { width: 13px; height: 13px; background: ${ACCENT}; border: 0; cursor: ew-resize; }
  .wm-val { font-size: 8px; color: rgba(255,255,255,0.55); min-width: 26px; text-align: right; }

  .wm-swatch { width: 20px; height: 20px; padding: 0; cursor: pointer; flex: none;
    border: 1.5px solid rgba(255,255,255,0.22); box-sizing: border-box; transition: border-color .14s; }
  .wm-swatch:hover { border-color: rgba(255,255,255,0.7); }
  .wm-swatch.active { border-color: #fff; box-shadow: inset 0 0 0 1.5px #000; }
  .wm-hue { position: relative; width: 200px; height: 22px; flex: none; cursor: crosshair;
    border: 1px solid rgba(255,255,255,0.2);
    background: linear-gradient(to right,
      #ff0000 0%, #ff8a00 12%, #ffe600 25%, #38d900 38%, #00d9c2 52%,
      #0091ff 65%, #2a3bff 76%, #9b2dff 87%, #ff2db4 95%, #ff0000 100%); }
  .wm-hue-pin { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.6); pointer-events: none; }

  .wm-act { border: 1px solid rgba(255,255,255,0.2); background: none; color: rgba(255,255,255,0.75);
    font: 700 9px/1 'Inter', sans-serif; letter-spacing: .1em; text-transform: uppercase;
    padding: 9px 12px; cursor: pointer; flex: none; transition: background .18s, color .18s, border-color .18s; }
  .wm-act:hover { background: ${ACCENT}; border-color: ${ACCENT}; color: #000d10; }
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const paintC = document.createElement('canvas');
paintC.id = 'wm-paint'; paintC.className = 'wm-layer';
const jetC = document.createElement('canvas');
jetC.id = 'wm-jet'; jetC.className = 'wm-layer';
const glC = document.createElement('canvas');
glC.id = 'wm-gl'; glC.className = 'wm-layer';
const navC = document.createElement('canvas');     // paint that lands ON the sticky bar
navC.id = 'wm-paint-nav';
const writerImg = document.createElement('img');   // engine wants one; we never show it
writerImg.style.display = 'none';
document.body.append(paintC, navC, jetC, glC, writerImg);

const bar = document.createElement('div');
bar.className = 'wm-bar';
document.body.appendChild(bar);   // populated by buildToolbar() after the engine inits

/* ---------------- paint engine ---------------- */
GraffitiPaint.init({
  canvas: paintC,
  writer: writerImg,
  color: ACCENT,
  writerConfig: { spray: { brushSize: 46 } },
  minBrush: 8,
});
GraffitiPaint.setCap('spray');
GraffitiPaint.beginFreePaint();

/* ════════════════ CAPS + COLOR SYSTEM ════════════════
   Four caps, each ported onto the engine's primitives with real-cap behaviour:
     • NY Fat      — widest, high output, soft, drips readily (bombing / fills)
     • Banana      — soft fat cap, smooth even flow, fewer drips (fades / blends)
     • Pink Dot    — skinny cap, fine crisp lines, minimal overspray, rare drips
     • Calligraphy — flat chisel tip fixed at 45°: thick across, thin along, no drips
   ───────────────────────────────────────────────────── */
// Cap icons are the real product photos in /images/caps (transparent PNGs).
// Order matters — it's the toolbar order. Each spray cap fully specifies its
// drip params (incl. wetnessPerStamp) because setDripConfig MERGES — omitting a
// key would inherit the previous cap's value. sizeSlow is live-adjustable via
// the Size slider; sizeFast tracks it through _ratio (set below).
const CAPS = {
  banana:    { name: 'Banana',    img: 'banana',    engine: 'spray', sizeSlow: 18,  sizeFast: 9,   spacing: 0.05,  speedSpacing: 0.08,
               drip: { enabled: true, useWetness: true, wetnessPerStamp: 0.04, spawnThreshold: 1.30, spawnRate: 0.004, maxRateMultiplier: 3, initialThicknessFrac: 0.28, initialWetness: 1.0 } },
  lego:      { name: 'Lego',      img: 'lego',      engine: 'spray', sizeSlow: 52,  sizeFast: 28,  spacing: 0.05,  speedSpacing: 0.09,
               drip: { enabled: true, useWetness: true, wetnessPerStamp: 0.08, spawnThreshold: 0.75, spawnRate: 0.018, maxRateMultiplier: 4, initialThicknessFrac: 0.42, initialWetness: 1.4 } },
  fat:       { name: 'NY Fat',    img: 'nyfat',     engine: 'spray', sizeSlow: 70,  sizeFast: 36,  spacing: 0.05,  speedSpacing: 0.10,
               drip: { enabled: true, useWetness: true, wetnessPerStamp: 0.12, spawnThreshold: 0.45, spawnRate: 0.045, maxRateMultiplier: 5, initialThicknessFrac: 0.5,  initialWetness: 1.9 } },
  pink:      { name: 'Pink Dot',  img: 'pinkdot',   engine: 'spray', sizeSlow: 112, sizeFast: 56,  spacing: 0.05,  speedSpacing: 0.10,
               drip: { enabled: true, useWetness: true, wetnessPerStamp: 0.13, spawnThreshold: 0.42, spawnRate: 0.05,  maxRateMultiplier: 5, initialThicknessFrac: 0.62, initialWetness: 2.1 } },
  ultrawide: { name: 'Ultrawide', img: 'ultrawide', engine: 'chisel', angle: 0, blur: 0.42, sizeSlow: 150, sizeFast: 110, spacing: 0.045, speedSpacing: 0.05,
               drip: { enabled: true, useWetness: true, wetnessPerStamp: 0.07, spawnThreshold: 0.80, spawnRate: 0.014, maxRateMultiplier: 4, initialThicknessFrac: 0.45, initialWetness: 1.3 } },
};
Object.values(CAPS).forEach(c => { c._ratio = c.sizeFast / c.sizeSlow; });   // keep slow→fast feel when resized
let currentCapKey = 'banana';
function currentCap() { return CAPS[currentCapKey]; }
function setCapByKey(key) {
  if (!CAPS[key]) return;
  currentCapKey = key;
  const c = CAPS[key];
  GraffitiPaint.setCap(c.engine);
  if (c.engine === 'chisel') {
    if (c.angle != null) GraffitiPaint.setChiselAngle(c.angle);
    GraffitiPaint.setChiselBlur(c.blur || 0);
  }
  if (c.drip) GraffitiPaint.setDripConfig(c.engine, c.drip);
  bar.querySelectorAll('.wm-cap').forEach(b => b.classList.toggle('active', b.dataset.cap === key));
  const sz = bar.querySelector('#wm-size');           // Size slider reflects this cap
  if (sz) { sz.value = c.sizeSlow; const v = bar.querySelector('#wm-size-val'); if (v) v.textContent = Math.round(c.sizeSlow); }
}

/* ---- colour helpers (hex ⇄ rgb ⇄ hsl) ---- */
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbToHex(r, g, b) { const f = v => ('0' + Math.round(v).toString(16)).slice(-2); return '#' + f(r) + f(g) + f(b); }
function hexToHsl(hex) { let { r, g, b } = hexToRgb(hex); r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h, s, l = (mx + mn) / 2; if (mx === mn) { h = s = 0; } else { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); switch (mx) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; } h /= 6; } return { h: h * 360, s, l }; }
function hslToHex(h, s, l) { h /= 360; const hue = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; let r, g, b; if (s === 0) { r = g = b = l; } else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3); } return rgbToHex(r * 255, g * 255, b * 255); }

// Neutrals sit beside the rainbow strip (which covers every hue).
const NEUTRALS = ['#11151A', '#8A8F93', '#FFFFFF'];
let paintColor = ACCENT;
let paintOpacity = 1;
let navRGB = hexToRgb(ACCENT);     // current paint colour as rgb, for the bar sprayer
const CONCRETE_URL = '/images/concrete-wall.jpg';
new Image().src = CONCRETE_URL;    // warm the cache so the pickup reveal is instant
function setPaintColor(hex) {
  paintColor = hex;
  GraffitiPaint.setColor(hex);
  navRGB = hexToRgb(hex);
  // neutral swatch active state
  bar.querySelectorAll('.wm-swatch').forEach(b =>
    b.classList.toggle('active', (b.dataset.color || '').toLowerCase() === hex.toLowerCase()));
  // hue strip pin — positioned at the colour's hue, hidden for neutrals
  const pin = bar.querySelector('#wm-hue-pin'), strip = bar.querySelector('#wm-hue');
  if (pin && strip) {
    const { h, s } = hexToHsl(hex);
    if (s < 0.08) pin.style.display = 'none';
    else { pin.style.display = ''; pin.style.left = (h / 360 * strip.clientWidth) + 'px'; }
  }
}
function setFlow(pct) {
  paintOpacity = pct / 100;
  GraffitiPaint.setOpacity(paintOpacity);
  const v = bar.querySelector('#wm-flow-val'); if (v) v.textContent = pct + '%';
}

/* ---- build the expanded toolbar: one wide row ---- */
function buildToolbar() {
  const caps = Object.keys(CAPS).map(k =>
    `<button class="wm-cap" type="button" data-cap="${k}" title="${CAPS[k].name}"><img class="wm-capimg" src="/images/caps/${CAPS[k].img}.png" alt="" draggable="false"><span>${CAPS[k].name}</span></button>`).join('');
  const neutrals = NEUTRALS.map(c =>
    `<button class="wm-swatch" type="button" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  bar.innerHTML =
      '<div class="wm-sec">' + caps + '</div>'
    + '<span class="wm-div"></span>'
    + '<div class="wm-sec"><span class="wm-lbl">Size</span><input id="wm-size" class="wm-range" type="range" min="6" max="200"><span class="wm-val" id="wm-size-val"></span></div>'
    + '<div class="wm-sec"><span class="wm-lbl">Flow</span><input id="wm-flow" class="wm-range" type="range" min="10" max="100"><span class="wm-val" id="wm-flow-val"></span></div>'
    + '<span class="wm-div"></span>'
    + '<div class="wm-sec">' + neutrals
    +   '<div class="wm-hue" id="wm-hue" title="Pick a colour"><span class="wm-hue-pin" id="wm-hue-pin"></span></div>'
    + '</div>'
    + '<span class="wm-div"></span>'
    + '<button class="wm-act" id="wm-buff" type="button">Clear</button>'
    + '<button class="wm-act" id="wm-down" type="button">Stop</button>';

  bar.querySelectorAll('.wm-cap').forEach(b => b.addEventListener('click', () => setCapByKey(b.dataset.cap)));
  bar.querySelectorAll('.wm-swatch').forEach(b => b.addEventListener('click', () => setPaintColor(b.dataset.color)));

  // rainbow hue strip — click or drag to pick any hue
  const strip = bar.querySelector('#wm-hue');
  let hueDrag = false;
  const pickHue = (e) => {
    const r = strip.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setPaintColor(hslToHex(t * 360, 0.85, 0.52));
  };
  strip.addEventListener('pointerdown', (e) => { hueDrag = true; pickHue(e); e.preventDefault(); e.stopPropagation(); });
  window.addEventListener('pointermove', (e) => { if (hueDrag) pickHue(e); });
  window.addEventListener('pointerup', () => { hueDrag = false; });

  // size (per-cap) + flow (transparency) sliders
  const sizeEl = bar.querySelector('#wm-size'), sizeVal = bar.querySelector('#wm-size-val');
  sizeEl.addEventListener('input', () => { currentCap().sizeSlow = +sizeEl.value; sizeVal.textContent = sizeEl.value; });
  const flowEl = bar.querySelector('#wm-flow');
  flowEl.addEventListener('input', () => setFlow(+flowEl.value));
  flowEl.value = 100;
}
buildToolbar();
setCapByKey(currentCapKey);
setFlow(100);
setPaintColor(paintColor);

/* Full-document paint surface at DPR 1: the engine's own resize targets the
   viewport rect at retina DPR, which would be ~150MB for a whole page. Spray
   is soft by nature, so DPR 1 is invisible here. Runs after the engine's
   resize listener (registered first) so this version wins. */
function pinPaintCanvas() {
  const h = document.documentElement.scrollHeight;
  paintC.style.height = h + 'px';
  paintC.width = document.documentElement.clientWidth;
  paintC.height = h;
  paintC.getContext('2d').setTransform(1, 0, 0, 1, 0, 0);
}
pinPaintCanvas();
window.addEventListener('resize', pinPaintCanvas);

/* ---- bar surface: its own fixed paint layer ----
   The sticky nav is a separate physical surface: paint that hits it must
   ride WITH it, not scroll with the wall. Strokes are routed by zone; this
   mini-sprayer mimics the engine's stamp look (soft core, overspray halo,
   short clipped drips) on the bar strip. */
const navCtx = navC.getContext('2d');
let navBottom = 0;
const navWet = new Map();                 // x-bucket → accumulated wetness
function sizeNavCanvas() {
  const nav = document.querySelector('nav');
  navBottom = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
  navC.width = innerWidth * DPR; navC.height = navBottom * DPR;
  navC.style.height = navBottom + 'px';
  navCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
sizeNavCanvas();
window.addEventListener('resize', sizeNavCanvas);

function navStamp(x, y, size) {
  const r = size / 2;
  const cc = navRGB, rgba = (a) => `rgba(${cc.r},${cc.g},${cc.b},${a * paintOpacity})`;
  const fade = 1 - speedNorm() * 0.65;        // fast pass = fainter mist
  const g = navCtx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(0.16 * fade));
  g.addColorStop(0.55, rgba(0.10 * fade));
  g.addColorStop(1, rgba(0));
  navCtx.fillStyle = g;
  navCtx.beginPath(); navCtx.arc(x, y, r, 0, 7); navCtx.fill();
  // overspray dust
  navCtx.fillStyle = rgba(0.05);
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, rr = r * (1 + Math.random());
    navCtx.beginPath();
    navCtx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.8, 0, 7);
    navCtx.fill();
  }
  // wetness → short drips, clipped to the bar (they stop at its edge)
  const k = Math.round(x / 9);
  const w = (navWet.get(k) || 0) + 1;
  if (w > 7 && Math.random() < 0.3) {
    const len = 14 + Math.random() * (navBottom - y);
    const lg = navCtx.createLinearGradient(0, y, 0, y + len);
    lg.addColorStop(0, rgba(0.5));
    lg.addColorStop(1, rgba(0));
    navCtx.fillStyle = lg;
    navCtx.fillRect(x + (Math.random() - 0.5) * 6 - 1.1, y, 2.2, len);
    navWet.set(k, 0);
  } else navWet.set(k, w);
}
function navSpraySegment(x0, y0, x1, y1, size) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(d / (size * (0.12 + speedNorm() * 0.2))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    navStamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size);
  }
}

/* ---------------- 3D can (in your grip) ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas: glC, antialias: true, alpha: true });
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;   // real gaussian blur on the shadow

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer)
  .fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 0, 10);

const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
key.position.set(1.4, 2.2, 12);               // over your shoulder, slightly up-right
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.radius = 18;                       // wide gaussian penumbra (VSM)
key.shadow.blurSamples = 18;
key.shadow.bias = -0.0002;
key.shadow.camera.near = 0.1; key.shadow.camera.far = 40;
key.shadow.camera.left = key.shadow.camera.bottom = -2.4;
key.shadow.camera.right = key.shadow.camera.top = 2.4;
scene.add(key, key.target);

/* invisible shadow catcher just behind the can — the "page" the can floats
   over. Renders ONLY the shadow, so the site shows through everywhere else. */
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShadowMaterial({ opacity: 0.3 })
);
shadowPlane.position.z = -0.07;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);
scene.add(new THREE.DirectionalLight(0x9fd8ff, 1.1).position.set(-3, 1, -2) && new THREE.AmbientLight(0x223038, 0.5));

const can = new THREE.Group();
can.visible = false;
scene.add(can);

// cap/valve materials — yellow when the can rests, darkened while painting
// (so the nozzle aimed at the wall shows no yellow tip)
const capMats = [];
const CAP_YELLOW = 0xC78F00, CAP_DARK = 0x2c3033;
function setCapPainting(on) { capMats.forEach(m => m.color.set(on ? CAP_DARK : CAP_YELLOW)); }

let nozzleLocal = new THREE.Vector3();
const labelTex = new THREE.TextureLoader().load('3d/grft_can_texture.png');
labelTex.flipY = true;
labelTex.colorSpace = THREE.SRGBColorSpace;
labelTex.anisotropy = 8;
labelTex.wrapS = labelTex.wrapT = THREE.ClampToEdgeWrapping;
labelTex.center.set(0.5, 0.587);       // pivot = the logo's own center in the texture
                                       // (measured: bbox center of the wordmark, flipY)

/* ---- label (logo) placement on the can body ----
   The GRFT+ wordmark is a texture on the body mesh; these tune where it sits
   and how big it reads. scale>1 = bigger logo; offX/offY shift it; rot turns it.
   Add #place (or Shift+P) to edit live; values persist + can be copied. */
const LABEL_DEFAULT = { offX: 0.465, offY: -0.5, scale: 0.43, rot: -1.57 };   // resting egg
// Painting pose shows the can at a different angle, so the logo gets its own
// transform (tuned in the editor's "Painting" pose).
const LABEL_HAND = { offX: 0.455, offY: 0.165, scale: 0.39, rot: -1.56 };
let label = Object.assign({}, LABEL_DEFAULT);
try { const ls = localStorage.getItem('grft-can-label'); if (ls) label = Object.assign(label, JSON.parse(ls)); } catch (e) {}
function saveLabel() { try { localStorage.setItem('grft-can-label', JSON.stringify(label)); } catch (e) {} }
let labelHand = Object.assign({}, LABEL_HAND);
try { const lh = localStorage.getItem('grft-can-label-hand'); if (lh) labelHand = Object.assign(labelHand, JSON.parse(lh)); } catch (e) {}
function saveLabelHand() { try { localStorage.setItem('grft-can-label-hand', JSON.stringify(labelHand)); } catch (e) {} }
function applyLabel(cfg) {
  cfg = cfg || label;
  labelTex.repeat.set(1 / cfg.scale, 1 / cfg.scale);       // smaller repeat → bigger logo
  labelTex.offset.set(cfg.offX, cfg.offY);
  labelTex.rotation = cfg.rot;
  labelTex.needsUpdate = true;
}
applyLabel();

new GLTFLoader().load('3d/montana_grft.glb', (gltf) => {
  const model = gltf.scene;
  model.traverse(o => {
    if (o.isMesh) o.castShadow = true;
    if (o.isMesh && o.material) {
      o.material.envMapIntensity = 1.1;
      if (o.material.metalness > 0.95) o.material.roughness = Math.min(o.material.roughness, 0.18);
      if (o.material.name === 'Material.005') {        // body → black + GRFT+ label
        o.material.map = labelTex;
        o.material.color.set(0xffffff);
        o.material.metalness = 0.3;
        o.material.roughness = 0.42;
        o.material.needsUpdate = true;
      }
      if (o.material.name === 'Material.002' || o.material.name === 'Material.007') {
        o.material.color.set(CAP_YELLOW);               // cap → brand yellow (pre-tonemap)
        o.material.roughness = 0.3;
        o.material.envMapIntensity = 0.7;
        capMats.push(o.material);
      }
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1.6 / size.y;                               // can ≈1.6 world units tall
  model.scale.setScalar(s);
  model.rotation.y = -1.15;                             // GRFT+ label faces the viewer
  // Rig the group so its ORIGIN is the nozzle tip: the can pivots around the
  // cap, and paint lands exactly under it. Body extends downward into the hand.
  model.position.copy(center).multiplyScalar(-s);
  model.position.y -= size.y * s * 0.5;                 // nozzle (top of can) → origin
  nozzleLocal.set(0, 0, 0);
  can.add(model);
});

/* screen px → world coords on the z=0 plane */
function screenToWorld(x, y, out) {
  const ndc = new THREE.Vector3((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const t = -camera.position.z / dir.z;
  return out.copy(camera.position).addScaledVector(dir, t);
}

/* ---------------- jet particles ---------------- */
const jctx = jetC.getContext('2d');
const jets = [];
/* contact splatter: spray hits the wall right under the cap and mists
   outward in a shallow ring, heavier toward the floor like real bounce-back */
function emitJet(x, y, dt) {
  for (let i = 0; i < 70 * dt * 60; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    jets.push({ x, y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp * 0.6 + 30,      // gravity bias
                life: 0.10 + Math.random() * 0.10,
                r: 0.5 + Math.random() * 1.3 });
  }
}
function stepJets(dt) {
  jctx.clearRect(0, 0, innerWidth, innerHeight);
  jctx.fillStyle = paintColor;
  for (let i = jets.length - 1; i >= 0; i--) {
    const p = jets[i];
    p.life -= dt;
    if (p.life <= 0) { jets.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.9; p.vy *= 0.9;
    jctx.globalAlpha = Math.min(0.5, p.life * 3) * 0.5 * paintOpacity;
    jctx.beginPath(); jctx.arc(p.x, p.y, p.r, 0, 7); jctx.fill();
  }
  // faint contact dot while idle — gone the moment paint takes over
  if (armed && !spraying) {
    jctx.globalAlpha = 0.55;
    jctx.beginPath(); jctx.arc(cur.x, cur.y, 1.6, 0, 7); jctx.fill();
  }
  jctx.globalAlpha = 1;
}

/* ---------------- hiss ---------------- */
let actx = null, hissGain = null;
function startHiss() {
  if (REDUCED) return;
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const len = actx.sampleRate * 2;
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 4.2; }
    const src = actx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.5;
    hissGain = actx.createGain(); hissGain.gain.value = 0;
    src.connect(bp).connect(hissGain).connect(actx.destination);
    src.start();
  }
  actx.resume();
  hissGain.gain.cancelScheduledValues(actx.currentTime);
  hissGain.gain.setTargetAtTime(0.13, actx.currentTime, 0.02);
}
function stopHiss() { if (hissGain) hissGain.gain.setTargetAtTime(0, actx.currentTime, 0.05); }

/* ---------------- interaction ---------------- */
let armed = false;
let down = false, spraying = false, sprayedThisGesture = false;
let downX = 0, downY = 0;
const cur = { x: innerWidth / 2, y: innerHeight * 0.6 };
const prevPt = { x: 0, y: 0 };
let speedPx = 0;                       // smoothed pointer speed → spray width
let lastMoveT = 0;

// pickup tween: the can lifts from its resting pose up into the hand
let lifting = false, liftP = 0;
const LIFT_DUR = 0.5;                   // seconds
const liftStart = { pos: new THREE.Vector3(), scale: 1, rot: new THREE.Euler() };
const HAND_TIP = -0.2;                 // forward tilt while painting: nozzle aims INTO
                                        // the wall so the yellow tip faces away from view

/* ---- resting can (the easter egg) + placement ----------------------------
   The can sits on the page at a saved 3D transform until it's clicked
   ("picked up"), which arms paint mode. Add #place to the URL (or press
   Shift+P) to drag / scale / rotate it and copy the final values. */
const REST_DEFAULT = { xFrac: 0.191, pageY: 633, scale: 0.61, rotX: -0.04, rotY: -1.52, rotZ: -0.5 };
let rest = Object.assign({}, REST_DEFAULT);
try { const sv = localStorage.getItem('grft-rest-can'); if (sv) rest = Object.assign(rest, JSON.parse(sv)); } catch (e) {}
function saveRest() { try { localStorage.setItem('grft-rest-can', JSON.stringify(rest)); } catch (e) {} }

let mode = location.hash.toLowerCase().includes('place') ? 'place' : 'rest';   // 'rest' | 'place' | 'hand'
let editPose = 'rest';                 // in place mode: which pose's logo we're tuning ('rest'|'hand')
bar.style.display = 'none';            // toolbar only appears once the can is in hand

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let placeDrag = false;
function canHit(x, y) {
  if (!can.visible) return false;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(can, true).length > 0;
}

function arm() {                       // pick up the can → it follows the cursor
  liftStart.pos.copy(can.position);   // tween FROM wherever it was resting…
  liftStart.scale = can.scale.x;
  liftStart.rot.copy(can.rotation);
  liftP = 0; lifting = true;
  mode = 'hand'; armed = true;
  setCapPainting(true);                // cap goes dark → no yellow tip while painting
  applyLabel(labelHand);             // upright logo for the face-on painting pose
  document.body.classList.add('wm-armed');
  can.visible = true;
  bar.style.display = '';
  if (window.__hero) window.__hero.reveal(CONCRETE_URL);   // buff the hero to bare concrete
}
function disarm() {                    // put the can back down — it stays on the page as the egg
  armed = false; down = false;
  if (spraying) { spraying = false; stopHiss(); }
  document.body.classList.remove('wm-armed', 'wm-spraying');
  bar.style.display = 'none';
  setCapPainting(false);              // cap returns to yellow as it sits back down
  applyLabel(label);                  // restore the resting-pose logo transform
  if (window.__hero) window.__hero.restore();   // bring the hero photo back
  mode = 'rest';
}

/* Only a real pointer drives the can. Finger touches are ignored. */
function isPaintPointer(e) { return e.pointerType !== 'touch'; }

function onPointerDown(e) {
  if (e.button !== 0 || !isPaintPointer(e)) return;
  if (e.target && e.target.closest && e.target.closest('.wm-bar, .wm-place')) return;

  if (mode === 'place') {                        // grab the can to reposition it (resting pose only)
    if (editPose === 'rest' && canHit(e.clientX, e.clientY)) { placeDrag = true; sprayedThisGesture = true; e.preventDefault(); e.stopPropagation(); }
    return;
  }
  if (mode === 'rest') {                          // click the resting can to pick it up
    if (canHit(e.clientX, e.clientY)) { sprayedThisGesture = true; e.preventDefault(); e.stopPropagation(); arm(); }
    return;                                       // a miss falls through → normal page click
  }
  // mode === 'hand'
  if (!armed) return;
  if (e.pointerType === 'pen') e.preventDefault();
  down = true; sprayedThisGesture = false;
  downX = e.clientX; downY = e.clientY;
  cur.x = e.clientX; cur.y = e.clientY;
  prevPt.x = cur.x; prevPt.y = cur.y;
}
document.addEventListener('pointerdown', onPointerDown, true);

document.addEventListener('pointermove', (e) => {
  if (!isPaintPointer(e)) return;       // finger → leave it to the page (scroll)
  cur.x = e.clientX; cur.y = e.clientY;

  if (mode === 'place') {               // dragging the can to a new spot
    if (placeDrag) { rest.xFrac = e.clientX / innerWidth; rest.pageY = e.clientY + scrollY; syncPanel(); e.preventDefault(); }
    return;
  }
  if (mode !== 'hand' || !armed || !down) { lastMoveT = performance.now(); return; }

  const now = performance.now();
  const dtm = Math.max(1, now - lastMoveT);   // ms since previous move
  lastMoveT = now;
  if (e.pointerType === 'pen') e.preventDefault();   // pencil paints, doesn't scroll
  if (!spraying && Math.hypot(cur.x - downX, cur.y - downY) > 6) beginSpray();
  if (spraying) {
    const v = Math.hypot(cur.x - prevPt.x, cur.y - prevPt.y);
    // time-normalized hand speed (px per 16ms frame)
    speedPx = speedPx * 0.8 + (v / dtm) * 16 * 0.2;
    if (cur.y <= navBottom) {            // on the bar: fixed surface
      navSpraySegment(prevPt.x, prevPt.y, cur.x, cur.y, brushSize());
    } else {                             // on the wall: scrolls with content
      sprayWallSegment(prevPt.x + scrollX, prevPt.y + scrollY, cur.x + scrollX, cur.y + scrollY);
    }
    prevPt.x = cur.x; prevPt.y = cur.y;
  }
}, { passive: false });

function beginSpray() {
  spraying = true; sprayedThisGesture = true;
  document.body.classList.add('wm-spraying');
  startHiss();
}
function endPointer(e) {
  if (e && !isPaintPointer(e)) return;
  if (placeDrag) { placeDrag = false; saveRest(); }
  if (spraying) { spraying = false; stopHiss(); }
  down = false;
  document.body.classList.remove('wm-spraying');
}
document.addEventListener('pointerup', endPointer, true);
document.addEventListener('pointercancel', endPointer, true);

/* quick click = click; a gesture that sprayed must not also activate links */
document.addEventListener('click', (e) => {
  if (sprayedThisGesture && !(e.target.closest && e.target.closest('.wm-bar'))) {
    e.preventDefault(); e.stopPropagation();
  }
  sprayedThisGesture = false;
}, true);

/* aerosol physics: constant flow, so the hand's speed decides the line.
   Slow = fat, dense, wet (drips build). Fast = thinner AND fainter. */
function speedNorm() { return Math.min(1, speedPx / 45); }
// width is per-cap: slow hand = fat line, fast hand = thin (constant for calligraphy,
// which varies by stroke direction instead).
function brushSize() { const c = currentCap(); const fast = c.sizeSlow * c._ratio; return c.sizeSlow - speedNorm() * (c.sizeSlow - fast); }
/* fast strokes also deposit LESS: stamps spread further apart the faster
   you move, so coverage thins out instead of staying solid */
function sprayWallSegment(x0, y0, x1, y1) {
  const c = currentCap();
  const size = brushSize();
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const spacing = Math.max(1.0, size * (c.spacing + speedNorm() * c.speedSpacing));
  const steps = Math.max(1, Math.ceil(dist / spacing));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    GraffitiPaint.paintAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size);
  }
}

/* ---- placement editor panel (visible only in 'place' mode) ---- */
const ppBtn = 'width:100%;padding:8px;background:#FEBD17;border:none;color:#000d10;'
  + 'font:800 10px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;';
const poseBtn = 'flex:1;padding:7px 0;border:1px solid #444;background:none;color:#bbb;'
  + 'font:800 9px/1 Inter,sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;';
function lbl(name, id, min, max, step) {
  return '<label style="display:block;margin-bottom:7px">' + name
    + '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step
    + '" style="width:100%;accent-color:#FEBD17;margin-top:3px"></label>';
}
const panel = document.createElement('div');
panel.className = 'wm-place';
panel.style.cssText = 'position:fixed;top:14px;right:14px;z-index:99999;width:220px;'
  + 'max-height:calc(100vh - 28px);overflow-y:auto;'
  + 'background:rgba(0,13,16,.95);border:1px solid #FEBD17;padding:14px;'
  + 'font:600 11px/1.6 Inter,system-ui,sans-serif;color:#fff;letter-spacing:.04em;display:none';
panel.innerHTML =
    '<div style="font-weight:800;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px">Place the can</div>'
  + '<div style="color:#FEBD17;margin-bottom:11px">drag the can to move it</div>'
  + lbl('Size', 'pp-scale', '0.3', '2.5', '0.01')
  + lbl('Tip · X', 'pp-rx', '-1.57', '1.57', '0.01')
  + lbl('Turn · Y', 'pp-ry', '-3.14', '3.14', '0.01')
  + lbl('Lean · Z', 'pp-rz', '-1.57', '1.57', '0.01')
  + '<div style="font-weight:800;text-transform:uppercase;letter-spacing:.12em;margin:13px 0 8px;border-top:1px solid #1c2a2e;padding-top:11px">Logo</div>'
  + '<div style="color:#8a8f93;margin-bottom:7px">tuning the <b id="pp-pose-label" style="color:#FEBD17">resting</b> pose</div>'
  + '<div style="display:flex;gap:6px;margin-bottom:11px">'
  +   '<button type="button" id="pp-pose-rest" style="' + poseBtn + '">Resting</button>'
  +   '<button type="button" id="pp-pose-hand" style="' + poseBtn + '">Painting</button>'
  + '</div>'
  + lbl('Logo size', 'pp-lsize', '0.3', '3', '0.01')
  + lbl('Logo X', 'pp-lx', '-0.5', '0.5', '0.005')
  + lbl('Logo Y', 'pp-ly', '-0.5', '0.5', '0.005')
  + lbl('Logo turn', 'pp-lrot', '-3.14', '3.14', '0.01')
  + '<pre id="pp-out" style="margin:8px 0;padding:7px;background:#000;color:#9fe6ff;'
  + 'font:500 10px/1.45 ui-monospace,monospace;white-space:pre-wrap;border:1px solid #1c2a2e"></pre>'
  + '<button type="button" id="pp-copy" style="' + ppBtn + '">Copy values</button>'
  + '<button type="button" id="pp-reset" style="' + ppBtn + 'margin-top:6px;background:none;border:1px solid #444;color:#bbb">Reset</button>';
document.body.appendChild(panel);

const ppOut = panel.querySelector('#pp-out');
// which logo config the Logo sliders edit, based on the pose being tuned
function activeLabel() { return editPose === 'hand' ? labelHand : label; }
function saveActiveLabel() { editPose === 'hand' ? saveLabelHand() : saveLabel(); }
const f3 = (n) => +n.toFixed(3), f2 = (n) => +n.toFixed(2);
function syncPanel() {
  panel.querySelector('#pp-scale').value = rest.scale;
  panel.querySelector('#pp-rx').value = rest.rotX;
  panel.querySelector('#pp-ry').value = rest.rotY;
  panel.querySelector('#pp-rz').value = rest.rotZ;
  const L = activeLabel();
  panel.querySelector('#pp-lsize').value = L.scale;
  panel.querySelector('#pp-lx').value = L.offX;
  panel.querySelector('#pp-ly').value = L.offY;
  panel.querySelector('#pp-lrot').value = L.rot;
  panel.querySelector('#pp-pose-label').textContent = editPose === 'hand' ? 'painting' : 'resting';
  ppOut.textContent = 'REST_DEFAULT = {\n'
    + ' xFrac: ' + f3(rest.xFrac) + ', pageY: ' + Math.round(rest.pageY) + ',\n'
    + ' scale: ' + f2(rest.scale) + ',\n'
    + ' rotX: ' + f2(rest.rotX) + ', rotY: ' + f2(rest.rotY) + ', rotZ: ' + f2(rest.rotZ) + '\n}\n'
    + 'LABEL_DEFAULT = {  // resting\n'
    + ' offX: ' + f3(label.offX) + ', offY: ' + f3(label.offY) + ',\n'
    + ' scale: ' + f2(label.scale) + ', rot: ' + f2(label.rot) + '\n}\n'
    + 'LABEL_HAND = {  // painting\n'
    + ' offX: ' + f3(labelHand.offX) + ', offY: ' + f3(labelHand.offY) + ',\n'
    + ' scale: ' + f2(labelHand.scale) + ', rot: ' + f2(labelHand.rot) + '\n}';
}
function bindRange(id, key) {
  panel.querySelector(id).addEventListener('input', (e) => {
    rest[key] = parseFloat(e.target.value); saveRest(); syncPanel();
  });
}
function bindLabel(id, key) {
  panel.querySelector(id).addEventListener('input', (e) => {
    const cfg = activeLabel(); cfg[key] = parseFloat(e.target.value);
    saveActiveLabel(); applyLabel(cfg); syncPanel();
  });
}
bindRange('#pp-scale', 'scale'); bindRange('#pp-rx', 'rotX'); bindRange('#pp-ry', 'rotY'); bindRange('#pp-rz', 'rotZ');
bindLabel('#pp-lsize', 'scale'); bindLabel('#pp-lx', 'offX'); bindLabel('#pp-ly', 'offY'); bindLabel('#pp-lrot', 'rot');

// switch which pose we're tuning — flips the can preview + the cap + the logo target
function setEditPose(p) {
  editPose = p;
  if (p === 'hand') { setCapPainting(true); applyLabel(labelHand); }
  else { setCapPainting(false); applyLabel(label); }
  const rB = panel.querySelector('#pp-pose-rest'), hB = panel.querySelector('#pp-pose-hand');
  const on = 'background:#FEBD17;border-color:#FEBD17;color:#000d10;', off = 'background:none;border-color:#444;color:#bbb;';
  rB.style.cssText = poseBtn + (p === 'rest' ? on : off);
  hB.style.cssText = poseBtn + (p === 'hand' ? on : off);
  syncPanel();
}
panel.querySelector('#pp-pose-rest').addEventListener('click', () => setEditPose('rest'));
panel.querySelector('#pp-pose-hand').addEventListener('click', () => setEditPose('hand'));

panel.querySelector('#pp-copy').addEventListener('click', () => {
  const b = panel.querySelector('#pp-copy');
  if (navigator.clipboard) navigator.clipboard.writeText(ppOut.textContent);
  b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = 'Copy values'; }, 1200);
});
panel.querySelector('#pp-reset').addEventListener('click', () => {
  rest = Object.assign({}, REST_DEFAULT);
  label = Object.assign({}, LABEL_DEFAULT);
  labelHand = Object.assign({}, LABEL_HAND);
  saveRest(); saveLabel(); saveLabelHand(); applyLabel(activeLabel()); syncPanel();
});

function setPlaceMode(on) {
  mode = on ? 'place' : 'rest';
  panel.style.display = on ? '' : 'none';
  if (on) { armed = false; bar.style.display = 'none'; document.body.classList.remove('wm-armed'); setEditPose('rest'); }
  else { editPose = 'rest'; setCapPainting(false); applyLabel(label); }
}
if (mode === 'place') setPlaceMode(true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (mode === 'place') setPlaceMode(false); else disarm(); }
  if ((e.key === 'p' || e.key === 'P') && e.shiftKey) setPlaceMode(mode !== 'place');
  if ((e.key === 'b' || e.key === 'B') && armed) buff();
});
function buff() {
  GraffitiPaint.clear();
  GraffitiPaint.beginFreePaint();
  navCtx.clearRect(0, 0, innerWidth, navBottom);
  navWet.clear();
}
document.getElementById('wm-buff').addEventListener('click', buff);
document.getElementById('wm-down').addEventListener('click', disarm);

/* hold-to-spray without moving: build wetness so drips form */
setInterval(() => {
  if (spraying && performance.now() - lastMoveT > 70) {
    speedPx *= 0.7;
    if (cur.y <= navBottom) navStamp(cur.x, cur.y, brushSize());
    else GraffitiPaint.paintAt(cur.x + scrollX, cur.y + scrollY, brushSize());
  }
}, 50);

/* ---------------- can follow + render loop ---------------- */
const canPos = new THREE.Vector3(0, -3, 0);
const wTarget = new THREE.Vector3();
let recoil = 0;
let prevT = performance.now();

function tick(now) {
  const dt = Math.min((now - prevT) / 1000, 0.05);
  prevT = now;

  if (mode === 'hand' && armed) {
    // nozzle rides the cursor: paint lands exactly under the cap.
    screenToWorld(cur.x, cur.y + 4, wTarget);

    if (lifting) {
      // smooth pickup: ease the can from its resting pose into the hand pose.
      liftP = Math.min(1, liftP + dt / LIFT_DUR);
      const e = 1 - Math.pow(1 - liftP, 3);        // ease-out cubic
      can.position.lerpVectors(liftStart.pos, wTarget, e);
      can.scale.setScalar(liftStart.scale + (1 - liftStart.scale) * e);
      can.rotation.x = liftStart.rot.x + (HAND_TIP - liftStart.rot.x) * e;
      can.rotation.y = liftStart.rot.y + (0    - liftStart.rot.y) * e;
      can.rotation.z = liftStart.rot.z + (0.22 - liftStart.rot.z) * e;
      canPos.copy(can.position);                    // hand off to follow-mode with no jump
      recoil = 0;
      if (liftP >= 1) lifting = false;
    } else {
      // A whisper of lag keeps the can alive without reading as dangling.
      canPos.lerp(wTarget, 1 - Math.pow(0.000001, dt));
      can.scale.setScalar(1);
      can.position.copy(canPos);

      // the can pivots AROUND the nozzle (group origin = cap tip).
      // RIGHT-HANDED grip: the body always hangs to the RIGHT of the contact
      // point — strokes deepen or shallow the angle, but it never pendulums
      // across to the left. Resting angle 0.22 rad; range 0.08 (near upright,
      // moving hard left) to 0.45 (deep lean, sweeping right).
      const vx = (wTarget.x - canPos.x);
      const lean = THREE.MathUtils.clamp(0.22 + vx * 1.6, 0.08, 0.45);
      can.rotation.y = 0;
      can.rotation.z += (lean - can.rotation.z) * (1 - Math.pow(0.0001, dt));
      can.rotation.x = HAND_TIP;                    // nozzle tipped into the wall
      if (spraying) {                               // pressure shiver at the tip
        can.rotation.z += (Math.random() - 0.5) * 0.012;
        can.rotation.x += (Math.random() - 0.5) * 0.012;
      }
      // recoil: pressing pushes the can BACK off the wall slightly (toward viewer)
      recoil += ((spraying ? 0.10 : 0) - recoil) * (1 - Math.pow(0.001, dt));
      can.position.z = recoil;

      if (spraying) emitJet(cur.x, cur.y, dt);
    }

    // shadow rig tracks the can: light stays over your shoulder
    key.position.set(can.position.x + 1.4, can.position.y + 2.2, 12);
    key.target.position.copy(can.position);
    key.target.updateMatrixWorld();
  } else if (mode === 'place' && editPose === 'hand') {
    placePaintPreview();    // tuning the painting-pose logo: show the can face-on
  } else {
    placeRestingCan();      // 'rest' or 'place'(resting): the can sits on the page
  }
  stepJets(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* painting-pose preview for the editor: show the can face-on, centered, at the
   in-hand orientation so the painting logo can be tuned against the real pose. */
function placePaintPreview() {
  screenToWorld(innerWidth * 0.5, innerHeight * 0.42, wTarget);
  can.position.copy(wTarget);
  can.position.z = 0;
  can.visible = true;
  can.scale.setScalar(1);
  can.rotation.set(HAND_TIP, 0, 0.22);
  key.position.set(can.position.x + 1.4, can.position.y + 2.2, 12);
  key.target.position.copy(can.position);
  key.target.updateMatrixWorld();
}

/* the easter-egg can at rest: pinned to a page spot (scrolls with content),
   at the saved size + 3D angle. Hidden when scrolled off-screen. */
function placeRestingCan() {
  const sx = rest.xFrac * innerWidth;
  const sy = rest.pageY - scrollY;
  const onScreen = sy > -300 && sy < innerHeight + 300;
  can.visible = onScreen;
  if (!onScreen) return;
  screenToWorld(sx, sy, wTarget);
  can.position.copy(wTarget);
  can.position.z = 0;
  can.scale.setScalar(rest.scale);
  can.rotation.set(rest.rotX, rest.rotY, rest.rotZ);
  key.position.set(can.position.x + 1.4, can.position.y + 2.2, 12);
  key.target.position.copy(can.position);
  key.target.updateMatrixWorld();
}

function sizeAll() {
  jetC.width = innerWidth * DPR; jetC.height = innerHeight * DPR;
  jctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener('resize', sizeAll);
sizeAll();
requestAnimationFrame(tick);

const api = { arm, disarm, buff, setPlaceMode,
              get mode() { return mode; }, get rest() { return rest; },
              _dbg: { scene, key, shadowPlane, can, renderer } };
window.__wallmode = api;
return api;

}  /* ── end initWallMode ── */

/* ────────────────────────────────────────────────────────────────────────────
   GRFT+ paint engine
   ────────────────────────────────────────────────────────────────────────────
   Canvas-based spray-can / marker text animator. Plays recorded human-hand
   traces through a stamp brush so any text in the GRFT+ font renders as if
   a writer is actually laying it down.

   This module is plain (no ES modules) on purpose: it gets inlined verbatim
   into the standalone HTML output of the `graffiti-text-animator` skill,
   and lives at the project root next to `opentype.min.js`.

   Single global export: `window.GraffitiPaint`.

   Usage:
     GraffitiPaint.init({
       canvas: document.getElementById('paint'),
       writer: document.getElementById('writer'),
       color: '#ffc800',
       speed: 1.0,                          // number OR () => number
       writerConfig: { spray:{...}, marker:{...} },   // optional overrides
       fontSizeRef: 720,                    // reference for sf scaling
       heightCap: 0.55,                     // fraction of stage height
       maxWidthFrac: 0.86,                  // fraction of stage width
       inkTimePerPoint: 6,                  // ms per coalesced sample
     });
     await GraffitiPaint.loadAssets({
       tracesFast: 'grft-traced-paths-404.json',   // optional warm-up
       tracesFull: 'grft-traced-paths.json',
       font:       'Fonts/GraffitiPlusDisplay-Regular.ttf',
       sprayImg:   'images/grft_branded_can.png',
       markerImg:  'images/grft_marker_true_top_down.png',
     });
     GraffitiPaint.setCap('spray');
     await GraffitiPaint.play('hello');

   Depends on:
     - `opentype.js` loaded before this script (window.opentype)

   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── Defaults (tuned for shipping; per-init overrides win) ─────────────────
  const DEFAULT_WRITER_CONFIG = {
    spray:  { img: 'images/grft_branded_can.png',
              anchorY: 0.04,   // nozzle near top of image
              imgHeight: 220,
              brushSize: 60 },
    marker: { img: 'images/grft_marker_true_top_down.png',
              anchorY: 0.95,   // tip at bottom of image
              imgHeight: 180,
              brushSize: 30 },
  };
  // Stamp spacing as a fraction of brush size — dense for spray (overdraw
  // builds the halo) wider for marker (opaque ink would just smear).
  const SPACING = { spray: 0.06, marker: 0.16 };

  // ── Engine state (single instance — only one engine per page) ─────────────
  let canvas = null;
  let writer = null;
  let pctx = null;
  let cfg = {
    color: '#ffc800',
    speed: 1.0,
    writerConfig: DEFAULT_WRITER_CONFIG,
    fontSizeRef: 720,
    heightCap: 0.55,
    maxHeightPx: 360,        // hard ceiling so it doesn't explode on big screens
    maxWidthFrac: 0.86,
    inkTimePerPoint: 6,
    baselineFrac: 0.62,      // where the baseline sits in the stage vertically
  };
  const cap = { current: 'spray' };
  const stampCache = new Map();
  let traces = null;
  let font = null;
  let abortToken = { aborted: false };
  let currentTilt = 0;
  let targetTilt  = 0;
  let writerImgHeight = 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sizeBucket = (s) => Math.max(2, Math.round(s / 2) * 2);
  const resolveSpeed = () =>
    typeof cfg.speed === 'function' ? cfg.speed() : cfg.speed;
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  // ── Stamp building + caching ──────────────────────────────────────────────
  function buildStamp(capName, col, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const r = size / 2;
    x.translate(r, r);
    if (capName === 'spray') {
      // SPRAY: soft radial halo + dense pixel grain (real aerosol noise)
      const cx = (Math.random()-0.5) * r * 0.16;
      const cy = (Math.random()-0.5) * r * 0.16;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    hexA(col, 0.55));
      g.addColorStop(0.35, hexA(col, 0.18));
      g.addColorStop(0.75, hexA(col, 0.04));
      g.addColorStop(1,    hexA(col, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, r, 0, Math.PI*2); x.fill();
      const grain = Math.min(700, Math.round(r * r * 0.55));
      for (let i = 0; i < grain; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.pow(Math.random(), 1.5) * r;
        const dx = Math.cos(a) * rr, dy = Math.sin(a) * rr;
        const edge = rr / r;
        const sz = (0.35 + Math.random()*0.9) * (1 - edge*0.5);
        const alpha = (0.05 + Math.random()*0.18) * (1 - edge*0.7);
        x.fillStyle = hexA(col, alpha);
        x.beginPath(); x.arc(dx, dy, sz, 0, Math.PI*2); x.fill();
      }
    } else {
      // MARKER (and any future opaque-cap default): bold solid ink with a
      // 15%-edge feather so it doesn't look like a pasted circle.
      const g = x.createRadialGradient(0, 0, r*0.85, 0, 0, r);
      g.addColorStop(0,    hexA(col, 1));
      g.addColorStop(0.85, hexA(col, 1));
      g.addColorStop(1,    hexA(col, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, r, 0, Math.PI*2); x.fill();
    }
    return c;
  }
  function getStamp(capName, size) {
    const bucket = sizeBucket(size);
    // Color in the cache key so per-init color overrides don't poison the cache.
    const k = `${capName}|${cfg.color}|${bucket}`;
    let s = stampCache.get(k);
    if (!s) { s = buildStamp(capName, cfg.color, bucket); stampCache.set(k, s); }
    return s;
  }
  function stampAt(x, y, size) {
    const s = getStamp(cap.current, size);
    pctx.drawImage(s, x - size/2, y - size/2, size, size);
  }
  function strokeSegment(x0, y0, x1, y1, size) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const spacing = Math.max(1, size * (SPACING[cap.current] || 0.12));
    const steps = Math.max(1, Math.ceil(dist / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stampAt(x0 + dx*t, y0 + dy*t, size);
    }
  }

  // ── Canvas + writer positioning ───────────────────────────────────────────
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(r.width  * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function clearCanvas() {
    pctx.save();
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, canvas.width, canvas.height);
    pctx.restore();
  }
  function setStrokeTilt() {
    const r = Math.random() * 2 - 1;
    targetTilt = Math.sign(r) * Math.pow(Math.abs(r), 2.2) * 4;
  }
  function positionWriter(x, y) {
    if (!writer) return;
    const wc = cfg.writerConfig[cap.current];
    const h = writerImgHeight || wc.imgHeight;
    currentTilt += (targetTilt - currentTilt) * 0.08;
    writer.style.left = x + 'px';
    writer.style.top  = (y - wc.anchorY * h) + 'px';
    writer.style.transform = `translate(-50%, 0) rotate(${currentTilt.toFixed(2)}deg)`;
  }
  function showWriter() { if (writer) writer.style.opacity = 1; }
  function hideWriter() { if (writer) writer.style.opacity = 0; }

  // ── Public API ────────────────────────────────────────────────────────────
  function init(opts) {
    if (!opts || !opts.canvas) throw new Error('GraffitiPaint.init: opts.canvas required');
    canvas = opts.canvas;
    writer = opts.writer || null;
    pctx = canvas.getContext('2d');

    // Merge user config over defaults.
    if (opts.color != null)            cfg.color = opts.color;
    if (opts.speed != null)            cfg.speed = opts.speed;
    if (opts.fontSizeRef != null)      cfg.fontSizeRef = opts.fontSizeRef;
    if (opts.heightCap != null)        cfg.heightCap = opts.heightCap;
    if (opts.maxHeightPx != null)      cfg.maxHeightPx = opts.maxHeightPx;
    if (opts.maxWidthFrac != null)     cfg.maxWidthFrac = opts.maxWidthFrac;
    if (opts.inkTimePerPoint != null)  cfg.inkTimePerPoint = opts.inkTimePerPoint;
    if (opts.baselineFrac != null)     cfg.baselineFrac = opts.baselineFrac;
    if (opts.writerConfig) {
      cfg.writerConfig = {
        spray:  Object.assign({}, DEFAULT_WRITER_CONFIG.spray,  opts.writerConfig.spray  || {}),
        marker: Object.assign({}, DEFAULT_WRITER_CONFIG.marker, opts.writerConfig.marker || {}),
      };
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function setCap(name) {
    cap.current = name;
    if (!writer) return;
    const wc = cfg.writerConfig[name];
    writer.src = wc.img;
    writer.style.height = wc.imgHeight + 'px';
    writer.style.width  = 'auto';
    // Pivot around the paint tip so the body wobbles but the tip stays glued
    // to the cursor — anchorY ≈ 0.04 for can (top), 0.95 for marker (bottom).
    writer.style.transformOrigin = `50% ${(wc.anchorY * 100).toFixed(1)}%`;
  }

  // Two-stage load: if tracesFast is given, that resolves init quickly so the
  // animation can start almost instantly; tracesFull background-loads to
  // unlock the full alphabet.
  async function loadAssets(urls) {
    if (!urls || !urls.font) throw new Error('GraffitiPaint.loadAssets: urls.font required');
    if (!urls.tracesFull && !urls.tracesFast) {
      throw new Error('GraffitiPaint.loadAssets: at least tracesFull or tracesFast required');
    }

    const firstTracesUrl = urls.tracesFast || urls.tracesFull;
    const [, loadedFont] = await Promise.all([
      fetch(firstTracesUrl, { cache: 'force-cache' })
        .then(r => { if (!r.ok) throw new Error('traces ' + r.status); return r.json(); })
        .then(j => { traces = j; }),
      new Promise((resolve, reject) => {
        window.opentype.load(urls.font, (err, f) => {
          if (err) reject(new Error('opentype: ' + (err.message || err)));
          else { font = f; resolve(f); }
        });
      }),
    ]);

    // Background-load the full set if a fast file was used for warm-up.
    if (urls.tracesFast && urls.tracesFull && urls.tracesFast !== urls.tracesFull) {
      fetch(urls.tracesFull, { cache: 'force-cache' })
        .then(r => r.ok ? r.json() : null)
        .then(full => { if (full) traces = full; })
        .catch(() => { /* keep the fast set */ });
    }

    return { font: loadedFont, traces };
  }

  // ── Layout helper: text → array of {char, x, y, scale, rotation} ──────────
  // Exposed so the tag designer can seed its layout from the same auto-fit
  // logic that play(text) uses, then let the user drag from there.
  //
  // Supports multi-line text (split on '\n'). Each line is centered
  // horizontally; the block of lines is centered vertically around the
  // existing single-line baseline (so single-line behavior is unchanged).
  function computeAutoLayout(text) {
    if (!font) throw new Error('GraffitiPaint.computeAutoLayout: font not loaded');
    const r = canvas.getBoundingClientRect();
    const STAGE_W = r.width, STAGE_H = r.height;
    const lines = String(text).split('\n');
    const lineHeightFactor = 1.05;

    // Seed fontSize from the single-line vertical budget. For multi-line we
    // shrink further so the whole block (ascent of first line + gaps between
    // baselines + descent of last line) fits in 86% of the stage height.
    let fontSize = Math.min(STAGE_H * cfg.heightCap, cfg.maxHeightPx) * 2;
    if (lines.length > 1) {
      const verticalBudget = STAGE_H * 0.86;
      // ascent + descent ≈ 1.0× fontSize (GRFT+ display)
      const blockH = (lines.length - 1) * fontSize * lineHeightFactor + fontSize;
      if (blockH > verticalBudget) {
        const k = verticalBudget / blockH;
        fontSize *= k;
      }
    }

    let scale = fontSize / font.unitsPerEm;
    const lineAdvances = lines.map(line => {
      let adv = 0;
      for (const ch of line) adv += font.charToGlyph(ch).advanceWidth * scale;
      return adv;
    });

    // Horizontal fit: shrink to whichever line is widest.
    const maxAdvance = lineAdvances.length ? Math.max.apply(null, lineAdvances) : 0;
    const maxWidth = STAGE_W * cfg.maxWidthFrac;
    if (maxAdvance > maxWidth) {
      const k = maxWidth / maxAdvance;
      fontSize *= k; scale *= k;
      for (let i = 0; i < lineAdvances.length; i++) lineAdvances[i] *= k;
    }

    // Distribute baselines. Single line stays at the existing baselineFrac
    // position (no change). Multi-line: the BLOCK is vertically centered
    // around 0.55 of stage height, leaving a bit more room for descenders.
    const lineGap = fontSize * lineHeightFactor;
    const blockCenterY = lines.length === 1
      ? STAGE_H * cfg.baselineFrac
      : STAGE_H * 0.55;
    const layout = [];
    for (let li = 0; li < lines.length; li++) {
      const adv = lineAdvances[li];
      const offset = (li - (lines.length - 1) / 2) * lineGap;
      const baselineY = blockCenterY + offset;
      let cursorX = (STAGE_W - adv) / 2;
      for (const ch of lines[li]) {
        const a = font.charToGlyph(ch).advanceWidth * scale;
        layout.push({ char: ch, x: cursorX, y: baselineY, scale: 1, rotation: 0 });
        cursorX += a;
      }
    }
    return { layout, fontSize, stage: { w: STAGE_W, h: STAGE_H }, lines: lines.length };
  }

  // ── Playback ──────────────────────────────────────────────────────────────
  // Auto-layout convenience: text → layout → playLayout.
  function play(text, opts) {
    opts = opts || {};
    if (!font || !traces) {
      return new Promise(resolve => setTimeout(() => resolve(play(text, opts)), 200));
    }
    const { layout, fontSize } = computeAutoLayout(text);
    return playLayout(layout, Object.assign({ fontSize }, opts));
  }

  // Core playback: takes an explicit layout, runs the engine.
  //   layout: [{ char, x, y, scale, rotation }]
  //     x, y     — baseline-anchor of the glyph, in canvas pixel coords
  //     scale    — fontSize multiplier (default 1)
  //     rotation — degrees, rotation around the glyph's center (default 0)
  //   opts: { speed?, cap?, fontSize? }
  //     fontSize — base size in px (default cfg.fontSizeRef). Per-char `scale`
  //                multiplies this.
  function playLayout(layout, opts) {
    opts = opts || {};
    if (!font || !traces) {
      return new Promise(resolve => setTimeout(() => resolve(playLayout(layout, opts)), 200));
    }
    const savedSpeed = cfg.speed;
    if (opts.speed != null) cfg.speed = opts.speed;
    if (opts.cap)           cap.current = opts.cap;

    abortToken.aborted = true;
    abortToken = { aborted: false };
    const token = abortToken;

    clearCanvas();
    resizeCanvas();
    const wc = cfg.writerConfig[cap.current];

    const fontSize = opts.fontSize || cfg.fontSizeRef;
    const sf = fontSize / cfg.fontSizeRef;
    const baseBrush = Math.max(12, wc.brushSize * sf);
    const baseImgH  = Math.max(80, wc.imgHeight * sf);
    if (writer) writer.style.height = baseImgH + 'px';
    writerImgHeight = baseImgH;

    // 1. Flatten layout → action timeline. Each action carries its own brush
    //    size since per-char scale changes the stroke footprint.
    const INK = cfg.inkTimePerPoint;
    const actions = [];
    let timeline = 0;
    for (const item of layout) {
      const ch = item.char;
      if (!ch || ch === ' ') {
        // Space: small pause; no actions.
        if (ch === ' ') timeline += 80;
        continue;
      }
      const data = traces?.letters?.[ch.toLowerCase()];
      if (!data || !(data.strokes || []).length) continue;

      const charScale = item.scale != null ? item.scale : 1;
      const charFontSize = fontSize * charScale;
      const charBrush = baseBrush * charScale;

      const glyph = font.charToGlyph(ch);
      const otPath = glyph.getPath(item.x, item.y, charFontSize);
      const obb = otPath.getBoundingBox();
      if (!obb || !isFinite(obb.x1)) continue;
      const tBox = { x: obb.x1, y: obb.y1, w: obb.x2 - obb.x1, h: obb.y2 - obb.y1 };

      const rotDeg = item.rotation || 0;
      const rad = rotDeg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const cx = (obb.x1 + obb.x2) / 2;
      const cy = (obb.y1 + obb.y2) / 2;

      for (const stroke of data.strokes) {
        const pts = stroke.points;
        if (!pts.length) continue;
        const t0 = pts[0].t;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          let px = tBox.x + p.nx * tBox.w;
          let py = tBox.y + p.ny * tBox.h;
          if (rad) {
            const dx = px - cx, dy = py - cy;
            px = cx + dx * cos - dy * sin;
            py = cy + dx * sin + dy * cos;
          }
          actions.push({
            x: px,
            y: py,
            t: timeline + (p.t - t0) + i * INK,
            first: i === 0,
            brushSize: charBrush,
          });
        }
        const last = pts[pts.length - 1];
        timeline += (last.t - t0) + pts.length * INK + 60;
      }
    }
    if (!actions.length) {
      cfg.speed = savedSpeed;
      return Promise.resolve();
    }

    // 2. rAF loop — speed scales the timeline linearly so the slider has a
    //    direct, predictable effect even at extreme values.
    showWriter();
    const startWall = performance.now();
    let lastIdx = -1, prev = null;
    return new Promise(resolve => {
      function tick(now) {
        if (token.aborted) { cfg.speed = savedSpeed; resolve(); return; }
        const elapsed = (now - startWall) * resolveSpeed();
        let idx = lastIdx;
        while (idx + 1 < actions.length && actions[idx+1].t <= elapsed) idx++;
        if (idx > lastIdx) {
          for (let i = lastIdx + 1; i <= idx; i++) {
            const a = actions[i];
            if (a.first || !prev) { setStrokeTilt(); stampAt(a.x, a.y, a.brushSize); }
            else strokeSegment(prev.x, prev.y, a.x, a.y, a.brushSize);
            prev = a;
          }
          positionWriter(prev.x, prev.y);
          lastIdx = idx;
        }
        if (lastIdx >= actions.length - 1) {
          hideWriter();
          cfg.speed = savedSpeed;
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function clear() {
    abortToken.aborted = true;
    if (pctx) clearCanvas();
    hideWriter();
  }
  function stop() {
    abortToken.aborted = true;
    hideWriter();
  }

  // Inject pre-loaded assets directly (skips the network path entirely).
  // Used by the standalone HTML output of the `graffiti-text-animator` skill
  // where the font + traces are inlined as base64/JSON literals, so there's
  // nothing to fetch.
  //
  //   font:   an opentype.js Font object (call opentype.parse(arrayBuffer))
  //   traces: a plain object matching the traces JSON shape
  function setAssets(assets) {
    if (assets.font)   font   = assets.font;
    if (assets.traces) traces = assets.traces;
    return { font, traces };
  }

  window.GraffitiPaint = {
    init, loadAssets, setAssets, play, playLayout, computeAutoLayout,
    setCap, clear, stop,
    // Exposed for tooling/debugging — host pages should not poke these.
    _internal: {
      getTraces: () => traces,
      getFont:   () => font,
      getCap:    () => cap.current,
    },
  };
})();

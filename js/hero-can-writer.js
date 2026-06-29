/*
 * hero-can-writer.js
 *
 * Drops the GRFT+ spray-can writer animation into a DOM container. Adapted
 * from proto-since-2008.html / the graffiti-text-animator skill template:
 * same per-letter mask architecture, recorder-bbox correction, cumulative-
 * length sync, smooth interpolation, straight-line travel, 5× speed baseline.
 *
 * Stripped down for hero use: no debug overlay, no UI controls, no outro
 * fly-off. After the last letter is written the can settles next to the
 * wordmark and becomes a clickable trigger (cursor: pointer + onCanClick).
 *
 * Usage:
 *   GrftHeroCanWriter.init({
 *     container:    '#hero-anim',        // CSS selector or HTMLElement
 *     text:         'since 2008',
 *     color:        '#ffc800',           // GRFT+ glyph fill
 *     onCanClick:   () => enterPaintMode(),
 *     // optional overrides:
 *     assets: { font: 'Fonts/GraffitiPlusDisplay-Regular.ttf',
 *               can:  'images/grft_branded_can.png',
 *               traces: 'Letter animations/grft-traced-paths.json' }
 *   });
 */

(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ── Stage / glyph geometry (matches the proto so the cached recordings line up) ──
  const VIEW_W      = 1400;
  const VIEW_H      = 500;
  const FONT_SIZE   = 280;
  const BASELINE_Y  = 340;
  const CAN_W       = 320;
  const CAN_H       = 320;

  // The recorder rendered each letter in a 600x600 SVG, GRFT+ font-size 500,
  // baseline 470, text-anchor=middle at x=300. Its stored bbox is the
  // <text>.getBBox() layout box, not the glyph's ink box — so we recompute
  // the true ink box via opentype and remap stored coords through it.
  const REC_FONT_SIZE = 500;
  const REC_BASELINE  = 470;
  const REC_CENTER_X  = 300;

  // ── Defaults (proto-tuned) ──
  const DEFAULTS = {
    text:           'since 2008',
    color:          '#ffc800',
    align:          'center',  // 'left' | 'center' | 'right' — horizontal alignment inside the SVG viewBox
    renderMode:     'reveal',  // 'reveal' = SVG mask unmask of GRFT+ glyph; 'paint' = real spray-paint stamps on a canvas
    paintBrushSize: 60,        // (paint mode only) flare stamp diameter
    paintCap:       'flare',   // (paint mode only) 'flare' or 'chisel'
    strokeWidth:    50,
    speedMult:      1.2,
    speedBaseline:  5.0,   // baked-in 5× over recording speed
    canTilt:        -5,    // right-hander grip
    canRestOffset:  { dx: 80, dy: 0 },   // can's resting position relative to last stroke end (close to the wordmark)
    onCanClick:     null,
    assets: {
      font:   'Fonts/GraffitiPlusDisplay-Regular.ttf',
      can:    'images/grft_branded_can.png',
      traces: 'Letter animations/grft-traced-paths.json'
    }
  };

  const EASINGS = {
    linear:       t => t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInCubic:  t => t * t * t,
    easeInOut:    t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2
  };

  function tween({ duration, easing = 'easeOutCubic', onUpdate, token }) {
    return new Promise(resolve => {
      const start = performance.now();
      const ease = EASINGS[easing] || EASINGS.linear;
      function tick() {
        if (token && token.aborted) { resolve(); return; }
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / duration);
        onUpdate(ease(t), t);
        if (t >= 1) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  async function loadFont(url) {
    return new Promise((resolve, reject) => {
      opentype.load(url, (err, f) => err ? reject(err) : resolve(f));
    });
  }

  // ── Spray-paint engine (lifted from experiment-paint.html) ──
  // Builds a stand-alone canvas that paints the spray-can stamps. The
  // hero-anim host sizes the SVG; we mirror that size for the canvas so
  // viewBox coordinates (0..VIEW_W, 0..VIEW_H) translate directly to canvas
  // pixels. Returns: { canvas, ctx, strokeSegment(x0,y0,x1,y1, vel), resize }.
  function makePaintEngine(containerEl, opts, svgForSizing) {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top  = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    const ctx = canvas.getContext('2d');

    function resize() {
      // Match the SVG's rendered size so coordinates line up
      const r = svgForSizing.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width  = r.width + 'px';
      canvas.style.height = r.height + 'px';
      // Map viewBox (0..VIEW_W, 0..VIEW_H) → canvas pixels (× DPR)
      const sx = (r.width  / VIEW_W) * dpr;
      const sy = (r.height / VIEW_H) * dpr;
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
    }

    // Resolve CSS-variable colors to hex (e.g. "var(--accent)" → "#ffc800")
    function resolveHex(c) {
      if (!c) return '#ffc800';
      if (c.startsWith('#') && (c.length === 7 || c.length === 4)) return c.length === 7 ? c : '#' + c.slice(1).split('').map(x => x+x).join('');
      const probe = document.createElement('span');
      probe.style.color = c;
      containerEl.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      const m = rgb.match(/\d+/g);
      if (!m) return '#ffc800';
      return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
    }
    const colorHex = resolveHex(opts.color);

    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    }

    // ── Stamp pre-render cache (one canvas per cap/color/size bucket) ──
    const stampCache = new Map();
    const sizeBucket = (s) => Math.max(2, Math.round(s / 2) * 2);

    function buildStamp(capName, col, size) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      const r = size / 2;
      x.translate(r, r);
      if (capName === 'flare') {
        const cx = (Math.random() - 0.5) * r * 0.18;
        const cy = (Math.random() - 0.5) * r * 0.18;
        const ph1 = Math.random() * Math.PI * 2;
        const ph2 = Math.random() * Math.PI * 2;
        const ph3 = Math.random() * Math.PI * 2;
        const noisyR = (a) =>
          r * (1 + 0.14 * Math.sin(2*a + ph1)
                 + 0.09 * Math.sin(3*a + ph2)
                 + 0.05 * Math.sin(5*a + ph3));
        const g1 = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g1.addColorStop(0,    hexA(col, 0.42));
        g1.addColorStop(0.35, hexA(col, 0.13));
        g1.addColorStop(0.80, hexA(col, 0.025));
        g1.addColorStop(1,    hexA(col, 0));
        x.fillStyle = g1; x.beginPath(); x.arc(0, 0, r, 0, Math.PI*2); x.fill();
        const ox = (Math.random() - 0.5) * r * 0.4;
        const oy = (Math.random() - 0.5) * r * 0.4;
        const g2 = x.createRadialGradient(ox, oy, 0, ox, oy, r * 0.7);
        g2.addColorStop(0, hexA(col, 0.18));
        g2.addColorStop(1, hexA(col, 0));
        x.fillStyle = g2; x.beginPath(); x.arc(0, 0, r, 0, Math.PI*2); x.fill();
        const grainCount = Math.min(900, Math.round(r * r * 0.7));
        for (let i = 0; i < grainCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const rEdge = noisyR(a);
          const rr = Math.pow(Math.random(), 1.4) * rEdge;
          const dx = cx + Math.cos(a) * rr;
          const dy = cy + Math.sin(a) * rr;
          const edge = rr / rEdge;
          const sz = (0.35 + Math.random() * 1.1) * (1 - edge * 0.5);
          const alpha = (0.05 + Math.random() * 0.18) * (1 - edge * 0.7);
          x.fillStyle = hexA(col, alpha);
          x.beginPath(); x.arc(dx, dy, sz, 0, Math.PI*2); x.fill();
        }
        const flyCount = Math.round(grainCount * 0.05);
        for (let i = 0; i < flyCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = noisyR(a) * (1.0 + Math.random() * 0.22);
          const sz = 0.4 + Math.random() * 0.9;
          x.fillStyle = hexA(col, 0.10 + Math.random() * 0.18);
          x.beginPath(); x.arc(cx + Math.cos(a)*rr, cy + Math.sin(a)*rr, sz, 0, Math.PI*2); x.fill();
        }
      } else if (capName === 'chisel') {
        const nibW = r * 1.75;
        const nibH = r * 0.42;
        x.rotate(-Math.PI / 5);
        x.fillStyle = hexA(col, 1);
        x.fillRect(-nibW / 2, -nibH / 2, nibW, nibH);
      }
      return c;
    }

    function getStamp(capName, col, size) {
      const bucket = sizeBucket(size);
      const k = `${capName}|${col}|${bucket}`;
      let s = stampCache.get(k);
      if (!s) { s = buildStamp(capName, col, bucket); stampCache.set(k, s); }
      if (stampCache.size > 120) stampCache.delete(stampCache.keys().next().value);
      return s;
    }

    const SPACING = { flare: 0.06, chisel: 0.08 };
    let lastFlareScale = 1.0;
    let lastVel = 0;

    function flareSpeedScale() {
      return Math.max(0.65, 0.95 - lastVel * 0.12);
    }

    function stampAt(x, y, scaleOverride) {
      const stamp = getStamp(opts.paintCap, colorHex, opts.paintBrushSize);
      let s = stamp.width;
      if (opts.paintCap === 'flare') {
        s = s * (scaleOverride != null ? scaleOverride : flareSpeedScale());
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * Math.PI * 2);
        ctx.drawImage(stamp, -s/2, -s/2, s, s);
        ctx.restore();
      } else {
        ctx.drawImage(stamp, x - s/2, y - s/2, s, s);
      }
    }

    // velocity-aware segment stamper; vel in viewBox-units / ms.
    function strokeSegment(x0, y0, x1, y1, vel) {
      lastVel = vel || 0;
      const dx = x1 - x0, dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const spacing = Math.max(1, opts.paintBrushSize * (SPACING[opts.paintCap] || 0.12));
      const steps = Math.max(1, Math.ceil(dist / spacing));
      const targetScale = opts.paintCap === 'flare' ? flareSpeedScale() : 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (opts.paintCap === 'flare') {
          const scale = lastFlareScale + (targetScale - lastFlareScale) * t;
          stampAt(x0 + dx * t, y0 + dy * t, scale);
        } else {
          stampAt(x0 + dx * t, y0 + dy * t);
        }
      }
      if (opts.paintCap === 'flare') lastFlareScale = targetScale;
    }

    function clear() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      // Reapply transform
      resize();
    }

    // Initial size — also re-size on first frame in case container wasn't laid out yet
    requestAnimationFrame(resize);
    window.addEventListener('resize', resize);

    return { canvas, ctx, strokeSegment, stampAt, resize, clear };
  }

  async function loadTraces(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`traces HTTP ${res.status}`);
    return res.json();
  }

  function init(userOpts) {
    const opts = Object.assign({}, DEFAULTS, userOpts);
    opts.assets = Object.assign({}, DEFAULTS.assets, userOpts && userOpts.assets);

    const containerEl = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;
    if (!containerEl) {
      console.warn('[hero-can-writer] container not found:', opts.container);
      return null;
    }

    // ── Build SVG stage ──
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // Sizing is controlled by the host page's CSS (e.g. .hero-anim-stage svg).
    // Don't set inline width/height here — inline styles would override the
    // host's height: clamp(...) and cause the SVG to balloon to 100% width.
    svg.style.overflow = 'visible';
    svg.style.position = 'relative';
    svg.style.zIndex = '2';

    const defsEl = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defsEl);

    const filledGroup = document.createElementNS(SVG_NS, 'g');
    // Set via style so CSS variables (e.g. "var(--accent)") resolve correctly.
    filledGroup.style.fill = opts.color;
    svg.appendChild(filledGroup);

    const can = document.createElementNS(SVG_NS, 'image');
    can.setAttribute('href', opts.assets.can);
    can.setAttribute('width', CAN_W);
    can.setAttribute('height', CAN_H);
    can.setAttribute('x', 0);
    can.setAttribute('y', 0);
    can.style.opacity = '0';
    svg.appendChild(can);

    // Paint-mode renderer (lifted from experiment-paint.html). When active,
    // we paint actual spray-paint stamps onto a canvas instead of unmasking
    // GRFT+ glyphs. The recorded path drives the same can motion; the
    // canvas just gets stamps deposited along it.
    let paintEngine = null;
    if (opts.renderMode === 'paint') {
      // Set container to relative so absolute-positioned canvas+svg stack inside it
      const cs = getComputedStyle(containerEl);
      if (cs.position === 'static') containerEl.style.position = 'relative';
      paintEngine = makePaintEngine(containerEl, opts, svg);
    }

    containerEl.replaceChildren(svg);
    if (paintEngine) containerEl.insertBefore(paintEngine.canvas, svg);

    // ── State ──
    let font = null;
    let traces = null;
    let cancelToken = { aborted: false };
    let _maskCounter = 0;

    function makeLetterMask() {
      const id = `grfthero-lm-${++_maskCounter}`;
      const m = document.createElementNS(SVG_NS, 'mask');
      m.setAttribute('id', id);
      m.setAttribute('maskUnits', 'userSpaceOnUse');
      m.setAttribute('x', '0'); m.setAttribute('y', '0');
      m.setAttribute('width', VIEW_W); m.setAttribute('height', VIEW_H);
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
      bg.setAttribute('width', VIEW_W); bg.setAttribute('height', VIEW_H);
      bg.setAttribute('fill', 'black');
      m.appendChild(bg);
      defsEl.appendChild(m);
      return { id, el: m };
    }

    function buildLetters(text) {
      if (!font) return [];

      let totalWidth = 0;
      for (const ch of text) {
        totalWidth += font.charToGlyph(ch).advanceWidth * (FONT_SIZE / font.unitsPerEm);
      }

      // Small left/right pad so glyphs with side bearings (e.g. the curve
      // of S) don't get clipped at the SVG edge when align is 'left'/'right'.
      const PAD = 30;
      let cursorX;
      if (opts.align === 'left')       cursorX = PAD;
      else if (opts.align === 'right') cursorX = VIEW_W - totalWidth - PAD;
      else                              cursorX = (VIEW_W - totalWidth) / 2;
      const out = [];

      for (const ch of text) {
        const glyph   = font.charToGlyph(ch);
        const advance = glyph.advanceWidth * (FONT_SIZE / font.unitsPerEm);

        if (ch === ' ') { cursorX += advance; continue; }

        const otPath = glyph.getPath(cursorX, BASELINE_Y, FONT_SIZE);
        const d = otPath.toPathData(2);
        const letterMask = opts.renderMode === 'paint' ? null : makeLetterMask();
        let filled = null;
        // In 'reveal' mode the GRFT+ glyph sits behind a per-letter mask.
        // In 'paint' mode there's no underlying glyph — strokes ARE the letter.
        if (opts.renderMode !== 'paint' && d && d.length > 5) {
          filled = document.createElementNS(SVG_NS, 'path');
          filled.setAttribute('d', d);
          filled.setAttribute('mask', `url(#${letterMask.id})`);
          filledGroup.appendChild(filled);
        }

        const traceData = traces && traces.letters && traces.letters[ch.toLowerCase()];
        if (!traceData || !traceData.strokes || traceData.strokes.length === 0) {
          out.push({ ch, strokes: [], fallback: true, advance, cursorX, letterMask, filled });
          cursorX += advance;
          continue;
        }

        const bb = otPath.getBoundingBox();
        const targetBox = { x: bb.x1, y: bb.y1, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };

        const recProvisional = glyph.getPath(0, REC_BASELINE, REC_FONT_SIZE);
        const rbb = recProvisional.getBoundingBox();
        const recVisualCenter = (rbb.x1 + rbb.x2) / 2;
        const recShift = REC_CENTER_X - recVisualCenter;
        const recTrueBox = {
          x: rbb.x1 + recShift, y: rbb.y1,
          w: rbb.x2 - rbb.x1, h: rbb.y2 - rbb.y1
        };
        const recOldBox = traceData.bbox || recTrueBox;

        const strokes = traceData.strokes.map(stroke => {
          const points = stroke.points.map(p => {
            const absX = recOldBox.x + p.nx * recOldBox.width;
            const absY = recOldBox.y + p.ny * recOldBox.height;
            const nxFixed = (absX - recTrueBox.x) / recTrueBox.w;
            const nyFixed = (absY - recTrueBox.y) / recTrueBox.h;
            return {
              x: targetBox.x + nxFixed * targetBox.w,
              y: targetBox.y + nyFixed * targetBox.h,
              t: p.t
            };
          });

          // Compute cumulative geometric length per point (needed by both render modes
          // — reveal uses it to sync mask dashoffset to can position; paint uses it
          // for velocity calc on each segment).
          const cumLen = [0];
          for (let k = 1; k < points.length; k++) {
            cumLen.push(cumLen[k-1] + Math.hypot(points[k].x - points[k-1].x, points[k].y - points[k-1].y));
          }

          const result = {
            points, cumLen,
            duration: Math.max(120, points[points.length - 1].t || 400)
          };

          // Reveal-mode-only assets: per-stroke SVG mask path
          if (opts.renderMode !== 'paint') {
            const pathD = 'M ' + points.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L ');
            const maskPath = document.createElementNS(SVG_NS, 'path');
            maskPath.setAttribute('d', pathD);
            maskPath.setAttribute('stroke', 'white');
            maskPath.setAttribute('stroke-width', opts.strokeWidth);
            maskPath.setAttribute('stroke-linecap', 'round');
            maskPath.setAttribute('stroke-linejoin', 'round');
            maskPath.setAttribute('fill', 'none');
            letterMask.el.appendChild(maskPath);

            const len = maskPath.getTotalLength();
            const hiddenOffset = len + opts.strokeWidth;
            maskPath.style.strokeDasharray = `${len} 999999`;
            maskPath.style.strokeDashoffset = hiddenOffset;

            result.maskPath = maskPath;
            result.length = len;
            result.hiddenOffset = hiddenOffset;
          }

          return result;
        });

        out.push({ ch, strokes, advance, cursorX, letterMask, filled });
        cursorX += advance;
      }

      return out;
    }

    function placeCan(x, y, scale = 1, mode = 'writing') {
      const nozzleOffsetX = CAN_W * 0.5;
      const nozzleOffsetY = CAN_H * 0.04;  // middle of white nozzle cap
      const tx = x - nozzleOffsetX;
      const ty = y - nozzleOffsetY;
      can.setAttribute(
        'transform',
        `translate(${tx} ${ty}) rotate(${opts.canTilt} ${nozzleOffsetX} ${nozzleOffsetY}) scale(${scale})`
      );
      can.style.opacity = 1;
    }

    function currentCanPos() {
      const tr = can.getAttribute('transform') || '';
      const m = tr.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!m) return { x: 0, y: 0 };
      return { x: parseFloat(m[1]) + CAN_W * 0.5, y: parseFloat(m[2]) + CAN_H * 0.04 };
    }

    function hopCan(fromX, fromY, toX, toY, duration, token) {
      return tween({
        duration, token, easing: 'easeInOut',
        onUpdate: (eased) => {
          placeCan(fromX + (toX - fromX) * eased, fromY + (toY - fromY) * eased);
        }
      });
    }

    function playStroke(stroke, token) {
      const pts = stroke.points;
      const total = stroke.duration / (opts.speedMult * opts.speedBaseline);
      const cumLen = stroke.cumLen;
      const lastCum = cumLen[cumLen.length - 1] || 1;
      const lastT = pts[pts.length - 1].t;
      const isPaint = opts.renderMode === 'paint';
      // Reveal-mode bookkeeping
      const hiddenOffset = stroke.hiddenOffset;
      const len = stroke.length;
      const sw = isPaint ? 0 : (parseFloat(stroke.maskPath.getAttribute('stroke-width')) || opts.strokeWidth);
      // Paint-mode bookkeeping
      let lastPaintX = pts[0].x, lastPaintY = pts[0].y;
      let lastPaintFrameT = 0;
      return new Promise(resolve => {
        const start = performance.now();
        function tick() {
          if (token && token.aborted) { resolve(); return; }
          const elapsed = performance.now() - start;
          const tNorm = Math.min(1, elapsed / total);
          const targetT = lastT * tNorm;

          let i = 0;
          while (i < pts.length - 1 && pts[i + 1].t <= targetT) i++;
          let x, y, segCumLen;
          if (i < pts.length - 1) {
            const p0 = pts[i], p1 = pts[i + 1];
            const segSpan = p1.t - p0.t;
            const segFrac = segSpan > 0 ? (targetT - p0.t) / segSpan : 0;
            x = p0.x + (p1.x - p0.x) * segFrac;
            y = p0.y + (p1.y - p0.y) * segFrac;
            segCumLen = cumLen[i] + (cumLen[i + 1] - cumLen[i]) * segFrac;
          } else {
            x = pts[i].x; y = pts[i].y; segCumLen = cumLen[i];
          }

          placeCan(x, y);

          if (isPaint) {
            // Deposit a paint segment from last frame position to current.
            // Velocity = distance/time (viewBox units per ms) used by flare scale.
            const frameDt = elapsed - lastPaintFrameT;
            const dx = x - lastPaintX, dy = y - lastPaintY;
            const dist = Math.hypot(dx, dy);
            const vel = frameDt > 0 ? dist / frameDt : 0;
            if (dist > 0.1) paintEngine.strokeSegment(lastPaintX, lastPaintY, x, y, vel);
            lastPaintX = x; lastPaintY = y; lastPaintFrameT = elapsed;
          } else {
            const frac = segCumLen / lastCum;
            const off = frac > 0 ? (len * (1 - frac) + sw / 2) : hiddenOffset;
            stroke.maskPath.style.strokeDashoffset = off.toFixed(2);
          }

          if (tNorm >= 1) {
            if (!isPaint) stroke.maskPath.style.strokeDashoffset = 0;
            placeCan(pts[pts.length - 1].x, pts[pts.length - 1].y);
            resolve();
          } else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }

    async function play(text) {
      if (!font || !traces) return;
      cancelToken.aborted = true;
      cancelToken = { aborted: false };
      const token = cancelToken;

      defsEl.replaceChildren();
      filledGroup.replaceChildren();
      _maskCounter = 0;
      if (paintEngine) paintEngine.clear();
      can.style.opacity = 0;
      can.style.cursor = 'default';
      can.onclick = null;

      const letters = buildLetters(text);
      const animated = letters.filter(l => l.strokes.length > 0);
      if (animated.length === 0) return;

      // INTRO — fly in from off-screen top-left, straight to first stroke
      const first = animated[0].strokes[0];
      const landX = first.points[0].x;
      const landY = first.points[0].y;
      placeCan(-300, -200, 1.1);

      await tween({
        duration: 150, token,
        onUpdate: (eased) => {
          placeCan(-300 + (landX + 300) * eased, -200 + (landY + 200) * eased, 1.1 - 0.1 * eased);
        }
      });

      // 3 quick wobbles
      for (let i = 0; i < 3; i++) {
        if (token.aborted) return;
        await tween({ duration: 18, token, onUpdate: (eased) => placeCan(landX + Math.sin(eased * Math.PI) * 6, landY) });
        await tween({ duration: 18, token, onUpdate: (eased) => placeCan(landX - Math.sin(eased * Math.PI) * 6, landY) });
      }

      // LETTERS
      for (const letter of animated) {
        if (token.aborted) return;
        for (const stroke of letter.strokes) {
          if (token.aborted) return;
          const canPos = currentCanPos();
          const dist = Math.hypot(stroke.points[0].x - canPos.x, stroke.points[0].y - canPos.y);
          if (dist > 20) {
            await hopCan(canPos.x, canPos.y, stroke.points[0].x, stroke.points[0].y, Math.max(35, Math.min(90, dist * 0.11)), token);
          }
          await playStroke(stroke, token);
        }
      }

      // Snap-reveal any fallback letters (reveal mode only — paint mode has nothing to reveal)
      if (opts.renderMode !== 'paint') {
        letters.forEach(l => {
          if (l.strokes.length === 0 && l.filled && l.letterMask) {
            const bb = l.filled.getBBox();
            const cover = document.createElementNS(SVG_NS, 'rect');
            cover.setAttribute('x', bb.x); cover.setAttribute('y', bb.y);
            cover.setAttribute('width', bb.width); cover.setAttribute('height', bb.height);
            cover.setAttribute('fill', 'white');
            l.letterMask.el.appendChild(cover);
          }
        });
      }

      // EXIT — accelerate off the right edge of the stage. Slight upward tilt
      // so it feels like the writer's hand swept up and away.
      const last = animated[animated.length - 1];
      const lastStroke = last.strokes[last.strokes.length - 1];
      const endPt = lastStroke.points[lastStroke.points.length - 1];
      const exitX = endPt.x + 1800;   // well past viewBox right edge
      const exitY = endPt.y - 220;    // lift up while exiting

      await tween({
        duration: 480, easing: 'easeInCubic', token,
        onUpdate: (eased) => {
          placeCan(endPt.x + (exitX - endPt.x) * eased, endPt.y + (exitY - endPt.y) * eased, 1, 'travel');
          // Fade out in the last 40% so the can doesn't pop disappear at the edge
          can.style.opacity = eased < 0.6 ? 1 : (1 - (eased - 0.6) / 0.4);
        }
      });
      can.style.opacity = 0;

      // The can is gone, but the painted wordmark stays. Make the wordmark
      // area itself the click target for entering paint mode.
      if (typeof opts.onCanClick === 'function') {
        containerEl.style.pointerEvents = 'auto';
        containerEl.style.cursor = 'pointer';
        containerEl.onclick = opts.onCanClick;
      }
    }

    // Boot
    (async function boot() {
      try {
        [font, traces] = await Promise.all([
          loadFont(opts.assets.font),
          loadTraces(opts.assets.traces)
        ]);
        play(opts.text);
      } catch (e) {
        console.error('[hero-can-writer] init failed:', e);
      }
    })();

    // Public handle so callers can replay or change text
    return {
      replay: (t) => play(t || opts.text),
      svg
    };
  }

  global.GrftHeroCanWriter = { init };
})(window);

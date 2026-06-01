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
  // Cap names: 'spray' (aerosol can), 'chisel' (flat-tip ink marker, no
  // drips, calligraphic strokes), 'mop' (round mop-marker, heavy ink,
  // lots of drips). 'marker' and 'bomber' are legacy aliases for 'mop'
  // — resolveCap() maps them so older pages (404.html) and any old
  // saved code keep working without edits.
  const DEFAULT_WRITER_CONFIG = {
    spray:  { img: 'images/grft_branded_can.png',
              anchorY: 0.04,   // nozzle near top of image
              imgHeight: 220,
              brushSize: 60 },
    chisel: { img: 'images/grft_marker_true_top_down.png',
              anchorY: 0.985,  // tip at bottom of image (measured from PNG ink bounds)
              imgHeight: 180,
              brushSize: 36 },
    mop:    { img: 'images/grft_mop_marker_top_down.png',
              anchorY: 0.086,  // mop marker's tip is at the TOP of the PNG
              imgHeight: 180,
              brushSize: 30 },
  };
  // Stamp spacing as a fraction of brush size — dense for spray (overdraw
  // builds the halo), tight for chisel (solid ink), slightly looser for
  // mop (the round opaque stamp would smear with heavy overlap).
  const SPACING = { spray: 0.06, chisel: 0.10, mop: 0.16 };

  // 'marker' and 'bomber' → 'mop' alias resolver. Applied at every config
  // lookup so legacy callers (setCap('marker') in 404.html, setCap('bomber')
  // in older builds) route to the mop configs.
  function resolveCap(name) {
    if (name === 'marker' || name === 'bomber') return 'mop';
    return name;
  }

  // ── Drip physics per cap ──────────────────────────────────────────────────
  // The dripping behaviour is the single biggest differentiator between
  // graffiti tools, and the user-facing brushes have to feel different in
  // exactly the way each real tool behaves:
  //
  //   - SPRAY CAN: drips form mostly where paint goes OVER PAINT (the bottom
  //     of an 'N' where the down-stroke crosses the up-stroke is the classic
  //     example). The engine tracks a low-resolution "wetness grid"; every
  //     stamp adds wetness to its cell. When a stamp hits a cell whose
  //     wetness is already above the spray spawn threshold, a drip can spawn
  //     — probability scales with how saturated the cell is.
  //
  //   - CHISEL MARKER (future cap): no drips. Flat tip + thick ink that
  //     dries instantly — `enabled: false`.
  //
  //   - BOMBING MARKER (the existing 'marker' cap): drips a lot, scattered
  //     along strokes, not tied to overlap. Uses a constant per-stamp
  //     probability and ignores the wetness grid.
  //
  //   - FIRE EXTINGUISHER (future cap): drips constantly, fat. Same model
  //     as bombing marker but with a much higher spawn rate and thicker
  //     initial drips. Slot reserved here so adding the cap later is just
  //     a config entry + a stamp builder.
  //
  // Drip lifecycle: spawned by stampAt() → ticked by tickDrips() each frame
  // (gravity, drag, thinning, wetness drain) → removed when wetness ≤ 0 or
  // it falls off the stage. Drips keep ticking AFTER the main playback ends
  // (ensureDripLoop) so a trail can finish dribbling.
  const DEFAULT_DRIP_CONFIG = {
    spray: {
      enabled: true,
      // Wetness grid — drips only spawn where paint accumulates.
      useWetness: true,
      wetnessPerStamp: 0.05,
      spawnThreshold: 0.85,       // a hair earlier than before
      spawnRate: 0.020,           // ~+65% vs first tuning
      maxRateMultiplier: 5,       // hot cells can spawn even more
      // Physics
      initialVelocity: 6,         // px/sec downward at spawn
      gravity: 260,               // px/sec²
      drag: 0.985,                // multiplier per frame at 60fps; normalized via dt
      wetnessDrain: 0.016,        // slightly longer-lived → drips travel further
      thicknessDrain: 0.005,
      initialWetness: 1.6,
      initialThicknessFrac: 0.45, // multiplier on stamp size at spawn
      minThicknessFrac: 0.18,
      stampSpacingFrac: 0.18,     // tight overlap so drip reads as a stream, not dots
      spreadX: 6,                 // px horizontal jitter at spawn
      // Lateral drift — only some drips wander. The rest fall straight down.
      wanderChance: 0.55,         // % of drips that get any horizontal motion
      vxMax: 5,                   // ±px/sec constant lateral drift (random sign)
      swayAmpMax: 7,              // ±px sinusoidal sway around the base path
      swayFreqMin: 0.25,          // Hz
      swayFreqMax: 0.65,
    },
    mop: {  // mop marker — drips a lot, NOT overlap-driven
      enabled: true,
      useWetness: false,
      wetnessPerStamp: 0,
      spawnThreshold: 0,
      spawnRate: 0.007,
      maxRateMultiplier: 1,
      speedDependentDrips: true,   // slow strokes drip more, fast strokes less
      initialVelocity: 4,
      gravity: 240,
      drag: 0.985,
      wetnessDrain: 0.020,
      thicknessDrain: 0.011,
      initialWetness: 1.25,
      initialThicknessFrac: 0.45,
      minThicknessFrac: 0.18,
      stampSpacingFrac: 0.22,
      spreadX: 2,
      // Gloppy ink — wanders less often, and more subtly.
      wanderChance: 0.30,
      vxMax: 3,
      swayAmpMax: 3,
      swayFreqMin: 0.20,
      swayFreqMax: 0.45,
    },
    chisel: { enabled: false },     // dries instantly — never drips
    // Future cap (placeholder):
    //   fireExtinguisher: { enabled: true, spawnRate: 0.10, initialThicknessFrac: 1.2, ... }
  };

  // Low-res grid resolution for wetness tracking. 12px cells is granular
  // enough that an N's down-stroke and up-stroke land in adjacent cells
  // when they cross, and coarse enough that the grid stays tiny.
  const WET_CELL = 12;

  // ── Engine state (single instance — only one engine per page) ─────────────
  let canvas = null;
  let writer = null;
  let pctx = null;
  // Defaults for the writer entry/exit fly-in/out animation. All x/y values
  // are FRACTIONS of stage width / height (negative = off-screen left,
  // > 1 = off-screen right; 0 = top, 1 = bottom). ctrlYOffsetFrac is added
  // to the first/last paint point's Y (negative = above the paint point).
  // Override per-page by calling setEntryConfig() / setExitConfig().
  // Default bezier paths tuned by Alex in the tag designer's PATHS mode.
  // Entry sweeps from bottom-LEFT up through a control point INSIDE the
  // stage and BELOW the paint point, hooking into the first stroke from
  // below. Exit mirrors. (Values rounded from the designer's pixel-fine
  // tuning to keep the source readable.)
  const DEFAULT_ENTRY_CONFIG = {
    startXFrac: -0.25,        // off-screen LEFT
    startYFrac:  0.98,        // BOTTOM
    ctrlXFrac:   0.148,       // on-stage, just left of the paint area
    ctrlYOffsetFrac: 0.323,   // BELOW the paint point — gives the "rise from below" feel
    scale: 1.6,               // subtly larger at entry start (camera slightly far)
  };
  const DEFAULT_EXIT_CONFIG = {
    ctrlXFrac:   0.695,       // on-stage, right of the paint area
    ctrlYOffsetFrac: 0.316,   // BELOW the paint point — mirror of entry
    endXFrac:    1.25,        // off-screen RIGHT
    endYFrac:    0.98,        // BOTTOM
    scale: 1.6,
  };

  let cfg = {
    color: '#ffc800',
    speed: 1.0,
    travelSpeed: null,       // null = use speed; otherwise independent rate for inter-stroke air travel
    writerConfig: DEFAULT_WRITER_CONFIG,
    writerScale: 1.4,        // multiplier on writer image height (all phases) — Alex-tuned default
    dripConfig: DEFAULT_DRIP_CONFIG,
    entryConfig: Object.assign({}, DEFAULT_ENTRY_CONFIG),
    exitConfig:  Object.assign({}, DEFAULT_EXIT_CONFIG),
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
  const resolveTravelSpeed = () => {
    if (cfg.travelSpeed == null) return resolveSpeed();
    return typeof cfg.travelSpeed === 'function' ? cfg.travelSpeed() : cfg.travelSpeed;
  };
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
    } else if (capName === 'chisel') {
      // CHISEL marker: solid slanted rectangle (calligraphic flat tip).
      // The fixed orientation means stroke width varies with stroke
      // direction — strokes perpendicular to the long axis are FAT,
      // strokes parallel to it are THIN. That's exactly how a real
      // chisel-tip marker behaves. Slight feather on the long edges only
      // (not the short ends) so it reads as ink, not vector.
      x.rotate(-Math.PI / 6);  // -30° from horizontal
      const w = size * 1.0;
      const h = size * 0.30;
      x.fillStyle = hexA(col, 1);
      x.fillRect(-w/2, -h/2, w, h);
      // Soft feathered edge on top + bottom (the long edges) to soften the
      // hard rectangle without losing the chisel character.
      const grad = x.createLinearGradient(0, -h/2, 0, h/2);
      grad.addColorStop(0,    hexA(col, 0));
      grad.addColorStop(0.15, hexA(col, 0.4));
      grad.addColorStop(0.5,  hexA(col, 0));
      grad.addColorStop(0.85, hexA(col, 0.4));
      grad.addColorStop(1,    hexA(col, 0));
      x.fillStyle = grad;
      x.fillRect(-w/2, -h/2 - 1, w, h + 2);
    } else {
      // MOP (and any future opaque-cap default): bold solid ink with a
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
    const resolved = resolveCap(capName);
    // Color in the cache key so per-init color overrides don't poison the cache.
    const k = `${resolved}|${cfg.color}|${bucket}`;
    let s = stampCache.get(k);
    if (!s) { s = buildStamp(resolved, cfg.color, bucket); stampCache.set(k, s); }
    return s;
  }
  // ── Wetness grid + active drips ──────────────────────────────────────────
  // Reset at the start of each playLayout via resetDripState().
  let wetGrid = null;
  let wetCols = 0, wetRows = 0;
  const activeDrips = [];
  let dripLoopActive = false;
  let lastDripTime = 0;
  // Last-stamp tracking for instantaneous pen-speed measurement. Drives the
  // speed-dependent drip multiplier on caps that opt in (mop, future fire
  // extinguisher) — slow strokes drip more, fast strokes drip less, matching
  // how a wet marker actually behaves on a wall.
  let lastStampT = -1, lastStampX = 0, lastStampY = 0;

  function resetDripState() {
    const r = canvas.getBoundingClientRect();
    wetCols = Math.max(1, Math.ceil(r.width  / WET_CELL));
    wetRows = Math.max(1, Math.ceil(r.height / WET_CELL));
    wetGrid = new Float32Array(wetCols * wetRows);
    activeDrips.length = 0;
    lastStampT = -1;
  }

  // Cached speedScale used during synchronous stamp bursts (e.g. one
  // pointermove triggering N stamps inside paintSegment, OR one rAF tick
  // playing back several recorded points). We only refresh the pen-speed
  // measurement when enough real time has passed since the last refresh
  // — otherwise burst stamps would all see dt≈0 and collapse the scale
  // to its "extremely fast" floor.
  let lastSpeedScale = 1;
  const SPEED_REFRESH_MS = 4;

  function stampAt(x, y, size) {
    const s = getStamp(cap.current, size);
    pctx.drawImage(s, x - size/2, y - size/2, size, size);

    // Pen-speed measurement for speed-dependent drip caps. First stamp of
    // a session has no reference → use 1. Refresh only when at least
    // SPEED_REFRESH_MS has elapsed since the last refresh.
    const now = performance.now();
    if (lastStampT > 0 && now - lastStampT >= SPEED_REFRESH_MS) {
      const dt = now - lastStampT;
      const dist = Math.hypot(x - lastStampX, y - lastStampY);
      const pxPerMs = dist / dt;
      // Slow (≤0.05 px/ms) → 2.0× drip rate; normal (~0.5) → 1.0×;
      // fast (≥5) → 0.1× (clamped both ends).
      lastSpeedScale = Math.max(0.1, Math.min(2.0, 0.5 / Math.max(0.05, pxPerMs)));
      lastStampT = now; lastStampX = x; lastStampY = y;
    } else if (lastStampT < 0) {
      // Very first stamp of a session — establish reference for next time.
      lastStampT = now; lastStampX = x; lastStampY = y;
      lastSpeedScale = 1;
    }
    // Synchronous burst stamps (dt < SPEED_REFRESH_MS) reuse lastSpeedScale.

    maybeSpawnDrip(x, y, size, lastSpeedScale);
  }
  function strokeSegment(x0, y0, x1, y1, size) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const spacing = Math.max(1, size * (SPACING[resolveCap(cap.current)] || 0.12));
    const steps = Math.max(1, Math.ceil(dist / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      stampAt(x0 + dx*t, y0 + dy*t, size);
    }
  }

  // Per-stamp: bump wetness in the cell, maybe spawn a drip. speedScale is
  // ~2.0 when the pen is barely moving, ~0.1 when zipping fast; caps that
  // opt in via `speedDependentDrips: true` use it to scale spawn probability.
  function maybeSpawnDrip(x, y, size, speedScale) {
    const dcfg = cfg.dripConfig && cfg.dripConfig[resolveCap(cap.current)];
    if (!dcfg || !dcfg.enabled) return;
    // Only wetness-driven caps actually NEED the grid; for flat-rate caps
    // (mop, future fire ext) it's fine to spawn without it. Lazy-init here
    // so free-paint pages that never called beginFreePaint still get drips.
    if (dcfg.useWetness && !wetGrid) resetDripState();
    if (speedScale == null) speedScale = 1;
    const speedMult = dcfg.speedDependentDrips ? speedScale : 1;

    let localWet = 0;
    if (dcfg.useWetness) {
      const col = Math.floor(x / WET_CELL);
      const row = Math.floor(y / WET_CELL);
      if (col >= 0 && col < wetCols && row >= 0 && row < wetRows) {
        const idx = row * wetCols + col;
        wetGrid[idx] += dcfg.wetnessPerStamp;
        localWet = wetGrid[idx];
      }
    }

    let prob;
    if (dcfg.useWetness) {
      // Spray: only spawn above threshold, scaled by saturation.
      if (localWet < dcfg.spawnThreshold) return;
      const mult = Math.min(dcfg.maxRateMultiplier,
                            1 + (localWet - dcfg.spawnThreshold));
      prob = dcfg.spawnRate * mult;
    } else {
      // Mop/marker etc: flat probability per stamp.
      prob = dcfg.spawnRate;
    }
    // Slow strokes pool more ink → more drips; fast strokes barely touch the
    // surface → fewer. Opt-in per cap via speedDependentDrips.
    prob *= speedMult;

    if (Math.random() >= prob) return;

    // Roll for lateral wander. Most drips fall straight; a fraction get a
    // small constant horizontal velocity + sinusoidal sway. Either or both
    // may be non-zero — independently sampled for variety.
    let vx = 0, swayAmp = 0, swayFreq = 0, swayPhase = 0;
    if (dcfg.wanderChance && Math.random() < dcfg.wanderChance) {
      // 70% of wanderers get drift, 70% get sway, 40% get both — gives a mix
      // of slowly-veering and slowly-wiggling drips.
      if (Math.random() < 0.7) vx = (Math.random() * 2 - 1) * (dcfg.vxMax || 0);
      if (Math.random() < 0.7) {
        swayAmp = Math.random() * (dcfg.swayAmpMax || 0);
        swayFreq = (dcfg.swayFreqMin || 0.3) +
                   Math.random() * ((dcfg.swayFreqMax || 0.6) - (dcfg.swayFreqMin || 0.3));
        swayPhase = Math.random() * Math.PI * 2;
      }
    }

    const startX = x + (Math.random() - 0.5) * dcfg.spreadX;
    activeDrips.push({
      // baseX is the un-swayed centerline of the drip (advances by vx).
      // The rendered x = baseX + sway(age).
      baseX: startX,
      x: startX,           // last-rendered x (updated each frame)
      y: y,
      vx: vx,
      vy: dcfg.initialVelocity * (0.7 + Math.random() * 0.6),
      swayAmp: swayAmp,
      swayFreq: swayFreq,
      swayPhase: swayPhase,
      age: 0,
      thickness: size * dcfg.initialThicknessFrac * (0.8 + Math.random() * 0.4),
      minThickness: size * dcfg.minThicknessFrac,
      wetness: dcfg.initialWetness * (0.7 + Math.random() * 0.6),
      gravity: dcfg.gravity,
      drag: dcfg.drag,
      wetnessDrain: dcfg.wetnessDrain,
      thicknessDrain: dcfg.thicknessDrain,
      stampSpacingFrac: dcfg.stampSpacingFrac,
      capName: cap.current,
    });
    ensureDripLoop();
  }

  function tickDrips(now) {
    if (activeDrips.length === 0) return;
    const dtSec = Math.min(0.05, Math.max(0.001, (now - lastDripTime) / 1000));
    lastDripTime = now;
    // Frame-normalized drag/drain factors so dt jitter doesn't blow drips up.
    const dragF  = Math.pow(0.5, dtSec * (-Math.log(0.985 + 1e-9) / Math.log(0.5)));
    // (We compute per-drip below using each drip's own drag — but a global
    // baseline matches the constants documented above at 60 fps.)
    const r = canvas.getBoundingClientRect();
    const stageH = r.height;

    for (let i = activeDrips.length - 1; i >= 0; i--) {
      const d = activeDrips[i];
      // Velocity update — gravity adds, drag multiplies (frame-normalized).
      d.vy += d.gravity * dtSec;
      d.vy *= Math.pow(d.drag, dtSec * 60);
      // Horizontal: linear drift on baseX + sinusoidal sway around it.
      d.age += dtSec;
      d.baseX += d.vx * dtSec;
      const swayNow = d.swayAmp
        ? d.swayAmp * Math.sin(2 * Math.PI * d.swayFreq * d.age + d.swayPhase)
        : 0;
      const newX = d.baseX + swayNow;
      const newY = d.y + d.vy * dtSec;

      // Render trail from (d.x, d.y) → (newX, newY). For straight-fall drips
      // dx ≈ 0, so this collapses to a vertical line; for wandering drips
      // each step lands slightly off-axis, drawing the curve.
      const stamp = getStamp(d.capName, sizeBucket(d.thickness));
      const dx = newX - d.x;
      const dy = newY - d.y;
      const dist = Math.hypot(dx, dy);
      const stampStep = Math.max(0.5, d.thickness * d.stampSpacingFrac);
      const steps = Math.max(1, Math.ceil(dist / stampStep));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = d.x + dx * t;
        const py = d.y + dy * t;
        pctx.drawImage(stamp, px - d.thickness/2, py - d.thickness/2, d.thickness, d.thickness);
      }

      d.x = newX;
      d.y = newY;
      d.wetness -= d.wetnessDrain * dtSec * 60;
      d.thickness *= Math.max(0, 1 - d.thicknessDrain * dtSec * 60);
      if (d.thickness < d.minThickness) d.thickness = d.minThickness;

      // Kill conditions: paint exhausted OR dropped off the canvas.
      if (d.wetness <= 0 || d.y > stageH + 40) {
        activeDrips.splice(i, 1);
      }
    }
  }

  // Keep ticking drips in their own rAF loop. Started lazily on first spawn;
  // auto-exits when the active list is empty.
  function ensureDripLoop() {
    if (dripLoopActive) return;
    dripLoopActive = true;
    lastDripTime = performance.now();
    function tick(now) {
      tickDrips(now);
      if (activeDrips.length > 0 && !abortToken.aborted) {
        requestAnimationFrame(tick);
      } else {
        dripLoopActive = false;
      }
    }
    requestAnimationFrame(tick);
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
    // Spray-can specific: right-handed graffiti writer's grip leans the
    // BOTTOM of the can to the right. Since the can's pivot is near its
    // TOP (anchorY=0.04), positive CSS rotation (CW) actually swings the
    // bottom LEFT — so we want NEGATIVE rotation to put the bottom right.
    // Guarantee a 3–7° magnitude so the lean is always visible, 92%
    // bias toward the right-handed direction.
    // Other caps (chisel, mop) keep a softer random magnitude with no
    // sign bias since their pivot is at the bottom.
    const isSpray = resolveCap(cap.current) === 'spray';
    let magnitude, sign;
    if (isSpray) {
      magnitude = 3 + Math.random() * 4;            // 3°–7°
      sign = Math.random() < 0.92 ? -1 : 1;         // bottom RIGHT (right-hand grip)
    } else {
      magnitude = Math.pow(Math.random(), 2.2) * 4; // 0°–4° soft
      sign = Math.random() < 0.5 ? -1 : 1;
    }
    targetTilt = sign * magnitude;
  }
  function positionWriter(x, y, extraScale, overrideTilt) {
    if (!writer) return;
    const wc = cfg.writerConfig[resolveCap(cap.current)];
    const baseH = writerImgHeight || wc.imgHeight;
    // Compose extraScale (entry/exit fly scale) with cfg.writerScale (user
    // global "can size" tuning from the tag designer).
    const scale = (extraScale != null ? extraScale : 1) * (cfg.writerScale || 1);
    const h = baseH * scale;
    writer.style.height = h + 'px';
    // overrideTilt = a fixed rotation in degrees (typically 0 for entry/exit
    // phases where we want the writer perfectly straight). If unset, fall
    // back to the smoothly-eased per-stroke tilt during the paint phase.
    let tilt;
    if (overrideTilt != null) {
      tilt = overrideTilt;
    } else {
      currentTilt += (targetTilt - currentTilt) * 0.08;
      tilt = currentTilt;
    }
    writer.style.left = x + 'px';
    writer.style.top  = (y - wc.anchorY * h) + 'px';
    writer.style.transform = `translate(-50%, 0) rotate(${tilt.toFixed(2)}deg)`;
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
    if (opts.travelSpeed !== undefined) cfg.travelSpeed = opts.travelSpeed;
    if (opts.entryConfig) Object.assign(cfg.entryConfig, opts.entryConfig);
    if (opts.exitConfig)  Object.assign(cfg.exitConfig,  opts.exitConfig);
    if (opts.writerScale != null) cfg.writerScale = opts.writerScale;
    if (opts.fontSizeRef != null)      cfg.fontSizeRef = opts.fontSizeRef;
    if (opts.heightCap != null)        cfg.heightCap = opts.heightCap;
    if (opts.maxHeightPx != null)      cfg.maxHeightPx = opts.maxHeightPx;
    if (opts.maxWidthFrac != null)     cfg.maxWidthFrac = opts.maxWidthFrac;
    if (opts.inkTimePerPoint != null)  cfg.inkTimePerPoint = opts.inkTimePerPoint;
    if (opts.baselineFrac != null)     cfg.baselineFrac = opts.baselineFrac;
    if (opts.writerConfig) {
      // Deep-merge per cap. 'marker' and 'bomber' are legacy aliases that
      // route to 'mop' so a single source of truth lives there.
      cfg.writerConfig = {
        spray:  Object.assign({}, DEFAULT_WRITER_CONFIG.spray),
        chisel: Object.assign({}, DEFAULT_WRITER_CONFIG.chisel),
        mop:    Object.assign({}, DEFAULT_WRITER_CONFIG.mop),
      };
      for (const k of Object.keys(opts.writerConfig)) {
        const target = resolveCap(k);
        if (cfg.writerConfig[target]) {
          Object.assign(cfg.writerConfig[target], opts.writerConfig[k]);
        }
      }
    }
    if (opts.dripConfig) {
      // Deep-merge per-cap so callers can override just a few knobs.
      cfg.dripConfig = {};
      for (const cap of Object.keys(DEFAULT_DRIP_CONFIG)) {
        cfg.dripConfig[cap] = Object.assign({}, DEFAULT_DRIP_CONFIG[cap], opts.dripConfig[cap] || {});
      }
      // Marker/bomber → mop alias for legacy callers.
      if (opts.dripConfig.marker) {
        cfg.dripConfig.mop = Object.assign({}, cfg.dripConfig.mop, opts.dripConfig.marker);
      }
      if (opts.dripConfig.bomber) {
        cfg.dripConfig.mop = Object.assign({}, cfg.dripConfig.mop, opts.dripConfig.bomber);
      }
      // Allow callers to add NEW cap entries (e.g., 'fireExtinguisher').
      for (const cap of Object.keys(opts.dripConfig)) {
        if (!cfg.dripConfig[cap] && cap !== 'marker' && cap !== 'bomber') {
          cfg.dripConfig[cap] = Object.assign({ enabled: true }, opts.dripConfig[cap]);
        }
      }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function setCap(name) {
    cap.current = name;
    if (!writer) return;
    const wc = cfg.writerConfig[resolveCap(name)];
    if (!wc) return;             // unknown cap name; leave writer as-is
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
    resetDripState();
    const wc = cfg.writerConfig[resolveCap(cap.current)];

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
      // Brush thickness intentionally NOT scaled per char — same physical
      // tool drawing different-sized letters. A scaled-up letter is drawn
      // with the same brush diameter as a normal letter; a scaled-down
      // letter looks heavier (real-world: a fat marker on small text).
      const charBrush = baseBrush;

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

      for (let si = 0; si < data.strokes.length; si++) {
        const stroke = data.strokes[si];
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
        // Within-letter strokes get a small lift gap (the hand barely leaves
        // the wall). Last stroke of a letter gets a much longer gap so the
        // air-travel arc to the NEXT letter has time to breathe.
        const isLastStrokeOfLetter = si === data.strokes.length - 1;
        const gap = isLastStrokeOfLetter ? 700 : 220;
        timeline += (last.t - t0) + pts.length * INK + gap;
      }
    }
    if (!actions.length) {
      cfg.speed = savedSpeed;
      return Promise.resolve();
    }

    // 2. rAF loop in five phases:
    //    - ENTRY  (~1100ms): writer arcs in from off-screen LOWER-LEFT at
    //      scale 2.4 via a quadratic bezier (control point up + biased
    //      toward the end), ease-out into first paint point at scale 1.0.
    //      Feels like a hand approaching from below the camera, swooping
    //      up to land at the wall.
    //    - PRE-HOLD (~250ms): writer holds at first paint point. Like the
    //      writer settling and aiming before pressing the nozzle.
    //    - PAINT: existing variable-rate stroke + air-gap loop.
    //    - POST-HOLD (~250ms): writer holds at last paint point. Like the
    //      writer considering the work before pulling away.
    //    - EXIT  (~1100ms): mirror of entry — bezier arc out to off-screen
    //      LOWER-RIGHT at scale 2.4, ease-in (accelerating away).
    //
    //    Entry/exit/holds aren't affected by the speed slider — they're
    //    scene framing, not paint timing.
    const ENTRY_DUR = 1100;
    const PRE_HOLD  = 250;
    const POST_HOLD = 250;
    const EXIT_DUR  = 1100;
    const FLY_SCALE = 2.4;
    const easeOut = (f) => 1 - Math.pow(1 - f, 3);
    const easeIn  = (f) => f * f * f;
    const easeInOut = (f) => f < 0.5
      ? 4 * f * f * f
      : 1 - Math.pow(-2 * f + 2, 3) / 2;
    // Quadratic bezier helper.
    function bez(t, p0, c, p1) {
      const omt = 1 - t;
      return omt * omt * p0 + 2 * omt * t * c + t * t * p1;
    }

    const stageRect = canvas.getBoundingClientRect();
    const firstA = actions[0];
    // Entry path traces a J-curve from cfg.entryConfig — all positions are
    // FRACTIONS of stage so the path adapts to any viewport.
    const eC = cfg.entryConfig || DEFAULT_ENTRY_CONFIG;
    const entryStart = {
      x: eC.startXFrac * stageRect.width,
      y: eC.startYFrac * stageRect.height,
      scale: eC.scale,
    };
    const entryCtrl = {
      x: eC.ctrlXFrac * stageRect.width,
      y: firstA.y + eC.ctrlYOffsetFrac * stageRect.height,
    };
    // Exit info — filled when paint completes.
    let exitEnd = null, exitCtrl = null;

    showWriter();
    // Seed the can/marker with its natural lean so the very first rendered
    // frame already shows tilt (instead of ramping up from zero over many
    // frames). setStrokeTilt sets a NEW targetTilt; we also nudge
    // currentTilt to that value so the smoothing has nothing to chase.
    setStrokeTilt();
    currentTilt = targetTilt;

    let phase = 'entry';
    let phaseStart = performance.now();
    let lastWallT = phaseStart;
    let virtualTime = 0;
    let lastIdx = -1, prev = null;

    return new Promise(resolve => {
      function tick(now) {
        if (token.aborted) { cfg.speed = savedSpeed; resolve(); return; }

        if (phase === 'entry') {
          const frac = Math.min(1, (now - phaseStart) / ENTRY_DUR);
          // ease-OUT: fast start, decelerate into the landing — natural
          // "swooping in" deceleration. Combined with the bezier control
          // point this gives the arc most curvature at the start.
          const k = easeOut(frac);
          const wx = bez(k, entryStart.x, entryCtrl.x, firstA.x);
          const wy = bez(k, entryStart.y, entryCtrl.y, firstA.y);
          const wScale = entryStart.scale + (1 - entryStart.scale) * k;
          positionWriter(wx, wy, wScale, 0);    // straight during fly-in
          if (frac >= 1) {
            phase = 'preHold';
            phaseStart = now;
          }
          requestAnimationFrame(tick);
          return;
        }

        if (phase === 'preHold') {
          // Writer hovers at the first paint point — gentle sine-wobble
          // so it reads as held in mid-air rather than frozen.
          const dt = (now - phaseStart);
          const floatX = Math.sin(dt * 0.006) * 4;
          const floatY = Math.cos(dt * 0.008) * 2;
          positionWriter(firstA.x + floatX, firstA.y + floatY, 1, 0);    // straight while hovering
          if (dt >= PRE_HOLD) {
            phase = 'paint';
            lastWallT = now;     // reset for paint-phase dt
          }
          requestAnimationFrame(tick);
          return;
        }

        if (phase === 'paint') {
          // Decide rate for THIS tick based on current sub-phase. We're in
          // an inter-stroke gap when prev is set, next action is the start
          // of a new stroke, and virtualTime is past prev.t.
          const nextForRate = actions[lastIdx + 1];
          const inGap = !!(prev && nextForRate && nextForRate.first
                           && virtualTime > prev.t);
          const rate = inGap ? resolveTravelSpeed() : resolveSpeed();

          const dt = now - lastWallT;
          lastWallT = now;
          virtualTime += dt * rate;

          let idx = lastIdx;
          while (idx + 1 < actions.length && actions[idx+1].t <= virtualTime) idx++;
          if (idx > lastIdx) {
            for (let i = lastIdx + 1; i <= idx; i++) {
              const a = actions[i];
              if (a.first || !prev) {
                const wasFirstEver = !prev;
                setStrokeTilt();
                // For the VERY FIRST stroke of the whole paint, snap the
                // tilt instantly — entry held the writer at 0° so without
                // this snap the lean would ramp in over half a second
                // (which feels mushy after the deliberate fly-in).
                if (wasFirstEver) currentTilt = targetTilt;
                stampAt(a.x, a.y, a.brushSize);
              } else {
                strokeSegment(prev.x, prev.y, a.x, a.y, a.brushSize);
              }
              prev = a;
            }
            lastIdx = idx;
          }

          // Writer position — during an "air gap" ease the position along
          // a quadratic bezier (perpendicular bend + vertical lift) so the
          // can/marker glides in an organic curve.
          if (prev) {
            let wx = prev.x, wy = prev.y;
            const nextA = actions[lastIdx + 1];
            if (nextA && nextA.first && virtualTime > prev.t) {
              const gapDur = nextA.t - prev.t;
              if (gapDur > 0) {
                const frac = Math.max(0, Math.min(1, (virtualTime - prev.t) / gapDur));
                const t = easeInOut(frac);
                const dx = nextA.x - prev.x;
                const dy = nextA.y - prev.y;
                const dist = Math.hypot(dx, dy) || 1;
                const perpX = -dy / dist;
                const perpY =  dx / dist;
                const hash = Math.abs(Math.sin(prev.x * 12.9898 + prev.y * 78.233
                                              + nextA.x * 37.719));
                const bendSign  = hash > 0.5 ? 1 : -1;
                const bendFrac  = 0.18 + ((hash * 1000) % 1) * 0.22;
                const bendMag   = bendSign * dist * bendFrac;
                const lift      = Math.min(100, dist * 0.22);
                const cx = (prev.x + nextA.x) / 2 + perpX * bendMag;
                const cy = (prev.y + nextA.y) / 2 + perpY * bendMag - lift;
                const omt = 1 - t;
                wx = omt * omt * prev.x + 2 * omt * t * cx + t * t * nextA.x;
                wy = omt * omt * prev.y + 2 * omt * t * cy + t * t * nextA.y;
              }
            }
            positionWriter(wx, wy, 1);
          }

          if (lastIdx >= actions.length - 1) {
            phase = 'postHold';
            phaseStart = now;
            // Exit path mirrors entry — J-curve in reverse, also from cfg.
            const xC = cfg.exitConfig || DEFAULT_EXIT_CONFIG;
            exitEnd = {
              x: xC.endXFrac * stageRect.width,
              y: xC.endYFrac * stageRect.height,
              scale: xC.scale,
            };
            exitCtrl = {
              x: xC.ctrlXFrac * stageRect.width,
              y: prev.y + xC.ctrlYOffsetFrac * stageRect.height,
            };
          }
          requestAnimationFrame(tick);
          return;
        }

        if (phase === 'postHold') {
          // Writer hovers at the last paint point with a gentle sway,
          // "considering the work" — alive rather than frozen.
          const dt = (now - phaseStart);
          const floatX = Math.sin(dt * 0.006) * 4;
          const floatY = Math.cos(dt * 0.008) * 2;
          positionWriter(prev.x + floatX, prev.y + floatY, 1, 0);    // straight while hovering
          if (dt >= POST_HOLD) {
            phase = 'exit';
            phaseStart = now;
          }
          requestAnimationFrame(tick);
          return;
        }

        // phase === 'exit'
        const frac = Math.min(1, (now - phaseStart) / EXIT_DUR);
        // ease-IN: slow start (just leaving the wall), accelerate away.
        const k = easeIn(frac);
        const wx = bez(k, prev.x, exitCtrl.x, exitEnd.x);
        const wy = bez(k, prev.y, exitCtrl.y, exitEnd.y);
        const wScale = 1 + (exitEnd.scale - 1) * k;
        positionWriter(wx, wy, wScale, 0);    // straight during fly-out
        if (frac >= 1) {
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
    activeDrips.length = 0;     // kill any in-flight drips
    if (wetGrid) wetGrid.fill(0);
    if (pctx) clearCanvas();
    hideWriter();
  }
  function stop() {
    abortToken.aborted = true;
    activeDrips.length = 0;
    hideWriter();
  }

  // ── Free-paint API ────────────────────────────────────────────────────────
  // Lets host pages drive the engine with raw pointer events — e.g. the
  // Painter experiment where the user paints freely on the wall instead of
  // playing back recorded letter traces. Drips still trigger automatically
  // because they live inside stampAt; the host just feeds in pointer paths
  // and the engine handles brush + drip physics from there.
  //
  // Call beginFreePaint() before the first paintAt — resets the wetness
  // grid so drips reflect a fresh session, kills any in-flight playback +
  // drips. Does NOT clear the canvas (use clear() for that).
  function beginFreePaint() {
    abortToken.aborted = true;
    abortToken = { aborted: false };
    activeDrips.length = 0;
    resetDripState();
    lastStampT = -1;
  }

  // Compute a default brush size for the current cap, scaled by writerScale.
  function defaultBrushSize() {
    const wc = cfg.writerConfig[resolveCap(cap.current)] || {};
    return Math.max(8, (wc.brushSize || 30) * (cfg.writerScale || 1));
  }

  function paintAt(x, y, size) {
    if (!pctx) return;
    const s = size != null ? size : defaultBrushSize();
    stampAt(x, y, s);   // also drives drip spawning + wetness tracking
  }
  function paintSegment(x0, y0, x1, y1, size) {
    if (!pctx) return;
    const s = size != null ? size : defaultBrushSize();
    strokeSegment(x0, y0, x1, y1, s);
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

  // Live setters for the entry/exit bezier — used by the tag designer's
  // path-edit mode so dragging a handle updates the next paint immediately.
  function setEntryConfig(c) {
    if (c) Object.assign(cfg.entryConfig, c);
  }
  function setExitConfig(c) {
    if (c) Object.assign(cfg.exitConfig, c);
  }
  function getEntryConfig() { return Object.assign({}, cfg.entryConfig); }
  function getExitConfig()  { return Object.assign({}, cfg.exitConfig); }
  function setWriterScale(s) { if (typeof s === 'number' && s > 0) cfg.writerScale = s; }
  function getWriterScale()  { return cfg.writerScale || 1; }

  window.GraffitiPaint = {
    init, loadAssets, setAssets, play, playLayout, computeAutoLayout,
    setCap, clear, stop,
    beginFreePaint, paintAt, paintSegment,
    setEntryConfig, setExitConfig, getEntryConfig, getExitConfig,
    setWriterScale, getWriterScale,
    DEFAULT_ENTRY_CONFIG, DEFAULT_EXIT_CONFIG,
    // Exposed for tooling/debugging — host pages should not poke these.
    _internal: {
      getTraces: () => traces,
      getFont:   () => font,
      getCap:    () => cap.current,
      getActiveDrips: () => activeDrips,
      getWetGrid:     () => wetGrid,
      getDripConfig:  () => cfg.dripConfig,
      getDripLoopActive: () => dripLoopActive,
    },
  };
})();

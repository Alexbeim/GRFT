/*
 * grft-tag.js — drop a saved Tag-Designer tag onto any page as LIVE paint.
 *
 * Takes a tag exported from tag-designer.html (the 📤 JSON button) and replays
 * it through the paint engine into any element, scaled to fit, painting itself
 * when it scrolls into view. The element's original text stays in the DOM
 * (visually hidden) so search engines and screen readers still read it — the
 * paint is a visual layer on top, not a replacement for the words.
 *
 * Depends on (load these BEFORE this file, in order):
 *   <script src="opentype.min.js"></script>
 *   <script src="paint-engine.js"></script>
 *   <script src="js/grft-tag.js"></script>
 *
 * Markup — wrap the copy you want tagged and point it at an exported JSON:
 *   <span class="grft-tag" data-tag="images/tags/since-2008.json">since 2008</span>
 *   <script>GrftTag.auto();</script>
 *
 * Per-element options (data attributes):
 *   data-tag      URL of the exported tag JSON (required)
 *   data-speed    paint speed, default 4 (higher = faster)
 *   data-trigger  "view" (default — paint when scrolled into view) | "load" | "click"
 *   data-replay   "click" to repaint on click, "hover" to repaint on hover
 *   data-once     "true" (default) to paint only the first time it enters view
 *
 * The paint engine is a SINGLETON — it can drive one animated canvas at a time.
 * GrftTag queues elements so they paint one after another as they appear. For
 * several tags visible at once, prefer exported PNGs (static) for the extras.
 */

(function () {
  'use strict';

  if (!window.GraffitiPaint) {
    console.error('[grft-tag] paint-engine.js must load before grft-tag.js');
    return;
  }

  // Mirror the Tag Designer's engine setup so embedded tags look identical to
  // what was authored. Kept in sync with tag-designer.html's GraffitiPaint.init.
  var WRITER_CONFIG = {
    spray:  { img: '/images/grft_can.png', brushSize: 50, imgHeight: 220 },
    chisel: { brushSize: 34, imgHeight: 180 },
    mop:    { brushSize: 26, imgHeight: 180 },
  };
  var FONT_SIZE_REF = 480;

  var assetsPromise = null;   // shared, loaded once
  var enginePrimed  = false;  // init() called at least once
  var pending = [];           // {el,tag,opts} waiting to paint (engine is single-track)
  var painting = false;
  var pumpScheduled = false;

  // ── Asset loading (once) ────────────────────────────────────────────────
  function loadAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = window.GraffitiPaint.loadAssets({
      // Slim traces (~1.35 MB, all a–z + 0–9) instead of the full ~4.6 MB set —
      // production-friendly weight for the homepage. Full set is unneeded here.
      tracesFull: '/grft-traced-paths-slim.json',
      font:       '/Fonts/GraffitiPlusDisplay-Regular.ttf',
      sprayImg:   '/images/grft_can.png',
      markerImg:  '/images/grft_marker_true_top_down.png',
    });
    return assetsPromise;
  }

  // ── DOM scaffold inside the host element ────────────────────────────────
  // The host's ORIGINAL content (the styled words) stays in place and visible —
  // this keeps it in the DOM for SEO/a11y AND means there's no blank flash while
  // the paint assets load (important above the fold). The <canvas> is overlaid
  // on top; when painting actually begins we fade the original out (revealOnPaint)
  // so the painted version takes over with no empty gap.
  function scaffold(el) {
    if (el._grft) return el._grft;

    var originalText = el.textContent.trim();

    // Wrap the original content. Two modes:
    //  - data-hide-copy (e.g. above-the-fold hero): start HIDDEN so the styled
    //    copy never flashes on load; it's a fallback revealed only on failure.
    //  - default (e.g. below-the-fold stats): start VISIBLE and only fade out
    //    the instant this element starts painting — so queued tags keep showing
    //    their plain text until their turn (no blank gaps), and there's still no
    //    flash because they're not seen until scrolled to.
    var hideCopy = el.hasAttribute('data-hide-copy');
    var orig = document.createElement('span');
    orig.className = 'grft-tag-orig';
    orig.style.cssText = 'position:relative;z-index:1;opacity:' + (hideCopy ? '0' : '1') + ';transition:opacity .25s ease;';
    while (el.firstChild) orig.appendChild(el.firstChild);

    // Stage overlays the element exactly. overflow:visible lets the writer
    // travel outside (all the way to the browser edge on exit).
    var stage = document.createElement('span');
    stage.className = 'grft-tag-stage';
    stage.style.cssText =
      'position:absolute;inset:0;display:block;z-index:2;pointer-events:none;overflow:visible;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';

    var writer = document.createElement('img');
    writer.alt = '';
    writer.style.cssText =
      'position:absolute;pointer-events:none;transform-origin:50% 0;' +
      'transform:translate(-50%,0);opacity:0;transition:opacity .15s;' +
      'filter:drop-shadow(0 10px 18px rgba(0,0,0,.45));will-change:transform,left,top;';

    // Element must establish a positioning context for the absolute stage.
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    // The host page may hide .grft-tag up front (no copy flash on load); now
    // that we own this element, make it visible so the canvas shows. The copy
    // stays hidden via `orig` (opacity 0) unless we fall back to it.
    el.style.visibility = 'visible';

    el.appendChild(orig);
    stage.appendChild(canvas);
    stage.appendChild(writer);
    el.appendChild(stage);

    el._grft = { canvas: canvas, writer: writer, stage: stage, orig: orig, originalText: originalText, painted: false };
    return el._grft;
  }

  // ── Rescale an authored layout onto this element's canvas ─────────────────
  // We fit the tag's INK bounds (the letters) into the host element — not the
  // authoring stage, which has arbitrary empty margins. The ink fills `fillW`
  // of the width / `fillH` of the height, centred horizontally and biased to
  // the top so drips have room to run down. fontSize scales by the same factor
  // so the brush stays proportional. Falls back to stage-fit for older exports
  // that predate inkBox.
  var FILL_W = 0.92;   // default: ink uses up to 92% of element width
  function fitLayout(tag, cssW, cssH, align, fillW, fitMode) {
    var box = tag.inkBox;
    if (!box || !(box.w > 0) || !(box.h > 0)) {
      // Legacy fallback: fit the whole authoring stage, centred.
      var sw = (tag.stage && tag.stage.w) || cssW;
      var sh = (tag.stage && tag.stage.h) || cssH;
      var ks = Math.min(cssW / sw, cssH / sh);
      return remap(tag, ks, (cssW - sw * ks) / 2, (cssH - sh * ks) / 2);
    }
    fillW = fillW > 0 ? fillW : FILL_W;
    var dripsOn = !(tag.drip && tag.drip.enabled === false);
    // fit by HEIGHT only ('height' mode) → every element of the same height
    // renders at the SAME glyph height regardless of how many characters it has
    // (so a row of stats is uniformly sized); width is free and may differ.
    var fillH, topPad, k;
    if (fitMode === 'height') {
      fillH = 0.8; topPad = (1 - fillH) / 2;
      k = (cssH * fillH) / box.h;
    } else {
      // 'contain': leave bottom room for drips only when the tag drips.
      fillH = dripsOn ? 0.62 : 0.90;
      topPad = dripsOn ? 0.12 : (1 - fillH) / 2;
      k = Math.min((cssW * fillW) / box.w, (cssH * fillH) / box.h);
    }
    // Horizontal placement of the ink within the box. Default centred; 'left'
    // pins the ink to the left edge (a hair of padding), 'right' to the right —
    // so a tag replacing left-aligned headline text lines up with it.
    var drawnW = box.w * k;
    var sidePad = cssW * 0.01;
    var leftX = align === 'left' ? sidePad
              : align === 'right' ? (cssW - drawnW - sidePad)
              : (cssW - drawnW) / 2;
    var offX = leftX - box.x * k;
    var offY = cssH * topPad - box.y * k;
    return remap(tag, k, offX, offY);
  }
  function remap(tag, k, offX, offY) {
    return {
      k: k,
      fontSize: (tag.fontSize || FONT_SIZE_REF) * k,
      layout: (tag.layout || []).map(function (c) {
        return {
          char: c.char,
          x: c.x * k + offX,
          y: c.y * k + offY,
          scale: c.scale,
          rotation: c.rotation,
        };
      }),
    };
  }

  // Drip physics are in PIXELS, so a tag rendered smaller than it was authored
  // would otherwise get proportionally longer/faster drips. Scale the pixel
  // knobs by the same fit factor `k` to keep drips looking identical at any
  // size. Returns an init-ready { <cap>: {...} } or undefined.
  var DRIP_PX_KNOBS = ['initialVelocity', 'gravity', 'spreadX', 'vxMax', 'swayAmpMax'];
  function dripConfigFor(tag, k) {
    if (!tag.drip || !tag.cap) return undefined;
    var d = {};
    for (var key in tag.drip) { if (tag.drip.hasOwnProperty(key)) d[key] = tag.drip[key]; }
    DRIP_PX_KNOBS.forEach(function (p) {
      if (typeof d[p] === 'number') d[p] = d[p] * k;
    });
    var out = {};
    out[tag.cap] = d;
    return out;
  }

  // Send the can flying off the edge of the BROWSER on exit, not just off the
  // little element box. The engine positions the writer in element-local coords
  // (left = px from the element's left), so to land it past the viewport's
  // right edge we translate that viewport target back into a local fraction of
  // the element width. Keeps it roughly level with the text as it zooms off.
  function setBrowserEdgeExit(canvas) {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var MARGIN = 200;   // px past the viewport edge so the whole can clears
    var endLocalX = (window.innerWidth + MARGIN) - r.left;
    var endXFrac = Math.max(1.3, endLocalX / r.width);
    window.GraffitiPaint.setExitConfig({
      ctrlXFrac: endXFrac * 0.5,   // control point ~midway for a smooth arc
      ctrlYOffsetFrac: -0.06,      // slight rise as it leaves
      endXFrac: endXFrac,
      endYFrac: 0.42,              // exit roughly level with the text
      scale: 1,                    // keep the can ONE size as it leaves (no robotic zoom)
    });
  }
  // Contained motion (default; the hero opts into the dramatic off-screen
  // version). The can comes in from just off the LEFT, writes, then lifts
  // straight up a touch and fades — it never flies off across the frame, so a
  // row of tags reads as the can writing each one and moving on.
  function setContainedEntry() {
    window.GraffitiPaint.setEntryConfig({
      startXFrac: -0.12, startYFrac: -0.22,   // just above-left, not way off-screen
      ctrlXFrac: 0.12, ctrlYOffsetFrac: -0.18,
      scale: 1.1,
    });
  }
  function setLocalExit() {
    window.GraffitiPaint.setExitConfig({
      ctrlXFrac: 0.85, ctrlYOffsetFrac: -0.18,
      endXFrac: 1.0, endYFrac: -0.22, scale: 1,   // lift up near the last char, fade
    });
  }

  // ── Queue: paint one at a time, in DOM order ──────────────────────────────
  // The engine is single-track. Elements that get triggered together (e.g. a row
  // of stats scrolling into view) fire their observers in arbitrary order, so we
  // collect them (brief debounce) and always paint the DOM-first one next — the
  // can writes them left-to-right / top-to-bottom, never out of order.
  function paintEl(el, tag, opts) {
    if (el._grftDone || el._grftQueued) return;
    el._grftQueued = true;
    pending.push({ el: el, tag: tag, opts: opts });
    if (pumpScheduled) return;
    pumpScheduled = true;
    setTimeout(function () { pumpScheduled = false; pump(); }, 60);
  }
  function pump() {
    if (painting || !pending.length) return;
    pending.sort(function (a, b) {
      return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    var item = pending.shift();
    painting = true;
    doPaint(item.el, item.tag, item.opts);
  }
  function doPaint(el, tag, opts) {
    var g = scaffold(el);

    // Fit to this element's canvas FIRST so we know the scale factor k, then
    // init the engine with drip physics scaled to match.
    var rect = g.canvas.getBoundingClientRect();
    var fit = fitLayout(tag, rect.width, rect.height,
      el.getAttribute('data-align') || 'center', parseFloat(el.getAttribute('data-fill')) || 0,
      el.getAttribute('data-fit') || 'contain');
    var speed = tag.speed != null ? tag.speed : (opts.speed != null ? opts.speed : 4);

    // (Re)point the singleton engine at THIS element's canvas + writer.
    // Keep init minimal (this is the config that's known to paint reliably);
    // speed goes to playLayout and drips are applied via setDripConfig below.
    window.GraffitiPaint.init({
      canvas: g.canvas,
      writer: g.writer,
      color: el.getAttribute('data-color') || tag.color || '#ffc800',
      writerConfig: WRITER_CONFIG,
      fontSizeRef: FONT_SIZE_REF,
      travelSpeed: speed / 3,   // same deliberate between-letter glide as the designer
      minBrush: 2,              // let the stroke scale all the way down on small (mobile) text
    });
    enginePrimed = true;

    // Fallback: reveal the styled copy if the paint never gets going (assets
    // hang/fail to load). Cleared the moment painting actually starts.
    var revealFallback = function () {
      el.style.visibility = 'visible';
      if (g.orig) g.orig.style.opacity = '1';
    };
    var failsafe = setTimeout(function () { if (!g.painted) revealFallback(); }, 10000);

    loadAssets().then(function () {
      if (tag.cap) window.GraffitiPaint.setCap(tag.cap);
      // Apply the tag's tuned drips (scaled to this size) after setCap.
      var scaled = dripConfigFor(tag, fit.k);
      if (scaled && tag.cap) window.GraffitiPaint.setDripConfig(tag.cap, scaled[tag.cap]);
      // Motion style: 'browser' = dramatic off-screen swoop-in + fly-off the
      // viewport edge (hero). Default = contained entry + lift-off (stats), so
      // the can stays in-frame and just writes each tag in turn.
      if (el.getAttribute('data-exit') === 'browser') {
        window.GraffitiPaint.setEntryConfig(window.GraffitiPaint.DEFAULT_ENTRY_CONFIG);
        setBrowserEdgeExit(g.canvas);
      } else {
        setContainedEntry();
        setLocalExit();
      }
      clearTimeout(failsafe);          // assets are in — the animation is happening
      if (g.orig) g.orig.style.opacity = '0';   // re-hide copy if a fallback had shown it
      return window.GraffitiPaint.playLayout(fit.layout, {
        fontSize: fit.fontSize,
        speed: speed,
      });
    }).then(function () {
      g.painted = true;
      window.__grftTagPainted = true;   // tells the page safety-net the copy can stay hidden
      el.classList.add('grft-tag-painted');
    }).catch(function (err) {
      // Animation failed — fall back to the styled copy so the words still show.
      console.error('[grft-tag] paint failed for', el, err);
      clearTimeout(failsafe);
      revealFallback();
    }).then(function () {
      painting = false;
      el._grftDone = true;
      if (opts && typeof opts.onDone === 'function') { try { opts.onDone(); } catch (e) {} }
      pump();
    });
  }

  // ── Read a tag (inline object or fetched URL) and wire triggers ───────────
  function mount(el, tag, opts) {
    opts = opts || {};
    var speed = opts.speed != null ? opts.speed : (parseFloat(el.getAttribute('data-speed')) || 4);
    var trigger = opts.trigger || el.getAttribute('data-trigger') || 'view';
    var replay = opts.replay || el.getAttribute('data-replay');
    var once = opts.once != null ? opts.once : (el.getAttribute('data-once') !== 'false');
    var paintOpts = { speed: speed };

    function go() { paintEl(el, tag, paintOpts); }

    if (replay === 'click') el.addEventListener('click', go);
    if (replay === 'hover') el.addEventListener('mouseenter', go);

    if (trigger === 'load') {
      go();
    } else if (trigger === 'click') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', go);
    } else { // 'view'
      if (!('IntersectionObserver' in window)) { go(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            go();
            if (once) io.unobserve(el);
          }
        });
      }, { threshold: 0.25 });
      io.observe(el);
    }
  }

  // Resolve data-tag (URL) then mount. Accepts a pre-fetched object too.
  function mountFromAttr(el) {
    if (el._grftMounted) return;
    el._grftMounted = true;
    var src = el.getAttribute('data-tag');
    if (!src) { console.error('[grft-tag] element missing data-tag', el); return; }
    fetch(src).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + src);
      return r.json();
    }).then(function (tag) {
      mount(el, tag, {});
    }).catch(function (err) {
      console.error('[grft-tag] could not load tag', src, err);
      // Leave the original text untouched on failure — the words are still there.
    });
  }

  // ── Span mode: one continuous animation across several targets ────────────
  // A container with `data-grft-span="<selector>"` gets ONE overlay canvas; the
  // can writes the text of each matched child in turn (left→right / DOM order),
  // at a UNIFORM size (sized so the widest fits its box), each left-aligned in
  // its box — one entrance, one exit, never leaving the frame between numbers.
  // Lays out from the live text + font advances (no per-target tag files needed).
  function layoutNumber(text, fs, font) {
    var glyphs = [], cursorX = 0, scale = fs / font.unitsPerEm;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === ' ') { cursorX += font.charToGlyph(' ').advanceWidth * scale; continue; }
      glyphs.push({ char: ch, x: cursorX, y: 0 });
      cursorX += font.charToGlyph(ch).advanceWidth * scale;
    }
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    glyphs.forEach(function (gl) {
      var bb = font.charToGlyph(gl.char).getPath(gl.x, gl.y, fs).getBoundingBox();
      if (bb && isFinite(bb.x1)) {
        if (bb.x1 < x1) x1 = bb.x1; if (bb.y1 < y1) y1 = bb.y1;
        if (bb.x2 > x2) x2 = bb.x2; if (bb.y2 > y2) y2 = bb.y2;
      }
    });
    return { glyphs: glyphs, ink: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } };
  }

  function mountSpan(container) {
    if (container._grftSpan) return;
    container._grftSpan = true;
    var selector = container.getAttribute('data-grft-span') || '.grft-span-target';
    var targets = Array.prototype.slice.call(container.querySelectorAll(selector));
    if (!targets.length) return;
    var color = container.getAttribute('data-color') || '#ffc800';
    var speed = parseFloat(container.getAttribute('data-speed')) || 6;

    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    var stage = document.createElement('span');
    stage.style.cssText = 'position:absolute;inset:0;display:block;z-index:5;pointer-events:none;overflow:visible;';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    var writer = document.createElement('img'); writer.alt = '';
    writer.style.cssText = 'position:absolute;pointer-events:none;transform-origin:50% 0;' +
      'transform:translate(-50%,0);opacity:0;transition:opacity .15s;filter:drop-shadow(0 8px 14px rgba(0,0,0,.4));';
    stage.appendChild(canvas); stage.appendChild(writer); container.appendChild(stage);

    // Hide the original numbers (kept in DOM for SEO); reveal them as a fallback.
    targets.forEach(function (t) { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; });
    var reveal = function () { targets.forEach(function (t) { t.style.opacity = '1'; }); };
    var failsafe = setTimeout(function () { if (!container._grftSpanPainted) reveal(); }, 10000);

    var fired = false;
    function go() { if (fired) return; fired = true; runSpan(); }
    if (!('IntersectionObserver' in window)) { go(); }
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { go(); io.disconnect(); } });
      }, { threshold: 0.3 });
      io.observe(container);
    }

    function runSpan() {
      loadAssets().then(function () {
        var font = window.GraffitiPaint._internal.getFont();
        var crect = canvas.getBoundingClientRect();
        var FILLW = 0.9, FILLH = 0.72;
        // Uniform size: the smallest fit across all targets (so the widest fits).
        var fs = Math.min.apply(null, targets.map(function (t) {
          var tr = t.getBoundingClientRect();
          var lay = layoutNumber(t.textContent.trim(), 100, font);
          return Math.min(100 * (tr.width * FILLW) / lay.ink.w, 100 * (tr.height * FILLH) / lay.ink.h);
        }));
        fs = Math.max(8, fs);
        // Build one combined layout, each number left-aligned + vertically centred in its box.
        var combined = [];
        targets.forEach(function (t) {
          var tr = t.getBoundingClientRect();
          var lay = layoutNumber(t.textContent.trim(), fs, font);
          var offX = (tr.left - crect.left) - lay.ink.x;
          var offY = (tr.top - crect.top + tr.height / 2) - (lay.ink.y + lay.ink.h / 2);
          lay.glyphs.forEach(function (gl) {
            combined.push({ char: gl.char, x: gl.x + offX, y: gl.y + offY, scale: 1, rotation: 0 });
          });
        });
        window.GraffitiPaint.init({
          canvas: canvas, writer: writer, color: color,
          writerConfig: WRITER_CONFIG, fontSizeRef: FONT_SIZE_REF,
          travelSpeed: speed / 3, minBrush: 2,
        });
        window.GraffitiPaint.setCap('spray');
        window.GraffitiPaint.setDripConfig('spray', { enabled: false });
        window.GraffitiPaint.setEntryConfig(window.GraffitiPaint.DEFAULT_ENTRY_CONFIG);
        window.GraffitiPaint.setExitConfig({ ctrlXFrac: 0.9, ctrlYOffsetFrac: -0.15, endXFrac: 1.0, endYFrac: -0.2, scale: 1 });
        clearTimeout(failsafe);
        return window.GraffitiPaint.playLayout(combined, { fontSize: fs, speed: speed });
      }).then(function () {
        container._grftSpanPainted = true;
        window.__grftTagPainted = true;
      }).catch(function (err) {
        console.error('[grft-tag] span paint failed', err);
        clearTimeout(failsafe); reveal();
      });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.GrftTag = {
    // Scan the page for `selector` elements and wire each up from its data-tag.
    auto: function (selector) {
      var els = document.querySelectorAll(selector || '.grft-tag');
      Array.prototype.forEach.call(els, mountFromAttr);
      Array.prototype.forEach.call(document.querySelectorAll('[data-grft-span]'), mountSpan);
    },
    // Programmatic: mount a specific element with an inline tag object or URL.
    mount: function (el, tagOrUrl, opts) {
      if (typeof tagOrUrl === 'string') {
        fetch(tagOrUrl).then(function (r) { return r.json(); })
          .then(function (tag) { mount(el, tag, opts || {}); });
      } else {
        mount(el, tagOrUrl, opts || {});
      }
    },
    // Paint NOW (used to trigger from outside, e.g. a carousel). Safe to call
    // repeatedly: resets the per-element guards so it replays, but no-ops if a
    // paint of this element is already queued/in-flight (prevents stacking on
    // rapid carousel skip/back). The canvas lives inside the host element, so a
    // paint that's still running on a hidden slide simply isn't seen.
    paintNow: function (el, tag, opts) {
      if (!el || el._grftQueued) return;
      el._grftDone = false;
      paintEl(el, tag, opts || {});
    },
    isPainting: function (el) { return !!(el && (el._grftQueued || (painting && !el._grftDone))); },
  };
})();

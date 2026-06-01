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
    spray:  { img: 'images/grft_can.png', brushSize: 50, imgHeight: 220 },
    chisel: { brushSize: 34, imgHeight: 180 },
    mop:    { brushSize: 26, imgHeight: 180 },
  };
  var FONT_SIZE_REF = 480;

  var assetsPromise = null;   // shared, loaded once
  var enginePrimed  = false;  // init() called at least once
  var queue = [];             // elements waiting to paint (engine is single-track)
  var painting = false;

  // ── Asset loading (once) ────────────────────────────────────────────────
  function loadAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = window.GraffitiPaint.loadAssets({
      // Slim traces (~1.35 MB, all a–z + 0–9) instead of the full ~4.6 MB set —
      // production-friendly weight for the homepage. Full set is unneeded here.
      tracesFull: 'grft-traced-paths-slim.json',
      font:       'Fonts/GraffitiPlusDisplay-Regular.ttf',
      sprayImg:   'images/grft_can.png',
      markerImg:  'images/grft_marker_true_top_down.png',
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
  function fitLayout(tag, cssW, cssH, align, fillW) {
    var box = tag.inkBox;
    if (!box || !(box.w > 0) || !(box.h > 0)) {
      // Legacy fallback: fit the whole authoring stage, centred.
      var sw = (tag.stage && tag.stage.w) || cssW;
      var sh = (tag.stage && tag.stage.h) || cssH;
      var ks = Math.min(cssW / sw, cssH / sh);
      return remap(tag, ks, (cssW - sw * ks) / 2, (cssH - sh * ks) / 2);
    }
    fillW = fillW > 0 ? fillW : FILL_W;
    // Leave bottom room for drips ONLY when the tag actually drips. A no-drip
    // tag fills the box nearly fully and centres vertically.
    var dripsOn = !(tag.drip && tag.drip.enabled === false);
    var fillH = dripsOn ? 0.62 : 0.90;
    var topPad = dripsOn ? 0.12 : (1 - fillH) / 2;   // centre when no drips
    var k = Math.min((cssW * fillW) / box.w, (cssH * fillH) / box.h);
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
  // Contained exit — the can just slides off this element's own right edge
  // (used by default; the hero opts into the full browser-edge fly-off).
  function setLocalExit() {
    window.GraffitiPaint.setExitConfig({
      ctrlXFrac: 0.7, ctrlYOffsetFrac: -0.06,
      endXFrac: 1.3, endYFrac: 0.42, scale: 1,
    });
  }

  // ── Paint one element (serialised through the queue) ──────────────────────
  function paintEl(el, tag, opts) {
    if (painting) {
      // Engine is single-track — wait our turn.
      if (queue.indexOf(el) === -1) queue.push(function () { paintEl(el, tag, opts); });
      return;
    }
    painting = true;
    var g = scaffold(el);

    // Fit to this element's canvas FIRST so we know the scale factor k, then
    // init the engine with drip physics scaled to match.
    var rect = g.canvas.getBoundingClientRect();
    var fit = fitLayout(tag, rect.width, rect.height,
      el.getAttribute('data-align') || 'center', parseFloat(el.getAttribute('data-fill')) || 0);
    var speed = tag.speed != null ? tag.speed : (opts.speed != null ? opts.speed : 4);

    // (Re)point the singleton engine at THIS element's canvas + writer.
    // Keep init minimal (this is the config that's known to paint reliably);
    // speed goes to playLayout and drips are applied via setDripConfig below.
    window.GraffitiPaint.init({
      canvas: g.canvas,
      writer: g.writer,
      color: tag.color || '#ffc800',
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
      // Exit style: 'browser' sends the can off the viewport edge (hero);
      // default is a contained slide off this element's own edge (stats).
      if (el.getAttribute('data-exit') === 'browser') setBrowserEdgeExit(g.canvas);
      else setLocalExit();
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
      var next = queue.shift();
      if (next) next();
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

  // ── Public API ────────────────────────────────────────────────────────────
  window.GrftTag = {
    // Scan the page for `selector` elements and wire each up from its data-tag.
    auto: function (selector) {
      var els = document.querySelectorAll(selector || '.grft-tag');
      Array.prototype.forEach.call(els, mountFromAttr);
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
  };
})();

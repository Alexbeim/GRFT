import React, { useState, useRef, useCallback } from "react";

/**
 * Asset Manager — Step 6: Wall overlay.
 * Composite one or more real logo images onto a live wall preview — anchor to a
 * fixed position with padding, or drag freely with snap guides (wall center + other
 * logos) — then export the whole overlay as a single transparent PNG at the wall's
 * actual pixel resolution, logos only, ready to composite onto the live paint canvas
 * in production.
 * Fully standalone — own local state, no wizard shell dependency.
 *
 * Screen size: `wallWidth`/`wallHeight` (default 3840×2160, 16:9) drive both the
 * preview's aspect ratio and the exported PNG's pixel dimensions. For now these are
 * a fixed 16:9 default — the intent is for the host app to eventually pass the
 * actual screen dimensions configured for the event (the same source of truth as
 * the setup diagram's screen sizing) once that's wired up, so the overlay and the
 * physical screen always agree on resolution and aspect ratio.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";

// Two sample logos with different aspect ratios (1:1 and 3:1), inlined as SVG data
// URLs so the seed rows below preview and export correctly without a real upload.
const SAMPLE_MARK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="#0A0B0C"/><circle cx="100" cy="70" r="30" fill="#FEBD17"/></svg>');
const SAMPLE_WORDMARK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160"><rect x="4" y="4" width="472" height="152" rx="12" fill="#fff"/><text x="240" y="98" font-family="monospace" font-size="52" font-weight="700" text-anchor="middle" fill="#0A0B0C">SPONSOR</text></svg>');

const DEFAULT_LOGOS = [
  { id: "seed-1", name: "Brand logo", kind: "From assets", src: SAMPLE_MARK_SVG, naturalW: 200, naturalH: 200, mode: "anchored", anchor: "br", padding: 6, size: 14 },
  { id: "seed-2", name: "Sponsor mark", kind: "From assets", src: SAMPLE_WORDMARK_SVG, naturalW: 480, naturalH: 160, mode: "anchored", anchor: "tl", padding: 6, size: 22 },
];
const ANCHOR_KEYS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

// anchor math in percentages of wall width/height, given each logo's own true
// half-width/half-height (so padding touches the actual image edge, not a guess).
function axy(anchor, padding, halfWPct, halfHPct) {
  const xs = { l: padding + halfWPct, c: 50, r: 100 - padding - halfWPct };
  const ys = { t: padding + halfHPct, m: 50, b: 100 - padding - halfHPct };
  const vy = anchor[0] === "t" ? "t" : anchor[0] === "b" ? "b" : "m";
  const hx = anchor[1] === "l" ? "l" : anchor[1] === "r" ? "r" : "c";
  return { x: xs[hx], y: ys[vy] };
}

function aspectOf(lg) { return lg.naturalW && lg.naturalH ? lg.naturalW / lg.naturalH : 1; }

// A logo's width is a % of wall width; its height in % of wall height depends on
// both its own image aspect ratio and the wall's aspect ratio.
function heightPctOf(lg, wallAR) { return (lg.size * wallAR) / aspectOf(lg); }

function getXY(lg, wallAR) {
  if (lg.mode === "free") return { x: lg.x, y: lg.y };
  const halfH = heightPctOf(lg, wallAR) / 2;
  return axy(lg.anchor, lg.padding, lg.size / 2, halfH);
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

// Renders logos only, at full wall resolution, on a transparent canvas — no wall
// background — so the export is a straight composite layer for production.
async function exportOverlayPng(logos, wallWidth, wallHeight) {
  const wallAR = wallWidth / wallHeight;
  const canvas = document.createElement("canvas");
  canvas.width = wallWidth;
  canvas.height = wallHeight;
  const ctx = canvas.getContext("2d");
  for (const lg of logos) {
    if (!lg.src) continue;
    const img = await loadImageEl(lg.src);
    const xy = getXY(lg, wallAR);
    const wPx = (lg.size / 100) * wallWidth;
    const hPx = wPx / aspectOf(lg);
    const cx = (xy.x / 100) * wallWidth;
    const cy = (xy.y / 100) * wallHeight;
    ctx.drawImage(img, cx - wPx / 2, cy - hPx / 2, wPx, hPx);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 1900);
  }, []);
  return [toast, flash];
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: INK, color: "#F4F4F2", borderRadius: 4, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.28)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: YELLOW, display: "inline-block", flex: "none" }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: "#F4F4F2" }}>{message}</span>
    </div>
  );
}

function StepFooter({ stepNumber, totalSteps, completed, onToggleComplete, onBack, onNext, nextLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${HAIRLINE}`, marginTop: 32, paddingTop: 20 }}>
      <span onClick={onBack} style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: onBack ? "#6B6B70" : "#c2bfb6", cursor: onBack ? "pointer" : "default" }}>← Back</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
        Step {String(stepNumber).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span onClick={onToggleComplete} style={{ border: `1px solid ${completed ? "#16744B" : INK}`, color: completed ? "#16744B" : INK, borderRadius: 2, padding: "11px 18px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: completed ? 700 : 400, cursor: "pointer" }}>
          {completed ? "✓ Completed" : "Mark complete"}
        </span>
        <span onClick={onNext} style={{ background: YELLOW, color: INK, borderRadius: 2, padding: "12px 22px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          {nextLabel || "Continue →"}
        </span>
      </div>
    </div>
  );
}

export function AssetManagerStep6WallOverlay({
  initialLogos = DEFAULT_LOGOS,
  onChange,
  onExport, // (blob) => void — fired in addition to the automatic local download, e.g. to also persist server-side
  wallWidth = 3840,
  wallHeight = 2160, // 16:9 default — swap for the event's real screen size once that's wired up
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 6,
  totalSteps = 8,
}) {
  const [logos, setLogos] = useState(initialLogos);
  const [wallSel, setWallSel] = useState(0);
  const [drag, setDrag] = useState(null);
  const [guideX, setGuideX] = useState(null);
  const [guideY, setGuideY] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [dragOverWall, setDragOverWall] = useState(false);
  const wallRef = useRef(null);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [toast, flash] = useToast();

  const WALL_AR = wallWidth / wallHeight;
  const commit = (next) => { setLogos(next); onChange?.(next); };

  const startDrag = (i) => (e) => {
    e.preventDefault?.();
    setWallSel(i);
    setDrag({ i });
    setLogos((prev) => {
      const next = prev.map((lg, idx) => (idx === i && lg.mode !== "free" ? { ...lg, ...getXY(lg, WALL_AR), mode: "free" } : lg));
      onChange?.(next);
      return next;
    });
  };
  const onMove = (e) => {
    if (!drag || !wallRef.current) return;
    const r = wallRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    let y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    const TH = 2.6;
    const others = logos.map((lg, idx) => (idx === drag.i ? null : getXY(lg, WALL_AR))).filter(Boolean);
    let gx = null, gy = null;
    for (const t of [50, ...others.map((o) => o.x)]) { if (Math.abs(x - t) < TH) { x = t; gx = t; break; } }
    for (const t of [50, ...others.map((o) => o.y)]) { if (Math.abs(y - t) < TH) { y = t; gy = t; break; } }
    setGuideX(gx); setGuideY(gy);
    setLogos((prev) => {
      const next = prev.map((lg, idx) => (idx === drag.i ? { ...lg, mode: "free", x, y } : lg));
      onChange?.(next);
      return next;
    });
  };
  const endDrag = () => { if (drag) { setDrag(null); setGuideX(null); setGuideY(null); } };

  const sel = logos[wallSel] || logos[0];
  const updateSel = (patch) => {
    const next = logos.map((lg, i) => (i === wallSel ? { ...lg, ...patch } : lg));
    commit(next);
  };
  const setFree = () => { const xy = getXY(sel, WALL_AR); updateSel({ mode: "free", x: xy.x, y: xy.y }); };
  const setAnchored = () => updateSel({ mode: "anchored" });

  const removeLogo = (i) => {
    const target = logos[i];
    if (target?.src?.startsWith("blob:")) URL.revokeObjectURL(target.src);
    const next = logos.filter((_, idx) => idx !== i);
    commit(next);
    setWallSel((s) => Math.max(0, Math.min(next.length - 1, s)));
    flash("Removed logo");
  };

  // Reads real files, loads each to get its true pixel dimensions (so aspect ratio
  // on the wall is correct), then either appends new logos or replaces one in place.
  const handleFiles = async (fileList, replaceIndex) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    for (const file of incoming) {
      try {
        const src = URL.createObjectURL(file);
        const img = await loadImageEl(src);
        const meta = { src, naturalW: img.naturalWidth, naturalH: img.naturalHeight, file, name: file.name, kind: "Uploaded" };
        if (replaceIndex != null) {
          setLogos((prev) => {
            const old = prev[replaceIndex];
            if (old?.src?.startsWith("blob:")) URL.revokeObjectURL(old.src);
            const next = prev.map((lg, idx) => (idx === replaceIndex ? { ...lg, ...meta } : lg));
            onChange?.(next);
            return next;
          });
          flash(`Replaced with ${file.name}`);
        } else {
          let newIndex = 0;
          setLogos((prev) => {
            const next = [...prev, { id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, mode: "anchored", anchor: "mc", padding: 6, size: 18, x: 50, y: 50, ...meta }];
            newIndex = next.length - 1;
            onChange?.(next);
            return next;
          });
          setWallSel(newIndex);
          flash(`Added ${file.name}`);
        }
      } catch (e) {
        flash(`Couldn't load ${file.name}`);
      }
    }
  };

  const downloadOverlay = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await exportOverlayPng(logos, wallWidth, wallHeight);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wall-overlay-${wallWidth}x${wallHeight}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onExport?.(blob);
      flash(`Downloaded ${wallWidth}×${wallHeight} PNG`);
    } catch (e) {
      flash("Couldn't export the overlay — try again");
    } finally {
      setExporting(false);
    }
  };

  const selXY = getXY(sel, WALL_AR);
  const selX = Math.round(selXY.x);
  const selY = Math.round(selXY.y);

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 980 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00", marginBottom: 8 }}>Step 06</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.01em", color: INK, margin: "0 0 6px" }}>Wall overlay</h2>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6B6B70", margin: "0 0 24px", maxWidth: "62ch" }}>
        Upload one or more logos — your brand mark, a sponsor, anything — composited onto the live wall. Anchor each to a fixed position with padding, or drag it where you want — it snaps to the wall center and lines up with your other logos. When you're happy with it, download the whole thing as a single transparent PNG.
      </p>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 380 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Wall display preview</span>
            <span onClick={downloadOverlay} style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: exporting ? MUTED : INK, border: `1px solid ${exporting ? HAIRLINE : INK}`, borderRadius: 2, padding: "7px 12px", cursor: exporting ? "default" : "pointer" }}>
              {exporting ? "Exporting…" : "↓ Download PNG"}
            </span>
          </div>
          <div style={{ background: "#16181b", borderRadius: 6, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
            <div
              ref={wallRef}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              onDragOver={(e) => { e.preventDefault(); setDragOverWall(true); }}
              onDragLeave={() => setDragOverWall(false)}
              onDrop={(e) => { e.preventDefault(); setDragOverWall(false); handleFiles(e.dataTransfer.files); }}
              style={{ aspectRatio: `${wallWidth}/${wallHeight}`, background: INK, borderRadius: 2, position: "relative", overflow: "hidden", touchAction: "none", outline: dragOverWall ? `2px dashed ${YELLOW}` : "none", outlineOffset: -2 }}
            >
              <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(125deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 52px)" }} />
              <div style={{ position: "absolute", top: 14, left: 16, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#5a5d62" }}>Live wall · {wallWidth.toLocaleString()} × {wallHeight.toLocaleString()}</div>
              {guideX != null && <div style={{ position: "absolute", left: `${guideX}%`, top: 0, bottom: 0, width: 1, background: YELLOW, opacity: 0.9, pointerEvents: "none" }} />}
              {guideY != null && <div style={{ position: "absolute", top: `${guideY}%`, left: 0, right: 0, height: 1, background: YELLOW, opacity: 0.9, pointerEvents: "none" }} />}
              {dragOverWall && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(10,11,12,0.7)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: YELLOW }}>Drop to add logo</span>
                </div>
              )}
              {logos.map((lg, i) => {
                const xy = getXY(lg, WALL_AR);
                const heightPct = heightPctOf(lg, WALL_AR);
                const isSel = i === wallSel;
                return (
                  <div
                    key={lg.id ?? i}
                    onPointerDown={startDrag(i)}
                    onClick={() => setWallSel(i)}
                    style={{
                      position: "absolute", left: `${xy.x.toFixed(2)}%`, top: `${xy.y.toFixed(2)}%`, width: `${lg.size}%`, height: `${heightPct}%`,
                      transform: "translate(-50%,-50%)", cursor: "grab", touchAction: "none",
                      outline: isSel ? `2px dashed ${YELLOW}` : "1px solid rgba(255,255,255,0.35)", outlineOffset: 3,
                    }}
                  >
                    {lg.src ? (
                      <img src={lg.src} alt={lg.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{lg.name}</div>
                    )}
                  </div>
                );
              })}
              {sel.mode === "free" && (
                <div style={{ position: "absolute", bottom: 12, left: 16, fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: YELLOW, pointerEvents: "none" }}>
                  Free placement · drag to position, snaps to guides
                </div>
              )}
            </div>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED, marginTop: 8 }}>
            Exports at {wallWidth.toLocaleString()} × {wallHeight.toLocaleString()}px, transparent background, logos only — ready to composite onto the live wall.
          </div>
        </div>

        <div style={{ width: 340, flex: "none", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Overlay logos</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED }}>{logos.length} logos</span>
            </div>
            {logos.map((lg, i) => {
              const isSel = i === wallSel;
              return (
                <div key={lg.id ?? i} onClick={() => setWallSel(i)} style={{ display: "flex", alignItems: "center", gap: 11, border: `1px solid ${isSel ? INK : HAIRLINE}`, borderRadius: 2, padding: "11px 12px", marginBottom: 8, cursor: "pointer" }}>
                  <span style={{ width: 34, height: 26, borderRadius: 2, background: "repeating-conic-gradient(#ECEAE4 0% 25%, #fff 0% 50%) 50% / 8px 8px", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {lg.src && <img src={lg.src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: INK, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lg.name}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED }}>{lg.kind}</span>
                  </span>
                  {isSel && <span onClick={(e) => { e.stopPropagation(); removeLogo(i); }} style={{ fontFamily: FONT_MONO, fontSize: 15, color: MUTED, cursor: "pointer" }}>×</span>}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <span onClick={() => addInputRef.current?.click()} style={{ flex: 1, textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: INK, border: "1px dashed #c2bfb6", borderRadius: 2, padding: "9px 0", cursor: "pointer" }}>+ Upload logo</span>
              <span onClick={() => replaceInputRef.current?.click()} style={{ flex: 1, textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6B6B70", border: `1px solid ${HAIRLINE}`, borderRadius: 2, padding: "9px 0", cursor: "pointer" }}>Replace image</span>
            </div>
            <input ref={addInputRef} type="file" accept="image/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
            <input ref={replaceInputRef} type="file" accept="image/*" onChange={(e) => { handleFiles(e.target.files, wallSel); e.target.value = ""; }} style={{ display: "none" }} />
          </div>

          {/* One grouped card — mode, anchor/free control, and both sliders all
              configure the same selected logo, so they read as a single unit. */}
          <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 3, background: "#FAF9F6", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Placement · {sel.name}</span>
              <div style={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: 2, overflow: "hidden", background: "#fff" }}>
                <span onClick={setAnchored} style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: sel.mode === "anchored" ? INK : "#6B6B70", background: sel.mode === "anchored" ? YELLOW : "transparent", padding: "7px 13px", fontWeight: sel.mode === "anchored" ? 700 : 400, cursor: "pointer" }}>Anchored</span>
                <span onClick={setFree} style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: sel.mode === "free" ? INK : "#6B6B70", background: sel.mode === "free" ? YELLOW : "transparent", padding: "7px 13px", fontWeight: sel.mode === "free" ? 700 : 400, cursor: "pointer", borderLeft: `1px solid ${HAIRLINE}` }}>Free</span>
              </div>
            </div>

            {sel.mode === "anchored" ? (
              <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, width: 108, flex: "none" }}>
                  {ANCHOR_KEYS.map((a) => {
                    const active = sel.anchor === a;
                    return <span key={a} onClick={() => updateSel({ anchor: a })} title={a} style={{ aspectRatio: "1", borderRadius: 2, background: active ? YELLOW : "#fff", border: `1px solid ${active ? YELLOW : HAIRLINE}`, cursor: "pointer" }} />;
                  })}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 7 }}><span>Padding</span><span>{sel.padding}%</span></div>
                  <input type="range" min="0" max="20" value={sel.padding} onChange={(e) => updateSel({ padding: Number(e.target.value) })} style={{ width: "100%", accentColor: YELLOW, cursor: "pointer" }} />
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 7 }}><span>Horizontal</span><span>{selX}%</span></div>
                <input type="range" min="0" max="100" value={selX} onChange={(e) => updateSel({ x: Number(e.target.value) })} style={{ width: "100%", accentColor: YELLOW, cursor: "pointer", marginBottom: 14 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 7 }}><span>Vertical</span><span>{selY}%</span></div>
                <input type="range" min="0" max="100" value={selY} onChange={(e) => updateSel({ y: Number(e.target.value) })} style={{ width: "100%", accentColor: YELLOW, cursor: "pointer" }} />
              </div>
            )}

            <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 7 }}><span>Size</span><span>{sel.size}%</span></div>
              <input type="range" min="4" max="50" value={sel.size} onChange={(e) => updateSel({ size: Number(e.target.value) })} style={{ width: "100%", accentColor: YELLOW, cursor: "pointer" }} />
            </div>
          </div>
        </div>
      </div>

      <StepFooter stepNumber={stepNumber} totalSteps={totalSteps} completed={completed} onToggleComplete={onToggleComplete} onBack={onBack} onNext={onNext} />
      <Toast message={toast} />
    </div>
  );
}

export default AssetManagerStep6WallOverlay;

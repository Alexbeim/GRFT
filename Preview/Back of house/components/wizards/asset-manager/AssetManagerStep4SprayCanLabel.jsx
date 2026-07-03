import React, { useState, useRef, useCallback } from "react";

/**
 * Asset Manager — Step 4: Spray can label.
 * Artwork source, can color, gradient, then drag-to-position the label on a live
 * can preview with snap guides, plus a 360° rotation slider with face detection.
 * Fully standalone — own local state, no wizard shell dependency.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";

const CAN_PALETTE = ["#0A0B0C", "#FEBD17", "#C7402F", "#2A6FDB", "#1F8A5B"];
const FACE_DEFS = [{ label: "Front", d: 0 }, { label: "Right", d: 90 }, { label: "Back", d: 180 }, { label: "Left", d: 270 }];

function faceFor(d) {
  const n = ((d % 360) + 360) % 360;
  if (n < 45 || n >= 315) return "Front";
  if (n < 135) return "Right";
  if (n < 225) return "Back";
  return "Left";
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

export function AssetManagerStep4SprayCanLabel({
  onChange,
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 4,
  totalSteps = 8,
}) {
  const [artSource, setArtSource] = useState("uploads");
  const [artTile, setArtTile] = useState(0);
  const [canColor, setCanColor] = useState(1);
  const [gradientOn, setGradientOn] = useState(true);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [canArtX, setCanArtX] = useState(50);
  const [canArtY, setCanArtY] = useState(50);
  const [canDrag, setCanDrag] = useState(false);
  const [canGuideX, setCanGuideX] = useState(null);
  const [canGuideY, setCanGuideY] = useState(null);
  const canRef = useRef(null);
  const [toast, flash] = useToast();

  const emit = (patch) => onChange?.({ artSource, artTile, canColor, gradientOn, rotateDeg, canArtX, canArtY, ...patch });

  const startCanDrag = (e) => { e.preventDefault?.(); setCanDrag(true); };
  const onCanMove = (e) => {
    if (!canDrag || !canRef.current) return;
    const r = canRef.current.getBoundingClientRect();
    let x = Math.max(12, Math.min(88, ((e.clientX - r.left) / r.width) * 100));
    let y = Math.max(12, Math.min(88, ((e.clientY - r.top) / r.height) * 100));
    let gx = null, gy = null;
    if (Math.abs(x - 50) < 3) { x = 50; gx = 50; }
    for (const t of [33, 50, 67]) { if (Math.abs(y - t) < 3) { y = t; gy = t; break; } }
    setCanArtX(x); setCanArtY(y); setCanGuideX(gx); setCanGuideY(gy);
    emit({ canArtX: x, canArtY: y });
  };
  const endCanDrag = () => { if (canDrag) { setCanDrag(false); setCanGuideX(null); setCanGuideY(null); } };

  const rad = (rotateDeg * Math.PI) / 180;
  const lx = canArtX + Math.sin(rad) * 30;
  const labelOpacity = Math.cos(rad) > 0 ? 1 : 0.12;
  const canFace = faceFor(rotateDeg);

  const setRotation = (d) => { setRotateDeg(d); emit({ rotateDeg: d }); };

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 900 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00", marginBottom: 8 }}>Step 04</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.01em", color: INK, margin: "0 0 6px" }}>Spray can label</h2>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6B6B70", margin: "0 0 22px", maxWidth: "62ch" }}>Design the label that wraps each spray can — artwork, color, gradient, then position.</p>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <div style={{ width: 348, flex: "none", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* 1 artwork */}
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>1 · Artwork</div>
            <div style={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
              {[{ key: "uploads", label: "From uploads" }, { key: "upload", label: "Upload new" }, { key: "fullwrap", label: "Full wrap" }].map((o) => {
                const active = artSource === o.key;
                return (
                  <span key={o.key} onClick={() => { setArtSource(o.key); emit({ artSource: o.key }); }} style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: active ? INK : "#6B6B70", background: active ? YELLOW : "transparent", padding: "8px 12px", fontWeight: active ? 700 : 400, cursor: "pointer", borderLeft: `1px solid ${HAIRLINE}` }}>
                    {o.label}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              {[0, 1].map((i) => (
                <div key={i} onClick={() => { setArtTile(i); emit({ artTile: i }); }} style={{ width: 60, height: 60, borderRadius: 2, background: "#ECEAE4", border: `2px solid ${artTile === i ? YELLOW : "transparent"}`, cursor: "pointer" }} />
              ))}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", color: MUTED }}>Full wrap requires 2480 × 1040 px @ 300 dpi</div>
          </div>

          {/* 2 can color */}
          <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>2 · Can color</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {CAN_PALETTE.map((hex, i) => (
                <div
                  key={hex}
                  onClick={() => { setCanColor(i); emit({ canColor: i }); }}
                  style={{ width: 34, height: 34, borderRadius: "50%", background: hex, cursor: "pointer", outline: canColor === i ? `2px solid ${INK}` : "none", outlineOffset: 2 }}
                />
              ))}
              <div onClick={() => flash("Color picker is a demo")} style={{ width: 34, height: 34, borderRadius: "50%", border: "1px dashed #c2bfb6", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 16, cursor: "pointer" }}>+</div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", color: MUTED, marginTop: 8 }}>From palette, or + a new color</div>
          </div>

          {/* 3 gradient */}
          <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>3 · Gradient</span>
              <span onClick={() => { const v = !gradientOn; setGradientOn(v); emit({ gradientOn: v }); }} style={{ width: 32, height: 18, borderRadius: 9, background: gradientOn ? YELLOW : "#e2dfd8", position: "relative", cursor: "pointer" }}>
                <span style={{ position: "absolute", top: 2, [gradientOn ? "right" : "left"]: 2, width: 14, height: 14, borderRadius: "50%", background: gradientOn ? INK : "#fff", boxShadow: gradientOn ? "none" : "0 1px 2px rgba(0,0,0,0.2)" }} />
              </span>
            </div>
            {gradientOn && <div style={{ height: 30, borderRadius: 2, background: `linear-gradient(90deg, ${YELLOW}, #C7402F)`, marginBottom: 10 }} />}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: YELLOW, border: "1px solid #d8d5cd" }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: MUTED }}>→</span>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#C7402F", border: "1px solid #d8d5cd" }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", color: MUTED, marginLeft: 6 }}>Palette or new colors</span>
            </div>
          </div>

          {/* 4 placement */}
          <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>4 · Placement</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.5, color: "#6B6B70" }}>Drag the artwork on the can to position it — it snaps to the can's center line and to the top, middle and bottom thirds.</div>
          </div>
        </div>

        {/* preview */}
        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ flex: 1, background: "#ECEAE4", borderRadius: 2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 14, left: 16, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Real-time 3D preview</div>
            <div style={{ position: "absolute", top: 12, right: 14, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: INK, background: "#fff", border: "1px solid #d8d5cd", borderRadius: 2, padding: "5px 10px" }}>{canFace} · {rotateDeg}°</div>
            <div
              ref={canRef}
              onPointerMove={onCanMove}
              onPointerUp={endCanDrag}
              onPointerLeave={endCanDrag}
              style={{ width: 104, height: 330, borderRadius: "14px 14px 6px 6px", background: "#fff", border: "1px solid #d8d5cd", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, touchAction: "none" }}
            >
              <div style={{ width: 32, height: 24, background: "#d8d5cd", borderRadius: 3 }} />
              {canGuideX != null && <div style={{ position: "absolute", left: `${canGuideX}%`, top: 0, bottom: 0, width: 1, background: YELLOW, opacity: 0.9, pointerEvents: "none" }} />}
              {canGuideY != null && <div style={{ position: "absolute", top: `${canGuideY}%`, left: 0, right: 0, height: 1, background: YELLOW, opacity: 0.9, pointerEvents: "none" }} />}
              <div
                onPointerDown={startCanDrag}
                style={{
                  position: "absolute", width: 64, height: 64, background: CAN_PALETTE[canColor], borderRadius: 4, cursor: "grab", touchAction: "none",
                  left: `${lx.toFixed(1)}%`, top: `${canArtY}%`, transform: "translate(-50%,-50%)", opacity: labelOpacity.toFixed(2),
                }}
              />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 42, background: "linear-gradient(90deg, rgba(0,0,0,0.06), transparent 18%, transparent 82%, rgba(0,0,0,0.06))", pointerEvents: "none" }} />
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: 2, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Rotate to inspect · full 360°</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: INK }}>{rotateDeg}°</span>
            </div>
            <input type="range" min="0" max="360" value={rotateDeg} onChange={(e) => setRotation(Number(e.target.value))} style={{ width: "100%", accentColor: YELLOW, cursor: "pointer" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {FACE_DEFS.map((f) => {
                const active = canFace === f.label;
                return (
                  <span
                    key={f.label}
                    onClick={() => setRotation(f.d)}
                    style={{
                      flex: 1, textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase",
                      color: active ? INK : "#6B6B70", background: active ? YELLOW : "transparent", border: active ? "none" : `1px solid ${HAIRLINE}`,
                      borderRadius: 2, padding: "8px 0", fontWeight: active ? 700 : 400, cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <StepFooter stepNumber={stepNumber} totalSteps={totalSteps} completed={completed} onToggleComplete={onToggleComplete} onBack={onBack} onNext={onNext} />
      <Toast message={toast} />
    </div>
  );
}

export default AssetManagerStep4SprayCanLabel;

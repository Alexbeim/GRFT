import React, { useState } from "react";

/**
 * Asset Manager — Step 7: Test area.
 * A trial-mode entry point into the browser paint app — tool rail + canvas frame.
 * The actual paint engine is out of scope here; this is the launch surface for it.
 * Fully standalone — own local state, no wizard shell dependency.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";

const TOOLS = [
  { key: "cans", label: "Cans" },
  { key: "stencil", label: "Stencil" },
  { key: "sticker", label: "Sticker" },
  { key: "color", label: "Color" },
  { key: "bg", label: "BG" },
];

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

export function AssetManagerStep7TestArea({
  onLaunch,
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 7,
  totalSteps = 8,
}) {
  const [activeTool, setActiveTool] = useState("cans");
  const [activeColor, setActiveColor] = useState(2);
  const colors = ["#ffffff", "#ffffff", YELLOW];

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00" }}>Step 07</div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: INK, background: YELLOW, borderRadius: 2, padding: "3px 9px" }}>Trial mode</span>
      </div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.01em", color: INK, margin: "0 0 6px" }}>Test area</h2>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6B6B70", margin: "0 0 24px", maxWidth: "62ch" }}>A browser version of the paint app. Trial every can, stencil, sticker, color and background before you launch.</p>

      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ width: 84, flex: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {TOOLS.map((t) => {
            const active = activeTool === t.key;
            return (
              <div
                key={t.key}
                onClick={() => setActiveTool(t.key)}
                style={{ aspectRatio: "1", borderRadius: 2, background: active ? INK : "#ECEAE4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: active ? "#fff" : "#6B6B70", cursor: "pointer" }}
              >
                {t.label}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, minHeight: 380, background: "#ECEAE4", borderRadius: 2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>Paint canvas · {TOOLS.find((t) => t.key === activeTool)?.label}</span>
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10 }}>
            {colors.map((c, i) => (
              <div key={i} onClick={() => setActiveColor(i)} style={{ width: 42, height: 42, borderRadius: "50%", background: c, border: c === "#ffffff" ? "1px solid #d8d5cd" : "none", outline: activeColor === i ? `2px solid ${INK}` : "none", outlineOffset: 2, cursor: "pointer" }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <span onClick={onLaunch} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: INK, color: "#fff", borderRadius: 2, padding: "13px 22px", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
          Launch full trial →
        </span>
      </div>

      <StepFooter stepNumber={stepNumber} totalSteps={totalSteps} completed={completed} onToggleComplete={onToggleComplete} onBack={onBack} onNext={onNext} />
    </div>
  );
}

export default AssetManagerStep7TestArea;

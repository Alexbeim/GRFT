import React, { useState } from "react";

/**
 * Asset Manager — Step 8: Approve & lock.
 * Final checklist recap and the approve/lock action that freezes assets and hands
 * off to production. Fully standalone — own local state, no wizard shell dependency.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";

const DEFAULT_ITEMS = [
  { label: "Logos", meta: "2 files" },
  { label: "Color palette", meta: "5 swatches" },
  { label: "Can designs", meta: "2 placements" },
  { label: "Stencils, stickers & backgrounds", meta: "8 assets" },
  { label: "Wall overlay", meta: "Bottom-right" },
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

export function AssetManagerStep8ApproveLock({
  items = DEFAULT_ITEMS,
  onApprove,
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 8,
  totalSteps = 8,
}) {
  const [locked, setLocked] = useState(false);

  const approveLock = () => {
    setLocked(true);
    onApprove?.();
  };

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 620 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00", marginBottom: 8 }}>Step 08</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.01em", color: INK, margin: "0 0 6px" }}>Approve &amp; lock</h2>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6B6B70", margin: "0 0 24px", maxWidth: "62ch" }}>
        Confirm your assets. On approval they freeze and flow into the event record — nothing changes after launch without a reopen.
      </p>

      <div style={{ maxWidth: 560 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, borderTop: `1px solid ${HAIRLINE}`, borderBottom: i === items.length - 1 ? `1px solid ${HAIRLINE}` : "none", padding: "16px 0", marginBottom: i === items.length - 1 ? 24 : 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#16744B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</span>
            <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 15, color: INK }}>{item.label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: MUTED }}>{item.meta}</span>
          </div>
        ))}

        {locked ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#E3F1EA", color: "#16744B", borderRadius: 2, padding: "15px 26px", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
            ✓ Assets approved & locked
          </div>
        ) : (
          <div onClick={approveLock} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: YELLOW, color: INK, borderRadius: 2, padding: "15px 26px", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" }}>
            Approve &amp; lock assets →
          </div>
        )}
      </div>

      <StepFooter stepNumber={stepNumber} totalSteps={totalSteps} completed={completed} onToggleComplete={onToggleComplete} onBack={onBack} onNext={onNext} />
    </div>
  );
}

export default AssetManagerStep8ApproveLock;

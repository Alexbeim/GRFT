import React, { useState } from "react";

/**
 * Asset Manager — Step 5: Asset builder.
 * Stencils / stickers / backgrounds tabs, a premade/upload/AI source toggle, and a
 * multi-select tile grid. Fully standalone — own local state, no wizard shell dependency.
 */

const FONT_MONO = "var(--gp-font-mono, 'Space Mono', 'Courier New', monospace)";
const FONT_BODY = "var(--gp-font-body, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const FONT_DISPLAY = "var(--gp-font-display, 'Manrope', 'Helvetica Neue', Arial, sans-serif)";
const YELLOW = "#FEBD17";
const INK = "#0A0B0C";
const HAIRLINE = "var(--gp-hairline-light, rgba(10,11,12,0.12))";
const MUTED = "#9A9A96";

const TAB_DEFS = [
  { key: "stencils", label: "Stencils", count: 10 },
  { key: "stickers", label: "Stickers", count: 8 },
  { key: "backgrounds", label: "Backgrounds", count: 6 },
];
const SOURCE_DEFS = [
  { key: "premade", label: "Premade" },
  { key: "upload", label: "Upload new" },
  { key: "ai", label: "Make with AI" },
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

export function AssetManagerStep5AssetBuilder({
  initialTab = "stencils",
  initialSource = "premade",
  initialSelection = { stencils: [0, 3], stickers: [], backgrounds: [] },
  onChange,
  completed = false,
  onToggleComplete,
  onBack,
  onNext,
  stepNumber = 5,
  totalSteps = 8,
}) {
  const [tab, setTab] = useState(initialTab);
  const [source, setSource] = useState(initialSource);
  const [sel, setSel] = useState(initialSelection);

  const curCount = (TAB_DEFS.find((t) => t.key === tab) || {}).count || 10;
  const selectedNow = sel[tab] || [];

  const toggleTile = (i) => {
    setSel((prev) => {
      const arr = prev[tab] || [];
      const nextArr = arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i];
      const next = { ...prev, [tab]: nextArr };
      onChange?.(next);
      return next;
    });
  };

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 720 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#B07A00", marginBottom: 8 }}>Step 05</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "-0.01em", color: INK, margin: "0 0 16px" }}>Asset builder</h2>

      <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${HAIRLINE}`, marginBottom: 20 }}>
        {TAB_DEFS.map((t) => {
          const active = tab === t.key;
          return (
            <span
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
                color: active ? INK : MUTED, fontWeight: active ? 700 : 400, paddingBottom: 12,
                borderBottom: active ? `2px solid ${YELLOW}` : "2px solid transparent", cursor: "pointer",
              }}
            >
              {t.label}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: 2, overflow: "hidden" }}>
          {SOURCE_DEFS.map((s, i) => {
            const active = source === s.key;
            return (
              <span key={s.key} onClick={() => setSource(s.key)} style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: active ? INK : "#6B6B70", background: active ? YELLOW : "transparent", padding: "9px 16px", fontWeight: active ? 700 : 400, cursor: "pointer", borderLeft: i > 0 ? `1px solid ${HAIRLINE}` : "none" }}>
                {s.label}
              </span>
            );
          })}
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{selectedNow.length} selected · tap to toggle</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {Array.from({ length: curCount }, (_, i) => {
          const isSel = selectedNow.includes(i);
          return (
            <div
              key={i}
              onClick={() => toggleTile(i)}
              style={{ aspectRatio: "1", borderRadius: 2, background: "#ECEAE4", border: `2px solid ${isSel ? YELLOW : "transparent"}`, position: "relative", cursor: "pointer" }}
            >
              {isSel && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: YELLOW, color: INK, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 10 }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      <StepFooter stepNumber={stepNumber} totalSteps={totalSteps} completed={completed} onToggleComplete={onToggleComplete} onBack={onBack} onNext={onNext} />
    </div>
  );
}

export default AssetManagerStep5AssetBuilder;

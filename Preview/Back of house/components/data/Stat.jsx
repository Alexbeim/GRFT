import React from "react";

/**
 * Graffiti+ Stat. Big grotesk/mono figure over a mono unit label.
 * Use 3–4 across a hairline-topped row for proof. One figure may go accent.
 */
export function Stat({ figure, label, accent = false, onDark = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <span
        style={{
          fontFamily: "var(--gp-font-graffiti)",
          fontSize: "var(--gp-stat)",
          lineHeight: 1,
          letterSpacing: 0,
          color: accent
            ? "var(--gp-accent)"
            : onDark
            ? "var(--gp-ink)"
            : "var(--gp-ink-on-light)",
        }}
      >
        {figure}
      </span>
      <span
        style={{
          fontFamily: "var(--gp-font-mono)",
          fontSize: "0.8125rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--gp-mono-grey)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * StatRow — 3–4 Stats divided by a top hairline + inter-cell gap.
 */
export function StatRow({ children, onDark = true }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--gp-space-7, 4rem)",
        paddingTop: "var(--gp-space-4, 1.5rem)",
        borderTop: `1px solid ${onDark ? "var(--gp-hairline)" : "var(--gp-hairline-light)"}`,
      }}
    >
      {children}
    </div>
  );
}

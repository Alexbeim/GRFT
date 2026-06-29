import React from "react";

/**
 * Graffiti+ AudienceCard. Bold label + one-line value prop, hairline-separated.
 * Explicitly NOT a rounded accent-border card — it's a content block divided by rules.
 */
export function AudienceCard({ label, value, onDark = true }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        paddingTop: "var(--gp-space-4, 1.5rem)",
        borderTop: `1px solid ${onDark ? "var(--gp-hairline)" : "var(--gp-hairline-light)"}`,
      }}
    >
      <span
        style={{
          fontFamily: "var(--gp-font-display)",
          fontWeight: 700,
          fontSize: "1.375rem",
          letterSpacing: "-0.01em",
          color: onDark ? "var(--gp-ink)" : "var(--gp-ink-on-light)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--gp-font-body)",
          fontWeight: 400,
          fontSize: "1rem",
          lineHeight: 1.5,
          textWrap: "pretty",
          color: onDark ? "var(--gp-muted)" : "var(--gp-muted-light)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * NumberedStep. 01–04 mono numeral, two-line title (muted second), one sentence.
 */
export function NumberedStep({ number, title, second, body, onDark = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-3, 1rem)" }}>
      <span
        style={{
          fontFamily: "var(--gp-font-mono)",
          fontSize: "0.8125rem",
          letterSpacing: "0.18em",
          color: "var(--gp-accent)",
        }}
      >
        {number}
      </span>
      <span
        style={{
          fontFamily: "var(--gp-font-display)",
          fontWeight: 700,
          fontSize: "1.5rem",
          lineHeight: 1.0,
          letterSpacing: "-0.01em",
          color: onDark ? "var(--gp-ink)" : "var(--gp-ink-on-light)",
        }}
      >
        {title}
        {second ? <><br /><span style={{ color: onDark ? "var(--gp-muted)" : "var(--gp-muted-light)" }}>{second}</span></> : null}
      </span>
      <span
        style={{
          fontFamily: "var(--gp-font-body)",
          fontSize: "1rem",
          lineHeight: 1.5,
          textWrap: "pretty",
          color: onDark ? "var(--gp-ink-dim)" : "var(--gp-body)",
        }}
      >
        {body}
      </span>
    </div>
  );
}

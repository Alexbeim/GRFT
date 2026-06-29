import React from "react";

/**
 * Graffiti+ EyebrowLabel.
 * Mono, uppercase, wide tracking, optional lead dot/dash. Yellow on dark,
 * mono-grey on light. Dot-separate segments: "THE PROGRAMMING · AIR GIANTS".
 */
export function EyebrowLabel({ children, onDark = true, lead = "dot", ...rest }) {
  const leadGlyph = lead === "dash" ? "—" : lead === "dot" ? "·" : null;
  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontFamily: "var(--gp-font-mono)",
        fontSize: "0.8125rem",
        fontWeight: 400,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: onDark ? "var(--gp-accent)" : "var(--gp-mono-grey)",
      }}
    >
      {leadGlyph ? <span aria-hidden="true">{leadGlyph}</span> : null}
      <span>{children}</span>
    </span>
  );
}

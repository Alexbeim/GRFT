import React from "react";

/**
 * Graffiti+ LogoWall. Partner logos as mono-weight marks.
 * Dark band (marks in mono-grey) or light chips (#F4F4F2). Even grid, generous
 * spacing, mono section label above. Pass logos as {src,alt} for real images,
 * or plain strings for wordmark fallbacks.
 */
export function LogoWall({ logos = [], label = "Trusted by", onDark = true, columns = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gp-space-5, 2rem)" }}>
      <span
        style={{
          fontFamily: "var(--gp-font-mono)",
          fontSize: "0.8125rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--gp-mono-grey)",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "1px",
          background: onDark ? "var(--gp-hairline)" : "var(--gp-hairline-light)",
        }}
      >
        {logos.map((logo, i) => {
          const isImg = logo && typeof logo === "object" && logo.src;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--gp-space-4, 1.5rem)",
                minHeight: "72px",
                background: onDark ? "var(--gp-ground)" : "var(--gp-paper)",
              }}
            >
              {isImg ? (
                <img
                  src={logo.src}
                  alt={logo.alt || ""}
                  style={{ maxHeight: "28px", maxWidth: "100%", objectFit: "contain", filter: onDark ? "grayscale(1) brightness(1.6)" : "grayscale(1)" }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--gp-font-mono)",
                    fontSize: "0.875rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: onDark ? "var(--gp-muted)" : "var(--gp-muted-light)",
                  }}
                >
                  {typeof logo === "object" ? logo.alt : logo}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

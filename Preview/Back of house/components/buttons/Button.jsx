import React from "react";

/**
 * Graffiti+ Button.
 * Primary: yellow fill, ink text, 2px radius — darkens to accent-deep on press.
 * Secondary: paper/ink outline. Link: text + arrow that nudges on hover.
 * Mono label, no shouting. The arrow is type, not an icon asset.
 */
export function Button({
  children,
  variant = "primary",
  href,
  onDark = false,
  onClick,
  type = "button",
  disabled = false,
  ...rest
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: "var(--gp-font-mono)",
    fontSize: "0.8125rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
    padding: "0.875rem 1.375rem",
    border: "1px solid transparent",
    borderRadius: "var(--gp-radius-btn, 2px)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    textDecoration: "none",
    transition: "background var(--gp-dur,200ms) var(--gp-ease), color var(--gp-dur,200ms)",
  };

  const variants = {
    primary: {
      background: "var(--gp-accent)",
      color: "var(--gp-ground)",
    },
    secondary: {
      background: "transparent",
      color: onDark ? "var(--gp-ink)" : "var(--gp-ink-on-light)",
      borderColor: onDark ? "var(--gp-ink)" : "var(--gp-ink-on-light)",
    },
    link: {
      background: "transparent",
      color: onDark ? "var(--gp-ink)" : "var(--gp-accent-deep)",
      padding: "0.25rem 0",
    },
  };

  const style = { ...base, ...(variants[variant] || variants.primary) };
  const Tag = href ? "a" : "button";
  const tagProps = href ? { href } : { type, disabled };

  return (
    <Tag
      {...tagProps}
      {...rest}
      style={style}
      onClick={onClick}
      onMouseDown={(e) => {
        if (variant === "primary" && !disabled)
          e.currentTarget.style.background = "var(--gp-accent-deep)";
      }}
      onMouseUp={(e) => {
        if (variant === "primary" && !disabled)
          e.currentTarget.style.background = "var(--gp-accent)";
      }}
    >
      <span>{children}</span>
      {variant === "link" ? <span aria-hidden="true">→</span> : null}
    </Tag>
  );
}

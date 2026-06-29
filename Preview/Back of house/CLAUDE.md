# Project instructions

## Default design system — Graffiti+ (GRFT+)

**Graffiti+ is the default design system for every document, deck, prototype, and asset in this project.** Do not invent a separate visual language — always build on the Graffiti+ system defined here.

Brand: **Graffiti+ (GRFT+)** — the original interactive digital graffiti wall, since 2008, by Tangible Interaction Design Inc.

### The rules (full detail in `readme.md` + `SKILL.md`)
- **Light, photography-forward.** Paper (`#FFFFFF` / `#FAF9F6`) is the primary reading surface. Black (`#0A0B0C`) is punctuation only — nav, hero, logo marquee, footer. Web balance ≈ 60% light / 40% dark.
- **Yellow `#FEBD17` is a single accent** — demo button, link underlines, lead dots, active dashes, numerals. Never a flood. On light, yellow *text* → `#B07A00` (fails contrast otherwise).
- **Type:** Manrope (display 700 + body 400–500), Space Mono for UPPERCASE labels only, and the graffiti tag face (`--gp-font-graffiti`) for big stat numbers only (`18 / 500+ / 6 / 2008`).
- **Logo:** GRFT+ bubble wordmark `assets/logo-grft.png` — black on light, `filter: brightness(0) invert(1)` for white on dark.
- **Voice:** confident, plain, sentence-case headlines. No exclamation marks, no emoji. Photography supplies the energy.

### How to use it
1. Link the tokens: `styles.css` (it `@import`s everything in `tokens/`).
2. Reuse components in `components/` and fork the homepage in `ui_kits/website/` as a starting point for new pages.
3. Copy assets out of `assets/` rather than referencing externally.

### Standing TODO when real assets arrive
- Swap `--gp-font-graffiti` to the real hand-drawn number font (currently Permanent Marker stand-in).
- Swap the homepage display font if the licensed grotesque is provided (currently Manrope stand-in).
- Replace text wordmarks in the logo wall with real partner SVGs; replace placeholder photo fields with real event photography.

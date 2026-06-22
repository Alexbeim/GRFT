# Graffiti+ — Design System

The brand system for **Graffiti+ (GRFT+)** — *the original interactive digital
graffiti wall, since 2008* — by **Tangible Interaction Design Inc.** Distilled from
**graffitiplus.io** (live site), plus the GRFT+ bubble wordmark and cone mascot.

> **The single rule:** light, photography-forward surfaces with **black used as
> punctuation** (nav, hero, footer) and **yellow `#FEBD17` as a single accent** — never a flood.

Graffiti+ is a hands-on digital graffiti wall for event activations — brand activations,
festivals, product launches, tradeshows. Real spray-can tools, in public, at scale.
500+ activations on six continents for Nike, Chanel, Hennessy, Porsche, Google, Disney,
Samsung, and more. The voice is confident and plain; the photography supplies the energy.

## Sources
- graffitiplus.io — live website (the primary reference: light/photo-forward, dark nav + hero).
- `uploads/design.md` — the authored design language (kept in the project; note its *Street Giants / K11 ECOAST* deck is one example project, not the brand).
- GRFT+ bubble wordmark — `assets/logo-grft.png` (transparent, 1808×956). Supplied.
- GRFT+ cone mascot — `assets/cone-mascot.png` (transparent) + vector `.svg`. Supplied.

---

## Content fundamentals

- **Tone:** short, declarative, present-tense. "From load-in to last tag, we handle everything."
- **Fragments punch:** "Zero barrier. Full participation." is on-brand.
- **Lead with the takeaway;** supporting detail goes to speaker notes or an appendix, never onto the slide.
- **Casing:** headlines sentence-case (often multi-line), Archivo bold/black, no full stops required. Labels are UPPERCASE mono.
- **No exclamation marks, no stacked hype adjectives.** The photography supplies the energy.
- **Name discipline:** `Graffiti+`, `GRFT+` — one spelling everywhere.
- **No emoji.** Ever.
- **Headline grammar:** sentence-case Archivo bold, ink on paper (or white on the dark hero). A muted second clause is common. Real examples:
  ```
  Pioneering digital graffiti since 2008.
  From load-in to last tag, we handle everything.
  Two decades in, and still perfecting it.
  ```
- **Eyebrow label:** mono, uppercase, with a lead dot — `● FEATURED`, `● THE ORIGINAL`, `● ON NOW`, `● NEW PROJECT`. Yellow/gold on light, white on the dark hero.

---

## Visual foundations

- **Colour:** **paper (`#FFFFFF` / `#FAF9F6`) is the primary reading surface**; near-black (`#0A0B0C`, faintly green `#000D10`) is reserved for nav, the hero, the logo marquee, and the footer. One yellow `#FEBD17` accent. Web balance ≈ **60% light / 40% dark / 5% yellow**. Full token set in `tokens/colors.css`.
- **Yellow discipline:** `#FEBD17` is for the demo button, link underlines, the active slide dash, the lead dot, numerals. On light it **fails contrast** (≈1.5:1 on white) so it is fill/underline/rule only; yellow-toned *text* on light uses `#B07A00` (`--gp-accent-deep`). On the dark hero it is text-safe.
- **Type:** **Archivo** grotesk for display (800–900, tight tracking) and body (400–500). **Space Mono** for labels only — eyebrows, captions, stat labels, metadata, UPPERCASE wide-tracked. A **hand-drawn graffiti tag face** (`--gp-font-graffiti`, Permanent Marker stand-in) is reserved for the **big stat numbers** (`18 · 500+ · 6 · 2008`) — nowhere else. Never set headlines or body in mono or graffiti.
- **Photography is the hero.** Full-bleed event photography carries slides. Sit imagery on black, dim to `opacity:0.16–0.55` behind text, add a directional scrim (`linear-gradient` to `rgba(10,11,12,0.9–0.96)`) on the edge copy lands. Never type on an undimmed busy photo. No SVG/illustrated imagery, no gradients-as-decoration.
- **Backgrounds:** flat black (dark) or flat paper (light) — no textures, no gradient washes, no patterns. Drama comes from photo plates and light↔dark alternation, not surface decoration.
- **Hairline grids:** structure with 1px rules (`--gp-hairline` on dark, `--gp-hairline-light` on light) between cells — **not** boxes or cards. Borders divide; they don't contain.
- **Corner radius:** effectively **none**. `--gp-radius: 0`; buttons get at most 2px. No rounded cards, and explicitly no "rounded card with coloured left-border" motif.
- **Cards:** there are no decorated cards. "Cards" are hairline-separated content blocks (audience cards, stat blocks) — label + value, divided by rules, never filled or shadowed.
- **Shadows:** none on UI. The one exception is a soft drop-shadow under the cone mascot on dark grounds (`drop-shadow(0 14px 30px rgba(0,0,0,0.55))`).
- **Layout:** flex/grid with `gap` from the spacing scale for every group of siblings — never inline flow. Slide canvas 1920×1080, `padding:80px 96px`. Web content max 1240px, fluid section padding `clamp(4rem,10vw,9rem)`.
- **Logo:** the **GRFT+ bubble-graffiti wordmark** (`assets/logo-grft.png`) is the primary identifier — black on light, forced white on dark (`filter: brightness(0) invert(1)`). The cone mascot is additive personality, never a replacement.
- **Light/dark balance (web):** dark nav → dark full-bleed hero → **light body for all the substance** (stats, story, how-it-works, audience, FAQ) → dark logo marquee + footer. Drop back to dark only for big photo/CTA moments.
- **Motion:** confident and quick. Link arrows nudge `translateX(4px)` or a yellow underline wipes in (160–200ms). Buttons darken to `#B07A00` on press. Scroll reveals: short fade + 12–16px rise, ≤400ms, once. Marquee: linear infinite, pause on hover. No parallax, no spring bounce, no decorative loops. Respect `prefers-reduced-motion`.
- **Focus:** visible `:focus-visible` ring, 2px, `#B07A00` on light / `#FEBD17` on dark, 2px offset. Never `outline:none` without a replacement.

---

## Iconography

- The system is **near icon-free** — credibility is carried by **big figures + a logo wall**, not icon decoration.
- **No emoji, no hand-drawn decorative SVG.** Numerals (`01 / 02 / 03`), stat figures, and brand-logo marks do the work.
- **Functional glyphs only:** the `→` arrow on links/buttons, a lead dot/dash on eyebrow labels. Set these in the type, not as image assets.
- **Logo wall / marquee:** partner logos as mono-weight marks (dark band) or on `#F4F4F2` white chips (light). Greyscale or full colour on white.
- The **cone mascot** is the one illustrated brand element — additive personality on covers/closings only, never a content icon. See Brand cards + Caveats.

---

## Index / manifest

- `styles.css` — global entry (link this). `@import`s the four token files.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`.
- `guidelines/` — foundation specimen cards (Type · Colors · Spacing · Brand), light-forward.
- `components/` — reusable primitives: `Button`, `EyebrowLabel`, `Stat`, `AudienceCard`, `LogoWall` (each `.jsx` + `.d.ts` + `.prompt.md` + a `@dsCard` html).
- `ui_kits/website/` — **homepage recreation** of graffitiplus.io (`@dsCard group="Website"`) — the reference for the real look.
- `slides/` — sample pitch-deck slide types, dark (`@dsCard group="Slides"`).
- `assets/` — GRFT+ wordmark, cone mascot (`.png` + `.svg`); add partner logos + event imagery here.
- `SKILL.md` — Agent-Skills-compatible entry for download/Claude Code use.

---

## Caveats / open items
- **Graffiti stat font is a stand-in.** The live `18 / 500+ / 6 / 2008` numbers use a custom hand-drawn tag; I've substituted Google's **Permanent Marker**. Send the real font file and I'll swap `--gp-font-graffiti`.
- **Partner logos are mono wordmarks.** The marquee uses text (NIKE, ADIDAS, …) — drop the real SVGs into `assets/` and I'll wire the LogoWall to images.
- **No real event photography yet.** The homepage hero and photo plates use dimmed placeholder fields. Drop images into `assets/` and the scrim treatment carries them.
- **Logo:** supplied as black linework; forced white on dark via CSS filter. If you have a true white/mono version, add it for crispest nav rendering.

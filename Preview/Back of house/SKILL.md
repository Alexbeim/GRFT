---
name: graffitiplus-design
description: Use this skill to generate well-branded interfaces and assets for Graffiti+ (GRFT+), the original interactive digital graffiti wall, either for production or throwaway prototypes/mocks/decks. Contains the colour system, typography, fonts, logo, components, a homepage recreation, and brand rules — light + photography-forward, black as punctuation, yellow as a single accent.
user-invocable: true
---

Read `readme.md` first, then explore the other files.

- **The one rule:** **light, photography-forward** surfaces; **black `#0A0B0C` is punctuation** (nav, hero, footer); **yellow `#FEBD17` is a single accent** — never a flood. Web balance ≈ 60% light / 40% dark.
- **Logo:** GRFT+ bubble wordmark — `assets/logo-grft.png` (black on light; `filter: brightness(0) invert(1)` for white on dark).
- **Tokens** live in `tokens/` and ship via `styles.css` (link this one file). Colours, type (Archivo display + Space Mono labels + a graffiti tag face for big stat numbers), spacing.
- **Components** (`components/`): `Button`, `EyebrowLabel`, `Stat`/`StatRow`, `LogoWall`, `AudienceCard`/`NumberedStep`.
- **Website** (`ui_kits/website/`): a homepage recreation of graffitiplus.io — the canonical look (dark nav/hero → light body → dark footer).
- **Slides** (`slides/`): title, section, stat, full-bleed photo, logo wall — 1920×1080 dark pitch-deck types.
- **Stat numbers** use the graffiti face (`--gp-font-graffiti`); everything else is Archivo / Space Mono.
- **Mascot:** the GRFT+ cone — `assets/cone-mascot.png` (+ vector `.svg`) — additive personality on covers/closings only, planted on a bottom corner edge.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and produce static HTML for the user to view. If working on production code, copy assets and apply the rules here. If invoked with no other guidance, ask what they want to build, ask a few questions, then act as an expert Graffiti+ designer outputting HTML or production code.

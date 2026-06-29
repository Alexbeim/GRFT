# Graffiti+ — Design Language

Distilled from graffitiplus.io and the **Street Giants** pitch deck. This is the
reference for any Graffiti+ artifact: decks, one-pagers, proposals, social.

The single rule everything else serves: **black ground, photography is the colour,
yellow is a single accent — never a flood.**

---

## 1. Principles

1. **Black-dominant.** Near-black is the canvas on every surface. Light type, photography, and one accent sit on top. The site's own theme colour is black.
2. **Photography is the hero.** The work is loud and chromatic; the frame around it is silent. Let full-bleed event photography carry slides on its own.
3. **Yellow is a note, not a wash.** Reserve `#FEBD17` for rules, numerals, eyebrow labels, and a single highlighted word per headline. The moment it fills a background, the brand reads as a flyer instead of a premium operator.
4. **Terse and declarative.** Two-line headings, lowercase second line, full stop. A line, never a paragraph. Confidence through brevity.
5. **Mono is for labels only.** Monospace belongs to eyebrows, captions, stat tickers, and metadata — never body or headlines.
6. **Numbered & stat-led.** Section numerals (01 / 02 / 03), big standalone figures, and a brand-logo wall do the credibility work.

---

## 2. Colour

| Token | Hex | Role |
|---|---|---|
| Ground | `#0A0B0C` | Primary background on every surface |
| Ground (alt) | `#000D10` | Deepest black, photo overlays |
| Ink | `#F4F4F2` | Primary type on dark |
| Ink dim | `#E0E0DC` | Body / supporting copy |
| Muted | `#9A9A96` | Secondary copy, second headline line |
| Mono grey | `#8A8A86` | Eyebrow + metadata labels |
| **Accent** | `#FEBD17` | Signature yellow — rules, numerals, one highlighted word |
| Accent deep | `#B07A00` | Dark-gold shadow / pressed states |
| Hairline | `rgba(244,244,242,0.16)` | Dividers, grid lines, borders |

**Ratio discipline:** roughly 70% black ground / 25% ink + photography / 5% yellow.
If yellow exceeds a single accent gesture on a surface, pull it back.

**Photo treatment:** sit imagery on black, dim to `opacity:0.16–0.55` behind text, and
add a directional scrim (`linear-gradient` to `rgba(10,11,12,0.9–0.96)`) on the edge the
copy lands. Never place type on an undimmed busy photo.

---

## 3. Typography

| Use | Family | Weight | Notes |
|---|---|---|---|
| Display / headline | **Archivo** (grotesk) | 800–900 | `letter-spacing:-0.02em`, `line-height:0.84–0.98` |
| Body | **Archivo** | 400–500 | `line-height:1.3–1.5`, `text-wrap:pretty` |
| Labels / eyebrow / caption / stats | **Space Mono** | 400/700 | UPPERCASE, `letter-spacing:0.12–0.22em` |

> The source deck used Arial + Courier New. Archivo + Space Mono are the web-stack
> equivalents — substitute freely; keep the grotesk-display / mono-label split.

**Headline grammar.** Two lines, the second in `#8A8A86` or `#9A9A96`, ending in a full
stop. Optionally highlight one word in `#FEBD17`.

```
Giant art, built
by the waterfront.        ← second line muted

Created live. Stays forever.   ← "forever" or a key word in #FEBD17
```

**Eyebrow label.** Mono, uppercase, yellow, dot-separated:
`THE PROGRAMMING · AIR GIANTS`

**Type scale (1920×1080 slides, px):**

| Role | Size |
|---|---|
| Hero display | 160–210 / 900 |
| Slide title | 72–96 / 800 |
| Sub-headline | 34–44 / 800 |
| Body | 28–38 / 400–500 |
| Big stat figure | 88–120 / 900 |
| Eyebrow / caption / mono | 22–26 |

Minimum 24px for any slide text. Documents: 12pt floor.

---

## 4. Layout

- **Slide canvas:** 1920×1080, `padding:80px 96px`.
- **Eyebrow row:** mono label left (yellow), `STREET GIANTS / NN` right (grey), separated by a hairline.
- **Hairline grids.** Structure with 1px `rgba(244,244,242,0.16)` rules between cells, not boxes or cards. Borders divide; they don't contain.
- **Flex/grid with `gap`** for every group of siblings — never inline flow.
- **Full-bleed photo slides:** image → directional scrim → content. Copy bottom-left or in the dark edge.
- **Stat block:** big mono/grotesk figure stacked over a mono unit label; 3–4 across a hairline-topped row.
- **Logo wall:** even grid of logos on `#F4F4F2` chips, generous spacing, mono section label above — like the homepage marquee.

---

## 5. Voice

- Short, declarative, present-tense. "From load-in to last tag, we handle everything."
- "Zero barrier. Full participation." — fragments are fine when they punch.
- Lead with the takeaway; supporting detail goes to speaker notes or an appendix.
- Name discipline: **K11 ECOAST** (one spelling, everywhere).
- No exclamation marks, no hype adjectives stacked. The photography supplies the energy.

---

## 6. Do / Don't

| Do | Don't |
|---|---|
| Black ground, photo-forward | Flood slides in yellow |
| Yellow on rules, numerals, one word | Yellow as a background fill |
| Mono for labels only | Set headlines or body in mono |
| One idea per slide, one line of copy | Paragraph-dense slides |
| Hairline grids | Rounded cards with left-accent borders |
| Big figures + logo wall for proof | Bury proof in bullet lists |
| Real event photography | SVG/illustrated imagery, gradients, emoji |
| One locked title grammar across all slides | Drifting between heading styles |

---

## 7. Web (graffitiplus.io)

Sections 1–6 are the foundation; the web stack inherits all of it — black-dominant
principles, the colour family, Archivo + Space Mono, the terse voice. This section adds
what slides don't cover: a **lighter direction**, responsive type, spacing, interaction
states, motion, and accessibility.

### 7.1 A bit more white — the light/dark balance

The site today is black end-to-end. The direction is to **let in more light** without
losing the brand's drama. The move is a *hybrid*, not a flip:

- **Light is the default reading surface.** Long-form sections — How it works, Who it's for, Pro/Simple modes, FAQ, contact — sit on paper, dark ink. Easier to read, feels more premium and open, more room to breathe.
- **Black is reserved for punctuation.** The hero, full-bleed photo moments, the logo marquee, and section dividers stay dark. Alternating light↔dark gives rhythm and makes the photography hit harder.
- **Rule of thumb:** open on dark (hero), drop into light for the substance, return to dark for big photo/CTA moments. Roughly 60% light / 40% dark across a full scroll.

### 7.2 Light surface tokens

On light, the yellow can't carry text — it fails contrast on white. Yellow becomes a
**fill / underline / rule**, and `Accent deep` does any yellow-ish type.

| Token | Hex | Role on light |
|---|---|---|
| Paper | `#FFFFFF` | Primary light ground |
| Paper warm | `#FAF9F6` | Softer light ground, large fields |
| Ink | `#0A0B0C` | Headlines + primary type |
| Body | `#33333A` | Body copy |
| Muted | `#6B6B70` | Second headline line, secondary copy |
| Mono label | `#8A8A86` | Eyebrow + metadata (unchanged) |
| Accent | `#FEBD17` | Fills, underlines, rules, highlight-behind-text **only** |
| Accent deep | `#B07A00` | Yellow-toned **text** on light (links, emphasis) |
| Hairline | `rgba(10,11,12,0.12)` | Dividers / grid lines on light |

> **Contrast:** `#FEBD17` on `#FFFFFF` ≈ 1.5:1 — never use it for text. For a yellow
> accent word on light, use `#B07A00` (≈ 4.6:1) or set the word in ink over a yellow
> highlight block. On dark, `#FEBD17` on `#0A0B0C` ≈ 13:1 — text-safe.

### 7.3 Responsive type

Fluid scale with `clamp(min, preferred, max)`; base `1rem = 16px`.

| Role | clamp() |
|---|---|
| Hero display | `clamp(3rem, 9vw, 7.5rem)` / 900 |
| Section title | `clamp(2rem, 5vw, 4rem)` / 800 |
| Sub-headline | `clamp(1.4rem, 2.6vw, 2.25rem)` / 800 |
| Body | `clamp(1rem, 1.2vw, 1.25rem)` / 400 |
| Big stat | `clamp(2.75rem, 7vw, 6rem)` / 900 |
| Eyebrow / caption / mono | `0.8125rem`–`0.9375rem`, `letter-spacing:0.18em` |

Headlines `line-height:0.95–1.0`; body `1.5–1.6`; `text-wrap:balance` on headlines,
`pretty` on body. Keep the two-line + muted-second-line + full-stop grammar.

### 7.4 Spacing & layout

- **Spacing scale (rem):** `0.5 · 0.75 · 1 · 1.5 · 2 · 3 · 4 · 6 · 8`. Use these steps only.
- **Section rhythm:** vertical padding `clamp(4rem, 10vw, 9rem)`; generous, never cramped.
- **Content width:** max `1240px`, gutters `clamp(1.25rem, 5vw, 4rem)`.
- **Breakpoints:** `≥1024` desktop · `640–1023` tablet (grids → 2-up) · `<640` mobile (1-up, hero display drops to the clamp min).
- **Grids:** flex/grid with `gap` from the scale. Hairline dividers between cells on both light and dark — borders divide, don't box.

### 7.5 Components (current site)

| Component | Spec |
|---|---|
| **Nav** | Sticky, transparent over dark hero → solidifies (paper + bottom hairline) on scroll into light. Logo left; links mono-ish small; `Book a demo` = primary button right. |
| **Eyebrow micro-label** | Mono, uppercase, `letter-spacing:0.18em`, often with a small lead dot/dash. ("THE ORIGINAL", "NEW PROJECT", "ON NOW", "FEATURED".) |
| **Hero** | Dark. Full-bleed photo/video, directional scrim, display headline w/ muted second line, single text link `Our story →`. |
| **Stat row** | Big figure + mono unit label, 3-up across a hairline. `18 / 500+ / 6`. |
| **Logo marquee** | Dark band, continuous horizontal scroll, logos as mono-weight marks; pause on hover. |
| **Numbered steps** | `01–04` mono numerals, photo + short title (two-line, muted second) + one sentence. |
| **Audience cards** | Bold label + one-line value prop. Hairline-separated, **not** rounded accent-border cards. |
| **Case study** | Photo + brand eyebrow + declarative headline (period) + 2–3 sentences + `View project →`. |
| **Testimonial** | Large quiet quote, attribution in mono (name · role, company). |
| **FAQ** | Question in ink, accordion, hairline rows. |
| **Buttons** | Primary: yellow fill `#FEBD17`, ink text, no/2px radius. Secondary: text link with `→`, or ink/paper outline. |
| **Footer** | Dark. Logo, contact, social, copyright in mono. |

### 7.6 Interaction & motion

- **Links:** `→` suffix; on hover the arrow nudges `translateX(4px)`, or a yellow underline wipes in. `transition: 160–200ms ease`.
- **Buttons:** hover lifts/darkens (`#FEBD17` → `#B07A00` on press); visible `:focus-visible` ring (2px, `#B07A00` on light / `#FEBD17` on dark, 2px offset).
- **Cards / case studies:** hover raises image contrast slightly or scales the photo `1.03` inside `overflow:hidden`; never bounce.
- **Reveal on scroll:** short fade + 12–16px rise, `≤400ms`, once. Respect `prefers-reduced-motion: reduce` — disable transforms, keep opacity.
- **Marquee:** linear infinite; pause on hover/focus.
- Motion is confident and quick. No parallax stacks, no spring bounce, no decorative loops.

### 7.7 Accessibility

- Body text ≥ `4.5:1`, large text ≥ `3:1`. Re-check every colour pair on light — yellow text is the trap (see 7.2).
- Tap targets ≥ `44×44px`.
- Visible focus states everywhere; never `outline:none` without a replacement.
- Honour `prefers-reduced-motion` and `prefers-color-scheme` if a true dark/light toggle ships.
- Real `alt` text on photography; captions in mono.

---

## 8. Documents (proposals — light)

Proposals, decks-as-PDF, one-pagers, and rate sheets are **printed/long-form reading**,
not stage slides — so they run **light: paper ground, ink type.** Black is for the cover
and full-bleed photo plates only.

### 8.1 Surfaces

- **Cover:** dark — full-bleed photo, scrim, display title + mono metadata. The one black moment, mirroring the deck.
- **Interior pages:** `#FFFFFF` (or `#FAF9F6`) ground, `#0A0B0C` headlines, `#33333A` body.
- **Photo plates:** may go full-bleed dark between light sections for rhythm.
- **Back cover / contact:** dark again, mono contact line.

### 8.2 Page system

- **Print:** A4 / Letter, margins `≥ 18mm`; **12pt body floor**, 9–10pt mono captions.
- **Type:** Archivo headings, Archivo body, Space Mono labels/captions/page numbers. Body `line-height:1.5`, `max-width: ~70ch`.
- **Running header:** mono — `GRAFFITI+` left, `PROPOSAL · CLIENT` or section right, hairline under.
- **Page numbers:** mono, footer corner.
- **Eyebrow labels & numbered sections** carry over from the deck — they make a document skimmable.

### 8.3 Light-document specifics

- **Yellow = structure, not text.** Section numerals, rules, a highlight block behind an ink word, a stat underline. Yellow type → `#B07A00`.
- **Hairlines** (`rgba(10,11,12,0.12)`) for tables, dividers, stat rows — no heavy borders, no filled cells.
- **Stat / proof:** keep the big-figure + mono-label and the logo wall, now as ink-on-paper with logos in greyscale or full colour on white chips.
- **Tables:** hairline rows, mono column heads, generous row padding. No zebra fills.
- **Tone holds:** terse, declarative, one idea per block — even with more room to write, resist the paragraph.

### 8.4 Do / Don't (light)

| Do | Don't |
|---|---|
| Paper ground, ink type for reading | Long body text on black |
| Dark cover + photo plates for drama | Flip the whole document to black |
| Yellow as fill / rule / highlight | Yellow as body or heading text on white |
| `#B07A00` for any yellow-toned text | `#FEBD17` text on white (fails contrast) |
| Hairline tables, mono heads | Filled cells, zebra stripes, heavy borders |
| 12pt+ body, ~70ch measure | Dense, edge-to-edge text blocks |

---

## 9. Brand mascot — the cone

GRFT+ has a character: a **traffic-cone mascot** — orange safety cone with a halo, white
cartoon gloves holding a spray can, sneakers, and the GRFT+ graffiti tag on its body. He
is the brand's playful, street-culture face. Use him to add personality to covers and
closings without undercutting the premium, restrained system.

![GRFT+ cone mascot](images/cone-mascot.png)

### Placement

- **Stand him on an edge.** He reads best planted on the bottom edge of a page or frame — feet on the baseline/footer line, as if standing on it. Not floating, not centered.
- **Corner, not center.** Bottom-right (or bottom-left) of dark covers and closings. Keep him clear of the headline and any footer text — he sits *above* the running footer, never on top of it.
- **One per surface.** A single appearance per page. He's a punctuation mark, not a pattern.
- **Scale:** roughly 30–40% of page height on a cover. Big enough to have presence, small enough to stay a sidekick.
- Always add a soft drop shadow on dark grounds (`drop-shadow(0 14px 30px rgba(0,0,0,0.55))`) so he lifts off the photo.

### Where he belongs

| Use him | Keep him out |
|---|---|
| Cover & closing pages | Body/content pages, tables, timelines |
| Dark grounds (his colours pop) | Dense data or financial pages |
| Social, merch, event signage, swag | Formal commercial terms / legal |
| A single hero moment | Repeated or tiled as wallpaper |

### Rules

- **Don't recolor or redraw him** — the orange, halo, gloves, and tag are fixed.
- He is **additive personality**, never a replacement for the GRFT+ wordmark/logo. Both can appear; the logo stays the primary identifier.
- Asset: transparent PNG, `assets/cone-mascot.png` (608×812).

---

*Source: graffitiplus.io (live) + Street Giants (Edition 01, K11 ECOAST Shenzhen) deck + GRFT+ cone mascot.*

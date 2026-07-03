# Backend integration — Color management (Step 3)

This document is for whoever wires `AssetManagerStep3ColorManagement.jsx` into the
real platform. The component needs **zero backend calls to function** — palette
generation, HEX/RGB/CMYK/Pantone conversion, and dominant-color extraction from an
uploaded image are all done client-side. Everything below is about persisting the
result, not making the component work.

## What the component does NOT do

- It does not call any API. There is no equivalent of Step 2's `getServerPreview` or
  `onDelete` — nothing here requires server-side processing.
- It does not upload the image used for color extraction anywhere. The image is read
  into an in-memory `<canvas>`, sampled for dominant colors, and then discarded — the
  file itself never leaves the browser and isn't part of any payload.
- It does not persist anything itself. You own storage entirely via `onChange`.

## The only integration point — `onChange`

```
onChange({ variant, extras, palette }) => void
```

Fires on every change: picking/unpicking a starter palette, adding or removing a
color, or clicking "Use only my colors." Shape:

```ts
{
  variant: "default" | "pastel" | null,  // which starter palette is selected, or null
  extras: string[],                       // client's own colors, as "#RRGGBB", in add order
  palette: string[],                      // the resolved wall palette — extras + variant's
                                           // 80 swatches, de-duplicated, extras first
}
```

- `variant: null` means the client explicitly opted out of both starter palettes —
  a valid, intentional end state ("use only my colors"), not a missing selection.
  Don't treat `null` as "not yet chosen" when deciding whether the step is complete;
  use `extras.length > 0` (or your own completion flag) alongside it. The component
  itself shows a warning banner when `!variant && extras.length === 0`, but does not
  block navigation — that's a product decision for the host app.
- `palette` is the fully resolved list you'd actually send to production (e.g. load
  onto the physical wall/kiosk) — you generally don't need to regenerate it from
  `variant` yourself. It's derived, not independent state: `palette = dedupe([...extras, ...basePaletteFor(variant)])`.
- `extras` is intentionally kept separate from `variant` in the payload (not merged
  server-side either) so the host app can distinguish "client's own colors" from
  "colors that came from a starter set" later — e.g. for re-editing, billing a
  custom-color surcharge, or QA review before lock.

## Hydrating existing state

```jsx
<AssetManagerStep3ColorManagement
  initialVariant={savedConfig.variant}   // "default" | "pastel" | null
  initialExtras={savedConfig.extras}     // string[] of "#RRGGBB" — case-insensitive, will be upper-cased
  onChange={(data) => api.saveColorConfig(eventId, data)}
/>
```

Both `initial*` props are read once on mount (uncontrolled after that, same as every
other step in this set) — the component owns its own state from then on.

## Suggested data model

```
color_configs
  id            uuid
  event_id      uuid
  variant       enum('default', 'pastel') null   -- null = "own colors only"
  extras        jsonb        -- ["#22AA88", "#C7402F", ...]
  palette       jsonb        -- fully resolved list, cached so production doesn't
                                 need to re-derive the 80-swatch generation logic
  updated_at    timestamp
```

Storing the resolved `palette` (not just `variant`/`extras`) means production/export
tooling never needs to reimplement the HSL palette-generation curves — it just reads
the array. Regenerate it from `variant`/`extras` only if you deliberately want to
pick up palette-generation changes retroactively on old configs.

## Debouncing

Slider-driven entry (RGB/CMYK) and the palette-card selection don't call `onChange`
directly — only `+ Add color`, removing a color, and picking/unpicking a palette do.
So `onChange` fires at most once per discrete user action, not once per slider
`input` event; no debouncing is needed on your end.

## Validation

All conversions (HEX text, Pantone lookup) are validated client-side before
`+ Add color` is enabled — `extras` will only ever contain well-formed 6-digit
`#RRGGBB` strings. Still, treat this as UX, not a security boundary: re-validate the
shape of `extras`/`palette` server-side (array of `^#[0-9A-F]{6}$` strings) before
trusting it for anything downstream like generating physical assets.

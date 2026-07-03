# Backend integration — Wall overlay (Step 6)

This document is for whoever wires `AssetManagerStep6WallOverlay.jsx` into the real
platform. The component does logo compositing and PNG export entirely client-side —
**zero backend calls required to function**. Everything below is optional, additive
integration for persistence and for tying the wall's resolution to the event's real
screen configuration.

## What the component does NOT do

- It does not upload logo images anywhere. Uploaded files are held as local
  `blob:` object URLs and drawn directly to a canvas for preview/export.
- It does not call any API unless you pass `onExport`.
- It does not generate the PNG server-side — export runs entirely in the browser via
  `<canvas>`, so there's no thumbnail-service equivalent to Step 2's `getServerPreview`.

## Integration point — `onExport(blob)`

Fires after the user clicks "Download PNG," in addition to (not instead of) the
automatic local download the component already triggers. Use it to also persist the
exported overlay server-side:

```jsx
<AssetManagerStep6WallOverlay
  onExport={async (blob) => {
    const form = new FormData();
    form.append("file", blob, "wall-overlay.png");
    await fetch(`/api/events/${eventId}/wall-overlay`, { method: "POST", body: form });
  }}
/>
```

The blob is always `image/png`, sized exactly `wallWidth`×`wallHeight`, with a fully
transparent background outside logo pixels — safe to store and composite directly
onto the live paint canvas in production without further processing.

## `onChange` payload — persisting logo placement

```ts
onChange(logos: LogoEntry[]) => void

type LogoEntry = {
  id: string,
  name: string,
  kind: "From assets" | "Uploaded",
  src: string,              // blob: URL (this session) or a persisted URL (hydrated)
  naturalW: number,
  naturalH: number,
  mode: "anchored" | "free",
  anchor?: "tl"|"tc"|"tr"|"ml"|"mc"|"mr"|"bl"|"bc"|"br", // when mode === "anchored"
  padding?: number,         // % — when mode === "anchored"
  x?: number, y?: number,   // % of wall width/height, center-anchored — when mode === "free"
  size: number,             // % of wall width; height is derived from the image's own aspect ratio
  file?: File,              // raw upload, only present for images picked this session
}
```

Fires on every logo change (add, remove, move, resize, reposition). `file` is what
you actually upload to storage — not JSON-serializable, so exclude it from any naive
persistence snapshot; same pattern as Step 2's `.file`.

## Hydrating existing state

```jsx
<AssetManagerStep6WallOverlay
  initialLogos={savedLogos.map((l) => ({ ...l, file: undefined }))} // src must be a real, reachable URL
  onChange={(logos) => api.saveWallOverlay(eventId, logos)}
  onExport={(blob) => api.uploadOverlayPng(eventId, blob)}
/>
```

`src` for hydrated entries should point at a real, publicly-reachable URL (your CDN),
not a `blob:` URL from a previous session — those are revoked as soon as the tab that
created them closes. `naturalW`/`naturalH` should be the image's true pixel
dimensions; store them when you first persist an uploaded logo so re-hydration
doesn't need to re-fetch and re-measure the image.

## Screen size — `wallWidth` / `wallHeight`

```jsx
<AssetManagerStep6WallOverlay
  wallWidth={event.screen.widthPx}   // defaults to 3840
  wallHeight={event.screen.heightPx} // defaults to 2160 (16:9)
/>
```

These two props drive **both** the live preview's aspect ratio and the exported
PNG's actual pixel dimensions — there's no separate "export resolution" setting to
keep in sync. Right now the component defaults to a fixed 3840×2160 (16:9), matching
a typical Graffiti+ wall. The intended integration: once the event's screen
dimensions are captured elsewhere in the platform (the same source of truth as the
setup diagram's screen sizing), pass them straight through here so the overlay and
the physical screen always agree — no separate config to keep in sync, and no risk
of shipping a PNG sized for the wrong screen.

If the event has multiple screens/walls, render one `AssetManagerStep6WallOverlay`
per screen, each with its own `wallWidth`/`wallHeight` and its own `initialLogos`/
`onChange`/`onExport` — the component has no concept of "the event," only "this one
wall," by design.

## CORS note for hydrated (non-upload) logos

Export loads every logo's `src` into an `Image` element and draws it to canvas.
Object URLs (`blob:`) and `data:` URLs are always safe. For a hydrated `src` served
from your own CDN/storage, that origin must serve the image with
`Access-Control-Allow-Origin` permitting the app's origin — otherwise the canvas is
"tainted" and `toBlob()` will throw, and the user will see a "Couldn't export the
overlay" toast instead of a silent failure. This is a standard requirement for any
canvas-based image export, not specific to this component.

## Suggested data model

```
wall_overlays
  id            uuid
  event_id      uuid
  screen_id     uuid null   -- if the event has multiple walls/screens
  logos         jsonb       -- LogoEntry[] minus `file`, with `src` rewritten to a persisted URL
  exported_png  text null   -- storage key/URL of the last exported PNG, if you persist it via onExport
  updated_at    timestamp
```

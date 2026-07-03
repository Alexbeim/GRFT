# Backend integration — Asset builder (Step 5)

This document is for whoever wires `AssetManagerStep5AssetBuilder.jsx` into the real
platform. All image conversion (stencil thresholding, sticker background removal +
die-cut edge + shadow, background cropping) runs client-side on canvas — **zero
backend calls required to function**. Everything below is persistence and the
future AI hook.

## Asset format contract (what production receives)

| Type | Size | Format | Convention |
|---|---|---|---|
| Stencil | 1024 × 1024 | PNG with alpha | **Transparent = paintable.** The cut-out the guest paints through is alpha 0; the blocking sheet is opaque (`#0A0B0C`, but only the alpha channel is meaningful to the paint engine). |
| Sticker | 1024 × 1024 | PNG with alpha | Subject, then a small white die-cut padding ring, then a micro drop shadow (soft black, low alpha), then fully transparent. |
| Background | 1920 × 1080 | JPEG (quality 0.9) | Cover-cropped to the 16:9 wall. No transparency needed. |

Premade library items are currently inline SVG data URLs (placeholder art) following
the same conventions — swap `PREMADE_STENCILS` / `PREMADE_STICKERS` /
`PREMADE_BACKGROUNDS` in the component for the real installation libraries (same
`{id, name, type, origin, src}` shape) when those assets exist.

## `onChange` payload

```ts
onChange({ selection, items }) => void

selection: {
  stencils: string[],     // selected item ids, premade + custom mixed
  stickers: string[],
  backgrounds: string[],
}
items: {
  stencils: ItemEntry[],  // the SELECTED items only, resolved to full objects
  stickers: ItemEntry[],
  backgrounds: ItemEntry[],
}

type ItemEntry = {
  id: string,             // "st-star" (premade) or "c-..." (client-made)
  name: string,
  type: "stencils" | "stickers" | "backgrounds",
  origin: "premade" | "upload",
  src: string,            // data: URL for client-made items; swap for a storage URL on save
}
```

Fires on every selection toggle, on adding a converted upload (which is also
auto-selected), and on removing a client-made item.

**Persisting client-made items:** `src` for `origin: "upload"` items is a `data:` URL
containing the final, already-converted file — the exact bytes production should use.
On save, decode and upload it to storage, then persist the item with your storage URL
instead of the data URL:

```js
async function persistItem(eventId, item) {
  const blob = await (await fetch(item.src)).blob(); // data: URL → Blob
  const form = new FormData();
  form.append("file", blob, `${item.name}.png`);
  form.append("type", item.type);
  const { url } = await (await fetch(`/api/events/${eventId}/assets`, { method: "POST", body: form })).json();
  return { ...item, src: url };
}
```

Premade items (`origin: "premade"`) don't need uploading — persist just their ids
and resolve against your own library table.

## Hydrating existing state

```jsx
<AssetManagerStep5AssetBuilder
  initialSelection={{ stencils: ["st-star", "c-abc123"], stickers: [], backgrounds: ["bg-brick"] }}
  initialCustom={{
    stencils: [{ id: "c-abc123", name: "Client logo", type: "stencils", origin: "upload", src: "https://cdn.example.com/assets/abc123.png" }],
    stickers: [],
    backgrounds: [],
  }}
  onChange={(data) => api.saveAssetConfig(eventId, data)}
/>
```

Both props are read once on mount (uncontrolled after that, same as the other steps).
Hydrated `src` values can be normal https URLs — they're only displayed, never
re-processed, so no CORS constraints apply here.

## The AI hook (future)

"Make with AI" is currently a placeholder modal (prompt box, disabled generate).
When the generation backend exists, the intended wiring is: generate the raw image
server-side, then feed it into the SAME client-side Adjust → Review pipeline the
upload path uses — so AI output ships in exactly the same format, and the client
still confirms the result before it enters their library. Suggested contract:

```
POST /api/ai/generate-asset
{ "type": "stencil" | "sticker" | "background", "prompt": "..." }

→ 200 { "imageUrl": "https://..." }   // raw image; client-side pipeline handles conversion
```

The returned image must be served CORS-readable (`Access-Control-Allow-Origin`) —
the conversion pipeline draws it to a canvas and reads pixels back.

## Server-side validation — do not skip this

Client-side conversion is UX, not a security boundary. A user can POST anything to
your asset-upload endpoint directly. Before accepting:

- Re-check magic bytes (must actually be PNG/JPEG), dimensions (1024×1024 for
  stencils/stickers), and file size limits.
- Re-verify the alpha convention server-side if production depends on it (e.g. a
  stencil with zero transparent pixels is unusable — reject early with a clear error
  rather than shipping a wall asset that can't be painted).
- Standard malware scanning, same as any user-upload endpoint.

## Suggested data model

```
event_assets
  id            uuid
  event_id      uuid
  type          enum('stencil', 'sticker', 'background')
  origin        enum('premade', 'upload', 'ai')
  library_id    text null    -- premade id ("st-star") when origin = premade
  name          text
  storage_key   text null    -- uploaded file location when origin != premade
  selected      boolean      -- currently chosen for the wall
  created_at    timestamp
```

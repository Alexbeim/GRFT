# Asset Manager — step modules

The 8-step client self-serve asset onboarding flow (Welcome → Logo upload → Color
management → Spray can label → Asset builder → Wall overlay → Test area → Approve &
lock), ported from `wireframes/Module 1 - Asset Manager.dc.html` into 8 **fully
standalone** React components — one per step.

Each file is independently copy-pasteable: no imports from each other, no shared
wizard shell, no assumption that all 8 steps live in the same app or even the same
page. Drop any single step into your tool without the rest.

## Files

| File | Step | Notable behavior |
|---|---|---|
| `AssetManagerStep1Welcome.jsx` | 1 · Welcome | Project timeline, "what we'll cover" checklist, invite-collaborator form (adds pending rows on invite) |
| `AssetManagerStep2LogoUpload.jsx` | 2 · Logo upload | Real drag/drop + file-picker upload, large preview on a transparency checkerboard, format/transparency/resolution validation, brand-book/document detection, optional server-rendered thumbnails for AI/EPS/PDF, confirm-then-delete with an awaited backend hook |
| `AssetManagerStep2LogoUpload.BACKEND.md` | — | Backend integration spec for Step 2: endpoint contracts, data model, Ghostscript notes, server-side validation. |
| `AssetManagerStep3ColorManagement.jsx` | 3 · Color management | Two whole-palette starter options (Default / Pastel, 80 HSL-generated swatches each) picked with a single click, plus a standalone "Your colors" set built via HEX/RGB/CMYK/Pantone entry (sliders for RGB/CMYK — no invalid states) or canvas-based dominant-color extraction from an uploaded image. Client can opt out of both starter palettes and use only their own colors. |
| `AssetManagerStep3ColorManagement.BACKEND.md` | — | Backend integration spec for Step 3: `onChange` payload shape, suggested data model. No server calls required — included for parity with Step 2's doc. |
| `AssetManagerStep3ColorManagement.demo.html` | — | Standalone, zero-build preview of Step 3 alone — open directly in a browser. Not needed for integration. |
| `AssetManagerStep4SprayCanLabel.jsx` | 4 · Spray can label | Draggable label placement on a can preview (snaps to center + thirds), 360° rotation slider with Front/Right/Back/Left face detection |
| `AssetManagerStep5AssetBuilder.jsx` | 5 · Asset builder | Stencils/stickers/backgrounds tabs, source toggle, multi-select tile grid |
| `AssetManagerStep6WallOverlay.jsx` | 6 · Wall overlay | Upload real logo images and drag-to-place them on the wall preview, anchored (9-point grid + padding) vs. free placement with snap guides (wall center + other logos); "Download PNG" exports the whole overlay as a single transparent PNG at the wall's real pixel resolution |
| `AssetManagerStep6WallOverlay.BACKEND.md` | — | Backend integration spec for Step 6: `onExport`/`onChange` payload shapes, screen-size (`wallWidth`/`wallHeight`) tie-in, CORS notes for hydrated logos, suggested data model. |
| `AssetManagerStep6WallOverlay.demo.html` | — | Standalone, zero-build preview of Step 6 alone — open directly in a browser. Not needed for integration. |
| `AssetManagerStep7TestArea.jsx` | 7 · Test area | Tool rail + paint-canvas launch surface (the actual paint engine is out of scope — this is the entry point into it) |
| `AssetManagerStep8ApproveLock.jsx` | 8 · Approve & lock | Checklist recap + approve/lock action |
| `AssetManagerSteps.demo.html` | — | Zero-build preview of all 8 steps stacked on one page. Open directly in a browser. Not needed for integration. |

## Installing

Copy whichever step `.jsx` file(s) you need into your project. Each has **zero
dependencies beyond React**.

```jsx
import { AssetManagerStep1Welcome } from "./components/AssetManagerStep1Welcome";
```

## The shared contract

Every step follows the same prop shape for navigation and completion state, so they
compose predictably even though each file is independent:

| Prop | Type | Default | Description |
|---|---|---|---|
| `stepNumber` | `number` | the step's own number (1–8) | Shown in the footer as "Step 0N / totalSteps". Override if you renumber steps in your own flow. |
| `totalSteps` | `number` | `8` | Shown alongside `stepNumber`. |
| `completed` | `boolean` | `false` | Drives the footer's "Mark complete" / "✓ Completed" toggle button. |
| `onToggleComplete` | `() => void` | — | Fired when the completion toggle is clicked. You own the actual completed-state storage. |
| `onBack` | `() => void` | — | Fired by the footer's "← Back" link. Omit to render it disabled. |
| `onNext` | `() => void` | — | Fired by the footer's "Continue →" button. |
| `onChange` | `(data) => void` | — | Fired whenever the step's own data changes (shape varies per step — see each file's props). Use this to persist to your own store. |

Steps that manage a list or a piece of content also accept an `initial*` prop to seed
their local state (e.g. `initialCollaborators`, `initialFiles`, `initialLogos`,
`initialSelection`) so you can hydrate from a backend without controlling every
keystroke.

None of the steps assume:
- a surrounding wizard shell (no step-list sidebar is rendered — build your own if you
  want one, using each step's `stepNumber`/title as source data)
- a fixed-height app frame (footer sits in normal document flow, not pinned)
- that the other 7 steps exist in the same bundle

## Step 2 — server-rendered previews for AI / EPS / PDF

Browsers can't rasterize AI, EPS, or PDF files natively, and it's not reliable to fake
client-side (legacy `.eps` isn't PDF-based at all; even PDF-compatible `.ai` varies by
export settings). Rather than pull in a client-side PDF renderer (adds a real dependency
and still wouldn't cover `.eps`), `AssetManagerStep2LogoUpload` exposes an optional hook
so **your backend** generates the thumbnail — the same approach Figma/Dropbox-style
previews use:

```jsx
<AssetManagerStep2LogoUpload
  getServerPreview={async (file, { ext, name }) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/thumbnail", { method: "POST", body: form });
    const { thumbnailUrl } = await res.json();
    return thumbnailUrl; // or null/undefined to fall back to "no in-browser preview"
  }}
/>
```

- Called automatically for any uploaded `.ai`, `.eps`, or `.pdf` file, right after the
  fast client-side checks (format/size/filename heuristics) finish.
- The card shows a "Generating preview…" state while the promise is pending.
- If you don't pass this prop, those formats just show a clear ".ai · no in-browser
  preview" placeholder — the component stays zero-dependency by default.
- For files already uploaded in a previous session, skip this entirely and pass the
  already-generated thumbnail straight into `initialFiles` as `previewUrl` /
  `previewKind: "image"`.
- Server-side, a common implementation is Ghostscript (`gs`) rendering page 1 to PNG —
  it handles true legacy `.eps` as well as PDF-compatible `.ai`, which a browser-only
  approach can't.

## Step 2 — deleting a logo

Removing a card asks for confirmation first (these may already be persisted
server-side), then — if you pass `onDelete` — awaits it before actually removing the
card. A rejected promise leaves the card in place and shows a toast instead of
silently losing the failure:

```jsx
<AssetManagerStep2LogoUpload
  onDelete={(fileEntry) => api.deleteLogo(eventId, fileEntry.id)}
/>
```

If you don't pass `onDelete`, confirming just removes the card locally (no backend
call) — fine for a purely client-side draft state.

Every entry passed to `onChange` / `onDelete` also includes **`.file`** — the raw
browser `File` object for anything uploaded this session (not present on entries that
came from `initialFiles`, since those didn't originate from a picker). That's what you
actually upload to storage; it's not JSON-serializable, so don't put it straight into a
naive `JSON.stringify` persistence layer.

See `AssetManagerStep2LogoUpload.BACKEND.md` for the fuller backend integration spec
(endpoint contracts, suggested data model, Ghostscript notes, server-side validation).

## Step 3 — palette selection and the client's own colors

The client picks **one whole palette** (Default or Pastel — both shown side by side,
single click, no tabs) or opts out of both and builds entirely from their own colors.
Colors they add — by HEX/RGB/CMYK/Pantone entry or pulled from an uploaded logo/image
— live in a separate "Your colors" set, never merged into or implied to be part of
either starter palette:

```jsx
<AssetManagerStep3ColorManagement
  initialVariant={savedConfig.variant}   // "default" | "pastel" | null
  initialExtras={savedConfig.extras}     // ["#22AA88", ...]
  onChange={({ variant, extras, palette }) => api.saveColorConfig(eventId, { variant, extras, palette })}
/>
```

`onChange` gives you both the raw selection (`variant`/`extras`) and the fully
resolved `palette` array (extras + the variant's 80 swatches, de-duplicated) so
production tooling doesn't need to reimplement the palette-generation math. See
`AssetManagerStep3ColorManagement.BACKEND.md` for the full payload shape and a
suggested data model.

## Example: wiring one step into your own flow

```jsx
function MyAssetStep({ eventId }) {
  const [completed, setCompleted] = useState(false);

  return (
    <AssetManagerStep3ColorManagement
      initialVariant={savedConfig.variant}
      initialExtras={savedConfig.extras}
      onChange={(data) => api.saveColorConfig(eventId, data)}
      completed={completed}
      onToggleComplete={() => setCompleted((c) => !c)}
      onBack={() => router.push(`/events/${eventId}/step/2`)}
      onNext={() => router.push(`/events/${eventId}/step/4`)}
      stepNumber={3}
    />
  );
}
```

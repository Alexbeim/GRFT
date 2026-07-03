# Backend integration — Logo upload (Step 2)

This document is for whoever wires `AssetManagerStep2LogoUpload.jsx` into the real
platform. The component does all validation and preview UI client-side and needs
**zero backend calls to function** — everything below is optional, additive
integration for persistence, real AI/EPS/PDF thumbnails, and safe deletion.

## What the component does NOT do

- It does not upload files anywhere. It only validates them in the browser (format,
  transparency, resolution, suspicious filenames) and holds them in local state.
- It does not call any API unless you pass `getServerPreview` and/or `onDelete`.
- It does not trust its own client-side validation for anything security-relevant —
  see "Server-side validation" below. Client checks are UX, not a security boundary.

## Integration points (2 optional props)

### 1. `getServerPreview(file, { ext, name }) → Promise<string | null>`

Fires automatically for any uploaded `.ai`, `.eps`, or `.pdf` file (browsers can't
rasterize these natively). Called once, right after the fast client-side checks
finish. The card shows "Generating preview…" until the promise resolves.

**Suggested endpoint:**

```
POST /api/assets/thumbnail
Content-Type: multipart/form-data

file: <binary>

→ 200 { "thumbnailUrl": "https://cdn.example.com/thumbnails/abc123.png" }
```

**Suggested server implementation:** Ghostscript (`gs`) rendering page 1 to a PNG.
It handles both PDF-compatible `.ai` (the Illustrator default) and true legacy `.eps`
(which is not PDF-based — a client-side PDF.js approach would silently fail on real
`.eps` files, which is why this is server-side at all):

```bash
gs -dNOPAUSE -dBATCH -dFirstPage=1 -dLastPage=1 -sDEVICE=pngalpha -r150 \
   -sOutputFile=thumbnail.png input.ai
```

Store the resulting PNG wherever the rest of your uploaded assets live and return its
URL. If generation fails (corrupt file, unsupported PostScript features, timeout),
resolve with `null`/`undefined` rather than rejecting — the component falls back to
the "no in-browser preview" placeholder instead of showing an error state, which is
the right degrade for a file that's otherwise still usable by production.

### 2. `onDelete(fileEntry) → Promise<void>`

Fires after the user confirms removal (the component shows a confirm-overlay first —
these assets may already be persisted). The card shows "Removing…" while the promise
is in flight. **Reject the promise on failure** — the component leaves the card in
place and shows a toast, rather than optimistically removing something that's still
on the server.

```jsx
onDelete={async (fileEntry) => {
  const res = await fetch(`/api/assets/${fileEntry.id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
}}
```

`fileEntry` is the full card state at the moment of deletion — includes `id`, `name`,
`ext`, `sizeLabel`, `kind`, `badges`, and (if uploaded this session) `.file`, the raw
`File` object. Use whichever identifier your backend actually tracks — if you're
storing your own asset ID, put it on the object when you construct `initialFiles`, or
match on `name`.

## Persisting an upload — `onChange` and `.file`

`onChange(files)` fires on every change (new upload analyzed, server preview resolved,
deletion completed) with the full current list. Each entry that came from a file the
user picked this session includes:

```ts
{
  id: string,
  name: string,
  ext: string,               // "ai", "png", "svg", ...
  sizeLabel: string,          // "1.2 MB"
  status: "checking" | "done" | "deleting",
  kind: "vector" | "raster" | "document" | "ambiguous" | "unknown",
  previewUrl: string | null,  // blob: URL (client preview) or your server thumbnail URL
  previewKind: "image" | "pending" | "none",
  dimsLabel: string | null,   // "3200 × 3200 px", raster only
  badges: Array<{ level: "ok" | "warn" | "error", text: string }>,
  file: File | undefined,     // ← the raw upload. Not present on seeded/initialFiles entries.
}
```

**`file` is the thing you actually upload to storage.** The component never uploads
it itself — it's purely a local validator/previewer. A typical flow:

```jsx
<AssetManagerStep2LogoUpload
  initialFiles={savedLogos} // from your DB, already has previewUrl / no .file
  onChange={(files) => {
    // Upload anything new (has .file, i.e. picked this session and not yet synced).
    const unsaved = files.filter((f) => f.file && f.status === "done");
    for (const entry of unsaved) {
      const form = new FormData();
      form.append("file", entry.file);
      form.append("clientId", entry.id);
      fetch(`/api/events/${eventId}/logos`, { method: "POST", body: form });
    }
  }}
  onDelete={(entry) => api.deleteLogo(eventId, entry.id)}
  getServerPreview={(file, meta) => api.generateThumbnail(file)}
/>
```

Debounce/dedupe the upload call on your side if needed (`onChange` fires once per
state transition, so a single upload can trigger it 2–3 times as validation
progresses — checking `status === "done"` and tracking already-uploaded ids avoids
re-uploading the same file).

## Server-side validation — do not skip this

Every check this component does (format, transparency, resolution, "is this a brand
book") is a client-side UX nicety to catch mistakes early. **None of it is
enforceable** — a user can bypass the browser entirely and POST whatever they want
straight to your upload endpoint. Before accepting a file server-side:

- Re-check the actual file signature/magic bytes, not just the extension the client
  reported (a `.png` extension proves nothing about the actual bytes).
- Re-check file size against your real limit.
- If you generate thumbnails via Ghostscript, run it in a sandboxed/resource-limited
  process — PostScript is a full programming language and malicious `.eps`/`.ai`
  files are a known attack surface (infinite loops, resource exhaustion). Set a hard
  timeout and memory cap on the `gs` invocation.
- Virus/malware scan uploads before they're servable, same as any other user-upload
  endpoint.

## Suggested data model

```
logos
  id            uuid
  event_id      uuid
  filename      text
  ext           text
  size_bytes    int
  storage_key   text        -- wherever the original file lives (S3 key, etc.)
  thumbnail_url text null   -- set once getServerPreview-equivalent finishes server-side
  status        enum('processing', 'ready', 'failed')
  created_at    timestamp
```

`status` lets you show the "Generating preview…" state correctly even across a page
reload (pass `previewKind: "pending"` in `initialFiles` for any row still
`processing`, and poll or use a websocket to flip it to `"image"` once ready).

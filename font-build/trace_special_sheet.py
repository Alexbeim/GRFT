#!/usr/bin/env python3
"""
Slice the special_characters_sheet.png into individual character images and
trace each with potrace. Replaces the previous (mislabeled) special_chars/
SVGs with correctly-named ones.

Layout (1408x1056 sheet):
  Row 1:  %   $   @   !
  Row 2:  ?   &   *
  Row 3:  .   ,   +   -
"""
import os
import subprocess
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = "/Users/alex/Downloads/special_characters_sheet.png"
OUT_DIR = os.path.join(HERE, "special_chars")

# Drop the old (wrong) SVGs first so leftovers can't confuse the build
for old in os.listdir(OUT_DIR):
    if old.endswith(".svg"):
        os.remove(os.path.join(OUT_DIR, old))

# Load → binarize (black ink = 1)
img = Image.open(SRC).convert("L")
arr = np.array(img)
INK_THRESHOLD = 100  # pixels darker than this count as ink
ink = (arr < INK_THRESHOLD).astype(np.uint8)
H, W = ink.shape
print(f"sheet {W}x{H}, ink pixels: {ink.sum()}")

# Find connected components (8-connectivity)
labeled, n_blobs = ndimage.label(ink, structure=np.ones((3, 3), int))
print(f"found {n_blobs} ink blobs")

# Get each blob's bounding box + centroid
blobs = []
for i in range(1, n_blobs + 1):
    ys, xs = np.where(labeled == i)
    if len(xs) < 80:  # skip tiny specks
        continue
    blobs.append({
        "id": i,
        "x_min": int(xs.min()), "x_max": int(xs.max()),
        "y_min": int(ys.min()), "y_max": int(ys.max()),
        "cx": int(xs.mean()), "cy": int(ys.mean()),
        "size": len(xs),
    })
print(f"{len(blobs)} blobs after size filter")

# Group blobs into 3 rows. Sort by cy, split at the 2 biggest gaps between
# consecutive cy values — naturally falls onto the row boundaries.
blobs.sort(key=lambda b: b["cy"])
cys = [b["cy"] for b in blobs]
gaps = sorted([(cys[i+1] - cys[i], i) for i in range(len(cys)-1)], reverse=True)
# Two biggest gaps split the list into 3 chunks
split_points = sorted(g[1] for g in gaps[:2])
rows = []
prev = 0
for sp in split_points:
    rows.append(blobs[prev:sp+1])
    prev = sp + 1
rows.append(blobs[prev:])
print(f"row sizes: {[len(r) for r in rows]}")
print(f"row cy ranges: {[(r[0]['cy'], r[-1]['cy']) for r in rows]}")

# Within each row, sort blobs left-to-right then group adjacent blobs into
# single characters. Two blobs belong to the same character if their X bboxes
# overlap or are very close (e.g. the dot under ? or !).
for r in rows:
    r.sort(key=lambda b: b["cx"])

def group_chars(row, y0, y1):
    """Find character columns in the row's y-band by horizontal ink projection.
       Then assign each blob to the column whose x-range contains its centroid."""
    band = ink[y0:y1+1, :]
    col_has_ink = band.sum(axis=0) > 0
    # Find runs of columns with ink → character bounding columns
    cols = []
    i = 0
    while i < W:
        if col_has_ink[i]:
            start = i
            while i < W and col_has_ink[i]:
                i += 1
            cols.append((start, i - 1))
        else:
            i += 1
    # Merge close-together columns (handles slight gaps within a character —
    # e.g. between % bottom ring and its slash)
    MERGE_PX = 20
    merged = [cols[0]]
    for c in cols[1:]:
        if c[0] - merged[-1][1] <= MERGE_PX:
            merged[-1] = (merged[-1][0], c[1])
        else:
            merged.append(c)
    # For each column, collect blobs whose centroid x falls inside
    chars = [[] for _ in merged]
    for b in row:
        for ci, (cx_min, cx_max) in enumerate(merged):
            if cx_min <= b["cx"] <= cx_max:
                chars[ci].append(b)
                break
    return chars

# Layout key (top-to-bottom, left-to-right)
LAYOUT = [
    ["percent", "dollar",   "at",    "exclamation"],
    ["question", "ampersand", "asterisk"],
    ["period",  "comma",    "plus",  "hyphen"],
]

if len(rows) != 3:
    sys.exit(f"expected 3 rows, found {len(rows)}")

for row_idx, (row, names) in enumerate(zip(rows, LAYOUT)):
    y_lo = min(b["y_min"] for b in row)
    y_hi = max(b["y_max"] for b in row)
    chars = group_chars(row, y_lo, y_hi)
    if len(chars) != len(names):
        print(f"  warning: row {row_idx+1} expected {len(names)} chars, got {len(chars)} groups")
    print(f"row {row_idx+1}: {len(chars)} chars → {names}")

    for ci, (group, name) in enumerate(zip(chars, names)):
        x_min = min(b["x_min"] for b in group)
        x_max = max(b["x_max"] for b in group)
        y_min = min(b["y_min"] for b in group)
        y_max = max(b["y_max"] for b in group)
        MARGIN = 8
        x_min = max(0, x_min - MARGIN)
        y_min = max(0, y_min - MARGIN)
        x_max = min(W, x_max + MARGIN)
        y_max = min(H, y_max + MARGIN)

        crop = img.crop((x_min, y_min, x_max, y_max))
        # Binarize. Natural dimensions of the sheet keep relative glyph
        # proportions intact (cap-height vs short marks like comma/hyphen).
        bw = crop.point(lambda px: 0 if px < INK_THRESHOLD else 255).convert("1")

        pbm_path = os.path.join(HERE, f"_special_{name}.pbm")
        svg_path = os.path.join(OUT_DIR, f"{name}.svg")
        bw.save(pbm_path)
        subprocess.run(
            ["potrace", "-s", "--turdsize", "20", "-o", svg_path, pbm_path],
            check=True,
        )
        size = os.path.getsize(svg_path)
        print(f"  {name:<12} {bw.size[0]}x{bw.size[1]}  →  {svg_path}  ({size} bytes)")
        os.remove(pbm_path)

print("\ndone")

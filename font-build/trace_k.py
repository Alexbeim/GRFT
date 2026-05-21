#!/usr/bin/env python3
"""Convert refined_k_character.png → tightly-cropped PBM → potrace SVG."""
import os
import subprocess
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", "Fonts", "refined_k_character.png"))
PBM_OUT = os.path.join(HERE, "_k_trace.pbm")
SVG_OUT = os.path.join(HERE, "Alphabet_Numbers", "k.svg")

# Load + flatten alpha to white
img = Image.open(SRC).convert("RGBA")
bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
bg.paste(img, (0, 0), img)
gray = bg.convert("L")

# Threshold to 1-bit (black glyph on white). The K is dark on white background.
# Choose 128 — generous for the textured edges in the photo.
THRESHOLD = 128
bw = gray.point(lambda px: 0 if px < THRESHOLD else 255).convert("1")

# Tight-crop to the glyph bounding box (matches the look of the other potrace SVGs).
# getbbox() returns the bounding box of non-zero pixels — in "1" mode, white = 255 = non-zero.
# Invert first so the glyph (black) becomes "non-zero" for bbox detection.
from PIL import ImageOps
inverted = ImageOps.invert(gray.convert("L"))
bbox = inverted.point(lambda p: 255 if p > 30 else 0).getbbox()
if bbox is None:
    sys.exit("Could not find glyph in image")

# Add a small margin (the other potrace SVGs include a few px on each side)
MARGIN = 8
left, top, right, bottom = bbox
left = max(0, left - MARGIN)
top = max(0, top - MARGIN)
right = min(bw.size[0], right + MARGIN)
bottom = min(bw.size[1], bottom + MARGIN)
bw = bw.crop((left, top, right, bottom))
print(f"cropped to: {bw.size[0]}x{bw.size[1]} (from {img.size})")

# Downscale so the height matches the rest of the alphabet (~290pt).
# Other letters in the font are ~235-315pt tall; we aim for ~290 to fit between.
TARGET_HEIGHT = 290
ratio = TARGET_HEIGHT / bw.size[1]
new_size = (max(1, int(bw.size[0] * ratio)), TARGET_HEIGHT)
# Resample as L (greyscale) for better quality, then re-binarise
bw = bw.convert("L").resize(new_size, Image.LANCZOS).point(
    lambda px: 0 if px < 128 else 255
).convert("1")
print(f"resized to:  {bw.size[0]}x{bw.size[1]} (target height {TARGET_HEIGHT})")

bw.save(PBM_OUT)
print(f"wrote {PBM_OUT}")

# Run potrace with the same defaults the original SVGs used.
# Output as SVG. -s = svg backend. --turdsize removes small specks.
subprocess.run([
    "potrace", "-s",
    "--turdsize", "20",      # remove small noise
    "--alphamax", "1.0",     # smoother curves (default 1.0)
    "--opttolerance", "0.4", # default curve-optimization tolerance
    "-o", SVG_OUT,
    PBM_OUT,
], check=True)
print(f"wrote {SVG_OUT} ({os.path.getsize(SVG_OUT)} bytes)")

# Show the generated SVG header so we can confirm it matches potrace's format
with open(SVG_OUT) as f:
    head = "".join(f.readlines()[:9])
print("--- svg head ---")
print(head)

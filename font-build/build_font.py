#!/usr/bin/env python3
"""Build a WOFF2 font from individual SVG glyph files."""
import os
import re
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import SVGPath
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

HERE = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(HERE, "Alphabet_Numbers")
SPECIAL_DIR = os.path.join(HERE, "special_chars")
OUT_DIR = os.path.abspath(os.path.join(HERE, "..", "Fonts"))

EM = 1000
CAP_HEIGHT = 720        # tallest source glyph maps to this em-height
SIDE_PADDING = -50      # em units of padding L+R of each LETTER's tight bbox.
                        # -50 each side = -100 per pair = bakes a -0.1em
                        # "graffiti tag" tightness for letter pairs.
SIDE_PADDING_SPECIAL = 30   # punctuation gets a small positive pad so a "."
                            # or "?" doesn't crash into adjacent letters.
SPACE_WIDTH = 240       # space character width in em-units (also tightened)

# Per-pair kerning in em-units (negative = pull closer). Tight bbox positioning
# leaves visible gaps for pairs where one glyph has an angled/curved edge and
# the other a flat opposing edge (the dead space between A's tip and B's stem,
# for example). Pairs are tuned individually since some need much more pull
# than others.
KERN_PAIRS = [
    ('a', 'b', -60),
    ('c', 'd', -120),
    ('h', 'i', -80),
    ('k', 'l', -60),
    ('l', 'm', -100),
    ('m', 'n', -60),
    ('o', 'p', -60),
    ('q', 'r', -60),
    ('r', 's', -60),
    ('s', 't', -100),
    ('u', 'v', -100),
    ('w', 'x', -60),
    ('x', 'y', -100),
]
# SVGPath emits raw potrace path coords (10x scale, Y-up) without applying the
# outer <g transform>. We compensate with a uniform scale of (scale * 0.1).

# PostScript-safe glyph names (digits need word forms)
DIGIT_NAMES = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
}

def glyph_name(char):
    return DIGIT_NAMES.get(char, char)

# Special characters from special_chars/ — file-stem → (codepoint, glyph_name)
SPECIAL_CHARS = {
    'ampersand':   (0x26, 'ampersand'),
    'asterisk':    (0x2A, 'asterisk'),
    'at':          (0x40, 'at'),
    'comma':       (0x2C, 'comma'),
    'dollar':      (0x24, 'dollar'),
    'exclamation': (0x21, 'exclam'),
    'hyphen':      (0x2D, 'hyphen'),
    'percent':     (0x25, 'percent'),
    'period':      (0x2E, 'period'),
    'plus':        (0x2B, 'plus'),
    'question':    (0x3F, 'question'),
}

# Pass 1 — collect SVG dimensions. Each source = (codepoints, glyph_name, w, h, file, kind)
# codepoints is a list because letters get both lowercase+uppercase mapped.
# kind is "letter" or "special" — used to pick the right SIDE_PADDING.
sources = []
for fname in sorted(os.listdir(SVG_DIR)):
    if not fname.endswith('.svg'):
        continue
    char = fname[:-4]
    if len(char) != 1:
        continue
    full = os.path.join(SVG_DIR, fname)
    with open(full) as f:
        content = f.read()
    w = float(re.search(r'width="([0-9.]+)pt"', content).group(1))
    h = float(re.search(r'height="([0-9.]+)pt"', content).group(1))
    cps = [ord(char)]
    if char.isalpha():
        cps.append(ord(char.upper()))
    sources.append((cps, glyph_name(char), w, h, full, "letter"))

# Special characters from special_chars/
if os.path.isdir(SPECIAL_DIR):
    for fname in sorted(os.listdir(SPECIAL_DIR)):
        if not fname.endswith('.svg'):
            continue
        stem = fname[:-4]
        if stem not in SPECIAL_CHARS:
            print(f"  warning: no codepoint mapping for {stem}.svg — skipping")
            continue
        cp, gname = SPECIAL_CHARS[stem]
        full = os.path.join(SPECIAL_DIR, fname)
        with open(full) as f:
            content = f.read()
        w = float(re.search(r'width="([0-9.]+)pt"', content).group(1))
        h = float(re.search(r'height="([0-9.]+)pt"', content).group(1))
        sources.append(([cp], gname, w, h, full, "special"))

# Use the ALPHABET's tallest glyph for the global scale, not specials —
# some specials (like @) intentionally exceed cap height.
alphabet_max_h = max(h for _, _, _, h, _, k in sources if k == "letter")
scale = CAP_HEIGHT / alphabet_max_h
print(f"alphabet tallest = {alphabet_max_h}pt → scale {scale:.4f} (cap-height = {CAP_HEIGHT})")

# Pass 2 — build glyphs
glyph_order = ['.notdef', 'space'] + [n for _, n, _, _, _, _ in sources]
# Deduplicate while preserving order in case any glyph name appears twice
seen = set()
glyph_order = [n for n in glyph_order if not (n in seen or seen.add(n))]
glyphs = {}
advance_widths = {}
lsb = {}

# .notdef + space placeholders (empty contours)
glyphs['.notdef'] = TTGlyphPen(None).glyph()
glyphs['space']   = TTGlyphPen(None).glyph()
advance_widths['.notdef'] = 500
advance_widths['space']   = SPACE_WIDTH
lsb['.notdef'] = 0
lsb['space']   = 0

unit_scale = scale * 0.1  # raw potrace coords are 10x; SVGPath skips <g transform>

for cps, gname, w_pt, h_pt, svg_file, kind in sources:
    pad = SIDE_PADDING if kind == "letter" else SIDE_PADDING_SPECIAL

    # Pass 1: measure the glyph's TIGHT bounding box (potrace SVGs have
    # variable internal whitespace in their viewBox, so the viewBox width
    # isn't the real glyph width).
    bp = BoundsPen(None)
    probe = TransformPen(bp, (unit_scale, 0, 0, unit_scale, 0, 0))
    SVGPath(filename=svg_file).draw(probe)
    if bp.bounds is None:
        print(f"  warning: empty glyph for {gname}")
        continue
    bx_min, _, bx_max, _ = bp.bounds
    tight_w = bx_max - bx_min

    # Pass 2: build the glyph, shifted so its real xMin lands at pad.
    shift_x = pad - bx_min
    transform = (unit_scale, 0, 0, unit_scale, shift_x, 0)

    pen = TTGlyphPen(None)
    reverse_pen = ReverseContourPen(pen)        # TT needs outer CCW + inner CW
    cu2qu_pen = Cu2QuPen(reverse_pen, max_err=1.0)
    tpen = TransformPen(cu2qu_pen, transform)

    svg = SVGPath(filename=svg_file)
    svg.draw(tpen)

    glyphs[gname] = pen.glyph()
    advance_widths[gname] = max(80, int(tight_w + 2 * pad))
    lsb[gname] = pad

print(f"built {len(sources)} glyphs (+ .notdef + space)")

# Build the font
fb = FontBuilder(EM, isTTF=True)
fb.setupGlyphOrder(glyph_order)

# Character map. Each source carries the list of codepoints it should serve;
# letters include both lowercase and uppercase, specials carry just one.
cmap = {0x20: 'space'}
for cps, gname, _, _, _, _ in sources:
    for cp in cps:
        cmap[cp] = gname
fb.setupCharacterMap(cmap)

fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({n: (advance_widths[n], lsb[n]) for n in glyph_order})

ASCENT = 950           # roomy enough for tall specials (@, $) that exceed cap
DESCENT = -200         # roomy enough for comma/period descenders
fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
fb.setupOS2(
    sTypoAscender=ASCENT,
    sTypoDescender=DESCENT,
    sTypoLineGap=0,
    usWinAscent=ASCENT,
    usWinDescent=abs(DESCENT),
    sxHeight=int(CAP_HEIGHT * 0.65),
    sCapHeight=CAP_HEIGHT,
)
fb.setupNameTable({
    "familyName": "GraffitiPlus Display",
    "styleName":  "Regular",
    "psName":     "GraffitiPlusDisplay-Regular",
    "fullName":   "GraffitiPlus Display Regular",
    "version":    "Version 1.000",
    "uniqueFontIdentifier": "GraffitiPlusDisplay-Regular;1.000",
    "copyright":  "© Tangible Interaction Design Inc.",
})
fb.setupPost()

# Kerning — adds a GPOS `kern` feature targeting the listed glyph pairs.
# Browsers apply this by default (font-kerning: auto), so authors don't need
# to opt in via CSS to get the tighter pairs.
kern_rules = "\n".join(f"    pos {a} {b} {amt};" for a, b, amt in KERN_PAIRS)
fea_source = f"""
languagesystem DFLT dflt;
languagesystem latn dflt;

feature kern {{
{kern_rules}
}} kern;
"""
addOpenTypeFeaturesFromString(fb.font, fea_source)
print(f"applied {len(KERN_PAIRS)} kerning pairs")
for a, b, amt in KERN_PAIRS:
    print(f"  {a}{b}: {amt}")

os.makedirs(OUT_DIR, exist_ok=True)
ttf_path = os.path.join(OUT_DIR, "GraffitiPlusDisplay-Regular.ttf")
fb.font.save(ttf_path)
print(f"saved {ttf_path} ({os.path.getsize(ttf_path)} bytes)")

# Convert to WOFF2
font = TTFont(ttf_path)
font.flavor = "woff2"
woff2_path = os.path.join(OUT_DIR, "GraffitiPlusDisplay-Regular.woff2")
font.save(woff2_path)
print(f"saved {woff2_path} ({os.path.getsize(woff2_path)} bytes)")

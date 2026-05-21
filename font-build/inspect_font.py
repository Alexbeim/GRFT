#!/usr/bin/env python3
"""Inspect a built font's glyph bounds and metrics."""
import os
from fontTools.ttLib import TTFont

font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Fonts",
                         "GraffitiPlusDisplay-Regular.ttf")
font = TTFont(font_path)
glyf = font['glyf']
hmtx = font['hmtx']
head = font['head']

print(f"unitsPerEm: {head.unitsPerEm}")
print(f"xMin/yMin/xMax/yMax in head: {head.xMin} {head.yMin} {head.xMax} {head.yMax}")
print()
print(f"{'glyph':<10}{'adv':>6}{'lsb':>6}{'xMin':>6}{'yMin':>6}{'xMax':>6}{'yMax':>6}  contours")
for name in font.getGlyphOrder():
    g = glyf[name]
    aw, lsb = hmtx[name]
    if g.numberOfContours == 0:
        print(f"{name:<10}{aw:>6}{lsb:>6}  (empty)")
        continue
    xmin = min(p[0] for p in g.coordinates)
    ymin = min(p[1] for p in g.coordinates)
    xmax = max(p[0] for p in g.coordinates)
    ymax = max(p[1] for p in g.coordinates)
    print(f"{name:<10}{aw:>6}{lsb:>6}{xmin:>6}{ymin:>6}{xmax:>6}{ymax:>6}  {g.numberOfContours}")

"""Offline study of the Obsidian editor region of V-38 on the existing trial image (research/14 §6.183). Flatness only: no
colour difference to Inkdrop is computed to pick a region. Reports, for the original x range of the editor region
(850..930), the contiguous runs of rows whose standard deviation across x is <= 0.5, and the sd / mean of the original
region and of the fallback region (largest run inside the original rows 260..649).
usage: python3 editor-region-offline.py <obsidian-trial.png>"""
import statistics, sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
# The original region (850, 260, 80, 390) covers x 850..929 and rows 260..649: half-open ranges [850, 930) and [260, 650).
X0, X1, Y0, Y1 = 850, 930, 260, 650
def row_sd(y):
    px = [im.getpixel((x, y)) for x in range(X0, X1)]
    return max(statistics.pstdev([p[c] for p in px]) for c in range(3))
runs, start = [], None
for y in range(Y0, Y1):
    flat = row_sd(y) <= 0.5
    if flat and start is None: start = y
    if not flat and start is not None: runs.append((start, y - 1)); start = None
if start is not None: runs.append((start, Y1 - 1))
print("flat row runs inside the original y range [", Y0, ",", Y1, "):", [(a, b, b - a + 1) for a, b in runs])
def region(x, y, w, h):
    px = [im.getpixel((xx, yy)) for xx in range(x, x + w) for yy in range(y, y + h)]
    return [round(statistics.pstdev([p[c] for p in px]), 2) for c in range(3)], [round(statistics.mean([p[c] for p in px]), 1) for c in range(3)]
print("original region (850, 260, 80, 390): sd, mean =", region(850, 260, 80, 390))
a, b = max(runs, key=lambda r: r[1] - r[0])
print(f"largest run {a}..{b} -> fallback region (850, {a}, 80, {b - a + 1}): sd, mean =", region(850, a, 80, b - a + 1))

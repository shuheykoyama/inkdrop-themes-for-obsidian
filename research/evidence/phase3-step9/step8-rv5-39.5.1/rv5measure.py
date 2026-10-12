# Measure the glyph colour of each fixed token in its native capture (2x pixels of the window's CSS px
# rectangle) and compare it with the expected colour (ΔE2000). Glyph core = the eighth of the pixels farthest
# from the most common colour of the rectangle (the code block background).
# usage: python3 -I rv5measure.py <dir with rv5-token-rects.json and screenshots/> <out.csv>
import csv, json, math, sys
from collections import Counter
from PIL import Image

d, out = sys.argv[1], sys.argv[2]
rows = json.load(open(f"{d}/rv5-token-rects.json"))

def rgb(s):
    return [float(x) for x in s[s.index("(") + 1:s.index(")")].split(",")][:3]

def lab(c):
    def f(u):
        u /= 255
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    g3 = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = g3(x), g3(y), g3(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)

def de2000(c1, c2):
    L1, a1, b1 = lab(c1); L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1 = math.degrees(math.atan2(b1, a1p)) % 360
    h2 = math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    dh = 0 if C1p * C2p == 0 else (h2 - h1 if abs(h2 - h1) <= 180 else h2 - h1 - 360 if h2 > h1 else h2 - h1 + 360)
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = (h1 + h2) / 2 if abs(h1 - h2) <= 180 else (h1 + h2 + 360) / 2 if h1 + h2 < 360 else (h1 + h2 - 360) / 2
    if C1p * C2p == 0: hb = h1 + h2
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63))
    SL = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    SC, SH = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    RT = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hb - 275) / 25) ** 2)))
    return math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))

res = []
# The definition `main` (.token.function-definition.function) is not one of the fixed classes: left out.
for r in [r for r in rows if r["text"] != "main"]:
    im = Image.open(f"{d}/screenshots/{r['png']}").convert("RGB")
    s = 2  # the captures are 2x the window's CSS px
    box = [(x, y) for x in range(int(r["x"] * s) + 1, int((r["x"] + r["w"]) * s) - 1) for y in range(int(r["y"] * s) + 1, int((r["y"] + r["h"]) * s) - 1)]
    px = [im.getpixel(p) for p in box]
    bg = Counter(px).most_common(1)[0][0]
    core = sorted(px, key=lambda p: -math.dist(p, bg))[:max(1, len(px) // 8)]
    meas = [sum(p[i] for p in core) / len(core) for i in range(3)]
    res.append({"theme": r["theme"], "block": r["block"], "class": r["cls"], "text": r["text"], "computed": r["computed"], "expected": r["expected"],
                "measured": "rgb(%d, %d, %d)" % tuple(round(v) for v in meas), "dE2000_measured_vs_expected": round(de2000(meas, rgb(r["expected"])), 2),
                "dE2000_measured_vs_computed": round(de2000(meas, rgb(r["computed"])), 2)})
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(res[0].keys())); w.writeheader(); w.writerows(res)
for x in res: print(x["theme"], x["block"], x["class"], f'"{x["text"]}"', x["expected"], x["measured"], x["dE2000_measured_vs_expected"])

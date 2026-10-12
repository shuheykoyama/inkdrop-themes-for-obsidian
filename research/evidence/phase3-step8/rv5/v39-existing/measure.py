# V-39 (partial, existing data): measure the colour of every token of the sample note's JS block in the
# existing Inkdrop V-30 screenshots (CDP, 1x, opaque) and compare it with the colour Inkdrop's own parser
# and syntax.css give the token (expected.json + resolved palette colours from an Obsidian page dump).
# usage: python3 -I measure.py <inkdrop png dir> <expected.json> <page-sd.json> <page-kd.json> <out.csv>
import csv, json, math, sys
from PIL import Image

png_dir, exp_path, sd_page, kd_page, out = sys.argv[1:6]
exp = json.load(open(exp_path))[0]
code = exp["code"]
lines = code.split("\n")
pages = {"sd": json.load(open(sd_page))["vars"], "kd": json.load(open(kd_page))["vars"]}

def rgb(s):
    n = [float(x) for x in s[s.index("(") + 1:s.index(")")].split(",")]
    return n[:3], (n[3] if len(n) > 3 else 1.0)

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

dist = lambda p, q: math.dist(p, q)

def bands(im, box, bg):
    # Rows of the code block that hold glyph pixels, grouped into text lines.
    x0, y0, x1, y1 = box
    rows = [y for y in range(y0, y1) if any(dist(im.getpixel((x, y)), bg) > 40 for x in range(x0, x1))]
    out, cur = [], []
    for y in rows:
        if cur and y != cur[-1] + 1: out.append((cur[0], cur[-1])); cur = []
        cur.append(y)
    if cur: out.append((cur[0], cur[-1]))
    return out

rows_out = []
# (theme, file, view, code block box (x0, y0, x1, y1) in px, index of the first code line among the text lines; the editor's fence line ```js shows as two: the backticks and js)
shots = [("sd", "sd-1-default", "editor", (508, 418, 1012, 535), 2), ("kd", "kd-1-default", "editor", (508, 418, 1012, 535), 2),
         ("sd", "sd-5-preview", "preview", (512, 540, 1010, 640), 0), ("kd", "kd-5-preview", "preview", (512, 540, 1010, 640), 0)]
for theme, name, view, box, first in shots:
    im = Image.open(f"{png_dir}/{name}.png").convert("RGB")
    bg = im.getpixel((box[2] - 20, box[1] + 5))
    bs = bands(im, box, bg)[first:first + len(lines)]
    # Column geometry from the first line: its first and last glyph pixels span len(line) characters.
    y0, y1 = bs[0]
    xs = [x for x in range(box[0], box[2]) for y in range(y0, y1 + 1) if dist(im.getpixel((x, y)), bg) > 40]
    left, right = min(xs), max(xs)
    cw = (right - left + 1) / len(lines[0].rstrip())
    print("#", name, "bg", bg, "bands", bands(im, box, bg), "left", left, "right", right, "cw", round(cw, 2), file=sys.stderr)
    starts = [sum(len(l) + 1 for l in lines[:i]) for i in range(len(lines))]
    for r in exp["ranges"]:
        li = max(i for i, s in enumerate(starts) if s <= r["from"])
        col0, col1 = r["from"] - starts[li], r["to"] - starts[li]
        ya, yb = bs[li]
        xa, xb = int(left + col0 * cw), int(left + col1 * cw)
        px = [im.getpixel((x, y)) for x in range(xa, max(xb, xa + 1)) for y in range(ya, yb + 1)]
        px = sorted(px, key=lambda p: -dist(p, bg))
        core = px[:max(1, len(px) // 8)]  # the glyph cores: the pixels farthest from the background
        meas = tuple(round(sum(p[i] for p in core) / len(core)) for i in range(3))
        name_var = r["var"].replace("--syntax-", "--ink-syntax-")
        want, a = rgb(pages[theme][name_var])
        # Nearest declared syntax colour, to name what the pixel shows.
        best = min(((de2000(meas, rgb(v)[0]), k) for k, v in pages[theme].items() if k.startswith("--ink-syntax-") and rgb(v)[1] == 1), key=lambda t: t[0])
        rows_out.append({"theme": theme, "view": view, "text": r["text"], "inkdrop_var": r["var"], "expected": "rgb(%d, %d, %d)" % tuple(round(x) for x in want),
                         "measured": "rgb(%d, %d, %d)" % meas, "dE2000": round(de2000(meas, want), 2),
                         "nearest_var": best[1].replace("--ink-syntax-", "").replace("-color", ""), "nearest_dE2000": round(best[0], 2)})
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys())); w.writeheader(); w.writerows(rows_out)
for r in rows_out: print(r["theme"], r["view"], f'{r["text"]:>8}', r["inkdrop_var"].replace("--syntax-", "").replace("-color", ""), r["expected"], r["measured"], r["dE2000"], "nearest", r["nearest_var"], r["nearest_dE2000"])

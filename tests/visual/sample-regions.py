"""Region sampling of native screenshots: mean and spread of the pixels in background-only rectangles,
colour differences against reference colours, flatness check and adjacent-region continuity
(research/14 section 3.7 and Q23-5a / Q23-5b).

Reused from research/evidence/phase2-v04/tools/sample-regions.py (V-04). The PNG decoder, statistics
and colour-difference functions are copied unchanged; the regions and references, which V-04 had as
constants, now come from a JSON config, and two optional checks were added:
  max_sd  : a region whose per-channel standard deviation exceeds this is NOT flat (text, a border or
            anti-aliasing is inside it). Its measurement is invalid and the run fails; it is never
            averaged into a pass.
  pairs   : [{"a": region, "b": region, "max_de2000": x}] continuity of two adjacent flat regions.
  max_de2000_vs_reference : optional limit for the difference against the reference colour.

usage: python3 -I tests/visual/sample-regions.py --config <cfg.json> --out <out.csv> <png> [<png> ...]
Exit status 1 if a region is not flat (when max_sd is set) or a pair / reference limit is exceeded.

Pure standard library (zlib PNG decoder, 8-bit RGB/RGBA, non-interlaced).
IMPORTANT: values are pixels of a native macOS capture in the DISPLAY colour space after window-server
compositing. They are NOT CSS colour values. For the colour differences the 8-bit values are treated
as sRGB (an approximation), converted to CIELAB (D65) and compared with CIE76 and CIEDE2000.
"""
import argparse
import csv
import json
import math
import struct
import sys
import zlib
from pathlib import Path


def read_png(path):
    data = Path(path).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, b""
    width = height = channels = 0
    while pos < len(data):
        length, ctype = struct.unpack(">I4s", data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b"IHDR":
            width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            assert depth == 8 and colour in (2, 6) and interlace == 0, (depth, colour, interlace)
            channels = 4 if colour == 6 else 3
        elif ctype == b"IDAT":
            idat += chunk
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width * channels
    rows, prev = [], bytearray(stride)
    i = 0
    for _ in range(height):
        ftype = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        # Undo the PNG scanline filter (None, Sub, Up, Average, Paeth).
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 255
            elif ftype == 2:
                line[x] = (line[x] + b) & 255
            elif ftype == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(line)
        prev = line
    return width, height, channels, rows


def stats(rows, channels, x, y, w, h):
    sums, sq, n = [0, 0, 0], [0, 0, 0], 0
    for yy in range(y, y + h):
        row = rows[yy]
        for xx in range(x, x + w):
            p = row[xx * channels: xx * channels + 3]
            for k in range(3):
                sums[k] += p[k]
                sq[k] += p[k] * p[k]
            n += 1
    mean = [s / n for s in sums]
    sd = [max(q / n - m * m, 0) ** 0.5 for q, m in zip(sq, mean)]
    return mean, sd


def to_lab(rgb):
    # sRGB (0-255) -> linear -> XYZ (D65) -> CIELAB.
    lin = [(c / 255 / 12.92) if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4 for c in rgb]
    x = 0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = 0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]
    f = lambda t: t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    fx, fy, fz = f(x / 0.95047), f(y / 1.0), f(z / 1.08883)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de76(a, b):
    return math.dist(to_lab(a), to_lab(b))


def de2000(c1, c2):
    # CIEDE2000 (Sharma, Wu, Dalal 2005), kL = kC = kH = 1.
    L1, a1, b1 = to_lab(c1)
    L2, a2, b2 = to_lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    else:
        hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp)) \
        + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63))
    dTheta = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTheta)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))




def theme_of(name, rules):
    # First matching substring wins, as in V-04: "sd" if "-sd" in name else "kd" if "-kd" in name else "".
    for needle, theme in rules:
        if needle in name:
            return theme
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("pngs", nargs="+")
    a = ap.parse_args()
    cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
    regions = cfg["regions"]
    refs = cfg.get("references", {})
    rules = cfg.get("theme_from_name", [])
    max_sd = cfg.get("max_sd")
    max_ref = cfg.get("max_de2000_vs_reference")
    pairs = cfg.get("pairs", [])

    out, problems = [], []
    for png in a.pngs:
        width, height, channels, rows = read_png(png)
        scale = width / cfg["window_width_points"]  # pixels per point
        name = Path(png).name
        theme = theme_of(name, rules)
        means = {}
        for region, (x, y, w, h) in regions.items():
            mean, sd = stats(rows, channels, int(x * scale), int(y * scale), int(w * scale), int(h * scale))
            ref = refs.get(theme, {}).get(region)
            out.append([name, region, f"{x},{y},{w},{h}", *(round(m, 1) for m in mean), *(round(s, 2) for s in sd),
                        round(de76(mean, ref), 2) if ref else "", round(de2000(mean, ref), 2) if ref else ""])
            flat = max_sd is None or max(sd) <= max_sd
            if not flat:
                problems.append(f"NOT FLAT {name} {region}: sd={[round(s, 2) for s in sd]} > {max_sd} (measurement invalid)")
            means[region] = mean if flat else None
            if flat and ref and max_ref is not None and de2000(mean, ref) > max_ref:
                problems.append(f"REFERENCE {name} {region}: dE2000 {de2000(mean, ref):.2f} > {max_ref}")
        for p in pairs:
            ma, mb = means.get(p["a"]), means.get(p["b"])
            if ma is None or mb is None:
                problems.append(f"PAIR {name} {p['a']}|{p['b']}: a region is missing or not flat")
                continue
            d = de2000(ma, mb)
            line = f"PAIR {name} {p['a']}|{p['b']}: dE2000 {d:.2f} (limit {p['max_de2000']})"
            print(line)
            if d > p["max_de2000"]:
                problems.append(line)

    with open(a.out, "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f, lineterminator="\n")
        wr.writerow(["image", "region", "rect_points(x,y,w,h)", "mean_r", "mean_g", "mean_b", "sd_r", "sd_g", "sd_b",
                     "dE76_vs_inkdrop_v32", "dE2000_vs_inkdrop_v32"])
        wr.writerows(out)
    for r in out:
        print(f"{r[0]:52} {r[1]:13} mean=({r[3]:6},{r[4]:6},{r[5]:6}) sd=({r[6]},{r[7]},{r[8]}) dE76={r[9]} dE00={r[10]}")
    for p in problems:
        print(f"FAIL {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

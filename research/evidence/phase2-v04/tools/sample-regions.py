"""V-04: mean and spread of screenshot pixels in background-only areas of the Obsidian window,
and colour differences against the Inkdrop V-32 composites.

usage: python3 -I sample-regions.py <out_csv> <png> [<png> ...]

Pure standard library (zlib PNG decoder, 8-bit RGB/RGBA, non-interlaced).
IMPORTANT: values are pixels of a native macOS capture in the DISPLAY colour space after window-server
compositing. They are NOT CSS colour values. For the colour differences the 8-bit values are treated
as sRGB (an approximation: the capture is in the display profile "Color LCD", not converted to sRGB),
converted to CIELAB (D65) and compared with CIE76 (Euclidean) and CIEDE2000.
"""
import csv
import math
import struct
import sys
import zlib
from pathlib import Path

# Background-only rectangles in window points (x, y, w, h) for the 1200x700 window used in V-04,
# chosen from the captures where no text, icon or control is drawn. Pixels = points * 2.
REGIONS = {
    "ribbon": (6, 280, 32, 360),
    "left-tabstrip": (180, 6, 80, 28),
    "left-dock": (60, 200, 220, 420),
    "root-tabstrip": (550, 6, 350, 28),
    "editor": (850, 130, 80, 520),
    "right-dock": (960, 240, 220, 400),
}

# Inkdrop V-32 acrylic composites (gray backdrop, active; ../../phase2-p0/measurements/inkdrop-v32-pixel-samples.csv)
# on the provisional mapping left dock = sidebar, right dock = note list, editor = editor.
INKDROP = {
    "sd": {"left-dock": (22.5, 43.8, 48.5), "right-dock": (13.3, 35.8, 40.8), "editor": (5.4, 33.3, 41.3)},
    "kd": {"left-dock": (30.1, 29.2, 28.2), "right-dock": (30.3, 27.8, 27.9), "editor": (31.4, 30.4, 28.4)},
}


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


out = []
for png in sys.argv[2:]:
    width, height, channels, rows = read_png(png)
    scale = width / 1200  # pixels per point for the 1200-point-wide window capture
    name = Path(png).name
    theme = "sd" if "-sd" in name else "kd" if "-kd" in name else ""
    for region, (x, y, w, h) in REGIONS.items():
        mean, sd = stats(rows, channels, int(x * scale), int(y * scale), int(w * scale), int(h * scale))
        ref = INKDROP.get(theme, {}).get(region)
        out.append([name, region, f"{x},{y},{w},{h}", *(round(m, 1) for m in mean), *(round(s, 2) for s in sd),
                    round(de76(mean, ref), 2) if ref else "", round(de2000(mean, ref), 2) if ref else ""])

with open(sys.argv[1], "w", newline="", encoding="utf-8") as f:
    wr = csv.writer(f, lineterminator="\n")
    wr.writerow(["image", "region", "rect_points(x,y,w,h)", "mean_r", "mean_g", "mean_b", "sd_r", "sd_g", "sd_b",
                 "dE76_vs_inkdrop_v32", "dE2000_vs_inkdrop_v32"])
    wr.writerows(out)
for r in out:
    print(f"{r[0]:52} {r[1]:13} mean=({r[3]:6},{r[4]:6},{r[5]:6}) sd=({r[6]},{r[7]},{r[8]}) dE76={r[9]} dE00={r[10]}")

"""Phase 2B / V-32: mean and spread of screenshot pixels in background-only areas of each pane.

usage: python3 -I sample-pixels.py <out_csv> <png> [<png> ...]

Pure standard library (zlib PNG decoder, 8-bit RGB/RGBA, non-interlaced).
IMPORTANT: values are pixels of a native macOS capture in the DISPLAY colour space after window-server
compositing. They are NOT CSS colour values and must not be compared to them as equal quantities.
"""
import csv
import struct
import sys
import zlib
from pathlib import Path

# Background-only rectangles in screen points (x, y, w, h) relative to the 1200x700 window,
# chosen from the captures where no text or control is drawn. Pixels = points * 2.
REGIONS = {
    "sidebar": (20, 470, 130, 160),
    "note-list": (220, 300, 260, 380),
    "editor": (600, 640, 550, 50),
}


def read_png(path):
    data = Path(path).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, width = 8, b"", None
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


out = []
for png in sys.argv[2:]:
    width, height, channels, rows = read_png(png)
    scale = width / 1200  # pixels per point for the 1200-point-wide window capture
    for name, (x, y, w, h) in REGIONS.items():
        mean, sd = stats(rows, channels, int(x * scale), int(y * scale), int(w * scale), int(h * scale))
        out.append([Path(png).name, name, f"{x},{y},{w},{h}", *(round(m, 1) for m in mean), *(round(s, 2) for s in sd)])

with open(sys.argv[1], "w", newline="", encoding="utf-8") as f:
    wr = csv.writer(f, lineterminator="\n")
    wr.writerow(["image", "region", "rect_points(x,y,w,h)", "mean_r", "mean_g", "mean_b", "sd_r", "sd_g", "sd_b"])
    wr.writerows(out)
for r in out:
    print(f"{r[0]:45} {r[1]:10} mean=({r[3]:6},{r[4]:6},{r[5]:6}) sd=({r[6]},{r[7]},{r[8]})")

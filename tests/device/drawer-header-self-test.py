"""Negative tests of tests/device/drawer-header.py on synthetic screenshots (no device needed).

The image imitates an open drawer at device pixel ratio 2: a body and a header of the drawer colour; each case
changes one thing and declares PASS or FAIL:
  - the same colour in both areas passes (8-bit and 16-bit images);
  - a header one 8-bit step off passes (below the dE2000 limit), a raised header (a lighter layer) fails;
  - text or an icon edge inside the header area, or a gradient in the body area, fails as not flat;
  - a missing area, an area outside the image, a scale that is not the pixel ratio, and a geometry without an
    open drawer fail.

usage: python3 -I tests/device/drawer-header-self-test.py
"""
import json
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "drawer-header.py"
DPR, VW, VH = 2, 200, 400  # CSS px; the image is 400 x 800
DRAWER = (0, 45, 56)
GEOMETRY = {"dpr": DPR, "viewport": [VW, VH], "drawers": [{"side": "left", "headerArea": [120, 350, 60, 30], "bodyArea": [20, 150, 160, 150]}]}


def png(path, pixel, depth=8):
    """Writes a W x H RGB PNG (filter 0 on every row); pixel(x, y) gives 8-bit values."""
    w, h = VW * DPR, VH * DPR
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            for v in pixel(x, y):
                raw += bytes([v]) if depth == 8 else struct.pack(">H", v * 257)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, depth, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw))) + chunk(b"IEND", b"")
    Path(path).write_bytes(data)


def in_header(x, y):
    return 120 * DPR <= x < 180 * DPR and 350 * DPR <= y < 380 * DPR


def run(tmp, name, pixel, geometry=GEOMETRY, depth=8):
    p, g, o = Path(tmp) / f"{name}.png", Path(tmp) / f"{name}.json", Path(tmp) / f"{name}.out.json"
    png(p, pixel, depth)
    g.write_text(json.dumps(geometry))
    r = subprocess.run([sys.executable, "-I", str(SCRIPT), "--item", str(p), str(g), "--out", str(o)], capture_output=True, text=True)
    res = json.loads(o.read_text())["results"] if o.exists() else []
    return ("PASS" if r.returncode == 0 else "FAIL"), res


def main():
    flat = lambda x, y: DRAWER
    cases = [
        ("same colour, 8-bit", "PASS", flat, GEOMETRY, 8),
        ("same colour, 16-bit", "PASS", flat, GEOMETRY, 16),
        ("header one 8-bit step off (below the limit)", "PASS", lambda x, y: (0, 46, 56) if in_header(x, y) else DRAWER, GEOMETRY, 8),
        ("raised header: a lighter layer", "FAIL", lambda x, y: (10, 55, 66) if in_header(x, y) else DRAWER, GEOMETRY, 8),
        ("text in the header area", "FAIL", lambda x, y: (147, 161, 161) if in_header(x, y) and x % 7 == 0 else DRAWER, GEOMETRY, 8),
        ("icon edge in the header area", "FAIL", lambda x, y: (60, 90, 100) if in_header(x, y) and x > 170 * DPR else DRAWER, GEOMETRY, 8),
        ("gradient in the body", "FAIL", lambda x, y: (0, 45 + y // 80, 56) if y < 340 * DPR else DRAWER, GEOMETRY, 8),
        ("no header area", "FAIL", flat, {**GEOMETRY, "drawers": [{"side": "left", "headerArea": None, "bodyArea": [20, 150, 160, 150]}]}, 8),
        ("area outside the image", "FAIL", flat, {**GEOMETRY, "drawers": [{"side": "left", "headerArea": [120, 390, 60, 30], "bodyArea": [20, 150, 160, 150]}]}, 8),
        ("scale is not the pixel ratio", "FAIL", flat, {**GEOMETRY, "dpr": 3}, 8),
        ("no open drawer", "FAIL", flat, {**GEOMETRY, "drawers": []}, 8),
    ]
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        for i, (name, want, pixel, geometry, depth) in enumerate(cases):
            got, res = run(tmp, f"c{i}", pixel, geometry, depth)
            ok = got == want
            bad += not ok
            detail = "; ".join(r.get("detail", "") for r in res)
            print(f"{'PASS' if ok else 'FAIL'} drawer-header self-test: {name}: {got} (declared {want}) -- {detail}")
    print(f"\n{'all' if not bad else bad} {'' if not bad else 'of '}{len(cases)} drawer-header self-test cases {'behaved as expected' if not bad else 'FAILED'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

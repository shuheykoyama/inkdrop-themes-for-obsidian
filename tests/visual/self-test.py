"""Negative tests of tests/visual/sample-regions.py on a synthetic image (no screenshot needed).

The image imitates the Q23-5 situation: a gutter and a line area with the same background, a 1 px
border between them, a strip of "text", and an area with a different colour. Checks:
  - two flat regions of the same colour on both sides of the border pass the continuity limit;
  - a flat region of another colour fails the continuity limit;
  - a region that includes the 1 px border, or the text strip, is rejected as not flat;
  - a reference limit fails when the reference colour is wrong.

usage: python3 -I tests/visual/self-test.py
"""
import json
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "sample-regions.py"
W, H = 200, 100  # pixels; the config says 100 points wide, so 2 px per point like a Retina capture
BG, BORDER, TEXT, OTHER = (30, 29, 26), (39, 38, 38), (197, 201, 197), (24, 22, 22)


def pixel(x, y):
    if x in (80, 81):  # 1 point border between "gutter" (x < 80) and "line" (x > 81)
        return BORDER
    if 60 <= y < 66 and 100 <= x < 160 and x % 3:  # glyph-like strip on the line area
        return TEXT
    if y >= 80:  # a different background at the bottom
        return OTHER
    return BG


def write_png(path):
    raw = b"".join(b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(W)) for y in range(H))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def run(tmp, png, cfg):
    cfg_path = tmp / "cfg.json"
    cfg_path.write_text(json.dumps({"window_width_points": 100, "max_sd": 1.0, **cfg}))
    res = subprocess.run([sys.executable, "-I", str(SCRIPT), "--config", str(cfg_path), "--out", str(tmp / "out.csv"), str(png)],
                         capture_output=True, text=True)
    return res.returncode, res.stdout


CASES = [
    # name, config, expected exit status, text that must appear in the output
    ("same colour on both sides of the border passes",
     {"regions": {"gutter": [5, 5, 30, 20], "line": [45, 5, 30, 20]}, "pairs": [{"a": "gutter", "b": "line", "max_de2000": 1.0}]},
     0, "PAIR synthetic.png gutter|line: dE2000 0.00"),
    ("different colour fails continuity",
     {"regions": {"gutter": [5, 5, 30, 20], "other": [45, 42, 30, 6]}, "pairs": [{"a": "gutter", "b": "other", "max_de2000": 1.0}]},
     1, "FAIL PAIR synthetic.png gutter|other"),
    ("region including the 1 px border is not flat",
     {"regions": {"across-border": [30, 5, 20, 20]}},
     1, "FAIL NOT FLAT synthetic.png across-border"),
    ("region including text is not flat, and its pair is not judged",
     {"regions": {"gutter": [5, 5, 30, 20], "text": [50, 28, 30, 6]}, "pairs": [{"a": "gutter", "b": "text", "max_de2000": 50}]},
     1, "FAIL PAIR synthetic.png gutter|text: a region is missing or not flat"),
    ("wrong reference colour fails",
     {"regions": {"gutter": [5, 5, 30, 20]}, "references": {"": {"gutter": [0, 33, 41]}}, "max_de2000_vs_reference": 1.0},
     1, "FAIL REFERENCE synthetic.png gutter"),
    ("right reference colour passes",
     {"regions": {"gutter": [5, 5, 30, 20]}, "references": {"": {"gutter": list(BG)}}, "max_de2000_vs_reference": 1.0},
     0, "dE00=0.0"),
]

failures = 0
with tempfile.TemporaryDirectory() as d:
    tmp = Path(d)
    png = tmp / "synthetic.png"
    write_png(png)
    for name, cfg, want_status, want_text in CASES:
        status, out = run(tmp, png, cfg)
        ok = status == want_status and want_text in out
        print(f"{'PASS' if ok else 'FAIL'} visual self-test: {name}" + ("" if ok else f" -- exit {status}; {out.strip()[-300:]}"))
        failures += not ok
print(f"\n{failures} visual self-test case(s) FAILED" if failures else f"\nall {len(CASES)} visual self-test cases behaved as expected")
sys.exit(1 if failures else 0)

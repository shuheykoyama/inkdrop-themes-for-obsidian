"""qd1.mobile-drawer-header pixel check (research/14 section 6.61): in a device screenshot of an open drawer,
the drawer header must show the same colour as the drawer body (the header paints no background of its own,
so the note list colour of the drawer shows through it, Q-D1).

The areas come from tests/device/drawer-geometry.js, measured on the device at the moment of the screenshot
(the kit's tour records them as measured.drawerGeometry): the widest strip of the header and the tallest band
of the drawer's tab container with nothing painted in them, in CSS pixels. They are scaled to the screenshot
by its width over the viewport's width, which must equal the device pixel ratio.

Judgement per drawer, with the limits of tests/visual/v38-compare.py (not relaxed here):
  - both areas present and inside the image, the scale equal to the device pixel ratio (+-0.02);
  - both areas flat: per-channel standard deviation <= 1.0 (else text, an icon, a border or a gradient is
    inside and the measurement is invalid: FAIL, never averaged into a pass);
  - CIEDE2000 of the two means <= 1.0.
The screenshot's values (8 or 16 bits, on the 0-255 scale) are treated as sRGB for the colour difference; both
areas come from the same image, so the comparison depends little on its colour space (an iPhone screenshot
carries its own profile, which is not applied). The statistics and CIEDE2000 are tests/visual/sample-regions.py's.

usage:
  python3 -I tests/device/drawer-header.py --tour <tour-*.json> --shots <dir with shots.json> --out <out.json>
  python3 -I tests/device/drawer-header.py --item <png> <geometry.json> [--item ...] --out <out.json>
Exit status 1 when a drawer fails or no drawer was judged.
"""
import argparse
import importlib.util
import json
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("sample_regions", HERE.parent / "visual" / "sample-regions.py")
assert spec and spec.loader
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

MAX_SD, MAX_DE = 1.0, 1.0


def read_png(path):
    """PNG (RGB or RGBA, 8 or 16 bits per channel, not interlaced) -> width, height, rows of RGB(A) values on
    the 0-255 scale (16-bit values / 257, kept as floats). Device screenshots are 16-bit; the CDP ones 8-bit."""
    data = Path(path).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, b""
    while pos < len(data):
        length, ctype = struct.unpack(">I4s", data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b"IHDR":
            width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            assert depth in (8, 16) and colour in (2, 6) and interlace == 0, (depth, colour, interlace)
        elif ctype == b"IDAT":
            idat += chunk
        pos += 12 + length
    channels = 3 if colour == 2 else 4
    step = channels * depth // 8  # bytes per pixel: the filters work on bytes, one pixel back
    raw = zlib.decompress(idat)
    stride = width * step
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        ftype, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - step] if x >= step else 0
            b = prev[x]
            c = prev[x - step] if x >= step else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 255
            elif ftype == 2:
                line[x] = (line[x] + b) & 255
            elif ftype == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
        if depth == 8:
            rows.append(list(line))
        else:
            rows.append([((line[k] << 8) | line[k + 1]) / 257 for k in range(0, stride, 2)])
    return width, height, channels, rows


def judge(png, geometry, label):
    """Judges every drawer of one screenshot; returns a list of result dicts."""
    width, height, channels, rows = read_png(png)
    out = []
    drawers = geometry.get("drawers") or []
    if not drawers:
        return [{"label": label, "status": "FAIL", "detail": "no open drawer in the geometry"}]
    vw = geometry["viewport"][0]
    scale = width / vw
    for d in drawers:
        res = {"label": label, "side": d.get("side"), "png": Path(png).name, "scale": round(scale, 4), "dpr": geometry.get("dpr"), "header": d.get("header")}
        out.append(res)
        if abs(scale - geometry.get("dpr", 0)) > 0.02:
            res.update(status="FAIL", detail=f"screenshot scale {scale:.3f} is not the device pixel ratio {geometry.get('dpr')}")
            continue
        areas = {}
        for name in ("headerArea", "bodyArea"):
            a = d.get(name)
            if not a:
                break
            # Inward to whole pixels: no pixel outside the measured area is sampled.
            x0, y0 = int(-(-a[0] * scale // 1)), int(-(-a[1] * scale // 1))
            x1, y1 = int((a[0] + a[2]) * scale), int((a[1] + a[3]) * scale)
            if x1 - x0 < 2 or y1 - y0 < 2 or x0 < 0 or y0 < 0 or x1 > width or y1 > height:
                break
            mean, sd = sr.stats(rows, channels, x0, y0, x1 - x0, y1 - y0)
            areas[name] = {"px": [x0, y0, x1 - x0, y1 - y0], "mean": [round(v, 2) for v in mean], "sd": [round(v, 3) for v in sd]}
        res["areas"] = areas
        if len(areas) < 2:
            res.update(status="FAIL", detail="header or body area missing, too small or outside the image")
            continue
        flat = {k: max(v["sd"]) <= MAX_SD for k, v in areas.items()}
        if not all(flat.values()):
            res.update(status="FAIL", detail=f"not flat (measurement invalid): {', '.join(k for k, f in flat.items() if not f)} max sd > {MAX_SD}")
            continue
        de = sr.de2000(areas["headerArea"]["mean"], areas["bodyArea"]["mean"])
        res["dE2000"] = round(de, 3)
        res.update(status="PASS" if de <= MAX_DE else "FAIL", detail=f"dE2000 {de:.3f} {'<=' if de <= MAX_DE else '>'} {MAX_DE}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour")
    ap.add_argument("--shots")
    ap.add_argument("--item", nargs=2, action="append", metavar=("PNG", "GEOMETRY"))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    items = []
    for png, geo in args.item or []:
        items.append((png, json.loads(Path(geo).read_text()), Path(png).name))
    if args.tour:
        tour = json.loads(Path(args.tour).read_text())
        shots = {s["n"]: s for s in json.loads((Path(args.shots) / "shots.json").read_text())["shots"]}
        for st in tour["steps"]:
            geo = (st.get("measured") or {}).get("drawerGeometry")
            if not geo or not geo.get("drawers"):
                continue
            shot = shots.get(st["n"])
            if not shot or not shot.get("file"):
                items.append((None, geo, st["label"]))
                continue
            items.append((str(Path(args.shots) / shot["file"]), geo, st["label"]))
    results = []
    for png, geo, label in items:
        if png is None:
            results.append({"label": label, "status": "FAIL", "detail": "no screenshot for this step"})
            continue
        results.extend(judge(png, geo, label))
    Path(args.out).write_text(json.dumps({"maxSd": MAX_SD, "maxDE2000": MAX_DE, "results": results}, indent=1) + "\n")
    for r in results:
        print(f"{r['status']:4} {r['label']} {r.get('side') or ''}: {r['detail']}")
    bad = [r for r in results if r["status"] != "PASS"]
    if not results:
        print("FAIL no drawer was judged")
    print(f"\n{len(results)} drawer(s) judged, {len(bad)} FAIL")
    sys.exit(1 if bad or not results else 0)


if __name__ == "__main__":
    main()

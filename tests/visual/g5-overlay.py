"""Step 11G G5 review images (research/14 section 6.85): each capture of tests/visual/g5-capture.mjs with the
rectangles method v2 measures drawn on it, for the visual check that is part of the result: pair.titlebar
(magenta) and pair.tab (green) over their common columns, with the v2 tile grid (thin lines), and the v1 left tab
strip (cyan, diagnostic). Also a 3x crop of the top of the window. Reads the captures only and writes into
<out>; needs Pillow (a local tool, not run in CI).

usage: python3 -I tests/visual/g5-overlay.py <capture out dir> <review out dir>
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

TILE = 8


def main():
    root, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=False)
    for g in sorted(root.glob("*/measurements/*.g5.json")):
        rec = json.loads(g.read_text())
        im = Image.open(root / rec["image"]).convert("RGB")
        s = im.width / 1200
        d = ImageDraw.Draw(im)
        pair = rec.get("pair") or {}
        for key, colour in (("titlebar", (255, 0, 255)), ("tab", (0, 255, 0))):
            r = pair.get(key)
            if not r:
                continue
            x, y, w, h = r
            nx, ny = max(1, -(-int(round(w * 100)) // (TILE * 100))), max(1, -(-int(round(h * 100)) // (TILE * 100)))
            for i in range(1, nx):
                d.line([((x + w * i / nx) * s, y * s), ((x + w * i / nx) * s, (y + h) * s)], fill=colour, width=1)
            for j in range(1, ny):
                d.line([(x * s, (y + h * j / ny) * s), ((x + w) * s, (y + h * j / ny) * s)], fill=colour, width=1)
            d.rectangle([x * s, y * s, (x + w) * s, (y + h) * s], outline=colour, width=2)
        lt = ((rec.get("regions") or {}).get("left-tabstrip") or {}).get("rect")
        if lt:
            d.rectangle([lt[0] * s, lt[1] * s, (lt[0] + lt[2]) * s, (lt[1] + lt[3]) * s], outline=(0, 200, 255), width=2)
        name = Path(rec["image"]).stem
        im.save(out / f"{name}-v2-regions.png")
        top = im.crop((0, 0, im.width, int(80 * s)))
        top.resize((top.width * 3 // 2, top.height * 3 // 2), Image.Resampling.NEAREST).save(out / f"{name}-v2-top.png")
        print(name, "pair", pair.get("columns"), "titlebar", pair.get("titlebar"), "tab", pair.get("tab"))


if __name__ == "__main__":
    main()

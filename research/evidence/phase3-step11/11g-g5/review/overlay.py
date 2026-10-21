"""G5 review images: each capture with the regions g5-judge.py measured drawn on it (titlebar magenta,
left-tabstrip green, root-tabstrip cyan), and a 4x crop of the top-left corner. Made from the captures only."""
import json, sys, glob
from pathlib import Path
from PIL import Image, ImageDraw
root, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(exist_ok=True)
for g in sorted(root.glob("*/measurements/*.g5.json")):
    rec = json.loads(g.read_text())
    im = Image.open(root / rec["image"]).convert("RGB")
    s = im.width / 1200
    d = ImageDraw.Draw(im)
    for k, c in (("titlebar", (255, 0, 255)), ("left-tabstrip", (0, 255, 0)), ("root-tabstrip", (0, 200, 255))):
        r = rec["regions"][k].get("rect")
        if r: d.rectangle([r[0] * s, r[1] * s, (r[0] + r[2]) * s, (r[1] + r[3]) * s], outline=c, width=2)
    name = Path(rec["image"]).stem
    im.save(out / f"{name}-regions.png")
    im.crop((0, 0, int(700 * s), int(80 * s))).resize((int(700 * s), int(80 * s))).save(out / f"{name}-top.png")
    print(name, {k: rec["regions"][k].get("rect") for k in ("titlebar", "left-tabstrip", "root-tabstrip")}, im.size)

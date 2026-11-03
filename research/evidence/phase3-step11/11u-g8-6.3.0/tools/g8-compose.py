"""Side-by-side images for G8: per theme and state, Inkdrop 6.3.0 on the left and Obsidian 1.14.5 on the right (each
cropped around the overlay with 24 px of margin, shown at 1x). usage: python3 g8-compose.py <out-dir> <review-dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
out, rev = Path(sys.argv[1]), Path(sys.argv[2]); rev.mkdir(parents=True, exist_ok=True)
CAP = 26
def cap(img, text):
    c = Image.new("RGB", (img.width, img.height + CAP), (24, 24, 24)); c.paste(img.convert("RGB"), (0, CAP))
    ImageDraw.Draw(c).text((8, 8), text, fill=(235, 235, 235)); return c
NAMES = {"sd": "Solarized Dark", "kd": "Kanagawa Dragon"}
for th in ("sd", "kd"):
    for st, crop in (("palette", True), ("menu", True), ("modal", True), ("notification", True), ("preferences", False)):
        suffix = "-crop" if crop else ""
        a = Image.open(out / f"inkdrop-{th}-{st}{suffix}.png"); b = Image.open(out / f"obsidian-{th}-{st}{suffix}.png")
        if not crop:
            a = a.resize((a.width * 700 // a.height, 700)) if a.height > 700 else a
        left, right = cap(a, f"Inkdrop 6.3.0 - {NAMES[th]} - {st}"), cap(b, f"Obsidian 1.14.5 - {NAMES[th]} - {st}")
        h = max(left.height, right.height)
        sheet = Image.new("RGB", (left.width + right.width + 8, h), (0, 0, 0)); sheet.paste(left, (0, 0)); sheet.paste(right, (left.width + 8, 0))
        sheet.save(rev / f"g8-{th}-{st}.png")
print(sorted(p.name for p in rev.glob("*.png")))

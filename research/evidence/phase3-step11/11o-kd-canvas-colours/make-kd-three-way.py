"""KD Canvas, three builds stacked (final / first trial / trial with colours 2 and 4 changed), nodes and groups enlarged 1.6x.
usage: python3 make-kd-three-way.py <final.png> <trial-v1.png> <trial-v2.png> <out.png>"""
import sys
from PIL import Image, ImageDraw
CAP = 28
labels = ["final build (current product CSS)", "trial 1 (shared Canvas palette variables)", "trial 2 (trial 1 + KD colours 2 and 4: autumn yellow, spring green)"]
parts = []
for path, label in zip(sys.argv[1:4], labels):
    im = Image.open(path).convert("RGB").crop((378, 325, 1170, 555))
    im = im.resize((int(im.width * 1.6), int(im.height * 1.6)), Image.LANCZOS)
    c = Image.new("RGB", (im.width, im.height + CAP), (24, 24, 24))
    c.paste(im, (0, CAP)); ImageDraw.Draw(c).text((8, 8), "Kanagawa Dragon - Canvas - " + label, fill=(235, 235, 235))
    parts.append(c)
sheet = Image.new("RGB", (parts[0].width, sum(p.height for p in parts) + 8 * 2), (0, 0, 0))
y = 0
for p in parts: sheet.paste(p, (0, y)); y += p.height + 8
sheet.save(sys.argv[4])

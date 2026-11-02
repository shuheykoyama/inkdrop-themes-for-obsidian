"""Side-by-side review images from the 20 shots of 11n-canvas-graph-trial (before = final build, after = trial build).
Pillow only; nothing is drawn but a caption strip per half. Output: ../11n-canvas-graph-trial/review/*.png
usage: python3 make-review-images.py <shots-dir> <out-dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

shots, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
CAP = 28

def captioned(img, text):
    canvas = Image.new("RGB", (img.width, img.height + CAP), (24, 24, 24))
    canvas.paste(img, (0, CAP))
    ImageDraw.Draw(canvas).text((8, 8), text, fill=(235, 235, 235))
    return canvas

def stack(images, vertical):
    w = max(i.width for i in images) if vertical else sum(i.width for i in images) + 8 * (len(images) - 1)
    h = sum(i.height for i in images) + 8 * (len(images) - 1) if vertical else max(i.height for i in images)
    sheet = Image.new("RGB", (w, h), (0, 0, 0))
    x = y = 0
    for i in images:
        sheet.paste(i, (x, y))
        if vertical: y += i.height + 8
        else: x += i.width + 8
    return sheet

for theme, name in (("solarized-dark", "Solarized Dark"), ("kanagawa-dragon", "Kanagawa Dragon")):
    # Canvas: the row of nodes and the groups, enlarged 1.6x, final build above trial build.
    halves = []
    for build in ("final", "trial"):
        im = Image.open(shots / f"{theme}-{build}-canvas-overview.png").convert("RGB").crop((378, 325, 1170, 555))
        halves.append(captioned(im.resize((int(im.width * 1.6), int(im.height * 1.6)), Image.LANCZOS), f"{name} - Canvas - {build} build ({'current product CSS' if build == 'final' else 'trial palette variables'})"))
    stack(halves, True).save(out / f"{theme}-canvas.png")
    # Graph: the graph pane, final build left, trial build right.
    halves = []
    for build in ("final", "trial"):
        im = Image.open(shots / f"{theme}-{build}-graph.png").convert("RGB").crop((772, 60, 1200, 800))
        halves.append(captioned(im, f"{name} - Graph - {build}"))
    stack(halves, False).save(out / f"{theme}-graph.png")
print("wrote", *sorted(p.name for p in out.glob("*.png")))

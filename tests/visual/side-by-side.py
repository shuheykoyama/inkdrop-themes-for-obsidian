"""Side-by-side sheets for visual review: an Inkdrop capture next to Obsidian captures (RV3, research/14 §6.13).

The sheets are for looking at structure, layering and decoration only. The two sides are different capture
methods (Inkdrop: CDP screenshot at 1x, V-30; Obsidian: native screencapture at 2x) and different notes,
so no colour is measured or compared here: colour values are checked by Computed Style (tests/runtime).
Pixels are copied unchanged except for the downscale of the 2x Obsidian crops to 1x (Lanczos).

usage: python3 -I tests/visual/side-by-side.py <out.png> <inkdrop.png> <x0,y0,x1,y1> <obsidian.png> <x0,y0,x1,y1> [<obsidian.png> <box> ...]
Boxes are in each image's own pixels. Requires Pillow.
"""
import sys

from PIL import Image, ImageDraw


def crop(path, box, scale):
    x0, y0, x1, y1 = (int(v) for v in box.split(","))
    im = Image.open(path).convert("RGB").crop((x0, y0, x1, y1))
    if scale != 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


def main():
    out, ink, ink_box, *rest = sys.argv[1:]
    left = crop(ink, ink_box, 1)
    # Obsidian captures are 2x (2400 px for a 1200 pt window): bring them to the Inkdrop capture's 1x.
    rights = [crop(rest[i], rest[i + 1], 0.5) for i in range(0, len(rest), 2)]
    label_h, gap = 22, 12
    right_w = max(r.width for r in rights)
    right_h = sum(r.height for r in rights) + gap * (len(rights) - 1)
    sheet = Image.new("RGB", (left.width + gap + right_w, label_h + max(left.height, right_h)), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((4, 4), "Inkdrop (V-30, CDP 1x): " + ink.rsplit("/", 1)[-1], fill="black")
    draw.text((left.width + gap + 4, 4), "Obsidian (native, 2x -> 1x): " + ", ".join(rest[i].rsplit("/", 1)[-1] for i in range(0, len(rest), 2)), fill="black")
    sheet.paste(left, (0, label_h))
    y = label_h
    for r in rights:
        sheet.paste(r, (left.width + gap, y))
        y += r.height + gap
    sheet.save(out)


if __name__ == "__main__":
    main()

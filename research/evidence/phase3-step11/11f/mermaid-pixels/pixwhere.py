import sys, glob
from PIL import Image
d, pre = sys.argv[1], sys.argv[2]
F = [Image.open(f).convert("RGBA") for f in sorted(glob.glob(f"{d}/{pre}-frozen-*.png"))]
R = [Image.open(f).convert("RGBA") for f in sorted(glob.glob(f"{d}/{pre}-reference-*.png"))]
w, h = F[0].size
fp = [im.load() for im in F]; rp = [im.load() for im in R]
for y in range(h):
    for x in range(w):
        a, b = fp[0][x, y], rp[0][x, y]
        if max(abs(a[i] - b[i]) for i in range(3)) > 0:
            fs = sorted({p[x, y][:3] for p in fp}); rs = sorted({p[x, y][:3] for p in rp})
            print((x, y), "frozen", fs, "reference", rs)

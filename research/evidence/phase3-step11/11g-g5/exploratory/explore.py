"""G5 post-hoc exploratory analysis (research/14 section 6.81). NOT a G5 judgement: the method is looked at
after the results were seen, so nothing here is a verification result.

Reads only the 8 G5 captures and their records (../after, ../before; their SHA-256 is checked against the
records first and nothing is written next to them) and writes exploratory.json and corner-*.png here.

A  the window corner: in each capture, per pixel row of the title bar, how far from the right edge the pixels
   are not the title bar's own colour (the macOS window outline, which the DOM does not show); the exclusion
   rule is derived from the opaque captures (exact colours) and applied unchanged to all 8, with a margin
   sensitivity sweep;
B  the spread of the pixels: per region, the per-channel sd split into the spread of row means (a vertical
   gradient), of column means (a horizontal gradient) and the residual (grain), the sd for tighter insets
   (edge mixing) and over 8 x 8 pt tiles (local unevenness);
C  CIEDE2000 between the title bar (corner excluded) and the left / centre tab strips, for 4 tiles of the
   title bar, for 3 vertical insets and for the margin sweep; after against before.
The colour difference and the decoding are those of tests/visual/sample-regions.py (its stats() is checked to
give the same means as numpy on every region).

usage: python3 -I explore.py   (from this folder)
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
G5 = HERE.parent
REPO = G5.parents[3]
spec = importlib.util.spec_from_file_location("sr", REPO / "tests" / "visual" / "sample-regions.py")
assert spec and spec.loader
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

COND = [(b, t, m) for b in ("after", "before") for t in ("solarized-dark", "kanagawa-dragon") for m in ("translucent", "opaque")]
MARGINS = [16, 24, 32, 48, 64]  # points cut from the right end of the title bar region (sweep)


def load(b, t, m):
    name = f"obsidian-{t}-{m}-gray-active-{b}"
    rec = json.loads((G5 / b / "measurements" / f"{name}.g5.json").read_text())
    img = G5 / rec["image"]
    assert hashlib.sha256(img.read_bytes()).hexdigest() == rec["imageSha256"], f"{img} changed"
    arr = np.asarray(Image.open(img).convert("RGB"), dtype=np.float64)
    return name, rec, arr, arr.shape[1] / 1200


def px(rect, s):
    x, y, w, h = rect
    return int(x * s), int(y * s), int(w * s), int(h * s)


def region(arr, rect, s):
    x, y, w, h = px(rect, s)
    return arr[y:y + h, x:x + w]


def spread(a):
    """Per-channel sd and its parts: row means, column means, residual."""
    sd = a.reshape(-1, 3).std(axis=0)
    rows = a.mean(axis=1)
    cols = a.mean(axis=0)
    resid = a - rows[:, None, :] - cols[None, :, :] + a.reshape(-1, 3).mean(axis=0)
    return {"sd": sd.round(3).tolist(), "rowMeansSd": rows.std(axis=0).round(3).tolist(), "colMeansSd": cols.std(axis=0).round(3).tolist(), "residualSd": resid.reshape(-1, 3).std(axis=0).round(3).tolist()}


def de(a, b):
    return round(sr.de2000(list(a), list(b)), 3)


def main():
    out = {"note": "post-hoc exploratory analysis, not a G5 judgement (research/14 section 6.81)", "images": {}}
    data = {c: load(*c) for c in COND}
    # Cross-check: sample-regions.py's stats() gives the same means as numpy for the judged regions.
    for c, (name, rec, arr, s) in data.items():
        w, h, ch, rows = sr.read_png(str(G5 / rec["image"]))
        for k in ("titlebar", "left-tabstrip"):
            m1, _ = sr.stats(rows, ch, *px(rec["regions"][k]["rect"], s))
            m2 = region(arr, rec["regions"][k]["rect"], s).reshape(-1, 3).mean(axis=0)
            assert np.allclose(m1, m2, atol=1e-6), (name, k, m1, m2)
    # A: the corner. Per pixel row of the judged title bar band, the run of pixels from the right edge whose
    # colour is not the band's own (median of its left half), in points.
    corner = {}
    for c, (name, rec, arr, s) in data.items():
        x, y, w, h = rec["regions"]["titlebar"]["rect"]
        ref = np.median(region(arr, [x, y, w / 2, h], s).reshape(-1, 3), axis=0)
        tol = 1.5 if c[2] == "opaque" else 6.0
        prof = []
        for yy in range(int(y * s), int((y + h) * s)):
            row = arr[yy, :, :]
            off = np.abs(row - ref).max(axis=1) > tol
            n = 0
            for xx in range(row.shape[0] - 1, -1, -1):
                if not off[xx]:
                    break
                n += 1
            prof.append(round(n / s, 2))
        corner[name] = {"maxPoints": max(prof), "byRowPoints": prof}
    opaque_max = max(v["maxPoints"] for k, v in corner.items() if "-opaque-" in k)
    rule = int(np.ceil(opaque_max)) + 2  # the outline measured on the opaque captures, plus 2 pt
    out["corner"] = {"perImage": corner, "opaqueMaxPoints": opaque_max, "rulePoints": rule,
                     "rule": f"cut {rule} pt from the right end of the title bar region (the widest run of non-title-bar pixels at the right edge in any row of the band on the opaque captures, {opaque_max} pt, plus 2 pt), the same for all 8 captures"}
    # Corner pictures: the right end of the band, 8x, with the cut line.
    for c, (name, rec, arr, s) in data.items():
        x, y, w, h = rec["regions"]["titlebar"]["rect"]
        crop = Image.fromarray(arr[0:int(32 * s), int((1200 - 64) * s):int(1200 * s)].astype(np.uint8)).resize((int(64 * s) * 4, int(32 * s) * 4), Image.Resampling.NEAREST)
        from PIL import ImageDraw
        d = ImageDraw.Draw(crop)
        cut = (1200 - (1200 - (x + w)) - rule - (1200 - 64)) * s * 4
        d.line([(cut, 0), (cut, crop.height)], fill=(255, 0, 255), width=2)
        d.rectangle([((x - (1200 - 64)) * s * 4), y * s * 4, (x + w - (1200 - 64)) * s * 4, (y + h) * s * 4], outline=(0, 255, 0), width=2)
        crop.save(HERE / f"corner-{name}.png")
    # B and C per image.
    for c, (name, rec, arr, s) in data.items():
        x, y, w, h = rec["regions"]["titlebar"]["rect"]
        tb = [x, y, w - rule, h]
        lt = rec["regions"]["left-tabstrip"]["rect"]
        rt = rec["regions"]["root-tabstrip"]["rect"]
        R = {k: region(arr, r, s) for k, r in (("titlebar-cut", tb), ("left-tabstrip", lt), ("root-tabstrip", rt))}
        mean = {k: a.reshape(-1, 3).mean(axis=0) for k, a in R.items()}
        res = {"means": {k: v.round(2).tolist() for k, v in mean.items()}, "spread": {k: spread(a) for k, a in R.items()}}
        # Tighter insets (edge mixing would fall away).
        res["insetSd"] = {}
        for k, r in (("titlebar-cut", tb), ("left-tabstrip", lt), ("root-tabstrip", rt)):
            res["insetSd"][k] = {str(i): region(arr, [r[0] + i, r[1] + i, r[2] - 2 * i, r[3] - 2 * i], s).reshape(-1, 3).std(axis=0).max().round(3) for i in (0, 2, 4, 6)}
        # 8 x 8 pt tiles of the title bar band: their means and sds (local unevenness).
        tiles = []
        for tx in np.arange(tb[0], tb[0] + tb[2] - 8, 8):
            for ty in np.arange(tb[1], tb[1] + tb[3] - 8 + 0.01, 8):
                a = region(arr, [tx, ty, 8, 8], s).reshape(-1, 3)
                tiles.append((a.mean(axis=0), a.std(axis=0).max()))
        tm = np.array([t[0] for t in tiles])
        res["tiles8pt"] = {"n": len(tiles), "maxTileSd": round(max(t[1] for t in tiles), 3), "tileMeanRange": (tm.max(axis=0) - tm.min(axis=0)).round(2).tolist()}
        # C: colour differences.
        res["dE2000"] = {"titlebar-cut vs left-tabstrip": de(mean["titlebar-cut"], mean["left-tabstrip"]), "titlebar-cut vs root-tabstrip": de(mean["titlebar-cut"], mean["root-tabstrip"]), "left vs root tabstrip": de(mean["left-tabstrip"], mean["root-tabstrip"])}
        quarter = tb[2] / 4
        res["dE2000 by quarter of the title bar (vs left)"] = [de(region(arr, [tb[0] + i * quarter, tb[1], quarter, tb[3]], s).reshape(-1, 3).mean(axis=0), mean["left-tabstrip"]) for i in range(4)]
        res["dE2000 by vertical inset (vs left)"] = {str(i): de(region(arr, [tb[0], tb[1] + i, tb[2], tb[3] - 2 * i], s).reshape(-1, 3).mean(axis=0), mean["left-tabstrip"]) for i in (0, 3, 6)}
        res["margin sweep (vs left)"] = {}
        for mg in MARGINS:
            a = region(arr, [x, y, w - mg, h], s).reshape(-1, 3)
            res["margin sweep (vs left)"][str(mg)] = {"maxSd": round(a.std(axis=0).max(), 3), "dE2000": de(a.mean(axis=0), mean["left-tabstrip"])}
        out["images"][name] = res
    (HERE / "exploratory.json").write_text(json.dumps(out, indent=1, default=float) + "\n")
    print(f"corner rule: {out['corner']['rule']}")
    for name, r in out["images"].items():
        sp = r["spread"]["titlebar-cut"]
        print(f"{name:52} tb-cut sd {max(sp['sd']):.2f} (rows {max(sp['rowMeansSd']):.2f}, cols {max(sp['colMeansSd']):.2f}, grain {max(sp['residualSd']):.2f}) "
              f"left sd {max(r['spread']['left-tabstrip']['sd']):.2f} root sd {max(r['spread']['root-tabstrip']['sd']):.2f} | dE vs left {r['dE2000']['titlebar-cut vs left-tabstrip']} vs root {r['dE2000']['titlebar-cut vs root-tabstrip']} left/root {r['dE2000']['left vs root tabstrip']}")


if __name__ == "__main__":
    main()

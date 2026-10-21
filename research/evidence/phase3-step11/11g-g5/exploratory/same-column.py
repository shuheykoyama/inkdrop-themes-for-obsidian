"""Exploratory only (research/14 section 6.81): the title bar against the centre tab strip directly below it,
over the same columns (x 722..906 pt: the judged title bar band starts at 722, the judged centre tab strip region
ends at 906), so a horizontal change of the window material is in both. Per 8 pt column pair and over the whole
span. Not a judgement.  usage: python3 -I same-column.py > same-column.txt   (from this folder)"""
import importlib.util, json
from pathlib import Path
import numpy as np
from PIL import Image
G5 = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sr", G5.parents[3] / "tests" / "visual" / "sample-regions.py")
assert spec and spec.loader
sr = importlib.util.module_from_spec(spec); spec.loader.exec_module(sr)
print("Exploratory only (research/14 section 6.81): title bar y 4..26 pt against the centre tab strip y 38..62 pt, same columns x 722..906 pt")
for b in ("after", "before"):
    for t in ("solarized-dark", "kanagawa-dragon"):
        for m in ("translucent", "opaque"):
            name = f"obsidian-{t}-{m}-gray-active-{b}"
            rec = json.loads((G5 / b / "measurements" / f"{name}.g5.json").read_text())
            a = np.asarray(Image.open(G5 / rec["image"]).convert("RGB"), dtype=float); s = a.shape[1] / 1200
            reg = lambda x, y, w, h: a[int(y*s):int((y+h)*s), int(x*s):int((x+w)*s)].reshape(-1, 3)
            whole = sr.de2000(list(reg(722, 4, 184, 22).mean(axis=0)), list(reg(722, 38, 184, 24).mean(axis=0)))
            cols = [sr.de2000(list(reg(x, 4, 8, 22).mean(axis=0)), list(reg(x, 38, 8, 24).mean(axis=0))) for x in range(722, 898, 8)]
            tsd = [reg(x, 4, 8, 22).std(axis=0).max() for x in range(722, 898, 8)]
            print(f"{name:55} whole dE {whole:.3f} | per 8 pt column: min {min(cols):.3f} max {max(cols):.3f} | max sd within a title bar column {max(tsd):.2f}")

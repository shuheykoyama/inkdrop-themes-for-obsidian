"""Exploratory only (research/14 section 6.81): the title bar band right of the ramp (x >= 880 pt, corner cut
9 pt) against the tab strips, and the column profile of the judged band every 20 pt. Not a judgement.
usage: python3 -I ramp.py > ramp.txt   (from this folder)"""
import importlib.util, json
from pathlib import Path
import numpy as np
from PIL import Image
G5 = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sr", G5.parents[3] / "tests" / "visual" / "sample-regions.py")
assert spec and spec.loader
sr = importlib.util.module_from_spec(spec); spec.loader.exec_module(sr)
print("Exploratory only (research/14 section 6.81): title bar x 880..1191 pt, y 4..26 pt (right of the ramp, corner cut 9 pt); profile of the judged band (y 4..26) every 20 pt, mean of R+G+B / 3")
for b in ("after", "before"):
    for t in ("solarized-dark", "kanagawa-dragon"):
        for m in ("translucent", "opaque"):
            name = f"obsidian-{t}-{m}-gray-active-{b}"
            rec = json.loads((G5 / b / "measurements" / f"{name}.g5.json").read_text())
            a = np.asarray(Image.open(G5 / rec["image"]).convert("RGB"), dtype=float); s = a.shape[1] / 1200
            reg = lambda x, y, w, h: a[int(y*s):int((y+h)*s), int(x*s):int((x+w)*s)].reshape(-1, 3)
            tb = reg(880, 4, 1191 - 880, 22); lt = reg(*rec["regions"]["left-tabstrip"]["rect"]); rt = reg(*rec["regions"]["root-tabstrip"]["rect"])
            prof = [round(float(reg(x, 4, 20, 22).mean()), 1) for x in range(722, 1180, 20)]
            print(f"{name:55} sd {tb.std(axis=0).max():.2f} dE vs left {sr.de2000(list(tb.mean(axis=0)), list(lt.mean(axis=0))):.3f} vs root {sr.de2000(list(tb.mean(axis=0)), list(rt.mean(axis=0))):.3f}")
            print(f"   profile x 722..1162: {prof}")

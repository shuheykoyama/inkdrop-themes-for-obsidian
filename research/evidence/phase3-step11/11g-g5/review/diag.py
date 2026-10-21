"""Diagnosis only (not a G5 judgement): per-channel sd and mean of parts of the measured title bar region, with
tests/visual/sample-regions.py's own functions, to see where the flatness fails."""
import importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("sr", sys.argv[2]); sr = importlib.util.module_from_spec(spec); spec.loader.exec_module(sr)
root = Path(sys.argv[1])
parts = {"titlebar (as judged)": [722.38, 4, 473.62, 22], "titlebar without the right 24 pt": [722.38, 4, 449.62, 22], "right 24 pt (window corner)": [1172, 4, 24, 22], "left-tabstrip": [140, 34, 160, 32], "root-tabstrip": [544, 34, 362, 32]}
for g in sorted(root.glob("*/measurements/*.g5.json")):
    rec = json.loads(g.read_text()); w, h, ch, rows = sr.read_png(str(root / rec["image"])); s = w / 1200
    vals = {k: sr.stats(rows, ch, int(x * s), int(y * s), int(ww * s), int(hh * s)) for k, (x, y, ww, hh) in parts.items()}
    tb = vals["titlebar without the right 24 pt"][0]
    print(Path(rec["image"]).stem)
    for k, (m, sd) in vals.items():
        extra = f" dE2000 vs that titlebar part {sr.de2000(tb, m):.3f}" if "tabstrip" in k else ""
        print(f"   {k:34} mean ({m[0]:.1f}, {m[1]:.1f}, {m[2]:.1f}) max sd {max(sd):.2f}{extra}")

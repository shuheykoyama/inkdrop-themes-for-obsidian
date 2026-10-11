"""V-38: compare same-session native captures of Inkdrop and Obsidian surface by surface (research/14 §6.6).

Both CSVs come from tests/visual/sample-regions.py (configs v38-inkdrop.json / v38-obsidian.json), i.e. the
same capture method, PNG decoder and statistics for both apps. The surfaces are paired by Q-D1:
Inkdrop sidebar <-> Obsidian ribbon; Inkdrop note list <-> dock bodies, vault profile and tab strips;
Inkdrop editor <-> centre editor. A pair passes when both regions are flat (max channel sd <= max_sd) and
CIEDE2000 <= the limit (1.0 by default, research/14 工程 4; not to be relaxed here).

usage: python3 -I tests/visual/v38-compare.py <inkdrop.csv> <obsidian.csv> <out.csv> <suffix> [--limit 1.0] [--max-sd 1.0]
  suffix: the part after the theme in both file names, e.g. "gray-active" for
          inkdrop-<theme>-acrylic-gray-active.png and obsidian-<theme>-translucent-gray-active.png
Exit status 1 if any pair fails or a region is missing / not flat.
"""
import argparse
import csv
import importlib.util
import sys
from pathlib import Path

# The colour-difference functions of the sampler (copied unchanged from V-04), loaded from the same file.
spec = importlib.util.spec_from_file_location("sample_regions", Path(__file__).with_name("sample-regions.py"))
assert spec is not None and spec.loader is not None, "tests/visual/sample-regions.py not found"
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

PAIRS = [  # (Inkdrop region, Obsidian region)
    ("sidebar", "ribbon"),
    ("note-list", "left-dock"), ("note-list", "right-dock"), ("note-list", "vault-profile"),
    ("note-list", "left-tabstrip"), ("note-list", "root-tabstrip"),
    ("editor", "editor"),
]
THEMES = ["solarized-dark", "kanagawa-dragon"]

ap = argparse.ArgumentParser()
ap.add_argument("inkdrop_csv"); ap.add_argument("obsidian_csv"); ap.add_argument("out_csv"); ap.add_argument("suffix")
ap.add_argument("--limit", type=float, default=1.0); ap.add_argument("--max-sd", type=float, default=1.0)
a = ap.parse_args()


def load(path):
    rows = {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        rows[(r["image"], r["region"])] = ([float(r["mean_r"]), float(r["mean_g"]), float(r["mean_b"])],
                                           max(float(r["sd_r"]), float(r["sd_g"]), float(r["sd_b"])))
    return rows


ink, obs = load(a.inkdrop_csv), load(a.obsidian_csv)
out, bad = [], 0
for theme in THEMES:
    for ink_region, obs_region in PAIRS:
        i = ink.get((f"inkdrop-{theme}-acrylic-{a.suffix}.png", ink_region))
        o = obs.get((f"obsidian-{theme}-translucent-{a.suffix}.png", obs_region))
        if not i or not o:
            verdict, de = "FAIL (region missing)", None
        elif i[1] > a.max_sd or o[1] > a.max_sd:
            verdict, de = "FAIL (not flat: measurement invalid)", sr.de2000(i[0], o[0])
        else:
            de = sr.de2000(i[0], o[0])
            verdict = "PASS" if de <= a.limit else "FAIL"
        bad += verdict != "PASS"
        out.append([theme, a.suffix, ink_region, i[0] if i else "", i[1] if i else "", obs_region, o[0] if o else "", o[1] if o else "",
                    round(de, 2) if de is not None else "", a.limit, verdict])
with open(a.out_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["theme", "capture", "inkdrop_region", "inkdrop_mean_rgb", "inkdrop_max_sd", "obsidian_region", "obsidian_mean_rgb",
                "obsidian_max_sd", "dE2000", "limit", "result"])
    w.writerows(out)
for r in out:
    print(f"{r[0]:16} {r[2]:10} {str(r[3]):24} {r[5]:14} {str(r[6]):24} dE2000={r[8]:<5} {r[10]}")
sys.exit(1 if bad else 0)

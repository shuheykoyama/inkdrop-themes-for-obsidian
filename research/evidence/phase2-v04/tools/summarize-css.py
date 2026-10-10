"""V-04: tabulate the computed backgrounds of every probed layer across diagnostic CSS cases.

usage: python3 -I summarize-css.py <out_csv> <measurements/css-*.json> ...
Values are Computed Style (CSS), not screen pixels.
"""
import csv
import json
import sys
from pathlib import Path

rows = []
files = sys.argv[2:]
data = {Path(f).stem.removeprefix("css-"): json.load(open(f, encoding="utf-8")) for f in files}
layers = list(next(iter(data.values()))["layers"].keys())
for layer in layers:
    row = {"layer": layer, "selector": next(iter(data.values()))["layers"][layer]["selector"]}
    for name, d in data.items():
        row[name] = d["layers"].get(layer, {}).get("backgroundColor")
    rows.append(row)
with open(sys.argv[1], "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=["layer", "selector", *data.keys()], lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
for r in rows:
    print(f"{r['layer']:34}", " | ".join(f"{k}={r[k]}" for k in data))

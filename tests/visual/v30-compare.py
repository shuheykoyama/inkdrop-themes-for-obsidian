"""Step 11D: compare the Inkdrop V-30 captures with Obsidian captures made the same way (CDP, 1024x800, scale 1),
flat region against flat region (research/14 §3.7, §6.30.3 11D).

Both images of a pair come from Page.captureScreenshot, so they are compared directly; a native capture is
never compared with a CDP one. Each pair of tests/visual/configs/v30-compare.json names a background-only
rectangle in an Inkdrop state and in an Obsidian state. The PNG decoder, statistics and CIEDE2000 are those of
tests/visual/sample-regions.py (copied unchanged from V-04).

Verdicts:
  PASS            both regions flat (max channel sd <= max_sd) and CIEDE2000 <= limit
  FAIL            expect "same" and the colours differ (a new difference: investigate it, research/14 11D)
  FAIL (not flat) a region holds text, a border or anti-aliasing: the measurement is invalid, never a pass
  DIFF (decided)  expect "decided" and the colours differ: a recorded decision, reported with its source
  FAIL (decided pair agrees) expect "decided" but no difference: the decision record no longer matches the theme

usage: python3 -I tests/visual/v30-compare.py <inkdrop_dir> <obsidian_screenshots_dir> <out.csv> [--config <cfg.json>]
Exit status 1 if any pair FAILs or an image is missing.
"""
import argparse
import csv
import importlib.util
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("sample_regions", here / "sample-regions.py")
assert spec is not None and spec.loader is not None, "tests/visual/sample-regions.py not found"
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

ap = argparse.ArgumentParser()
ap.add_argument("inkdrop_dir"); ap.add_argument("obsidian_dir"); ap.add_argument("out_csv")
ap.add_argument("--config", default=str(here / "configs" / "v30-compare.json"))
a = ap.parse_args()
cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
limit, max_sd = cfg["limit_de2000"], cfg["max_sd"]

images = {}


def measure(path, rect):
    # Mean colour and the largest per-channel standard deviation of a rectangle (image px = CSS px at scale 1).
    if path not in images:
        if not path.exists():
            return None
        images[path] = sr.read_png(path)
    width, height, channels, rows = images[path]
    assert (width, height) == (1024, 800), f"{path.name} is {width}x{height}, not the V-30 1024x800"
    mean, sd = sr.stats(rows, channels, *rect)
    return [round(m, 1) for m in mean], round(max(sd), 2)


out, failed = [], 0
for theme, short in cfg["themes"].items():
    for p in cfg["pairs"]:
        ink_state, ink_rect = p["inkdrop"]
        obs_state, obs_rect = p["obsidian"]
        ink_img = Path(a.inkdrop_dir) / f"{short}-{cfg['inkdrop_states'][ink_state]}.png"
        obs_img = Path(a.obsidian_dir) / f"obsidian-{theme}-{obs_state}.png"
        i, o = measure(ink_img, ink_rect), measure(obs_img, obs_rect)
        de = None
        if i is None or o is None:
            verdict = "FAIL (image missing)"
        else:
            de = round(sr.de2000(i[0], o[0]), 2)
            if i[1] > max_sd or o[1] > max_sd:
                verdict = "FAIL (not flat: measurement invalid)"
            elif p["expect"] == "same":
                verdict = "PASS" if de <= limit else "FAIL"
            else:
                verdict = "DIFF (decided)" if de > limit else "FAIL (decided pair agrees)"
        failed += verdict.startswith("FAIL")
        out.append([theme, p["id"], ink_img.name, ink_rect, i[0] if i else "", i[1] if i else "", obs_img.name, obs_rect,
                    o[0] if o else "", o[1] if o else "", de if de is not None else "", limit, verdict,
                    p.get("decision", ""), p["basis"]])

with open(a.out_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["theme", "pair", "inkdrop_image", "inkdrop_rect", "inkdrop_mean_rgb", "inkdrop_max_sd", "obsidian_image",
                "obsidian_rect", "obsidian_mean_rgb", "obsidian_max_sd", "dE2000", "limit", "result", "decision", "basis"])
    w.writerows(out)
for r in out:
    print(f"{r[0]:16} {r[1]:42} {str(r[4]):20} {str(r[8]):20} dE2000={str(r[10]):5} {r[12]}")
print(f"\n{len(out)} pairs: " + ", ".join(f"{n} {v}" for v, n in sorted({r[12]: sum(x[12] == r[12] for x in out) for r in out}.items())))
sys.exit(1 if failed else 0)

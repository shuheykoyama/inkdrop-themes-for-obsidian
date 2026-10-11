"""Same-token check for the step-4 native captures (research/14 §6.4).

The V-04 diagnostic stylesheet (research/evidence/phase2-v04/diagnostic-css/case-D-*.css) painted the same
Inkdrop acrylic declarations as the theme, on a different region mapping (left dock = sidebar, right dock =
note list). Captured on the same day under the same conditions, a region painted with the same token must
give the same pixels in both. This separates a theme problem (pixels differ) from a change of the capture
environment (both differ from the V-04 / V-32 numbers of 2026-10-10 in the same way).

usage: python3 -I tests/visual/same-token-check.py <theme_samples.csv> <v04_baseline_samples.csv> <out.csv> <focus>
  theme_samples.csv: tests/visual/sample-regions.py output for obsidian-<theme>-translucent-gray-<focus>.png
  v04_baseline_samples.csv: the same for obsidian-v04-case-D-<sd|kd>-translucent-gray-<focus>.png (V-04 regions)
Exit status 1 if any pair differs by more than 1 (8-bit) in a channel.
"""
import csv
import sys

# token: (region in the theme capture, region in the V-04 case-D capture)
PAIRS = {
    "--ink-sidebar-background-acrylic": ("ribbon", "left-dock"),
    "--ink-note-list-bar-background-acrylic": ("right-dock", "right-dock"),
    "--ink-editor-background-acrylic": ("editor", "editor"),
}
THEMES = {"solarized-dark": "sd", "kanagawa-dragon": "kd"}


def load(path):
    return {(r["image"], r["region"]): [float(r["mean_r"]), float(r["mean_g"]), float(r["mean_b"])]
            for r in csv.DictReader(open(path, encoding="utf-8"))}


theme_csv, base_csv, out_csv, focus = sys.argv[1:5]
ours, base = load(theme_csv), load(base_csv)
rows, bad = [], 0
for theme, short in THEMES.items():
    for token, (region, base_region) in PAIRS.items():
        a = ours.get((f"obsidian-{theme}-translucent-gray-{focus}.png", region))
        b = base.get((f"obsidian-v04-case-D-{short}-translucent-gray-{focus}.png", base_region))
        diff = max(abs(x - y) for x, y in zip(a, b)) if a and b else None
        ok = diff is not None and diff <= 1
        bad += not ok
        rows.append([theme, focus, token, region, a, base_region, b, diff, "PASS" if ok else "FAIL"])
with open(out_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["theme", "focus", "token", "theme_region", "theme_mean_rgb", "v04_case_d_region", "v04_case_d_mean_rgb", "max_channel_diff", "result"])
    w.writerows(rows)
for r in rows:
    print(" ".join(str(x) for x in r))
sys.exit(1 if bad else 0)

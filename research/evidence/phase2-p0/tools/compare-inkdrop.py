"""Compare Inkdrop runtime computed styles (Phase 2B) with the static predictions of Phase 1 (02 CSVs).

usage: python3 -I compare-inkdrop.py <research_dir> <out_csv>

For each theme and region it reads the measured computed colour from
evidence/phase2-p0/measurements/inkdrop-<id>-<state>.json and the declared token value from
data/inkdrop-<theme>-tokens.csv, converts both to RGBA and reports MATCH / DIFF.
"""
import colorsys
import csv
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
out_csv = Path(sys.argv[2])
meas = root / "evidence" / "phase2-p0" / "measurements"

# (region label, measurement file state, element key in the probe output, CSS property, token)
CHECKS = [
    ("page", "1-default", "app-container (page)", "backgroundColor", "--page-background"),
    ("sidebar", "1-default", "sidebar", "backgroundColor", "--sidebar-background"),
    ("sidebar right border", "1-default", "sidebar", "borderRight", "--sidebar-border-right"),
    ("note list", "1-default", "note-list", "backgroundColor", "--note-list-bar-background"),
    ("note list right border", "1-default", "note-list", "borderRight", "--note-list-bar-border-right"),
    ("editor (outer)", "1-default", "editor-layout", "backgroundColor", "--editor-background"),
    ("editor (CodeMirror)", "1-default", "cm-editor", "backgroundColor", "--editor-background-color"),
    ("editor text", "1-default", "cm-editor", "color", "--editor-foreground-color"),
    ("note menu bar", "1-default", "editor-title-bar", "backgroundColor", "--header-note-menu-background"),
    ("sidebar selected row fill", "1-default", "sidebar item (active)", "backgroundColor", "--sidebar-menu-item-inactive-background"),
    ("note list selected item fill", "1-default", "note-list item (active)", "backgroundColor", "--note-list-view-item-selected-background"),
    ("note list focus bar", "2-notelist-focus", "note-list item (active)", "boxShadow", "--note-list-view-item-active-background"),
    ("active line", "4-editor-selection", "cm-activeLine", "backgroundColor", "--editor-active-line-background-color"),
    ("gutter text", "4-editor-selection", "cm-gutters", "color", "--editor-gutter-color"),
    ("gutter right border", "4-editor-selection", "cm-gutters", "borderRight", "--editor-gutter-border-right"),
    ("selection (focused)", "4-editor-selection", "cm-selectionBackground", "backgroundColor", "--editor-focused-selection-background"),
    ("preview background", "5-preview", "preview", "backgroundColor", None),
]
THEMES = {"sd": "solarized-dark", "kd": "kanagawa-dragon"}


def to_rgba(text):
    """Parse the first colour in a CSS value (rgb/rgba/hsl/#hex/transparent) into an (r,g,b,a) tuple."""
    if text is None:
        return None
    t = text.strip()
    if "transparent" in t and not re.search(r"rgb|hsl|#", t):
        return (0, 0, 0, 0.0)
    m = re.search(r"rgba?\(([^)]*)\)", t)
    if m:
        parts = [p for p in re.split(r"[\s,/]+", m.group(1)) if p]
        r, g, b = (float(x) for x in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (round(r), round(g), round(b), round(a, 3))
    m = re.search(r"hsla?\(([^)]*)\)", t)
    if m:
        parts = [p for p in re.split(r"[\s,/]+", m.group(1)) if p]
        h = float(parts[0].replace("deg", "")) / 360
        s = float(parts[1].rstrip("%")) / 100
        l = float(parts[2].rstrip("%")) / 100
        a = parts[3] if len(parts) > 3 else "1"
        a = float(a.rstrip("%")) / 100 if a.endswith("%") else float(a)
        r, g, b = colorsys.hls_to_rgb(h, l, s)  # note: colorsys takes (h, l, s)
        return (round(r * 255), round(g * 255), round(b * 255), round(a, 3))
    m = re.search(r"#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b", t)
    if m:
        hx = m.group(1)
        r, g, b = (int(hx[i:i + 2], 16) for i in (0, 2, 4))
        a = int(hx[6:8], 16) / 255 if len(hx) == 8 else 1.0
        return (r, g, b, round(a, 3))
    if t in ("none", ""):
        return None
    return None


def close(a, b):
    # Equal within 1/255 per channel and 0.01 alpha (hex alpha rounding).
    return a is not None and b is not None and all(abs(x - y) <= 1 for x, y in zip(a[:3], b[:3])) and abs(a[3] - b[3]) <= 0.01


rows = []
for tid, tname in THEMES.items():
    tokens = {r["token"]: r for r in csv.DictReader(open(root / "data" / f"inkdrop-{tname}-tokens.csv", encoding="utf-8"))}
    for label, state, key, prop, token in CHECKS:
        m = json.load(open(meas / f"inkdrop-{tid}-{state}.json", encoding="utf-8"))
        el = m.get(key, {})
        measured = el.get(prop) if el.get("found") else None
        declared = tokens[token]["resolved_value"] if token and token in tokens else None
        mr, dr = to_rgba(measured), to_rgba(declared)
        if measured is None:
            verdict = "NOT FOUND"
        elif token is None:
            verdict = "INFO"
        elif dr is None and mr == (0, 0, 0, 0.0) and (declared or "").strip() in ("none", "transparent"):
            verdict = "MATCH"
        elif prop.startswith("border") and (declared or "").strip() == "none" and measured.startswith("0px"):
            # A border declared as "none" computes to a zero-width border; the colour part is irrelevant.
            verdict = "MATCH"
        else:
            verdict = "MATCH" if close(mr, dr) else "DIFF"
        rows.append([tname, label, f"{key} / {prop}", token or "", declared or "", measured or "", verdict])

with open(out_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["theme", "region", "element / property", "token", "declared (02, resolved)", "computed (runtime)", "verdict"])
    w.writerows(rows)
for r in rows:
    print(f"{r[0][:3]} {r[1]:30} {r[6]:9} declared={r[4][:34]:34} computed={r[5][:48]}")

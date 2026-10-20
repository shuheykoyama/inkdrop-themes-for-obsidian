"""Step 11G G5 judgement (research/14 section 6.73) of the 8 native captures of tests/visual/g5-capture.mjs.

Per capture, from its <name>.g5.json (written right after the capture) the sampling regions are checked first:
the frame is custom, the window is 1200 x 700 points at the capture rectangle (400, 250), the capture was taken
focused, the recorded translucency is an explicit true / false matching the capture, the computed title bar is
the expected one, the image's SHA-256 is the recorded one, and the title bar and left tab strip regions are
present, big enough, inside the window and over the element itself (not over a child that paints). Then
tests/visual/sample-regions.py measures the image (regions in window points, max sd 1.0, pair titlebar |
left-tabstrip with CIEDE2000 <= 1.0) and this script reads its CSV:
  - after,  translucent: CIEDE2000 <= 1.0 -> PASS, else FAIL;
  - before, translucent: CIEDE2000 >  1.0 -> the negative control holds; else the method cannot tell the fix
    apart and the whole G5 is INVALID;
  - opaque (both builds): reference only, reported.
A region that is not flat, a missing or unchecked capture makes the result INVALID (never a PASS). The limits
are V-38's and are not relaxed here.

usage: python3 -I tests/visual/g5-judge.py <capture out dir> --out <judgement.json>
Exit status 0 only when the result is PASS.
"""
import argparse
import csv
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("sample_regions", HERE / "sample-regions.py")
assert spec and spec.loader
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

MAX_SD, MAX_DE = 1.0, 1.0
WINDOW = (1200, 700)
CAPTURE_RECT = (400, 250, 1200, 700)  # screencapture -R of capture-obsidian.sh, points
CONDITIONS = [(b, t, m) for b in ("after", "before") for t in ("solarized-dark", "kanagawa-dragon") for m in ("translucent", "opaque")]


def check(rec, root):
    """Problems of one capture record (empty: usable)."""
    p = []
    w = rec.get("window") or {}
    if rec.get("frame") != "custom":
        p.append(f"frame is {rec.get('frame')!r}, not custom")
    if (w.get("innerWidth"), w.get("innerHeight")) != WINDOW:
        p.append(f"window is {w.get('innerWidth')} x {w.get('innerHeight')}, not 1200 x 700")
    if rec.get("focusedAfterShot") is not True:
        p.append("the window was not focused at the capture")
    # The recorded state must be an explicit true (translucent) or false (opaque); missing, null or a string is
    # not the state of the capture.
    tr = rec.get("translucent")
    if not isinstance(tr, bool) or tr != (rec.get("mode") == "translucent"):
        p.append(f"translucent is {tr!r} for a {rec.get('mode')} capture (true or false required)")
    b = w.get("bounds") or {}
    if (b.get("x"), b.get("y"), b.get("width"), b.get("height")) != CAPTURE_RECT:
        p.append(f"window bounds {b} are not the capture rectangle {CAPTURE_RECT}")
    tb = (rec.get("regions") or {}).get("titlebar") or {}
    if tb.get("background") != rec.get("expectedTitlebar"):
        p.append(f"computed title bar {tb.get('background')} is not {rec.get('expectedTitlebar')}")
    img = root / rec.get("image", "")
    if not img.is_file():
        p.append("image missing")
    elif hashlib.sha256(img.read_bytes()).hexdigest() != rec.get("imageSha256"):
        p.append("image differs from the recorded SHA-256")
    for name in ("titlebar", "left-tabstrip"):
        r = (rec.get("regions") or {}).get(name) or {}
        x = r.get("rect")
        if not x:
            p.append(f"{name}: no region")
            continue
        if not r.get("bigEnough"):
            p.append(f"{name}: region {x} too small")
        if x[0] < 0 or x[1] < 0 or x[0] + x[2] > WINDOW[0] or x[1] + x[3] > WINDOW[1]:
            p.append(f"{name}: region {x} outside the window")
        if not (r.get("centre") or {}).get("inside"):
            p.append(f"{name}: the region's centre is not over the element ({r.get('centre')})")
    return p


def measure(rec, root, work):
    """sample-regions.py on the capture with its own regions; returns ({region: (mean, sd)}, problems)."""
    regs = {k: v["rect"] for k, v in rec["regions"].items() if v.get("rect")}
    cfg = {"_comment": "G5: generated from the capture's own g5-regions.js output", "window_width_points": WINDOW[0], "regions": regs, "max_sd": MAX_SD,
           "pairs": [{"a": "titlebar", "b": "left-tabstrip", "max_de2000": MAX_DE}]}
    stem = Path(rec["image"]).stem
    c, o = work / f"{stem}.config.json", work / f"{stem}.csv"
    c.write_text(json.dumps(cfg, indent=1))
    subprocess.run([sys.executable, "-I", str(HERE / "sample-regions.py"), "--config", str(c), "--out", str(o), str(root / rec["image"])], capture_output=True, text=True)
    if not o.is_file():
        return {}, ["sample-regions.py wrote no CSV"]
    vals = {}
    for row in csv.DictReader(o.open()):
        vals[row["region"]] = ([float(row[k]) for k in ("mean_r", "mean_g", "mean_b")], [float(row[k]) for k in ("sd_r", "sd_g", "sd_b")])
    return vals, [f"{k} not flat (sd {max(sd)} > {MAX_SD})" for k, (_, sd) in vals.items() if k in ("titlebar", "left-tabstrip") and max(sd) > MAX_SD]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("captures")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    root = Path(a.captures)
    work = root / "judge"
    work.mkdir(exist_ok=True)
    results, invalid, failed = [], [], []
    for build, theme, mode in CONDITIONS:
        name = f"obsidian-{theme}-{mode}-gray-active-{build}"
        f = root / build / "measurements" / f"{name}.g5.json"
        res: dict = {"build": build, "theme": theme, "mode": mode}
        results.append(res)
        if not f.is_file():
            res.update(state="INVALID", detail="capture missing")
            invalid.append(name)
            continue
        rec = json.loads(f.read_text())
        rec["image"] = rec.get("image", "")
        probs = check(rec, root)
        if probs:
            res.update(state="INVALID", detail="; ".join(probs))
            invalid.append(name)
            continue
        vals, probs = measure(rec, root, work)
        res["regions"] = {k: {"mean": [round(x, 2) for x in m], "sd": s} for k, (m, s) in vals.items()}
        if probs or "titlebar" not in vals or "left-tabstrip" not in vals:
            res.update(state="INVALID", detail="; ".join(probs) or "a region was not measured")
            invalid.append(name)
            continue
        de = sr.de2000(vals["titlebar"][0], vals["left-tabstrip"][0])
        res["dE2000"] = round(de, 3)
        if mode == "opaque":
            res.update(state="REFERENCE", detail=f"dE2000 {de:.3f} (opaque, reported only)")
        elif build == "after":
            res.update(state="PASS" if de <= MAX_DE else "FAIL", detail=f"dE2000 {de:.3f} {'<=' if de <= MAX_DE else '>'} {MAX_DE}")
            if de > MAX_DE:
                failed.append(name)
        else:
            ok = de > MAX_DE
            res.update(state="CONTROL HOLDS" if ok else "CONTROL FAILS", detail=f"dE2000 {de:.3f} {'>' if ok else '<='} {MAX_DE} (pre-fix build must differ)")
            if not ok:
                invalid.append(name)
    overall = "INVALID" if invalid else "FAIL" if failed else "PASS"
    Path(a.out).write_text(json.dumps({"overall": overall, "maxSd": MAX_SD, "maxDE2000": MAX_DE, "results": results}, indent=1) + "\n")
    for r in results:
        print(f"{r['state']:14} {r['build']:6} {r['theme']:16} {r['mode']:11} {r.get('detail', '')}")
    print(f"\nG5: {overall}")
    sys.exit(0 if overall == "PASS" else 1)


if __name__ == "__main__":
    main()

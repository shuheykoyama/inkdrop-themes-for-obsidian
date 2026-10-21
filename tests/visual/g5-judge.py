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

Method v2 (--method v2, research/14 section 6.83, fixed before the confirmatory capture): the title bar and the
centre tab strip directly below it are compared over the same columns (the `pair` of g5-regions.js: the widest
common range where neither paints anything, without the window buttons and the window's rounded corner, at least
32 points wide). Both bands are divided into equal tiles of at most 8 x 8 points over those columns.
  - contamination (INVALID): a tile with a per-channel sd > 1.0 (text, an icon, a line inside it), or two
    neighbouring tiles whose means differ by more than 1.0 in a channel (a step, also one on a tile border);
    a smooth change across the band (the window material) passes;
  - colour: CIEDE2000 of the two bands' means; after, translucent: <= 1.0 PASS (automatic); before, translucent:
    > 1.0 overall and in every column, or the negative control fails and all is INVALID; opaque: reference;
  - recorded for diagnosis: CIEDE2000 per column, and against the left tab strip (the comparison of v1).
An automatic PASS still needs the visual check of the regions on the images before it is a result.

usage: python3 -I tests/visual/g5-judge.py <capture out dir> --out <judgement.json> [--method v1|v2]
Exit status 0 only when the result is PASS (v2: automatic PASS).
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


def check(rec, root, regions=True):
    """Problems of one capture record (empty: usable); `regions`: also the v1 sampling regions."""
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
    for name in ("titlebar", "left-tabstrip") if regions else ():
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


TILE, MIN_COMMON, STEP_LIMIT = 8, 32, 1.0  # points, points, 8-bit levels (method v2)


def tiles(rows, ch, scale, rect):
    """Equal tiles of at most TILE x TILE points covering `rect` (points): a grid [row][column] of (mean, sd)."""
    x, y, w, h = rect
    nx, ny = max(1, -(-int(round(w * 100)) // (TILE * 100))), max(1, -(-int(round(h * 100)) // (TILE * 100)))
    grid = []
    for j in range(ny):
        row = []
        for i in range(nx):
            x0, x1 = int((x + w * i / nx) * scale), int((x + w * (i + 1) / nx) * scale)
            y0, y1 = int((y + h * j / ny) * scale), int((y + h * (j + 1) / ny) * scale)
            row.append(sr.stats(rows, ch, x0, y0, max(1, x1 - x0), max(1, y1 - y0)))
        grid.append(row)
    return grid


def quality(grid, name):
    """Contamination of a band: tiles not flat, or a step between neighbouring tiles."""
    p = []
    for j, row in enumerate(grid):
        for i, (m, sd) in enumerate(row):
            if max(sd) > MAX_SD:
                p.append(f"{name} tile ({i},{j}) sd {max(sd):.2f} > {MAX_SD}")
            for di, dj in ((1, 0), (0, 1)):
                if j + dj < len(grid) and i + di < len(row):
                    m2 = grid[j + dj][i + di][0]
                    step = max(abs(m[k] - m2[k]) for k in range(3))
                    if step > STEP_LIMIT:
                        p.append(f"{name} step {step:.2f} > {STEP_LIMIT} between tiles ({i},{j}) and ({i + di},{j + dj})")
    return p


def mean_of(cells):
    return [sum(c[0][k] for c in cells) / len(cells) for k in range(3)]


def analyse(rows, ch, scale, pair):
    """Method v2 on decoded rows: the bands' tiles, their contamination, and the colour differences."""
    tb, tab = tiles(rows, ch, scale, pair["titlebar"]), tiles(rows, ch, scale, pair["tab"])
    probs = quality(tb, "titlebar") + quality(tab, "tab strip")
    ncol = len(tb[0])
    cols = [round(sr.de2000(mean_of([r[i] for r in tb]), mean_of([r[i] for r in tab])), 3) for i in range(ncol)]
    tbm, tabm = mean_of([c for r in tb for c in r]), mean_of([c for r in tab for c in r])
    return {"tiles": [len(tb), ncol, len(tab)], "titlebarMean": [round(v, 2) for v in tbm], "tabMean": [round(v, 2) for v in tabm],
            "maxTileSd": round(max(max(sd) for g in (tb, tab) for r in g for _, sd in r), 3),
            "dE2000": round(sr.de2000(tbm, tabm), 3), "dE2000ByColumn": cols, "problems": probs}


def pair_problems(rec):
    pr = rec.get("pair") or {}
    p = []
    if pr.get("missing") or not pr.get("columns"):
        return ["no common free columns of the title bar and the centre tab strip"]
    if not pr.get("bigEnough") or pr.get("width", 0) < MIN_COMMON:
        p.append(f"common columns {pr.get('width')} pt < {MIN_COMMON} pt")
    for k in ("titlebar", "tab"):
        x = pr.get(k) or [0, 0, 0, 0]
        if x[0] < 0 or x[1] < 0 or x[0] + x[2] > WINDOW[0] or x[1] + x[3] > WINDOW[1] or x[2] <= 0 or x[3] <= 0:
            p.append(f"pair {k} band {x} outside the window")
        if not (pr.get(f"{k}Centre") or {}).get("inside"):
            p.append(f"pair {k} band centre not over the element")
    return p


def judge_v2(root, out):
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
        probs = check(rec, root, regions=False) + pair_problems(rec)
        if probs:
            res.update(state="INVALID", detail="; ".join(probs))
            invalid.append(name)
            continue
        w, h, ch, rows = sr.read_png(str(root / rec["image"]))
        scale = w / WINDOW[0]
        r = analyse(rows, ch, scale, rec["pair"])
        res.update(columns=rec["pair"]["columns"], **{k: v for k, v in r.items() if k != "problems"})
        lt = ((rec.get("regions") or {}).get("left-tabstrip") or {}).get("rect")
        if lt:
            m, _ = sr.stats(rows, ch, int(lt[0] * scale), int(lt[1] * scale), int(lt[2] * scale), int(lt[3] * scale))
            res["diagnostic dE2000 vs left tab strip"] = round(sr.de2000(r["titlebarMean"], m), 3)
        if r["problems"]:
            res.update(state="INVALID", detail="; ".join(r["problems"][:4]) + (f" (+{len(r['problems']) - 4})" if len(r["problems"]) > 4 else ""))
            invalid.append(name)
            continue
        de = r["dE2000"]
        if mode == "opaque":
            res.update(state="REFERENCE", detail=f"dE2000 {de:.3f} (opaque, reported only)")
        elif build == "after":
            res.update(state="PASS" if de <= MAX_DE else "FAIL", detail=f"dE2000 {de:.3f} {'<=' if de <= MAX_DE else '>'} {MAX_DE}; by column max {max(r['dE2000ByColumn']):.3f}")
            if de > MAX_DE:
                failed.append(name)
        else:
            ok = de > MAX_DE and min(r["dE2000ByColumn"]) > MAX_DE
            res.update(state="CONTROL HOLDS" if ok else "CONTROL FAILS", detail=f"dE2000 {de:.3f}, by column min {min(r['dE2000ByColumn']):.3f} (pre-fix build must differ, > {MAX_DE} overall and in every column)")
            if not ok:
                invalid.append(name)
    overall = "INVALID" if invalid else "FAIL" if failed else "PASS (automatic; the visual check of the regions is still required)"
    Path(out).write_text(json.dumps({"method": "v2", "overall": overall, "maxTileSd": MAX_SD, "stepLimit": STEP_LIMIT, "tilePoints": TILE, "minCommonPoints": MIN_COMMON, "maxDE2000": MAX_DE, "results": results}, indent=1) + "\n")
    for r in results:
        print(f"{r['state']:14} {r['build']:6} {r['theme']:16} {r['mode']:11} {r.get('detail', '')}")
    print(f"\nG5 (v2): {overall}")
    sys.exit(0 if overall.startswith("PASS") else 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("captures")
    ap.add_argument("--out", required=True)
    ap.add_argument("--method", choices=["v1", "v2"], default="v1")
    a = ap.parse_args()
    if a.method == "v2":
        judge_v2(Path(a.captures), a.out)
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

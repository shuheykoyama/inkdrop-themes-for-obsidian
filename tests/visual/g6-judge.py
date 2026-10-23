"""Step 11G G6 (research/14 §6.93.4, §6.95): V-35 judgement of the captures of tests/visual/g6-run.mjs.

Inkdrop's own measured values are the reference (V-22, research/11 §14.5; V-30 state 4), so each capture is:
  INVALID  the state was not reached or the capture is not usable (theme, settings, focus, window, note changed,
           a search or selection highlight left over from another state)
  PASS     the active line, gutter text and KD gutter line equal V-22 and the band runs from gutter to text
  DIFF     a value differs from V-22 while every compared condition equals V-22's (version, theme, settings)
  HOLD     a value differs and a condition differs too, so theme and environment cannot be told apart
  RECORD   search match, code block and acrylic states: new reference values, no earlier value to compare
Nothing here changes a theme or an earlier record.

The run as a whole needs all 8 conditions (2 themes x opaque active / search / code and acrylic active), each
exactly once, each record naming its own file and an image that exists with the recorded SHA-256; a missing,
repeated or broken condition makes the run INCOMPLETE, whatever the single captures say.

usage: python3 -I tests/visual/g6-judge.py <capture out dir> [--out judge.json]
"""
import hashlib
import json
import sys
from pathlib import Path

V22 = {
    "conditions": {"inkdropVersion": "6.1.5", "themeVersion": {"solarized-dark": "2.2.1", "kanagawa-dragon": "1.2.1"}},
    "solarized-dark": {"activeLine": "rgba(0, 45, 56, 0.5)", "lineNumber": "rgb(88, 110, 116)", "gutterBorder": None},
    "kanagawa-dragon": {"activeLine": "rgba(39, 38, 38, 0.3)", "lineNumber": "rgb(98, 94, 91)", "gutterBorder": "1px solid rgb(39, 38, 38)"},
}
WINDOW = [1200, 700]


def invalid(rec):
    """Why the capture cannot be used (empty: usable)."""
    out = []
    st, b, a = rec["stateResult"], rec["probeBefore"], rec["probeAfter"]
    for when, p in (("before", b), ("after", a)):
        if p["theme"] != rec["theme"]:
            out.append(f"theme {p['theme']} {when} the shot")
        if not (p["settings"]["lineNumbers"] and p["settings"]["styleActiveLine"]):
            out.append(f"line numbers / active line not on {when} the shot")
        if p["settings"]["acrylic"] is not (rec["mode"] == "acrylic") or ("acrylic-window" in p["bodyClasses"]) is not (rec["mode"] == "acrylic"):
            out.append(f"acrylic does not match the mode {when} the shot")
        if not p["window"]["focused"]:
            out.append(f"the window was not focused {when} the shot")
        if p["window"]["viewport"] != WINDOW or p["window"]["screen"][:2] != [400, 250]:
            out.append(f"window {p['window']['screen']} {when} the shot")
        if not p["styles"]["activeLine"]["found"] or not p["styles"]["gutters"]["found"]:
            out.append(f"no active line or gutter {when} the shot")
    if b["window"]["devicePixelRatio"] != a["window"]["devicePixelRatio"]:
        out.append("devicePixelRatio changed during the shot")
    if rec["pixels"] != [round(WINDOW[0] * a["window"]["devicePixelRatio"]), round(WINDOW[1] * a["window"]["devicePixelRatio"])]:
        out.append(f"image {rec['pixels']} does not match the window at devicePixelRatio {a['window']['devicePixelRatio']}")
    if rec.get("noteUnchanged") is not True or not st["docUnchanged"]:
        out.append("the note changed")
    if not st["selectionEmpty"] or st["cursorLine"] != rec["line"]:
        out.append("the cursor is not alone on the requested line")
    if rec["state"] == "search" and (st["searchError"] or not st["activeLineHasMatch"]):
        out.append(f"no search match on the active line ({st['searchError'] or 'none found'})")
    if rec["state"] == "code" and not any("code" in c.lower() for c in st["activeLineClasses"]):
        out.append("the active line is not marked as a code block line")
    # Nothing carried over from another state (§6.117): no search highlight or panel outside the search state, no
    # selection-match highlight anywhere. A record without these fields cannot show it, so it is not usable either.
    if rec["state"] != "search" and (st.get("searchMatches") != 0 or st.get("searchPanelOpen") is not False):
        out.append("a search highlight or panel is left from another state")
    if st.get("selectionMatches") != 0:
        out.append("selection-match highlights are shown")
    return out


def compare(rec):
    """PASS / DIFF / HOLD for the plain active line state (opaque), with the values compared."""
    p = rec["probeAfter"]
    ref = V22[rec["theme"]]
    got = {"activeLine": p["styles"]["activeLine"]["backgroundColor"], "lineNumber": p["styles"]["lineNumber"].get("color"),
           "gutterBorder": p["styles"]["gutters"]["borderRight"]}
    # The band runs from the gutter to the text: the active gutter cell and the active line share a row.
    ag, al = p["styles"]["activeLineGutter"], p["styles"]["activeLine"]
    band = ag.get("found") and al.get("found") and ag["rect"][1] == al["rect"][1] and ag["rect"][3] == al["rect"][3]
    diffs = [k for k in ("activeLine", "lineNumber") if got[k] != ref[k]]
    if ref["gutterBorder"] and got["gutterBorder"] != ref["gutterBorder"]:
        diffs.append("gutterBorder")
    if not ref["gutterBorder"] and not got["gutterBorder"].startswith("0px"):
        diffs.append("gutterBorder")
    if not band:
        diffs.append("band")
    cond = V22["conditions"]
    conditionDiffs = [k for k, ok in (("inkdropVersion", p["inkdropVersion"] == cond["inkdropVersion"]),
                                       ("themeVersion", p["themeVersion"] == cond["themeVersion"][rec["theme"]])) if not ok]
    state = "PASS" if not diffs else "DIFF" if not conditionDiffs else "HOLD"
    return {"state": state, "values": got, "reference": ref, "differs": diffs, "conditionDiffs": conditionDiffs}


def judge(rec):
    bad = invalid(rec)
    if bad:
        return {"state": "INVALID", "why": bad}
    if rec["mode"] == "opaque" and rec["state"] == "active":
        return compare(rec)
    p = rec["probeAfter"]["styles"]
    return {"state": "RECORD", "values": {k: {"backgroundColor": v.get("backgroundColor"), "color": v.get("color")} for k, v in p.items() if v.get("found")},
            "layers": rec["probeAfter"]["layers"]}


EXPECTED = [(t, m, s) for t in ("solarized-dark", "kanagawa-dragon") for m, s in (("opaque", "active"), ("opaque", "search"), ("opaque", "code"), ("acrylic", "active"))]


def completeness(root):
    """Problems with the set of captures in root (empty: all 8 conditions, once each, records and images intact)."""
    out, seen = [], {}
    for f in sorted(root.glob("measurements/*.json")):
        try:
            rec = json.loads(f.read_text())
            key = (rec["theme"], rec["mode"], rec["state"])
        except (ValueError, KeyError) as e:
            out.append(f"{f.name}: unreadable record ({type(e).__name__})")
            continue
        if f.stem != rec.get("name") or rec.get("name") != f"inkdrop-{key[0]}-v35-{key[1]}-{key[2]}":
            out.append(f"{f.name}: the record does not name its own condition")
        if key in seen:
            out.append(f"{f.name}: condition {key} repeated (also {seen[key]})")
        seen.setdefault(key, f.name)
        img = root / rec.get("image", "")
        if not img.is_file():
            out.append(f"{f.name}: image missing")
        elif hashlib.sha256(img.read_bytes()).hexdigest() != rec.get("imageSha256"):
            out.append(f"{f.name}: image does not match the recorded SHA-256")
    out += [f"condition {k} missing" for k in EXPECTED if k not in seen]
    out += [f"condition {k} not expected" for k in seen if k not in EXPECTED]
    return out


def main():
    root = Path(sys.argv[1])
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    results = []
    for f in sorted(root.glob("measurements/*.json")):
        rec = json.loads(f.read_text())
        r = {"name": rec["name"], "theme": rec["theme"], "mode": rec["mode"], "state_": rec["state"],
             "devicePixelRatio": rec["probeAfter"]["window"]["devicePixelRatio"], **judge(rec)}
        results.append(r)
        print(f"{r['state']:8} {rec['name']}  {'; '.join(r.get('why', [])) or ', '.join(r.get('differs', [])) or ''}")
    missing = completeness(root)
    print(f"\nrun: {'COMPLETE' if not missing else 'INCOMPLETE: ' + '; '.join(missing)}")
    if out:
        Path(out).write_text(json.dumps({"reference": V22, "complete": not missing, "completeness": missing, "results": results}, indent=1) + "\n")
    return 1 if missing or any(r["state"] == "INVALID" for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())

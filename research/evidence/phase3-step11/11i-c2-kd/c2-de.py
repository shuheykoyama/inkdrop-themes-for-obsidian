"""C2 colour-difference analysis (research/14 §6.159), offline, from the per-character dumps of c2-general.mjs.

For Kanagawa Dragon, the languages whose C2 adoption is still open (js, javascript, ts, typescript, python, go), and
for comparison the adopted ones (sql, html, yaml, yml, markdown, md): per character, CIEDE2000 between Obsidian's
colour and Inkdrop's, before and after the trial CSS (tests/visual/sample-regions.py de2000, sRGB values as
computed). Every character counts once (weight 1), so a sum is the character-weighted total colour difference.
Reported per dump: matches per language; dE before / after over all characters and over the changed ones (mean,
median, max, sum); the same by Inkdrop token kind (property / variable / function / type and name / other); the
runs of characters whose dE grew.

usage: python3 -I c2-de.py <label> <dump.json> [<label> <dump.json> ...]
"""
import importlib.util
import json
import re
import statistics
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("sample_regions", Path(__file__).resolve().parents[4] / "tests/visual/sample-regions.py")
assert spec is not None and spec.loader is not None, "tests/visual/sample-regions.py not found"
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

OPEN = ["js", "javascript", "ts", "typescript", "python", "go"]
ADOPTED = ["sql", "html", "yaml", "yml", "markdown", "md"]
rgb = lambda s: tuple(int(x) for x in re.findall(r"[\d.]+", s)[:3])
cache = {}


def de(a, b):
    if (a, b) not in cache:
        cache[(a, b)] = sr.de2000(rgb(a), rgb(b))
    return cache[(a, b)]


def kind(cls):
    # The Inkdrop token kind of a character (its classes; the order decides for combined classes).
    if "tok-property-name" in cls:
        return "property"
    if "tok-function" in cls:
        return "function"
    if "tok-variable-name" in cls:
        return "variable"
    if re.search(r"tok-(name|type-name|class-name|type)\b", cls):
        return "type/name"
    return "other"


def stats(xs):
    if not xs:
        return "n 0"
    return f"n {len(xs)}, mean {statistics.mean(xs):.2f}, median {statistics.median(xs):.2f}, max {max(xs):.2f}, sum {sum(xs):.1f}"


args = sys.argv[1:]
for label, path in zip(args[::2], args[1::2]):
    rows = [r for r in json.load(open(path, encoding="utf-8")) if r["theme"] == "kanagawa-dragon"]
    for r in rows:
        r["deBefore"], r["deAfter"] = de(r["before"], r["inkdrop"]), de(r["after"], r["inkdrop"])
        r["kind"] = kind(r["cls"])
    print(f"===== {label}: {path.rsplit('/', 1)[-1]}")
    for group, langs in (("open (js, javascript, ts, typescript, python, go)", OPEN), ("adopted (sql, html, yaml, yml, markdown, md)", ADOPTED)):
        g = [r for r in rows if r["lang"] in langs]
        changed = [r for r in g if r["before"] != r["after"]]
        print(f"\n== {group}")
        print("lang chars matchBefore matchAfter delta changed")
        for lang in langs:
            l = [r for r in g if r["lang"] == lang]
            if not l:
                continue
            mb = sum(r["before"] == r["inkdrop"] for r in l)
            ma = sum(r["after"] == r["inkdrop"] for r in l)
            print(f"{lang} {len(l)} {mb} {ma} {ma - mb:+d} {sum(r['before'] != r['after'] for r in l)}")
        print(f"all characters, dE before: {stats([r['deBefore'] for r in g])}")
        print(f"all characters, dE after:  {stats([r['deAfter'] for r in g])}")
        print(f"changed characters, dE before: {stats([r['deBefore'] for r in changed])}")
        print(f"changed characters, dE after:  {stats([r['deAfter'] for r in changed])}")
        print("by Inkdrop token kind (changed characters): kind n, dE sum before -> after (change), closer / farther / same")
        for k in ("variable", "function", "type/name", "property", "other"):
            c = [r for r in changed if r["kind"] == k]
            if not c:
                continue
            b, a = sum(r["deBefore"] for r in c), sum(r["deAfter"] for r in c)
            closer = sum(r["deAfter"] < r["deBefore"] - 1e-9 for r in c)
            farther = sum(r["deAfter"] > r["deBefore"] + 1e-9 for r in c)
            print(f"  {k} {len(c)}, {b:.1f} -> {a:.1f} ({a - b:+.1f}), {closer} / {farther} / {len(c) - closer - farther}")
        grew = [r for r in changed if r["deAfter"] > r["deBefore"] + 1e-9]
        down = sum(r["deBefore"] - r["deAfter"] for r in changed if r["deAfter"] < r["deBefore"])
        up = sum(r["deAfter"] - r["deBefore"] for r in grew)
        print(f"dE decrease (sum over closer characters) {down:.1f}, increase (farther) {up:.1f}, net {up - down:+.1f}")
        if grew:
            print("characters whose dE grew, as runs (block lang 'text' Inkdrop classes: dE before -> after):")
            run = []
            for r in grew + [None]:
                if run and (r is None or r["block"] != run[-1]["block"] or r["at"] != run[-1]["at"] + 1 or r["cls"] != run[-1]["cls"]):
                    f = run[0]
                    print(f"  {f['block']} {f['lang']} '{''.join(x['ch'] for x in run)}' {f['cls']}: {f['deBefore']:.2f} -> {f['deAfter']:.2f}")
                    run = []
                if r is not None:
                    run.append(r)
    print()

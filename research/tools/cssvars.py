#!/usr/bin/env python3
"""Extract custom property definitions from Obsidian app.css and compare with docs.

Usage: cssvars.py <app.css 1.14.4> <app.css 1.13.7> <docs CSS variables dir> <out csv> <out json>
"""
import csv
import json
import os
import re
import sys
from collections import defaultdict


def parse_css(path):
    """Return list of dicts: var, value, selector, atrules, line."""
    src = open(path, encoding="utf-8").read()
    defs = []
    uses = defaultdict(int)
    i = 0
    n = len(src)
    line = 1
    stack = []  # list of (prelude, line)
    buf = []
    buf_line = 1
    while i < n:
        c = src[i]
        # comments
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
            continue
        # strings
        if c in "\"'":
            j = i + 1
            while j < n and src[j] != c:
                if src[j] == "\\":
                    j += 1
                j += 1
            seg = src[i:j + 1]
            if not "".join(buf).strip():
                buf_line = line
            buf.append(seg)
            line += seg.count("\n")
            i = j + 1
            continue
        if c == "{":
            prelude = " ".join("".join(buf).split())
            stack.append((prelude, buf_line))
            buf = []
            i += 1
            continue
        if c in ";}":
            decl = "".join(buf).strip()
            if decl.startswith("--") and ":" in decl:
                name, val = decl.split(":", 1)
                name = name.strip()
                val = " ".join(val.split())
                sels = [p for p, _ in stack if not p.startswith("@")]
                ats = [p for p, _ in stack if p.startswith("@")]
                defs.append({
                    "var": name,
                    "value": val,
                    "selector": sels[-1] if sels else "",
                    "parents": sels[:-1],
                    "atrules": ats,
                    "line": buf_line,
                })
            elif decl:
                pass
            for m in re.finditer(r"var\(\s*(--[\w-]+)", decl):
                uses[m.group(1)] += 1
            if c == "}" and stack:
                stack.pop()
            buf = []
            i += 1
            continue
        if c == "\n":
            line += 1
        if not c.isspace() and not "".join(buf).strip():
            buf_line = line
        buf.append(c)
        i += 1
    return defs, uses


def obsidian_start(path):
    for k, l in enumerate(open(path, encoding="utf-8"), 1):
        if "Obsidian theme variables" in l:
            return k
    return 0


def parse_docs(root):
    docs = defaultdict(set)
    for dp, _, fs in os.walk(root):
        for f in fs:
            if not f.endswith(".md"):
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, root)
            txt = open(p, encoding="utf-8").read()
            for m in re.finditer(r"`(--[A-Za-z0-9_-]+)`", txt):
                docs[m.group(1)].add(rel)
    return docs


def base_sel(sel):
    """Classify selector into mode buckets."""
    s = sel.strip()
    if s in (":root", "body", "html", ":root, body", "body, :root"):
        return "base"
    if s == ".theme-dark":
        return "dark"
    if s == ".theme-light":
        return "light"
    return None


def main():
    a14, a13, docroot, out_csv, out_json = sys.argv[1:6]
    start14 = obsidian_start(a14)
    start13 = obsidian_start(a13)
    d14, u14 = parse_css(a14)
    d13, u13 = parse_css(a13)
    docs = parse_docs(docroot)

    def index(defs, start):
        idx = defaultdict(list)
        for d in defs:
            d["region"] = "obsidian" if d["line"] >= start else "pdfjs"
            idx[d["var"]].append(d)
        return idx

    i14 = index(d14, start14)
    i13 = index(d13, start13)

    deprecated = set()
    colors = open(os.path.join(docroot, "Foundations", "Colors.md"), encoding="utf-8").read()
    m = re.search(r"Deprecated RGB and HSL variables(.*?)\n\n", colors, re.S)
    if m:
        deprecated |= set(re.findall(r"`(--[\w-]+)`", m.group(1)))
    # also variables listed under "Deprecated" comments in app.css
    deprecated_appcss = set()
    src = open(a14, encoding="utf-8").read().splitlines()
    for k, l in enumerate(src):
        if "Deprecated" in l and "/*" in l:
            for l2 in src[k + 1:k + 40]:
                mm = re.match(r"\s*(--[\w-]+)\s*:", l2)
                if mm:
                    deprecated_appcss.add(mm.group(1))
                elif l2.strip().startswith("/*") or l2.strip() == "}":
                    break

    allvars = sorted(set(i14) | set(docs))
    rows = []
    for v in allvars:
        defs = [d for d in i14.get(v, [])]
        obs_defs = [d for d in defs if d["region"] == "obsidian"]
        base = [d for d in obs_defs if not d["atrules"] and not d["parents"] and base_sel(d["selector"]) == "base"]
        dark = [d for d in obs_defs if not d["atrules"] and not d["parents"] and base_sel(d["selector"]) == "dark"]
        light = [d for d in obs_defs if not d["atrules"] and not d["parents"] and base_sel(d["selector"]) == "light"]
        # last definition wins for same specificity
        bval = base[-1]["value"] if base else ""
        dv = dark[-1]["value"] if dark else bval
        lv = light[-1]["value"] if light else bval
        sels = []
        for d in (base + dark + light):
            s = "%s@%d" % (d["selector"], d["line"])
            if s not in sels:
                sels.append(s)
        others = [d for d in obs_defs if d not in base + dark + light]
        notes = []
        if not obs_defs and defs:
            notes.append("pdf.js-region only")
        if others:
            uniq = []
            for d in others:
                s = ("[" + " ".join(d["atrules"]) + "] " if d["atrules"] else "") + d["selector"]
                if s not in uniq:
                    uniq.append(s)
            if not (base or dark or light):
                sels = ["%s@%d" % (d["selector"], d["line"]) for d in others[:3]]
            notes.append("also/only in %d other rule(s): %s" % (len(uniq), " | ".join(uniq[:4]) + (" ..." if len(uniq) > 4 else "")))
        if v in deprecated:
            notes.append("DEPRECATED per docs Colors.md (1.13)")
        if v in deprecated_appcss:
            notes.append("app.css comment: Deprecated")
        in13 = v in i13
        in14 = v in i14
        if in14 and not in13:
            notes.append("NEW in 1.14.x (absent in 1.13.7)")
        if in13 and not in14:
            notes.append("REMOVED in 1.14.x (present in 1.13.7)")
        if not in14 and u14.get(v):
            notes.append("used via var() in app.css but never defined (%d uses)" % u14[v])
        doc_pages = sorted(docs.get(v, []))
        if doc_pages and all(p.startswith("Publish") for p in doc_pages):
            notes.append("Publish-only doc")
        rows.append({
            "variable": v,
            "documented": "y" if v in docs else "n",
            "doc_page": ";".join(doc_pages),
            "defined_in_appcss": "y" if obs_defs else ("pdfjs-only" if defs else "n"),
            "default_dark": dv,
            "default_light": lv,
            "defining_selector": "; ".join(sels[:4]),
            "notes": "; ".join(notes),
        })
    # removed variables also included
    for v in sorted(set(i13) - set(i14)):
        if v in docs:
            continue
        rows.append({
            "variable": v, "documented": "n", "doc_page": "", "defined_in_appcss": "n",
            "default_dark": "", "default_light": "",
            "defining_selector": "(1.13.7) " + "; ".join("%s@%d" % (d["selector"], d["line"]) for d in i13[v][:3]),
            "notes": "REMOVED in 1.14.x (present in 1.13.7)",
        })
    rows.sort(key=lambda r: r["variable"])
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    obs14 = {v for v, ds in i14.items() if any(d["region"] == "obsidian" for d in ds)}
    obs13 = {v for v, ds in i13.items() if any(d["region"] == "obsidian" for d in ds)}
    docset = set(docs)
    docset_nonpublish = {v for v, ps in docs.items() if not all(p.startswith("Publish") for p in ps)}
    summary = {
        "obsidian_region_start_line_14": start14,
        "obsidian_region_start_line_13": start13,
        "defs_total_14": len(d14),
        "unique_vars_14_all": len(i14),
        "unique_vars_14_obsidian": len(obs14),
        "unique_vars_13_obsidian": len(obs13),
        "documented_vars": len(docset),
        "documented_nonpublish": len(docset_nonpublish),
        "documented_and_defined": len(docset_nonpublish & obs14),
        "documented_not_defined": sorted(docset_nonpublish - obs14),
        "defined_not_documented_count": len(obs14 - docset),
        "added_14_vs_13": sorted(obs14 - obs13),
        "removed_14_vs_13": sorted(obs13 - obs14),
        "deprecated_docs": sorted(deprecated),
        "deprecated_appcss": sorted(deprecated_appcss),
        "used_not_defined_14": sorted(v for v in u14 if v not in i14),
    }
    # value changes for vars in base/dark/light between versions
    changed = []
    def bucket(idx, v):
        out = {}
        for d in idx.get(v, []):
            if d["region"] != "obsidian" or d["atrules"] or d["parents"]:
                continue
            b = base_sel(d["selector"])
            if b:
                out[b] = d["value"]
        return out
    for v in sorted(obs14 & obs13):
        b14, b13 = bucket(i14, v), bucket(i13, v)
        if b14 != b13:
            changed.append({"var": v, "1.13.7": b13, "1.14.4": b14})
    summary["value_changed_base_dark_light"] = changed
    # selector histogram (obsidian region)
    hist = defaultdict(int)
    for d in d14:
        if d["region"] == "obsidian":
            hist[(" ".join(d["atrules"]) + " " if d["atrules"] else "") + d["selector"]] += 1
    summary["top_defining_selectors_14"] = sorted(hist.items(), key=lambda x: -x[1])[:40]
    json.dump(summary, open(out_json, "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()

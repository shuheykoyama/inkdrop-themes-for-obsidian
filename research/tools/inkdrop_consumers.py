#!/usr/bin/env python3
"""Locate where Inkdrop design tokens are consumed in an extracted app.asar.

STATIC analysis only: the app is never launched. The script reads CSS
(standalone files and <style> blocks in HTML) and JS bundles, and for each
token listed in mapping-candidates.csv (rows whose inkdrop_consumer is
"非公開" or "混在") records every declaration that references it via var().

Output keeps only a short excerpt per declaration (one declaration, truncated)
plus the selector chain, so proprietary sources are not reproduced.

Usage:
  python3 -I inkdrop_consumers.py <asar_root> <mapping-candidates.csv> <out.csv>
"""
import csv
import re
import sys
from pathlib import Path

MAX_DECL = 140  # truncate excerpts so we never copy long stretches of source


def line_col(text, offset):
    # 1-based line and column of a byte/char offset
    line = text.count("\n", 0, offset) + 1
    col = offset - (text.rfind("\n", 0, offset) + 1) + 1
    return line, col


def short(s):
    s = " ".join(s.split())
    return s if len(s) <= MAX_DECL else s[: MAX_DECL - 1] + "…"


# ---------------------------------------------------------------- CSS parser
def css_declarations(text, base=0):
    """Yield (selector_chain, property, value, offset) for every declaration.

    A tiny state machine: walk characters, skip comments/strings, push the
    prelude on '{', pop on '}', and treat text ending in ';' or '}' that
    contains ':' as a declaration.  Nested rules (CSS nesting with '&') and
    at-rules are kept as a chain joined with ' >> '.
    """
    stack = []  # prelude strings of open blocks
    buf_start = 0  # where the current pending text started
    i, n = 0, len(text)
    paren = 0  # depth inside (...) so ';' in url()/var() is not a terminator
    while i < n:
        c = text[i]
        if c == "/" and text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            i = j + 1
            continue
        if c == "(":
            paren += 1
        elif c == ")":
            paren = max(0, paren - 1)
        elif paren == 0 and c == "{":
            prelude = re.sub(r"/\*.*?\*/", " ", text[buf_start:i], flags=re.S)
            stack.append(" ".join(prelude.split()))
            buf_start = i + 1
        elif paren == 0 and c in ";}":
            # blank out comments (same length) so offsets stay valid
            chunk = re.sub(r"/\*.*?\*/", lambda m: " " * len(m.group()), text[buf_start:i], flags=re.S)
            stripped = chunk.strip()
            if ":" in stripped and stack:
                prop, _, val = stripped.partition(":")
                prop = prop.strip()
                # a nested selector like '&:hover' never reaches here (it ends
                # with '{'), so anything with ':' before ';'/'}' is a decl
                if prop and not prop.startswith("@"):
                    off = buf_start + (len(chunk) - len(chunk.lstrip()))
                    yield (" >> ".join(stack), prop, val.strip(), base + off)
            if c == "}" and stack:
                stack.pop()
            buf_start = i + 1
        i += 1


# ---------------------------------------------------------------- JS context
KEY_RE = re.compile(r"""(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([A-Za-z_$][\w$-]*))\s*:\s*$""")


def js_key_before(text, pos):
    # read an object key ending right before pos (e.g. `backgroundColor:`)
    m = KEY_RE.search(text[max(0, pos - 300):pos])
    if not m:
        return None
    return next(g for g in m.groups() if g is not None)


def js_context(text, pos, max_levels=4):
    """Return (selector_chain, property) for a var() found inside JS.

    Walk backwards from pos to the start of the current object member
    (previous ',' or '{' at depth 0) to find the property key, then keep
    walking to each enclosing '{' and read the key that precedes it.
    """
    # find property key: scan back to ',' or '{' at depth 0
    depth, j = 0, pos
    while j > 0:
        j -= 1
        ch = text[j]
        if ch in ")]}":
            depth += 1
        elif ch in "([{":
            if depth == 0:
                break
            depth -= 1
        elif ch == "," and depth == 0:
            break
        if pos - j > 2000:
            break
    seg = text[j + 1:pos]
    km = re.match(r"""\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([A-Za-z_$][\w$-]*))\s*:""", seg)
    prop = next((g for g in km.groups() if g is not None), None) if km else None
    # if we stopped at ',' keep walking back to the '{' that opens this object
    k = j
    if k > 0 and text[k] == ",":
        depth = 0
        while k > 0:
            k -= 1
            ch = text[k]
            if ch in ")]}":
                depth += 1
            elif ch in "([{":
                if depth == 0:
                    break
                depth -= 1
            if j - k > 200000:
                break
    # enclosing object keys
    chain = []
    while len(chain) < max_levels and k > 0 and text[k] == "{":
        key = js_key_before(text, k)
        if key is None:
            # e.g. theme({ ... }) — record the call name if present
            m = re.search(r"([\w$.]+)\(\s*$", text[max(0, k - 80):k])
            if m:
                chain.append(m.group(1) + "(...)")
            break
        chain.append(key)
        # move to the '{' that encloses this key
        depth, k2 = 0, k
        while k2 > 0:
            k2 -= 1
            ch = text[k2]
            if ch in ")]}":
                depth += 1
            elif ch in "([{":
                if depth == 0:
                    break
                depth -= 1
            if k - k2 > 200000:
                break
        k = k2
    return " >> ".join(reversed(chain)), prop


# ---------------------------------------------------------------- main scan
def load_tokens(mapping_csv):
    rows = list(csv.DictReader(open(mapping_csv, encoding="utf-8")))
    tok2ids = {}
    target_ids = []
    for r in rows:
        c = r["inkdrop_consumer"]
        if c.startswith("非公開") or c.startswith("混在"):
            target_ids.append(r["id"])
            for t in r["inkdrop_tokens"].split(";"):
                t = t.strip()
                if t:
                    tok2ids.setdefault(t, []).append(r["id"])
    return tok2ids, target_ids


def iter_files(root):
    pats = [
        "renderer/index.html",
        "renderer/assets/*.css",
        "renderer/assets/*.js",
        "main/**/*.js",
        "packages/**/*.css",
        "packages/**/*.js",
        "node_modules/@inkdropapp/css/*.css",
    ]
    seen = set()
    for p in pats:
        for f in sorted(root.glob(p)):
            if f.is_file() and f not in seen:
                seen.add(f)
                yield f


def var_re(tok):
    # var(--tok) or var(--tok, fallback); token must end at ',' ')' or space
    return re.compile(r"var\(\s*" + re.escape(tok) + r"\s*[,)]")


def scan(root, tokens):
    results = []  # dicts
    defs = {t: [] for t in tokens}
    regs = {t: var_re(t) for t in tokens}
    for f in iter_files(root):
        rel = f.relative_to(root).as_posix()
        text = f.read_text(encoding="utf-8", errors="replace")
        if f.suffix in (".css", ".html"):
            blocks = [(0, text)]
            if f.suffix == ".html":
                blocks = [(m.start(1), m.group(1)) for m in
                          re.finditer(r"<style[^>]*>(.*?)</style>", text, re.S)]
            for base, block in blocks:
                for sel, prop, val, off in css_declarations(block, base):
                    if prop in defs:
                        defs[prop].append((rel, sel, off, text))
                    for t, rg in regs.items():
                        if rg.search(val):
                            ln, col = line_col(text, off)
                            results.append(dict(
                                token=t, file=rel, selector=sel, property=prop,
                                declaration=short(f"{prop}: {val}"),
                                location=f"L{ln}:C{col} (offset {off})",
                                kind="css-alias" if prop.startswith("--") else "css"))
        else:
            for t, rg in regs.items():
                for m in rg.finditer(text):
                    # excerpt: the JS string literal containing the var()
                    s = max(text.rfind("`", 0, m.start()), text.rfind('"', 0, m.start()),
                            text.rfind("'", 0, m.start()))
                    # resolve context from the literal start so nested var()
                    # fallbacks inside the literal do not confuse the scan
                    sel, prop = js_context(text, s if 0 <= s < m.start() else m.start())
                    e = m.end()
                    q = text[s] if s >= 0 else ""
                    e2 = text.find(q, m.end()) if q else -1
                    lit = text[s + 1:e2] if 0 <= s < m.start() and e2 > 0 and e2 - s < 200 else text[m.start():e + 40]
                    ln, col = line_col(text, m.start())
                    results.append(dict(
                        token=t, file=rel, selector=sel or "(unknown JS context)",
                        property=prop or "?",
                        declaration=short(f"{prop or '?'}: {lit}"),
                        location=f"L{ln}:C{col} (offset {m.start()})",
                        kind="js-alias" if (prop or "").startswith("--") else "js"))
    return results, defs


def js_refs(root, tokens):
    """Quoted token names in JS that are not inside var() (e.g. palette lookups,
    style.setProperty).  These are references, not style consumers."""
    out = []
    for f in iter_files(root):
        if f.suffix != ".js":
            continue
        rel = f.relative_to(root).as_posix()
        text = f.read_text(encoding="utf-8", errors="replace")
        for t in tokens:
            for m in re.finditer(r"[`'\"]" + re.escape(t) + r"[`'\"]", text):
                ln, col = line_col(text, m.start())
                out.append(dict(token=t, file=rel, selector="(JS string literal)", property="",
                                declaration=short(text[max(0, m.start() - 40):m.end() + 40]),
                                location=f"L{ln}:C{col} (offset {m.start()})", kind="js-ref"))
    return out


# Manual static observations for tokens with no consumer in Inkdrop 6.1.5.
# Keep these short; they are explanations, not evidence.
NOT_FOUND_HINTS = {
    "--editor-drawer-background": "no 'drawer' class or component name in renderer CSS/JS (only icon keywords); drawer UI appears absent from 6.1.5 bundle",
    "--editor-drawer-border-left": "same as --editor-drawer-background",
    "--header-note-menu-action-item-active-background": "name unused; .editor-title-bar-revision .revision-label uses var(--info-background-color) directly (the base value of this token)",
    "--pink": "only defined in base ui.css; .ui.pink.* rules use --pink-background / --pink-text-color instead",
    "--teal": "only defined in base ui.css; .ui.teal.* rules use --teal-background / --teal-text-color instead",
    "--violet": "only defined in base ui.css; .ui.violet.* rules use --violet-background / --violet-text-color instead",
    "--yellow": "only defined in base ui.css; .ui.yellow.* rules use --yellow-background / --yellow-text-color instead",
}


def main():
    root = Path(sys.argv[1]).resolve()
    tok2ids, target_ids = load_tokens(sys.argv[2])
    out = Path(sys.argv[3])
    tokens = sorted(tok2ids)
    results, defs = scan(root, tokens)

    # one level of alias following: `--x: var(--tok)` -> consumers of --x
    alias_names = sorted({r["property"] for r in results if r["kind"].endswith("alias")} - set(tokens))
    alias_results, _ = scan(root, alias_names) if alias_names else ([], {})
    alias_src = {}
    for r in results:
        if r["kind"].endswith("alias"):
            alias_src.setdefault(r["property"], set()).add(r["token"])
    for r in alias_results:
        for src in sorted(alias_src.get(r["token"], ())):
            if r["kind"].endswith("alias"):
                continue
            rr = dict(r)
            rr["via"] = r["token"]
            rr["token"] = src
            results.append(rr)

    refs = js_refs(root, tokens)

    cols = ["token", "mapping_ids", "consumer_file", "selector", "property",
            "declaration", "location", "evidence", "notes"]
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        found = set()
        for r in sorted(results, key=lambda r: (r["token"], r["file"], r["location"])):
            # aliases and bare JS values are recorded but do not count as consumption
            if not r["kind"].endswith("alias") and r["property"] != "?":
                found.add(r["token"])
            note = {"css": "consumer (CSS)", "js": "consumer (JS style object / CodeMirror theme)",
                    "css-alias": "alias: token assigned to another custom property",
                    "js-alias": "alias: token assigned to another custom property in JS"}[r["kind"]]
            if r["kind"] == "js" and "theme(" in r["selector"]:
                note = "consumer (CodeMirror EditorView.theme spec in JS)"
            elif r["kind"] == "js" and r["property"] == "?":
                note = "JS value outside a style object (e.g. function argument / fallback); not a style declaration"
            if r.get("via"):
                note = f"consumer via alias {r['via']} ({note})"
            if r["file"].startswith("node_modules/@inkdropapp/css/"):
                # app JS reloadBaseStylesheets() requires these files at runtime
                note += "; base stylesheet loaded via reloadBaseStylesheets() (static read of app JS)"
            w.writerow(dict(token=r["token"], mapping_ids=" ".join(tok2ids[r["token"]]),
                            consumer_file=r["file"], selector=r["selector"],
                            property=r["property"], declaration=r["declaration"],
                            location=r["location"], evidence="STATIC", notes=note))
        for r in refs:
            w.writerow(dict(token=r["token"], mapping_ids=" ".join(tok2ids[r["token"]]),
                            consumer_file=r["file"], selector=r["selector"], property="",
                            declaration=r["declaration"], location=r["location"],
                            evidence="STATIC",
                            notes="reference only: token name as JS string (not a var() consumer)"))
        for t in tokens:
            if t in found:
                continue
            d = defs[t]
            where = "; ".join(sorted({x[0] for x in d})) or "nowhere in scanned files"
            w.writerow(dict(token=t, mapping_ids=" ".join(tok2ids[t]), consumer_file="",
                            selector="", property="", declaration="", location="",
                            evidence="STATIC",
                            notes=f"NOT FOUND: no var({t}) in scanned CSS/JS; defined in: {where}"
                                  + (f"; {NOT_FOUND_HINTS[t]}" if t in NOT_FOUND_HINTS else "")))

    # row summary
    rows_found = [i for i in target_ids if any(t in found for t, ids in tok2ids.items() if i in ids)]
    rows_all = [i for i in target_ids if all(t in found for t, ids in tok2ids.items() if i in ids)]
    print(f"target rows: {len(target_ids)}")
    print(f"rows with >=1 token consumed: {len(rows_found)}; all tokens consumed: {len(rows_all)}")
    print("rows with no token consumed:", [i for i in target_ids if i not in rows_found])
    print("partially consumed:", [i for i in rows_found if i not in rows_all])
    print("tokens not found:", [t for t in tokens if t not in found])


if __name__ == "__main__":
    main()

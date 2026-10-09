#!/usr/bin/env python3
"""Resolve Inkdrop CSS custom properties for a theme on top of @inkdropapp/css.

Static (declared-value) resolution only:
  * cascade layers ordered per layers.css (sub-layers below parent's direct styles)
  * only declarations on :root / :where(:root, :host) are "default"; :root:has(...) and
    @media print are recorded as conditional and excluded; @supports (corner-shape: squircle)
    is treated as applied (Electron/Chromium supports it; palette.json confirms).
  * var() substituted recursively (fallback used when target undefined)
  * light-dark(a, b) -> b (themes are themeAppearance: dark)
  * hsl()/rgb()/rgba() with literal numbers converted to #rrggbb[aa]
Usage: resolve_tokens.py <repos_dir> <theme_key> <out_csv>
"""
import csv, json, re, sys, colorsys, os

REPOS = sys.argv[1]
THEME = sys.argv[2]
OUT = sys.argv[3]

SHAS = {}
for line in open(os.path.join(os.path.dirname(REPOS.rstrip('/')), 'repo-shas.txt')):
    p = line.split()
    if len(p) >= 2:
        SHAS[p[0]] = p[1][:7]

BASE_REPO = 'inkdropapp_css'
BASE_FILES = ['tokens.css', 'utilities.css', 'ui.css', 'status.css', 'task-progress.css',
              'tags.css', 'markdown.css', 'mermaid.css', 'syntax.css']
THEMES = {
    'solarized-dark': ('inkdropapp_solarized-dark', 'styles',
                       ['tokens.css', 'ui.css', 'syntax.css', 'preview.css'], 'palette.json'),
    'kanagawa-dragon': ('inkdropapp_kanagawa', 'packages/dragon/styles',
                        ['palette.css', 'ui.css', 'syntax.css', 'preview.css'],
                        'packages/dragon/palette.json'),
}

# ---------- layer ordering ----------
layer_children = {(): []}  # tree: tuple path -> ordered children


def declare_layer(path):
    # register every prefix in order of first appearance
    for i in range(1, len(path) + 1):
        parent, node = tuple(path[:i - 1]), tuple(path[:i])
        layer_children.setdefault(parent, [])
        if node not in layer_children[parent]:
            layer_children[parent].append(node)
            layer_children.setdefault(node, [])


for name in re.sub(r'/\*.*?\*/', '', open(os.path.join(REPOS, BASE_REPO, 'layers.css')).read(),
                   flags=re.S).replace('@layer', '').replace(';', '').split(','):
    declare_layer(name.strip().split('.'))


def layer_rank():
    # post-order: children (in declaration order) first, then the layer's own styles;
    # the root () = unlayered styles comes last = highest precedence
    order = []

    def walk(n):
        for c in layer_children.get(n, []):
            walk(c)
        order.append(n)
    walk(())
    return {n: i for i, n in enumerate(order)}


# ---------- parser ----------
def parse(path, label, load_index):
    text = open(path).read()
    decls = []
    stack = []  # list of (kind, value)
    i, n = 0, len(text)
    buf, buf_start = "", 0
    buf_line = 1
    line = 1
    depth_paren = 0
    while i < n:
        c = text[i]
        if text.startswith('/*', i):
            j = text.index('*/', i + 2) + 2
            line += text.count('\n', i, j)
            i = j
            continue
        if c in '"\'':
            j = i + 1
            while text[j] != c:
                j += 2 if text[j] == '\\' else 1
            buf += text[i:j + 1]
            line += text.count('\n', i, j + 1)
            i = j + 1
            continue
        if c == '(':
            depth_paren += 1
        elif c == ')':
            depth_paren -= 1
        if c == '{' and depth_paren == 0:
            prelude = ' '.join(buf.split())
            if prelude.startswith('@layer'):
                names = prelude[len('@layer'):].strip()
                stack.append(('layer', names))
            elif prelude.startswith('@'):
                stack.append(('at', prelude))
            else:
                stack.append(('sel', prelude))
            buf = ''
            i += 1
            continue
        if (c == ';' and depth_paren == 0) or (c == '}' and depth_paren == 0):
            stmt = buf.strip()
            if stmt.startswith('--') and ':' in stmt:
                name, val = stmt.split(':', 1)
                # line of the property name
                decl_line = buf_line
                layer = []
                for k, v in stack:
                    if k == 'layer':
                        layer += v.split('.')
                sels = [v for k, v in stack if k == 'sel']
                ats = [v for k, v in stack if k == 'at']
                declare_layer(layer) if layer else None
                decls.append(dict(name=name.strip(), value=' '.join(val.split()), file=label,
                                  line=decl_line, layer=tuple(layer), sels=sels, ats=ats,
                                  load=load_index, pos=len(decls)))
            elif stmt.startswith('@layer') and c == ';':
                for nm in stmt[len('@layer'):].split(','):
                    declare_layer(nm.strip().split('.'))
            buf = ''
            if c == '}':
                if stack:
                    stack.pop()
            i += 1
            buf_line = line
            continue
        if not buf.strip() and not c.isspace():
            # line of the first non-whitespace char of this statement (comments are skipped)
            buf_line = line
        if c == '\n':
            line += 1
        buf += c
        i += 1
    return decls


ROOT_SELS = {':root': 10, ':where(:root, :host)': 0, ':where(:root,:host)': 0}


def classify(d):
    """return (is_default, specificity, condition_note)"""
    if len(d['sels']) != 1:
        return False, 0, 'scoped:' + ' > '.join(d['sels'])
    s = d['sels'][0]
    cond = []
    for a in d['ats']:
        if a.startswith('@supports') and 'corner-shape' in a:
            cond.append('assumed-applied ' + a)
        else:
            return False, 0, 'conditional:' + a
    if s in ROOT_SELS:
        return True, ROOT_SELS[s], '; '.join(cond)
    return False, 0, 'conditional:' + s


# ---------- value resolution ----------
def split_top(s, sep=','):
    parts, depth, cur = [], 0, ''
    for ch in s:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    return parts


def find_call(s, fname):
    m = re.search(r'(?<![\w-])' + fname + r'\(', s)
    if not m:
        return None
    start = m.start()
    j = m.end()
    depth = 1
    while depth:
        if s[j] == '(':
            depth += 1
        elif s[j] == ')':
            depth -= 1
        j += 1
    return start, j, s[m.end():j - 1]


def make_resolver(winners):
    cache = {}

    def resolve(name, stack=()):
        if name in cache:
            return cache[name]
        if name in stack:
            return ('<cycle>', {'cycle'}, set())
        d = winners.get(name)
        if d is None:
            return (None, {'undefined'}, set())
        out = subst(d['value'], stack + (name,))
        cache[name] = out
        return out

    def subst(val, stack):
        flags, used_ld = set(), set()
        # light-dark first (outermost-first is fine since args resolved later)
        while True:
            fc = find_call(val, 'light-dark')
            if not fc:
                break
            s, e, inner = fc
            args = split_top(inner)
            val = val[:s] + args[-1].strip() + val[e:]
            flags.add('light-dark->dark')
        while True:
            fc = find_call(val, 'var')
            if not fc:
                break
            s, e, inner = fc
            args = split_top(inner)
            ref = args[0].strip()
            fb = ','.join(args[1:]).strip() if len(args) > 1 else None
            rv, rflags, _ = resolve(ref, stack)
            if rv is None:
                if fb is not None:
                    rv2, f2, _ = subst(fb, stack)
                    flags |= f2
                    flags.add('fallback-used:' + ref)
                    rv = rv2
                else:
                    flags.add('undefined:' + ref)
                    rv = '<undefined ' + ref + '>'
            else:
                flags |= {f for f in rflags}
            val = val[:s] + rv + val[e:]
        return (' '.join(val.split()), flags, used_ld)

    return resolve


def pct(x):
    x = x.strip()
    return float(x[:-1]) / 100 if x.endswith('%') else float(x)


def to_hex(r, g, b, a=1.0):
    h = '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in (r, g, b))
    if a < 0.9995:
        h += '%02x' % round(a * 255)
    return h


def hsl_to_hex(m):
    inner = m.group(1).strip()
    if 'var(' in inner or '<' in inner:
        return m.group(0)
    alpha = 1.0
    if '/' in inner:
        inner, al = inner.split('/')
        alpha = pct(al)
    parts = inner.replace(',', ' ').split()
    if len(parts) != 3:
        return m.group(0)
    try:
        h = float(parts[0].replace('deg', '')) / 360
        s, l = pct(parts[1]), pct(parts[2])
    except ValueError:
        return m.group(0)
    r, g, b = colorsys.hls_to_rgb(h % 1, l, s)
    return to_hex(r, g, b, alpha)


def rgb_to_hex(m):
    parts = [p for p in re.split(r'[\s,/]+', m.group(2).strip()) if p]
    try:
        r, g, b = [float(p) / 255 for p in parts[:3]]
        a = pct(parts[3]) if len(parts) > 3 else 1.0
    except ValueError:
        return m.group(0)
    return to_hex(r, g, b, a)


def colorize(v):
    v = re.sub(r'hsla?\(([^()]*)\)', hsl_to_hex, v)
    v = re.sub(r'(rgba?)\(([^()]*)\)', rgb_to_hex, v)
    v = re.sub(r'#([0-9a-fA-F]{3})(?![0-9a-fA-F])',
               lambda m: '#' + ''.join(c * 2 for c in m.group(1)).lower(), v)
    return v


def norm(s):
    # palette.json serializes strings with double quotes; ignore quoting/escaping/whitespace
    return s.replace('\\"', '"').replace("'", '"').replace(' ', '')


# ---------- main ----------
def main():
    repo, sub, sheets, palette = THEMES[THEME]
    all_decls = []
    load = 0
    for f in BASE_FILES:
        lab = f'{BASE_REPO}@{SHAS[BASE_REPO]} {f}'
        all_decls += [dict(d, source='base') for d in parse(os.path.join(REPOS, BASE_REPO, f), lab, load)]
        load += 1
    for f in sheets:
        lab = f'{repo}@{SHAS[repo]} {sub}/{f}'
        all_decls += [dict(d, source='theme') for d in parse(os.path.join(REPOS, repo, sub, f), lab, load)]
        load += 1
    ranks = layer_rank()
    winners, overridden, conditional = {}, {}, {}
    for d in all_decls:
        ok, spec, note = classify(d)
        d['spec'], d['cond'] = spec, note
        if not ok:
            conditional.setdefault(d['name'], []).append(d)
            continue
        d['key'] = (ranks[d['layer']], spec, d['load'], d['pos'])
        overridden.setdefault(d['name'], []).append(d)
    for name, ds in overridden.items():
        ds.sort(key=lambda x: x['key'])
        winners[name] = ds[-1]
    resolve = make_resolver(winners)
    pal = json.load(open(os.path.join(REPOS, repo, palette)))
    rows = []
    for name in sorted(winners, key=lambda n: (winners[n]['source'] != 'theme', n)):
        d = winners[name]
        val, flags, _ = resolve(name)
        col = colorize(val)
        if any(f.startswith('undefined:') or f == 'cycle' for f in flags):
            status = 'unresolved'
        elif re.search(r'color-mix\(|calc\(|var\(', col) or any(f.startswith('fallback-used') for f in flags):
            status = 'partial'
        else:
            status = 'resolved'
        notes = []
        losers = [x for x in overridden[name][:-1]]
        if losers:
            notes.append('overrides: ' + ' | '.join(
                f"{x['file'].split(' ')[-1]}:{x['line']} [{'.'.join(x['layer']) or 'unlayered'}]" for x in losers))
        notes.append('layer=' + ('.'.join(d['layer']) or 'unlayered'))
        if flags:
            notes.append('flags=' + ','.join(sorted(flags)))
        if d['cond']:
            notes.append(d['cond'])
        if name in conditional:
            notes.append('conditional-overrides: ' + ' | '.join(
                f"{x['cond'].replace('conditional:', '')} @{x['file'].split(' ')[-1]}:{x['line']} = {x['value']}"
                for x in conditional[name]))
        if col != val:
            notes.append('substituted=' + val)
        if name in pal:
            pv = colorize(' '.join(str(pal[name]).split()))
            notes.append('palette.json=' + ('match' if norm(pv) == norm(col) else 'MISMATCH ' + str(pal[name])))
        else:
            notes.append('palette.json=absent')
        rows.append([name, d['source'], f"{d['file']}:{d['line']}", d['value'], col, status, '; '.join(notes)])
    with open(OUT, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['token', 'source', 'file:line', 'raw_value', 'resolved_value', 'resolution_status', 'notes'])
        w.writerows(rows)
    print(THEME, 'rows', len(rows),
          'theme', sum(r[1] == 'theme' for r in rows),
          {s: sum(r[5] == s for r in rows) for s in ('resolved', 'partial', 'unresolved')},
          'palette mismatch', sum('MISMATCH' in r[6] for r in rows),
          'palette absent', sum('palette.json=absent' in r[6] for r in rows))
    print('layer order:', [('.'.join(k) or 'unlayered') for k, _ in sorted(ranks.items(), key=lambda x: x[1])])


main()

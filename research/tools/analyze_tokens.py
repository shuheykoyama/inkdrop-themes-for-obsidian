#!/usr/bin/env python3
"""Parse @inkdropapp/css stylesheets and build a custom-property reference graph.

Usage: python3 -I analyze_tokens.py <repos_dir> <out_csv> <out_json>
"""
import csv
import json
import os
import re
import sys
from collections import defaultdict

REPOS = sys.argv[1]
OUT_CSV = sys.argv[2]
OUT_JSON = sys.argv[3]
CSS_DIR = os.path.join(REPOS, 'inkdropapp_css')
FILES = ['tokens.css', 'utilities.css', 'ui.css', 'status.css', 'task-progress.css',
         'tags.css', 'syntax.css', 'markdown.css', 'mermaid.css', 'reset.css']

VAR_RE = re.compile(r'var\(\s*(--[A-Za-z0-9_-]+)')


def strip_comments(src):
    # replace /* ... */ with spaces, keeping newlines so line numbers survive
    out = []
    i = 0
    n = len(src)
    in_str = None
    while i < n:
        c = src[i]
        if in_str:
            out.append(c)
            if c == '\\' and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ('"', "'"):
            in_str = c; out.append(c); i += 1; continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            j = n if j == -1 else j + 2
            out.append(''.join('\n' if ch == '\n' else ' ' for ch in src[i:j]))
            i = j
            continue
        out.append(c); i += 1
    return ''.join(out)


def parse(path):
    """Yield (kind, prop, value, line, stack) for every declaration."""
    src = strip_comments(open(path, encoding='utf-8').read())
    stack = []  # list of block preludes
    buf_start = 0
    depth_paren = 0
    in_str = None
    i = 0
    n = len(src)
    decls = []

    def line_of(pos):
        return src.count('\n', 0, pos) + 1

    def flush_decl(start, end):
        text = src[start:end]
        stripped = text.strip()
        if not stripped or ':' not in stripped:
            return
        lead = len(text) - len(text.lstrip())
        pos = start + lead
        prop, _, val = stripped.partition(':')
        prop = prop.strip()
        if not re.match(r'^(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9_-]*)$', prop):
            return
        decls.append((prop, ' '.join(val.split()), line_of(pos), list(stack)))

    while i < n:
        c = src[i]
        if in_str:
            if c == '\\':
                i += 2; continue
            if c == in_str:
                in_str = None
            i += 1; continue
        if c in ('"', "'"):
            in_str = c
        elif c == '(':
            depth_paren += 1
        elif c == ')':
            depth_paren -= 1
        elif depth_paren == 0 and c == ';':
            flush_decl(buf_start, i); buf_start = i + 1
        elif depth_paren == 0 and c == '{':
            prelude = ' '.join(src[buf_start:i].split())
            stack.append(prelude); buf_start = i + 1
        elif depth_paren == 0 and c == '}':
            flush_decl(buf_start, i)
            if stack:
                stack.pop()
            buf_start = i + 1
        i += 1
    return decls


def layer_of(stack):
    layers = [s[len('@layer '):].strip() for s in stack if s.startswith('@layer')]
    return '.'.join(layers) if layers else '(unlayered)'


def cond_of(stack):
    parts = [s for s in stack if not s.startswith('@layer')]
    return ' > '.join(parts)


defs = []           # custom property definitions
uses = defaultdict(list)   # token -> list of "file:line selector prop"
for f in FILES:
    for prop, val, line, stack in parse(os.path.join(CSS_DIR, f)):
        if prop.startswith('--'):
            defs.append(dict(token=prop, file=f, line=line, layer=layer_of(stack),
                             cond=cond_of(stack), value=val,
                             refs=sorted(set(VAR_RE.findall(val)))))
        for ref in VAR_RE.findall(val):
            if not prop.startswith('--'):
                uses[ref].append(f'{f}:{line} [{cond_of(stack)}] {prop}')

# consumers in base-ui-theme LESS sources (component rules)
less_uses = defaultdict(list)
bui = os.path.join(REPOS, 'inkdropapp_base-ui-theme', 'src')
for root, _, files in os.walk(bui):
    for fn in files:
        if not fn.endswith(('.less', '.overrides', '.variables')):
            continue
        p = os.path.join(root, fn)
        for ln, text in enumerate(open(p, encoding='utf-8'), 1):
            for ref in VAR_RE.findall(text):
                less_uses[ref].append(os.path.relpath(p, os.path.join(REPOS, 'inkdropapp_base-ui-theme')) + f':{ln}')

# consumers in the mermaid plugin's theme.ts (token suffix strings)
mermaid_ts = open(os.path.join(REPOS, 'inkdropapp_mermaid', 'packages', 'mermaid', 'src', 'theme.ts'),
                  encoding='utf-8').read()
mermaid_suffixes = set(re.findall(r":\s*'([a-z0-9-]+)'", mermaid_ts)) | {'surface-background-color', 'surface-border-color'}

defined = {d['token'] for d in defs}
referenced_in_defs = defaultdict(list)
for d in defs:
    for r in d['refs']:
        referenced_in_defs[r].append(d['token'])

rows = []
for d in defs:
    t = d['token']
    notes = []
    v = d['value']
    if 'light-dark(' in v:
        notes.append('light-dark')
    if 'color-mix(' in v:
        notes.append('color-mix')
    undefined = [r for r in d['refs'] if r not in defined]
    if undefined:
        notes.append('refs-undefined:' + '|'.join(undefined))
    if re.search(r'var\(--[A-Za-z0-9_-]+\s*,', v):
        notes.append('has-var-fallback')
    consumers = []
    if uses.get(t):
        consumers.append(f'css-rules:{len(uses[t])}')
    if less_uses.get(t):
        consumers.append(f'base-ui-theme-less:{len(less_uses[t])}')
    if t.startswith('--mermaid-') and t[len('--mermaid-'):] in mermaid_suffixes:
        consumers.append('mermaid-theme.ts')
    if referenced_in_defs.get(t):
        consumers.append(f'tokens:{len(set(referenced_in_defs[t]))}')
    notes.append('consumers=' + (','.join(consumers) if consumers else 'none-in-public-sources'))
    rows.append([t, f"{d['file']}:{d['line']}", d['layer'], d['cond'] or ':root', v,
                 ' '.join(d['refs']), '; '.join(notes)])

os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
with open(OUT_CSV, 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh)
    w.writerow(['token', 'defined_in', 'layer', 'selector_condition', 'raw_value', 'references', 'notes'])
    w.writerows(rows)

# summary for the report
all_refs = set(uses) | set(less_uses) | set(referenced_in_defs)
summary = {
    'definition_count': len(defs),
    'unique_tokens': len(defined),
    'per_file': {f: len({d['token'] for d in defs if d['file'] == f}) for f in FILES},
    'per_layer': {},
    'conditional_defs': [(d['token'], f"{d['file']}:{d['line']}", d['cond']) for d in defs if d['cond'] != ':root'],
    'referenced_but_undefined_in_css_pkg': sorted(r for r in all_refs if r not in defined),
    'undefined_refs_from_css_pkg_rules_or_tokens': sorted(r for r in (set(uses) | set(referenced_in_defs)) if r not in defined),
    'light_dark_count': sum('light-dark(' in d['value'] for d in defs),
    'color_mix_count': sum('color-mix(' in d['value'] for d in defs),
    'no_consumer_in_public_sources': sorted({r[0] for r in rows if 'none-in-public-sources' in r[6]}),
    'rule_uses': {k: v for k, v in uses.items()},
}
for d in defs:
    summary['per_layer'][d['layer']] = summary['per_layer'].get(d['layer'], 0) + 1
json.dump(summary, open(OUT_JSON, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps({k: summary[k] for k in ['definition_count', 'unique_tokens', 'per_file', 'per_layer',
                                           'light_dark_count', 'color_mix_count']}, indent=1))
print('conditional:', len(summary['conditional_defs']))
for c in summary['conditional_defs']:
    print('  ', c)
print('undefined refs (css pkg):', summary['undefined_refs_from_css_pkg_rules_or_tokens'])
print('undefined refs incl. base-ui-theme:', len(summary['referenced_but_undefined_in_css_pkg']))
print('no consumer count:', len(summary['no_consumer_in_public_sources']))

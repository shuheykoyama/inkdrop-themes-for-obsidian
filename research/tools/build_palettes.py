#!/usr/bin/env python3
"""Build research/data/inkdrop-palettes.json from theme CSS + upstream sources."""
import re, json, colorsys, sys, os
R, OUT = sys.argv[1], sys.argv[2]
SH = {l.split()[0]: l.split()[1][:7] for l in open(os.path.join(R, '..', 'repo-shas.txt')) if l.strip()}

def hsl_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb((h / 360) % 1, l / 100, s / 100)
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g, b))

def parse_triplet(t):
    h, s, l = t.replace('deg', '').replace('%', '').split()
    return float(h), float(s), float(l)

def dist(a, b):
    a = [int(a[i:i+2], 16) for i in (1, 3, 5)]; b = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return max(abs(x - y) for x, y in zip(a, b))

# --- Solarized Dark (ramps) ---
sd = 'inkdropapp_solarized-dark'
p = f'{R}/{sd}/styles/tokens.css'
ramps = {}
for i, line in enumerate(open(p), 1):
    m = re.match(r'\s*--hsl-(\w+)-(\d+):\s*([^;]+);\s*(?:/\*\s*(.*?)\s*\*/)?', line)
    if m:
        fam, step, val, cm = m.groups()
        h, s, l = parse_triplet(val)
        ramps.setdefault(fam, []).append(dict(step=int(step), hsl=val.strip(), hex=hsl_hex(h, s, l),
                                              comment=cm, source=f'{sd}@{SH[sd]} styles/tokens.css:{i}'))
# Osaka palette
osaka = {}
op = f'{R}/craftzdog_solarized-osaka.nvim/lua/solarized-osaka/colors.lua'
in_default = False
for i, line in enumerate(open(op), 1):
    if line.startswith('M.default'): in_default = True
    elif in_default and line.startswith('}'): in_default = False
    m = re.match(r'\s*(\w+)\s*=\s*hsl\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)', line)
    if in_default and m:
        n, h, s, l = m.group(1), *map(float, m.groups()[1:])
        osaka[n] = dict(hsl=(h, s, l), hex=hsl_hex(h, s, l), line=i)
fam_map = {'pink': 'magenta'}
for fam, lst in ramps.items():
    for e in lst:
        trip = parse_triplet(e['hsl'])
        hits = [n for n, o in osaka.items() if all(abs(a - b) < 1e-6 for a, b in zip(o['hsl'], trip))]
        e['osaka_match'] = hits
solarized16 = {  # https://ethanschoonover.com/solarized/ (fetched 2026-10-09)
    'base03': '#002b36', 'base02': '#073642', 'base01': '#586e75', 'base00': '#657b83', 'base0': '#839496',
    'base1': '#93a1a1', 'base2': '#eee8d5', 'base3': '#fdf6e3', 'yellow': '#b58900', 'orange': '#cb4b16',
    'red': '#dc322f', 'magenta': '#d33682', 'violet': '#6c71c4', 'blue': '#268bd2', 'cyan': '#2aa198', 'green': '#859900'}
osaka_vs_orig = {k: dict(original=v, osaka=osaka.get(k, {}).get('hex'),
                         max_channel_diff=dist(v, osaka[k]['hex']) if k in osaka else None)
                 for k, v in solarized16.items()}

# --- Kanagawa Dragon (named) ---
kd = 'inkdropapp_kanagawa'
kp = f'{R}/{kd}/packages/dragon/styles/palette.css'
up = {}
for line in open(f'{R}/rebelot_kanagawa.nvim/lua/kanagawa/colors.lua'):
    m = re.match(r'\s*(\w+)\s*=\s*"(#[0-9A-Fa-f]{6})"', line)
    if m: up[m.group(1)] = m.group(2).lower()
dragon = []
group = None
for i, line in enumerate(open(kp), 1):
    g = re.match(r'\s*/\*\s*(.*?)\s*\*/\s*$', line)
    if g and '--' not in line: group = g.group(1)
    m = re.match(r'\s*--kanagawa-(\w+):\s*([^;]+);\s*/\*\s*(#[0-9A-Fa-f]{6})\s*(?:\((.*?)\))?\s*\*/', line)
    if m:
        n, val, hx, role = m.groups()
        h, s, l = parse_triplet(val)
        fromhsl = hsl_hex(h, s, l)
        dragon.append(dict(name=n, group=group, hsl=val.strip(), hex_comment=hx.lower(), hex_from_hsl=fromhsl,
                           hsl_rounding_max_channel_diff=dist(hx.lower(), fromhsl),
                           role_comment=role, upstream_hex=up.get(n),
                           upstream_match=(up.get(n) == hx.lower()),
                           source=f'{kd}@{SH[kd]} packages/dragon/styles/palette.css:{i}'))
out = {
  'generated': '2026-10-09',
  'generator': 'scratchpad/scripts/build_palettes.py (static parse; hex computed from declared HSL)',
  'solarized-dark': {
    'repo': f'{sd}@{SH[sd]}', 'model': 'ramp override of @inkdropapp/css --hsl-<family>-<50..950> in @layer theme',
    'ramps': ramps,
    'note': 'pink ramp = Solarized magenta; families not listed (rose, fuchsia, purple, indigo, sky, teal, emerald, lime, amber, stone, zinc, gray, slate) are inherited from @inkdropapp/css tokens.css'},
  'solarized-osaka-default': {'repo': f'craftzdog_solarized-osaka.nvim@{SH["craftzdog_solarized-osaka.nvim"]}',
                              'colors': {k: dict(hsl=list(v['hsl']), hex=v['hex'], line=v['line']) for k, v in osaka.items()}},
  'solarized-original-16': {'source': 'https://ethanschoonover.com/solarized/', 'colors': solarized16,
                            'vs_osaka': osaka_vs_orig},
  'kanagawa-dragon': {'repo': f'{kd}@{SH[kd]}', 'model': 'named palette --kanagawa-* (HSL triplets), unlayered :root; base ramps untouched',
                      'colors': dragon},
  'kanagawa-nvim-upstream': {'repo': f'rebelot_kanagawa.nvim@{SH["rebelot_kanagawa.nvim"]}',
                             'colors': {k: v for k, v in up.items() if k in {d["name"] for d in dragon}}},
}
json.dump(out, open(OUT, 'w'), indent=2, ensure_ascii=False)
for d in dragon:
    print(f"{d['name']:14} {d['hsl']:18} cmt={d['hex_comment']} hsl->{d['hex_from_hsl']} diff={d['hsl_rounding_max_channel_diff']:2} up={d['upstream_hex']} {'OK' if d['upstream_match'] else 'DIFF'} {d['role_comment'] or ''}")
for f, l in ramps.items():
    print(f, [(e['step'], e['hex'], e['osaka_match']) for e in l])
for k, v in osaka_vs_orig.items(): print(k, v)

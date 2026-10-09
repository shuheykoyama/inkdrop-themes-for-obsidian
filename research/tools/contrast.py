"""WCAG 2.x contrast ratios for key Inkdrop fg/bg token pairs (declared values).

Alpha foregrounds are composited over the given background before measuring.
usage: python3 -I contrast.py <research_dir>
"""
import csv
import re
import sys
from pathlib import Path

research = Path(sys.argv[1])


def load(name):
    with open(research / "data" / name, newline="") as f:
        return {r["token"]: r["resolved_value"] for r in csv.DictReader(f)}


def parse(v):
    # accept #rgb[a] / #rrggbb[aa]; take first hex color in the value
    m = re.search(r"#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b", v)
    if not m:
        return None
    h = m.group(1)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
    return r, g, b, a


def over(fg, bg):
    # straight alpha compositing of fg onto an opaque bg
    a = fg[3]
    return tuple(round(fg[i] * a + bg[i] * (1 - a)) for i in range(3)) + (1.0,)


def lum(c):
    def ch(x):
        x /= 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


PAIRS = [
    ("本文 / エディタ", "--editor-foreground-color", "--editor-background-color"),
    ("プレビュー本文 / エディタ", "--text-color", "--editor-background"),
    ("muted / エディタ", "--muted-text-color", "--editor-background"),
    ("light / エディタ", "--light-text-color", "--editor-background"),
    ("コメント / エディタ", "--syntax-comment-color", "--editor-background-color"),
    ("ガター文字 / エディタ", "--editor-gutter-color", "--editor-background-color"),
    ("見出し / エディタ", "--syntax-heading-1-color", "--editor-background-color"),
    ("リンク(preview) / エディタ", "--mde-preview-link-color", "--editor-background"),
    ("リンク(editor) / エディタ", "--syntax-link-color", "--editor-background-color"),
    ("サイドバー項目 / サイドバー", "--sidebar-menu-item-color", "--sidebar-background"),
    ("サイドバー節見出し / サイドバー", "--sidebar-menu-section-color", "--sidebar-background"),
    ("ノート抜粋 / ノートリスト", "--note-list-view-item-color", "--note-list-bar-background"),
    ("日付 / ノートリスト", "--note-list-view-item-date-color", "--note-list-bar-background"),
    ("disabled / エディタ", "--disabled-text-color", "--editor-background"),
    ("primary ボタン文字 / primary", "--primary-button-text-color", "--primary-color"),
]

out = []
for theme, fn in (("Solarized Dark", "inkdrop-solarized-dark-tokens.csv"),
                  ("Kanagawa Dragon", "inkdrop-kanagawa-dragon-tokens.csv")):
    t = load(fn)
    for label, fg_t, bg_t in PAIRS:
        fg, bg = parse(t.get(fg_t, "")), parse(t.get(bg_t, ""))
        if not fg or not bg:
            out.append((theme, label, fg_t, bg_t, "n/a", "n/a"))
            continue
        if bg[3] < 1:  # translucent bg: composite over editor bg as a fallback
            bg = over(bg, parse(t["--editor-background-color"]))
        r = ratio(over(fg, bg), bg)
        verdict = "AA" if r >= 4.5 else ("AA-large" if r >= 3 else "fail")
        out.append((theme, label, fg_t, bg_t, f"{r:.2f}", verdict))

with open(research / "data" / "inkdrop-contrast.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["theme", "pair", "fg_token", "bg_token", "contrast_ratio", "wcag_text"])
    w.writerows(out)
for row in out:
    print(row)

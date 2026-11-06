# python3 -I tools/extract-tok-table.py <Inkdrop renderer/assets/app-*.js> > src/tok-table.js
# Cuts the preview highlighter's class table (the `tok-*` tagHighlighter rows, `Tb=g([...])` in Inkdrop 6.3.0's
# bundle) out of the renderer bundle. `k` stands for @lezer/highlight's `tags`.
import sys
s = open(sys.argv[1], encoding="utf8", errors="ignore").read()
marker = "Tb=g(["            # the name Tb is minifier output: look for the row `{tag:k.comment,class:`tok-comment`}` if it moves
i = s.find(marker)
if i < 0:
    sys.exit("table not found: search the bundle for 'tok-line-comment' and adjust the marker")
j = i + len(marker) - 1
depth = 0
for k in range(j, len(s)):
    if s[k] == "[": depth += 1
    elif s[k] == "]":
        depth -= 1
        if depth == 0:
            print("export const tags = t => { const k = t; return " + s[j:k + 1] + " }")
            break

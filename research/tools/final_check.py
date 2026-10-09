"""Integrity check for research/.

Checks
  1. relative Markdown links resolve (research/*.md and research/tools/README.md)
  2. every data file parses (CSV without ragged rows, JSON)
  3. IDs defined in 09 (Q-D / V / U), 07 (R) and 06 (W/N/E/G/O) are unique
  4. every ID referenced anywhere in the Markdown is defined
  5. 06 Markdown table and mapping-candidates.csv agree on classification / confidence / consumer

usage: python3 -I final_check.py <research_dir>     (exit status 1 when a problem is found)
"""
import csv
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
problems = []
docs = sorted(root.glob("*.md")) + [root / "tools" / "README.md"]
texts = {p: p.read_text(encoding="utf-8") for p in docs if p.exists()}

# 1. Relative links ([text](path), not URLs or in-page anchors) must point at existing files.
link_re = re.compile(r"\]\(([^)\s]+)\)")
for md, text in texts.items():
    for n, line in enumerate(text.splitlines(), 1):
        for target in link_re.findall(line):
            if re.match(r"^(https?:|mailto:|#)", target):
                continue
            path = target.split("#", 1)[0]
            if path and not (md.parent / path).exists():
                problems.append(f"broken link {md.name}:{n} -> {target}")

# 2. Data files parse.
for f in sorted((root / "data").iterdir()):
    if f.suffix == ".csv":
        with open(f, newline="", encoding="utf-8") as fh:
            rows = list(csv.reader(fh))
        width = len(rows[0])
        ragged = [i + 1 for i, r in enumerate(rows) if len(r) != width]
        print(f"{f.name}: {len(rows) - 1} rows x {width} cols; ragged={ragged[:5]}")
        if ragged:
            problems.append(f"ragged rows in {f.name}: {ragged[:5]}")
    elif f.suffix == ".json":
        json.loads(f.read_text(encoding="utf-8"))
        print(f"{f.name}: JSON ok")

# 3. Defined IDs: first table cell of a row in the owning document.
def defined(doc, pattern):
    ids = re.findall(rf"^\| ({pattern}) \|", texts[root / doc], re.M)
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        problems.append(f"duplicate ids in {doc}: {dup}")
    return set(ids)

q_d = defined("09-open-questions.md", r"Q-D\d+")
v = defined("09-open-questions.md", r"V-\d+")
u = defined("09-open-questions.md", r"U-\d+")
r = defined("07-technical-risks.md", r"R\d\d")
m = defined("06-mapping-candidates.md", r"[WNEGO]\d\d")
print(f"defined: Q-D {len(q_d)}, V {len(v)}, U {len(u)}, R {len(r)}, 06 rows {len(m)}")

# 4. References. "09 V-12" style and bare "Q-D4" both count; "R-01" (review IDs in 10) are excluded.
for md, text in texts.items():
    for ref in set(re.findall(r"\bQ-D\d+\b", text)) - q_d:
        problems.append(f"undefined {ref} in {md.name}")
    for ref in set(re.findall(r"\bV-\d+\b", text)) - v:
        problems.append(f"undefined {ref} in {md.name}")
    for ref in set(re.findall(r"\bU-\d+\b", text)) - u:
        problems.append(f"undefined {ref} in {md.name}")
    for ref in set(re.findall(r"\b07 (R\d\d)\b", text)) - r:
        problems.append(f"undefined 07 {ref} in {md.name}")
    for ref in set(re.findall(r"\b06 ([WNEGO]\d\d)\b", text)) - m:
        problems.append(f"undefined 06 {ref} in {md.name}")

# 5. 06 Markdown vs CSV: same classification, confidence and consumer per ID.
md_rows = {}
for line in texts[root / "06-mapping-candidates.md"].splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split(" | ")]
    if re.fullmatch(r"[WNEGO]\d\d", cells[0]) and len(cells) >= 9:
        md_rows[cells[0]] = (cells[3], cells[7], cells[8])
with open(root / "data" / "mapping-candidates.csv", newline="", encoding="utf-8") as fh:
    csv_rows = {row["id"]: (row["classification"], row["confidence"], row["inkdrop_consumer"])
                for row in csv.DictReader(fh)}
if md_rows.keys() != csv_rows.keys():
    problems.append(f"06 md/csv id sets differ: {sorted(md_rows.keys() ^ csv_rows.keys())}")
for i in md_rows.keys() & csv_rows.keys():
    if md_rows[i] != csv_rows[i]:
        problems.append(f"06 md/csv mismatch {i}: {md_rows[i]} vs {csv_rows[i]}")
print(f"06 md rows {len(md_rows)}, csv rows {len(csv_rows)}")

print("PROBLEMS:", problems or "none")
sys.exit(1 if problems else 0)

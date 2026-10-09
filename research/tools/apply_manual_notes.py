"""Append hand-written notes to obsidian-css-variables-1.14.4.csv.

cssvars.py derives its notes mechanically. A few facts (documentation typos, variables
injected as inline styles by app.js) were confirmed by reading the docs and app.js by hand;
they live in manual_notes.json and are appended here so the CSV is reproducible.

usage: python3 -I apply_manual_notes.py <csv> <manual_notes.json>
"""
import csv
import json
import sys

path, notes_path = sys.argv[1], sys.argv[2]
manual = json.load(open(notes_path, encoding="utf-8"))

with open(path, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fields = reader.fieldnames
    rows = list(reader)
if not fields:
    raise SystemExit(f"no header row in {path}")

seen = set()
for r in rows:
    extra = manual.get(r["variable"])
    if extra is None:
        continue
    seen.add(r["variable"])
    # Mechanical notes come first; the manual note is joined with the same "; " separator.
    r["notes"] = f'{r["notes"]}; {extra}' if r["notes"] else extra

missing = set(manual) - seen
if missing:
    raise SystemExit(f"manual notes for unknown variables: {sorted(missing)}")

with open(path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
print(f"applied {len(seen)} manual notes")

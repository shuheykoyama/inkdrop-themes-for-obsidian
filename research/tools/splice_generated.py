"""Replace the generated block of a Markdown file with a freshly generated fragment.

The block is delimited by the lines "<!-- BEGIN generated -->" and "<!-- END generated -->".
With --check, nothing is written; the exit status is 1 when the block differs from the fragment.

usage: python3 -I splice_generated.py <markdown> <fragment> [--check]
"""
import sys
from pathlib import Path

BEGIN, END = "<!-- BEGIN generated -->", "<!-- END generated -->"

md_path, frag_path = Path(sys.argv[1]), Path(sys.argv[2])
check = "--check" in sys.argv[3:]

text = md_path.read_text(encoding="utf-8")
fragment = frag_path.read_text(encoding="utf-8").strip("\n")

head, sep1, rest = text.partition(BEGIN + "\n")
body, sep2, tail = rest.partition("\n" + END)
if not (sep1 and sep2):
    raise SystemExit(f"markers not found in {md_path}")

if check:
    same = body.strip("\n") == fragment
    print(f"{md_path.name}: generated block {'MATCH' if same else 'DIFF'}")
    sys.exit(0 if same else 1)

md_path.write_text(head + BEGIN + "\n" + fragment + "\n" + END + tail, encoding="utf-8")
print(f"spliced {frag_path.name} into {md_path.name}")

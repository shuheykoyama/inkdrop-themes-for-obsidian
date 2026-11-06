# python3 -I tools/mk-big.py > data/big-body.md : three large blocks (1500-line JS, 1500-line Python, one 15000-char JSON line)
import json
js = """// module %d
import { readFile } from "fs";
const answer%d = 42, ratio = 1.5, ok = true, none = null;
let re = /ab+c/g;
class Shape%d extends Base {
  constructor(size) { super(); this.size = size; }
  area() { return this.size * 2; }
}
function greet%d(name) {
  if (name !== undefined) return `hi ${name}`;
  console.log(name.length, Math.max(1, 2));
}
greet%d("world");
"""
py = """# module %d
import os
from typing import List

@decorator
class Greeter%d(Base):
    \"\"\"Docstring.\"\"\"
    def greet(self, name: str, count=3) -> None:
        if name is not None and count > 0:
            print(f"hi {name}", len(name), True, 0x1F, 2.5)
        return [x for x in range(10) if x %% 2]
"""
n1 = js.count("\n"); n2 = py.count("\n")
jsb = "".join(js % ((i,) * 5) for i in range(1500 // n1))
pyb = "".join(py % ((i,) * 2) for i in range(1500 // n2))
longline = json.dumps({"k%d" % i: {"name": "v%d" % i, "n": i, "ok": True, "list": [1, 2, 3, None]} for i in range(250)}, separators=(",", ":"))
print("# Big blocks\n\n```js\n" + jsb.rstrip("\n") + "\n```\n\n```python\n" + pyb.rstrip("\n") + "\n```\n\n```json\n" + longline + "\n```")

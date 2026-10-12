# Code blocks

```js
// line comment
/* block comment */
import { readFile } from "fs";
const answer = 42, ratio = 1.5, ok = true, none = null;
let re = /ab+c/g;
class Shape extends Base {
  constructor(size) { super(); this.size = size; }
  area() { return this.size * 2; }
}
function greet(name) {
  if (name !== undefined) return `hi ${name}`;
  console.log(name.length, Math.max(1, 2));
}
greet("world");
```

```ts
interface Point { x: number; label?: string }
type Id = string | number;
enum Color { Red, Green }
export function move(p: Point, dx: number): Point {
  const next: Point = { ...p, x: p.x + dx };
  return next as Point;
}
```

```python
# comment
import os
from typing import List

@decorator
class Greeter(Base):
    """Docstring."""
    def greet(self, name: str, count=3) -> None:
        if name is not None and count > 0:
            print(f"hi {name}", len(name), True, 0x1F, 2.5)
        return None
```

```css
/* comment */
@media (max-width: 600px) {
  .card > a:hover, #main::before {
    color: #ff0000;
    margin: 0 auto 12px;
    font-family: "Inter", sans-serif !important;
    width: calc(100% - 2em);
  }
}
```

```html
<!-- comment -->
<!DOCTYPE html>
<div class="box" id="main" hidden>
  <a href="https://example.com">link &amp; text</a>
</div>
```

```json
{
  "name": "demo",
  "count": 3,
  "ratio": -0.5,
  "enabled": false,
  "tags": ["a", "b"],
  "empty": null
}
```

```sh
#!/bin/sh
# comment
NAME="world"
export PATH="$HOME/bin:$PATH"
if [ -n "$NAME" ]; then
  echo "hi ${NAME}" | grep -c hi > /dev/null 2>&1
fi
for f in *.txt; do cat "$f"; done
```

```go
// comment
package main

import "fmt"

type Point struct {
	X, Y int
}

func (p *Point) Move(dx int) error {
	p.X += dx
	fmt.Println("moved", p.X, 3.14, true, nil)
	return nil
}
```

```rust
// comment
use std::collections::HashMap;

#[derive(Debug)]
struct Point { x: i32, y: i32 }

fn main() -> Result<(), String> {
    let mut map: HashMap<&str, i32> = HashMap::new();
    map.insert("one", 1);
    println!("{:?} {}", map, 2.5);
    Ok(())
}
```

```yaml
# comment
name: demo
version: 1.2
enabled: true
items:
  - "quoted"
  - plain
anchor: &base
  key: value
ref: *base
```

```sql
-- comment
SELECT id, name AS label, COUNT(*)
FROM users u
WHERE u.age > 21 AND u.name LIKE 'A%'
GROUP BY id
ORDER BY name DESC;
```

```markdown
# Heading
Some *emphasis*, **strong** and `code`.
- item
[link](https://example.com)
```

## Fence name aliases

```javascript
const s = `x ${y}`; console.log(s);
```

```typescript
function id(v: number): number { return v; }
```

```py
def area(r): return len(r)
```

```bash
ls -la "$HOME" | grep -c x
```

```shell
cat "$FILE"; echo done
```

```zsh
for f in *.md; do wc -l "$f"; done
```

```yml
count: 3
on: true
```

```rs
fn main() { let x = 2.0; }
```

```md
**bold** and [a](https://example.com)
```

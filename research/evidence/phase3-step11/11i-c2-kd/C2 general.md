# C2 general

General code, not the test note's: variables, functions, type names, literals and operators.

```js
import { readFile } from "node:fs/promises";
const limit = 10;
let total = 0;
async function loadItems(path, options = {}) {
  const text = await readFile(path, "utf8");
  const items = JSON.parse(text).filter((item) => item.count > limit);
  for (const item of items) total += item.count * 2;
  return { items, total, ok: items.length !== 0 && !options.strict };
}
class Cache extends Map {
  get size() { return super.size; }
}
export default loadItems;
```

```javascript
const users = [{ name: "Ada", age: 36 }, { name: "Linus", age: 28 }];
const names = users.map((u) => u.name.toUpperCase());
console.log(names.join(", "), users.length >= 2 ? "many" : "few");
```

```ts
interface Point { x: number; y: number }
type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };
export function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    default: return shape.side * shape.side;
  }
}
const origin: Point = { x: 0, y: 0 };
let scale = 1.5 as const;
```

```typescript
enum Level { Low = 1, High }
const pick = <T, K extends keyof T>(obj: T, key: K): T[K] => obj[key];
const level: Level = Level.High;
console.log(pick(origin, "x") + level);
```

```python
import os
from dataclasses import dataclass

@dataclass
class Job:
    name: str
    retries: int = 3

def run(jobs: list[Job], dry_run: bool = False) -> dict[str, int]:
    results = {}
    for job in jobs:
        if job.retries > 0 and not dry_run:
            results[job.name] = len(job.name) * 2
    return results

print(run([Job("build"), Job("test", retries=0)]), os.getcwd(), None, True)
```

```py
count = sum(x * x for x in range(10) if x % 2 == 0)
print(f"count={count}", [n for n in range(3)])
```

```go
package main

import (
	"fmt"
	"strings"
)

type Server struct {
	Name string
	Port int
}

func (s *Server) Addr() string {
	return fmt.Sprintf("%s:%d", s.Name, s.Port)
}

func main() {
	servers := []Server{{Name: "api", Port: 8080}}
	for i, srv := range servers {
		if srv.Port > 0 && i < 10 {
			fmt.Println(strings.ToUpper(srv.Addr()), nil, true)
		}
	}
}
```

```sql
SELECT o.id, c.name, SUM(i.price * i.quantity) AS total
FROM orders AS o
JOIN customers c ON c.id = o.customer_id
LEFT JOIN items i ON i.order_id = o.id
WHERE o.created_at >= '2026-01-01' AND c.active = TRUE
GROUP BY o.id, c.name
HAVING COUNT(*) > 1
ORDER BY total DESC
LIMIT 20;
```

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Report page</title></head>
<body>
  <main id="main" class="report">
    <h1>Monthly report</h1>
    <p>Total sales grew by <strong>12 %</strong> this month.</p>
    <a href="/archive">See the archive</a>
  </main>
</body>
</html>
```

```yaml
name: build
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
        env:
          CI: true
```

```yml
server:
  host: localhost
  port: 8080
  debug: false
paths: [/var/log, /tmp]
```

```markdown
# Release notes

Version **2.1** adds a `--dry-run` option and fixes *two* bugs.

- Faster start
- Smaller install
  - Fewer files

1. Update the app
2. Restart it

> Back up your data first. See [the guide](https://example.com/guide).
```

```md
## Install

Run `npm install` and then:

- open the settings
- choose a theme
```

Not in the trial (controls):

```css
.card > .title:hover { color: #336699; margin: 0 auto; font-family: sans-serif; }
@media (max-width: 600px) { .card { display: none !important; } }
```

```rust
fn main() {
    let items = vec![1, 2, 3];
    let total: i32 = items.iter().map(|x| x * 2).sum();
    println!("{} {}", total, items.len());
}
```

```sh
for f in *.log; do
  if [ -s "$f" ]; then gzip -9 "$f" && echo "done: $f"; fi
done
export PATH="$HOME/bin:$PATH"
```

```json
{ "name": "demo", "version": "1.0.0", "private": true, "files": ["dist"], "count": 3, "parent": null }
```

```
plain block without a language: const a = b + 1;
```

Inline code `const a = load(path)` and `SELECT name FROM users` stay as they are.

> [!note] Callout with code
> ```js
> const inCallout = compute(1, 2) + offset;
> ```

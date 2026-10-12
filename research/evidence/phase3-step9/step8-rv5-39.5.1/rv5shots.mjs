// Step 8 follow-up (RV5 fixes): native captures of the Reading view blocks whose classes were fixed (Python
// builtin / decorator, Shell builtin, Rust function), both themes, and the window rectangles of those tokens
// for measuring their glyph colours in the captures.
// usage: node rv5shots.mjs <vault> <out dir> <tmp dir>
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { evaluate } from "../../../../tests/runtime/lib/cdp.mjs";

const [vault, out, tmp] = process.argv.slice(2);
const repo = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const targets = [
  { block: "python", scroll: "```python", tokens: [["builtin", "variable-name-function"], ["decorator", "meta"]] },
  { block: "sh", scroll: "```sh", tokens: [["builtin", "variable-name-standard"]] },
  { block: "rust", scroll: "```rust", tokens: [["function", "property-name-function"]] },
];
const rows = [];
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  for (const t of targets) {
    const tag = `rv5-${t.block}`;
    const r = spawnSync("bash", [`${repo}/tests/visual/capture-obsidian.sh`, theme, "opaque", "gray", "active", vault, out, tmp], {
      env: { ...process.env, CAPTURE_NOTE: "Code blocks.md", CAPTURE_VIEW: "reading", CAPTURE_SCROLL: t.scroll, CAPTURE_TAG: tag }, encoding: "utf8" });
    if (r.status !== 0) { console.error(`capture failed: ${theme} ${tag}\n${r.stderr}`); continue; }
    // Token rectangles (CSS px from the window's top-left) of the first code block of that language.
    const rects = await evaluate(9333, `(() => {
      const code = document.querySelector(".workspace-leaf.mod-active .markdown-rendered pre > code.language-${t.block}");
      const probe = document.body.createEl("span");
      const res = ${JSON.stringify(t.tokens)}.flatMap(([cls, v]) => [...code.querySelectorAll(".token." + cls)].map((e) => {
        const r = e.getBoundingClientRect();
        probe.style.color = "var(--ink-syntax-" + v + "-color)";
        return { cls, text: e.textContent, x: r.left, y: r.top, w: r.width, h: r.height, computed: getComputedStyle(e).color, expectedVar: v, expected: getComputedStyle(probe).color };
      }));
      probe.remove();
      return res;
    })()`);
    for (const x of rects) rows.push({ theme, block: t.block, png: `obsidian-${theme}-opaque-gray-active-reading-${tag}.png`, ...x });
  }
}
writeFileSync(`${out}/rv5-token-rects.json`, JSON.stringify(rows, null, 1));
console.log(rows.map((r) => `${r.theme} ${r.block} ${r.cls} "${r.text}" computed ${r.computed} expected ${r.expected}`).join("\n"));

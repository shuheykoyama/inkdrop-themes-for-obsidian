// C1-a side effects (research/14 §6.139): compares two c1-probe.mjs results (before / after the CSS change), per
// theme, note and view: which elements the Reading --code-normal reaches (marker colour test of the "before" run)
// and which elements changed any recorded property, grouped by the element and the change.
//
// usage: node c1-compare.mjs <before.json> <after.json>
import { readFileSync } from "node:fs";

const PROPS = ["color", "background", "border-top", "border-left", "text-decoration", "fill", "stroke", "display"];
const [before, after] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, "utf8")).results);
for (const a of after) {
  const b = before.find((x) => x.theme === a.theme && x.file === a.file && x.mode === a.mode);
  const both = Object.keys(a.base).filter((k) => k in b.base);
  const changed = both.filter((k) => a.base[k].v !== b.base[k].v);
  const reached = new Set(b.reached);
  const groups = {};
  for (const k of changed) {
    const from = b.base[k].v.split(" | "), to = a.base[k].v.split(" | ");
    const what = from.map((v, i) => (v !== to[i] ? `${PROPS[i]} ${v} -> ${to[i]}` : null)).filter(Boolean).join("; ");
    const el = k.split("/").at(-1).replace(/:\d+$/, "");
    const key = `${reached.has(k) ? "reached" : "not reached (own rule)"} ${el}: ${what}`;
    groups[key] = (groups[key] ?? 0) + 1;
  }
  console.log(`${a.theme} ${a.file} ${a.mode}: ${Object.keys(b.base).length} / ${Object.keys(a.base).length} elements, ${both.length} compared, reached ${b.reached.length}, changed ${changed.length}; hover popover ${b.popover} / ${a.popover}; editors inside .markdown-rendered ${b.editorsInRendered.length} / ${a.editorsInRendered.length}; .formula-editor ${b.formulaEditors} / ${a.formulaEditors}`);
  for (const [k, n] of Object.entries(groups)) console.log(`  ${n} x ${k}`);
}

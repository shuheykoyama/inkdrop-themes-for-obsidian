// Per-check comparison of two tests/runtime/run.mjs results (before: the final build; after: the trial build):
// state changes, checks only on one side, and the detail text of the new checks.
// usage: node compare-runtime.mjs <before.json> <after.json>
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")).results);
const key = (r) => [r.id, r.theme, r.platform, r.appearance, r.state].join(" | ");
const ma = new Map(a.map((r) => [key(r), r])), mb = new Map(b.map((r) => [key(r), r]));
const changed = [...mb].filter(([k, r]) => ma.has(k) && ma.get(k).status !== r.status);
const onlyA = [...ma.keys()].filter((k) => !mb.has(k)), onlyB = [...mb].filter(([k]) => !ma.has(k));
const count = (l) => l.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
console.log(`before ${a.length} results ${JSON.stringify(count(a))}\nafter  ${b.length} results ${JSON.stringify(count(b))}`);
console.log(`state changes in checks present on both sides: ${changed.length}`);
for (const [k, r] of changed) console.log(`  ${k}: ${ma.get(k).status} -> ${r.status}`);
console.log(`only before: ${onlyA.length}; only after: ${onlyB.length}`);
for (const [k, r] of onlyB) console.log(`  ${r.status} ${k} -- ${r.detail}`);

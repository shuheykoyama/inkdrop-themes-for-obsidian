// node check-versions.mjs <extracted Inkdrop renderer/assets dir>
// Static drift check: every Lezer grammar in Inkdrop's renderer bundle (identified by its nodeNames table) must be
// byte-identical to one in the packages this plugin bundles. Legacy (StreamLanguage) modes and Inkdrop's own grammars
// carry no such table: they are covered by the dynamic suite (lang-run.sh), not here.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const dir = process.argv[2];
const NODE_NAMES = /nodeNames:\s*[`"']((?:[^`"'\\]|\\.)*)[`"']/g;
const mine = new Map();
const root = path.resolve("node_modules");
for (const scope of ["@lezer", "@codemirror"]) for (const pkg of readdirSync(path.join(root, scope))) {
  if (scope === "@codemirror" && !pkg.startsWith("lang-")) continue;
  const f = path.join(root, scope, pkg, "dist", "index.js"); let s; try { s = readFileSync(f, "utf8"); } catch { continue; }
  const version = JSON.parse(readFileSync(path.join(root, scope, pkg, "package.json"), "utf8")).version;
  for (const m of s.matchAll(NODE_NAMES)) mine.set(m[1], `${scope}/${pkg}@${version}`);
}
let same = 0; const other = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  for (const m of readFileSync(path.join(dir, f), "utf8").matchAll(NODE_NAMES)) {
    if (mine.has(m[1])) { same++; console.log(`SAME   ${f.padEnd(28)} ${mine.get(m[1])}`); } else other.push([f, m[1].slice(0, 40)]);
  }
}
for (const [f, n] of other) console.log(`OTHER  ${f.padEnd(28)} not in the plugin's packages: ${n}`);
console.log(`${same} grammars identical to the plugin's packages, ${other.length} others (Inkdrop-only or changed)`);
process.exit(0);

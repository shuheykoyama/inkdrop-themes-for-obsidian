// node check-versions.mjs <extracted Inkdrop renderer/assets dir>
// Static drift check: every Lezer grammar in Inkdrop's renderer bundle (identified by its nodeNames table) must be
// byte-identical to one in the packages this plugin bundles. Legacy (StreamLanguage) modes carry no such table: they are
// covered by the dynamic suite (lang-run.sh), not here.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const dir = process.argv[2];
const NODE_NAMES = /nodeNames:\s*[`"']((?:[^`"'\\]|\\.)*)[`"']/g;
const mine = new Map();
const root = path.resolve("node_modules");
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(c|m)?js$/.test(e.name) && !d.includes(`${path.sep}node_modules${path.sep}esbuild`) ? [path.join(d, e.name)] : []);
for (const f of walk(root)) {
  let s; try { s = readFileSync(f, "utf8"); } catch { continue; } if (s.length > 3_000_000) continue;
  const pkg = f.slice(root.length + 1).split(path.sep).slice(0, f.slice(root.length + 1).startsWith("@") ? 2 : 1).join("/");
  for (const m of s.matchAll(NODE_NAMES)) if (!mine.has(m[1])) mine.set(m[1], pkg);
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

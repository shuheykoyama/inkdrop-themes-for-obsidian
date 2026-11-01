import { readFileSync } from "node:fs";
const load = (f) => { const seen = {}; const m = new Map(); for (const r of JSON.parse(readFileSync(f)).results) { const k = [r.id, r.theme, r.platform, r.appearance, r.state].join("|"); seen[k] = (seen[k] ?? 0) + 1; m.set(`${k}#${seen[k]}`, r); } return m; };
const a = load(process.argv[2]), b = load(process.argv[3]);
let same = 0;
for (const k of new Set([...a.keys(), ...b.keys()])) {
  const x = a.get(k), y = b.get(k);
  if (x?.status === y?.status) { same++; continue; }
  console.log(`${x?.status ?? "-"} -> ${y?.status ?? "-"}  ${k}`);
}
console.log(`same status: ${same} of ${new Set([...a.keys(), ...b.keys()]).size}`);

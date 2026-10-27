// G7-1 (research/14 §6.131): per character: the tok-* classes G7-0 predicts vs the tok-* classes measured, and the measured colour vs the
// colour of the predicted --syntax-* variable in that view.
import { readFileSync } from "node:fs";
const [stat, dir] = process.argv.slice(2);
const st = JSON.parse(readFileSync(stat, "utf8"));
const toks = (c) => [...new Set((c || "").split(/[\s<]+/).filter((k) => k.startsWith("tok-")))].sort().join(" ");
for (const theme of ["solarized-dark", "kanagawa-dragon"]) for (const view of ["editor", "preview"]) {
  const r = JSON.parse(readFileSync(`${dir}/inkdrop-${theme}-g7-${view}.json`, "utf8"));
  const vc = r.result.varColors;
  let chars = 0, clsDiff = 0, colDiff = 0, nov = 0; const where = {};
  for (const [i, b] of Object.values(st).entries()) {
    const want = new Array(b.code.length).fill(null);
    for (const g of b.ranges) for (let k = g.from; k < g.to; k++) want[k] = g;
    const got = new Array(b.code.length).fill(null);
    for (const g of r.result.blocks[i].ranges) for (let k = g.from; k < g.to; k++) got[k] = g;
    for (let k = 0; k < b.code.length; k++) {
      if (/\s/.test(b.code[k])) continue;
      chars++;
      const w = want[k], g = got[k];
      const wc = toks(w?.cls), gc = toks(g?.cls);
      if (wc !== gc) { clsDiff++; const key = `${i} ${b.lang}: "${wc}" -> "${gc}"`; where[key] = (where[key] || "") + b.code[k]; }
      const v = w?.var; if (!v) { nov++; continue; }
      if (vc[v] !== g?.color) { colDiff++; const key = `${i} ${b.lang} colour ${v}=${vc[v]} got ${g?.color}`; where[key] = (where[key] || "") + b.code[k]; }
    }
  }
  console.log(`== ${theme} ${view}: ${chars} non-space chars, class diffs ${clsDiff}, colour diffs ${colDiff}, no var ${nov}`);
  for (const [k, v] of Object.entries(where)) console.log("  ", k, JSON.stringify(v.slice(0, 40)));
}

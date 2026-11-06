import { readFileSync } from "node:fs";
import { scan } from "../src/blocks.js";
const norm = (s) => s.split(/\s+/).filter((x) => x.startsWith("tok-") || x.startsWith("md-")).sort().join(" ");
const body = readFileSync("fixtures/edge-body.md", "utf8");
const S = scan(body); const region = new Array(body.length).fill(false);
for (const f of S.fences) for (let k = f.from; k < f.to; k++) region[k] = true;
if (S.front) for (let k = S.front.from; k < S.front.to; k++) region[k] = true;
for (const m of S.math) for (let k = m.from; k < m.to; k++) region[k] = true;
const ink = JSON.parse(readFileSync("data/inkdrop-edge/edge-editor.json", "utf8"));
const perChar = (runs) => { const o = []; for (const [s, c] of runs) for (const ch of s) o.push([ch, norm(c)]); return o; };
for (const mode of ["source", "live"]) {
  const ob = JSON.parse(readFileSync(`ob-edge-${mode}.json`, "utf8")); const byN = new Map(ob.lines.map((l) => [l.n, l]));
  let off = 0, n = 0, bad = 0, missingLines = 0; const badLines = [];
  for (const l of ink.lines) {
    const o = byN.get(l.n); const theirs = perChar(l.runs);
    const hasRegion = [...l.text].some((_, k) => region[off + k] && /\S/.test(l.text[k]));
    if (hasRegion && !o) { missingLines++; }
    if (o && hasRegion) {
      const mine = perChar(o.runs);
      if (mine.map((x) => x[0]).join("") !== l.text) { badLines.push(`L${l.n}:text`); }
      for (let k = 0; k < l.text.length; k++) { if (!region[off + k] || /\s/.test(l.text[k])) continue; n++; if ((mine[k]?.[1] ?? "") !== (theirs[k]?.[1] ?? "")) { bad++; badLines.push(`L${l.n}`); } }
    }
    off += l.text.length + 1;
  }
  console.log(`${mode}: chars in code regions ${bad}/${n} differ; region lines absent from the DOM: ${missingLines}; ${[...new Set(badLines)].join(" ")}`);
}
// reading view vs Inkdrop preview, element by element: Obsidian's own front-matter element (first) and Inkdrop's math element (no code) are skipped
const ip = JSON.parse(readFileSync("data/inkdrop-edge/edge-preview.json", "utf8")).blocks.filter((b) => b.codeClass !== null);
const op = JSON.parse(readFileSync("ob-edge-reading.json", "utf8")).blocks.slice(1);
let diffs = 0, total = 0, badChars = 0;
ip.forEach((b, k) => {
  const o = op[k]; const A = perChar(b.runs).filter(([ch]) => /\S/.test(ch)), C = o ? perChar(o.runs).filter(([ch]) => /\S/.test(ch)) : [];
  const txtI = b.runs.map((r) => r[0]).join("").trim(), txtO = o ? o.runs.map((r) => r[0]).join("").trim() : null;
  let bad = 0; for (let i = 0; i < Math.max(A.length, C.length); i++) { total++; if ((A[i]?.[1] ?? "") !== (C[i]?.[1] ?? "") || A[i]?.[0] !== C[i]?.[0]) bad++; }
  badChars += bad;
  if (bad || txtI !== txtO) { diffs++; console.log(`  element ${k}: ${bad} chars differ; ${txtI === txtO ? "text same" : "TEXT DIFFERS"}; obsidian class="${o?.codeClass}" | inkdrop ${JSON.stringify(txtI.slice(0, 40))}; first ink=${A[0]?.[1] ?? ""} ob=${C[0]?.[1] ?? ""}`); }
});
console.log(`reading: ${ip.length} Inkdrop code elements vs ${op.length} Obsidian (front matter element skipped); differing elements ${diffs}; chars ${badChars}/${total}`);

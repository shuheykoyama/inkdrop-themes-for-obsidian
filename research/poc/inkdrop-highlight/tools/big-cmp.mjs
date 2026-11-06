// compare Inkdrop's editor/preview, Obsidian source/live/reading, and the Node pipeline on big-body.md
import { readFileSync, existsSync } from "node:fs";
const norm = (s) => s.split(/\s+/).filter((x) => x.startsWith("tok-") || x.startsWith("md-")).sort().join(" ");
const perChar = (runs) => { const o = []; for (const [s, c] of runs) for (const ch of s) o.push([ch, norm(c)]); return o; };
const body = readFileSync("data/big-body.md", "utf8");
const ink = JSON.parse(readFileSync("data/inkdrop-big/edge-editor.json", "utf8"));
const inkLines = new Map(ink.lines.map((l) => [l.n, l]));
// code lines of the three blocks: between fences
const lines = body.split("\n"); const code = new Set(); let open = false;
lines.forEach((t, i) => { if (/^```/.test(t)) { open = !open; return; } if (open) code.add(i + 1); });
let unmeasured = 0; for (const n of code) if (!inkLines.get(n)?.runs) unmeasured++;
console.log(`Inkdrop editor: ${code.size} code lines, unmeasured ${unmeasured}`);
const coverage = (label, mapByN) => {
  let n = 0, bad = 0, absent = 0, textBad = 0; const badLines = [];
  for (const ln of code) {
    const a = inkLines.get(ln), b = mapByN.get(ln);
    if (!a?.runs) continue; if (!b) { absent++; continue; }
    const A = perChar(a.runs), B = perChar(b.runs);
    if (A.map((x) => x[0]).join("") !== B.map((x) => x[0]).join("")) textBad++;
    for (let i = 0; i < A.length; i++) { if (/\s/.test(A[i][0])) continue; n++; if ((A[i][1] ?? "") !== (B[i]?.[1] ?? "")) { bad++; if (badLines.length < 5) badLines.push(ln); } }
  }
  console.log(`${label}: chars ${bad}/${n} differ; code lines absent from the DOM ${absent}; lines with different text ${textBad}${badLines.length ? "; e.g. lines " + badLines.join(",") : ""}`);
};
for (const mode of ["source", "live"]) { const f = `ob-big-${mode}.json`; if (existsSync(f)) coverage("Obsidian " + mode, new Map(JSON.parse(readFileSync(f, "utf8")).lines.map((l) => [l.n, l]))); }
// per-line: do Inkdrop's highlighted lines stop somewhere (budget)? count code lines with no tok class at all but non-blank
let plain = 0, firstPlain = null; for (const ln of code) { const l = inkLines.get(ln); if (!l?.runs) continue; const text = l.text.trim(); if (text && !l.runs.some(([, c]) => /tok-/.test(c))) { plain++; if (!firstPlain) firstPlain = ln; } }
console.log(`Inkdrop editor: non-blank code lines with no token class: ${plain}${firstPlain ? " (first at line " + firstPlain + ")" : ""}`);
// reading vs Inkdrop preview
if (existsSync("data/inkdrop-big/edge-preview.json") && existsSync("ob-big-reading.json")) {
  const ip = JSON.parse(readFileSync("data/inkdrop-big/edge-preview.json", "utf8")).blocks.filter((b) => b.codeClass !== null), op = JSON.parse(readFileSync("ob-big-reading.json", "utf8")).blocks.filter((b) => !b.codeClass?.includes("frontmatter"));
  ip.forEach((b, k) => { const A = perChar(b.runs).filter(([c]) => /\S/.test(c)), B = op[k] ? perChar(op[k].runs).filter(([c]) => /\S/.test(c)) : []; let bad = 0; for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i]?.[0] !== B[i]?.[0] || (A[i]?.[1] ?? "") !== (B[i]?.[1] ?? "")) bad++; console.log(`reading element ${k} (${b.codeClass}): chars ${bad}/${A.length} differ`); });
}

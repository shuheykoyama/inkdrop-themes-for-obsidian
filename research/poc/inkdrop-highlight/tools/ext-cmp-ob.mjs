import { readFileSync } from "node:fs";
import { docClasses, norm } from "./predict.mjs";
const body = readFileSync("fixtures/ext-body.md", "utf8");
const { region } = docClasses(body);
const ink = JSON.parse(readFileSync("data/inkdrop-ext/edge-editor.json", "utf8"));
const perChar = (runs) => { const o = []; for (const [s, c] of runs) for (const ch of s) o.push([ch, norm(c)]); return o; };
for (const mode of ["source", "live"]) {
  const ob = JSON.parse(readFileSync(`ob-ext-${mode}.json`, "utf8")); const byN = new Map(ob.lines.map((l) => [l.n, l]));
  let off = 0, n = 0, bad = 0, absent = []; const badLines = new Set();
  for (const l of ink.lines) {
    const has = [...l.text].some((_, k) => region[off + k] && /\S/.test(l.text[k]));
    const o = byN.get(l.n);
    if (has && !o) absent.push(l.n);
    if (has && o) { const mine = perChar(o.runs), theirs = perChar(l.runs); for (let k = 0; k < l.text.length; k++) { if (!region[off + k] || /\s/.test(l.text[k])) continue; n++; if ((mine[k]?.[1] ?? "") !== (theirs[k]?.[1] ?? "")) { bad++; badLines.add(l.n); } } }
    off += l.text.length + 1;
  }
  console.log(`${mode}: chars in plugin regions ${bad}/${n} differ${badLines.size ? " lines " + [...badLines].join(",") : ""}; region lines replaced by Obsidian widgets (absent from the DOM): ${absent.length}${absent.length ? " (" + absent.join(",") + ")" : ""}`);
}
// reading: code elements only (Inkdrop renders mermaid diagrams and math as non-code elements, like Obsidian)
const ip = JSON.parse(readFileSync("data/inkdrop-ext/edge-preview.json", "utf8")).blocks.filter((b) => b.codeClass !== null);
const op = JSON.parse(readFileSync("ob-ext-reading.json", "utf8")).blocks.filter((b) => !b.codeClass?.includes("language-yaml") || b.runs.map((r) => r[0]).join("").includes("nested front matter") === false ? true : true);
console.log("Inkdrop code elements", ip.length, "Obsidian pre elements", op.length, op.map((b) => b.codeClass?.split(" ")[0]).join(","));
// element by element: Obsidian's own properties block (the first, language-yaml) is skipped
const opc = JSON.parse(readFileSync("ob-ext-reading.json", "utf8")).blocks.slice(1);
let diffs = 0, total = 0, badChars = 0;
ip.forEach((b, k) => {
  const o = opc[k]; const A = perChar(b.runs).filter(([c]) => /\S/.test(c)), C = o ? perChar(o.runs).filter(([c]) => /\S/.test(c)) : [];
  let bad = 0; for (let i = 0; i < Math.max(A.length, C.length); i++) { total++; if (A[i]?.[0] !== C[i]?.[0] || (A[i]?.[1] ?? "") !== (C[i]?.[1] ?? "")) bad++; }
  badChars += bad; if (bad) { diffs++; console.log(`  element ${k} (${o?.codeClass}): ${bad}/${A.length} chars differ`); }
});
console.log(`reading: ${ip.length} Inkdrop code elements vs ${opc.length} Obsidian (properties element skipped): differing elements ${diffs}; chars ${badChars}/${total}`);

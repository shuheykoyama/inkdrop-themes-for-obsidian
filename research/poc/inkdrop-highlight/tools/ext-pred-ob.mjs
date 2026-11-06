// Obsidian's DOM classes (Ext.md, source and live) against the plugin pipeline's own prediction, Julia included
import { readFileSync } from "node:fs";
import { docClasses, norm } from "./predict.mjs";
const body = readFileSync("fixtures/ext-body.md", "utf8"); const { out, region } = docClasses(body);
const lines = body.split("\n"); const starts = []; let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; }
for (const mode of ["source", "live"]) {
  const ob = JSON.parse(readFileSync(`ob-ext-${mode}.json`, "utf8")); let n = 0, bad = 0, juliaChars = 0, juliaBad = 0;
  for (const l of ob.lines) { let p = 0; for (const [s, c] of l.runs) { for (let k = 0; k < s.length; k++) { const abs = starts[l.n - 1] + p + k; if (!region[abs] || /\s/.test(s[k])) continue; n++; const same = norm(c) === (out[abs] ?? ""); if (!same) { bad++; console.log(`  ${mode} L${l.n} ${JSON.stringify(s.slice(Math.max(0,k-5),k+6))} obsidian="${norm(c)}" predicted="${out[abs] ?? ""}"`); } if (l.n >= 53 && l.n <= 55) { juliaChars++; if (!same) juliaBad++; } } p += s.length; } }
  console.log(`${mode}: chars in plugin regions ${bad}/${n} differ from the prediction; Julia lines ${juliaBad}/${juliaChars}`);
}

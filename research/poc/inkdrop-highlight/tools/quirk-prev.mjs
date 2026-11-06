import { readFileSync } from "node:fs";
import { codeClasses, norm } from "./predict.mjs";
const body = readFileSync("fixtures/quirk-body.md", "utf8");
const ink = JSON.parse(readFileSync("data/inkdrop-quirk/edge-preview.json", "utf8")).blocks.filter((b) => b.codeClass !== null);
// the code blocks in document order: info + text
const blocks = [...body.matchAll(/^(`{3,})([^\s`]*)\n([\s\S]*?)\n\1$/gm)].map((m) => ({ info: m[2], code: m[3] }));
console.log("Inkdrop code elements", ink.length, "document fences", blocks.length);
let bad = 0, tot = 0; const rows = [];
for (let k = 0; k < Math.min(ink.length, blocks.length); k++) {
  const mine = await codeClasses(blocks[k].info, blocks[k].code + "\n");
  const A = []; for (const [s, c] of ink[k].runs) for (const ch of s) A.push([ch, norm(c)]);
  let x = 0, n = 0; for (let i = 0, j = 0; i < A.length; i++) { if (/\s/.test(A[i][0])) continue; n++; if ((mine[i] ?? "") !== A[i][1]) x++; }
  bad += x; tot += n; rows.push(`${blocks[k].info.padEnd(10)} ${x}/${n}`);
}
console.log(rows.join(" | ")); console.log(`preview: ${bad}/${tot} differ`);

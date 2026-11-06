import { readFileSync } from "node:fs";
import { codeClasses, norm } from "./predict.mjs";
const gt = JSON.parse(readFileSync("data/inkdrop-lang135/inkdrop-preview.json", "utf8")).blocks.find((b) => b.lang === "julia");
const theirs = new Array(gt.text.length).fill(""); for (const r of gt.ranges) for (let k = r.from; k < r.to; k++) theirs[k] = norm(r.cls);
const mine = await codeClasses("julia", gt.text); let n = 0, x = 0;
for (let k = 0; k < gt.text.length; k++) { if (/\s/.test(gt.text[k])) continue; n++; if ((mine[k] ?? "") !== theirs[k]) x++; }
console.log(`plugin's Lezer Julia vs Inkdrop 6.3.0's actual output on the julia block: ${x}/${n} characters differ`);

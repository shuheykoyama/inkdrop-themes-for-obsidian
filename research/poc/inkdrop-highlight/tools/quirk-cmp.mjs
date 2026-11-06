import { readFileSync } from "node:fs";
import { docClasses, codeClasses, norm } from "./predict.mjs";
const body = readFileSync("fixtures/quirk-body.md", "utf8");
const { out, region, S } = docClasses(body);
const gt = JSON.parse(readFileSync("data/inkdrop-quirk/edge-editor.json", "utf8"));
console.log(`plugin finds ${S.fences.length} fenced blocks, ${S.marks.length} front matter / math regions`);
let off = 0, n = 0, bad = 0; const byLine = new Map(), ex = [];
for (const l of gt.lines) {
  let p = 0; const th = []; for (const [s, cl] of (l.runs ?? [])) { for (let k = 0; k < s.length; k++) th[p + k] = norm(cl); p += s.length; }
  if (!l.runs) byLine.set(l.n, "UNMEASURED");
  for (let k = 0; k < l.text.length; k++) {
    if (/\s/.test(l.text[k]) || !region[off + k] || !l.runs) continue; n++;
    if ((out[off + k] ?? "") !== (th[k] ?? "")) { bad++; byLine.set(l.n, (byLine.get(l.n) ?? 0) + 1); if (ex.length < 12) ex.push(`L${l.n} ${JSON.stringify(l.text.slice(k, k + 12))} mine="${out[off + k]}" ink="${th[k] ?? ""}"`); }
  }
  off += l.text.length + 1;
}
console.log(`editor: chars in plugin regions ${bad}/${n} differ; lines: ${[...byLine].map(([l, c]) => `L${l}:${c}`).join(" ")}`);
console.log(ex.join("\n"));

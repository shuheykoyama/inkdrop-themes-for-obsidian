// the new pipeline against the Inkdrop measurements already taken: 135 languages (editor + preview) and the edge cases (editor)
import { readFileSync } from "node:fs";
globalThis.INK_JULIA_LEGACY = true; // Inkdrop itself uses language-data's Julia: the regression compares with the app
const { docClasses, codeClasses, norm } = await import("./predict.mjs");
const { find } = await import("../src/languages.js");
globalThis.__find = find;
let tot = 0, bad = 0, blocks = 0; const diffs = [];
for (const view of ["preview", "editor"]) {
  const gt = JSON.parse(readFileSync(`data/inkdrop-lang135/inkdrop-${view}.json`, "utf8"));
  for (const b of gt.blocks) {
    if (b.error) continue; blocks++;
    const mine = await codeClasses(b.lang, b.text); if (view === "editor" && mine.every((x) => !x) && !/^(py|rs)$/.test("")) { /* unknown language: editor marks monospace */ }
    const theirs = new Array(b.text.length).fill(""); for (const r of b.ranges) for (let k = r.from; k < r.to && k < b.text.length; k++) theirs[k] = norm(r.cls);
    let n = 0, x = 0; for (let k = 0; k < b.text.length; k++) { if (/\s/.test(b.text[k])) continue; n++; const m = mine[k] || (view === "editor" && !import_find(b.lang) ? "tok-monospace" : ""); if (m !== theirs[k]) x++; }
    tot += n; bad += x; if (x) diffs.push(`${view}:${b.lang} ${x}/${n}`);
  }
}
function import_find(l) { return globalThis.__find(l); }
console.log(`135-language data: ${blocks} blocks, chars ${bad}/${tot} differ`, diffs.slice(0, 10).join(" | "));
// edge cases (editor, whole document)
const body = readFileSync("fixtures/edge-body.md", "utf8"); const { out, region } = docClasses(body);
const gt = JSON.parse(readFileSync("data/inkdrop-edge/edge-editor.json", "utf8")); let off = 0, n = 0, x = 0; const bl = [];
for (const l of gt.lines) { let p = 0; const th = []; for (const [s, cl] of l.runs) { for (let k = 0; k < s.length; k++) th[p + k] = norm(cl); p += s.length; }
  for (let k = 0; k < l.text.length; k++) { if (/\s/.test(l.text[k]) || !region[off + k]) continue; n++; if ((out[off + k] ?? "") !== (th[k] ?? "")) { x++; bl.push(l.n); } } off += l.text.length + 1; }
console.log(`edge cases (editor): chars in plugin regions ${x}/${n} differ`, [...new Set(bl)].join(","));

// The plugin's pipeline run in Node: per-character classes for a whole document (editor) and for one code text (preview).
import { tagHighlighter, highlightTree, tags as t } from "@lezer/highlight";
import { tags as mk } from "../src/tok-table.js";
import { mdHighlighter } from "../src/inkdrop-markdown.js";
import { table, find, previewParser } from "../src/languages.js";
import { scan } from "../src/blocks.js";
export const highlighters = [tagHighlighter(mk(t)), mdHighlighter];
for (const d of table) if (!d.support) await d.load();
export const norm = (s) => [...new Set(s.split(/\s+/).filter((x) => x.startsWith("tok-") || x.startsWith("md-")))].sort().join(" "); // a class list is a set
// editor: classes of every character of `text` the plugin would decorate; `region[i]` marks them
export function docClasses(text) {
  const S = scan(text), out = new Array(text.length).fill(""), region = new Array(text.length).fill(false);
  const put = (a, z, cls) => { for (let k = a; k < z; k++) { out[k] = norm(cls); region[k] = true; } };
  for (const f of S.fences) {
    const d = find(f.info);
    for (const r of f.ranges) for (let k = r.from; k < r.to; k++) region[k] = true;
    if (d) highlightTree(d.support.language.parser.parse(text, undefined, f.ranges), highlighters, (a, z, cls) => put(a + f.ranges[0].from, z + f.ranges[0].from, cls)); // a tree parsed over ranges starts at 0 = the first range's start
    else for (const r of f.ranges) put(r.from, r.to, "tok-monospace");
  }
  for (const m of S.marks) { for (let k = m.from; k < m.to; k++) region[k] = true; highlightTree(S.tree, highlighters, (a, z, cls) => put(a, z, cls), m.from, m.to); }
  return { out, region, S };
}
// preview: classes of each character of one code text
export async function codeClasses(info, code) {
  const p = await previewParser(info, code), out = new Array(code.length).fill("");
  if (p) highlightTree(p.parse(code), highlighters, (a, z, cls) => { for (let k = a; k < z; k++) out[k] = norm(cls); });
  return out;
}

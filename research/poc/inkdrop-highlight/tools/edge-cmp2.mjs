import { readFileSync } from "node:fs";
import { languages } from "@codemirror/language-data";
import { LanguageDescription, StreamLanguage } from "@codemirror/language";
import { yaml as yamlLegacy } from "@codemirror/legacy-modes/mode/yaml";
import { tagHighlighter, highlightTree, tags as t, styleTags, Tag } from "@lezer/highlight";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags as mk } from "../src/tok-table.js";
import { scan } from "../src/blocks.js";
const T = Array.from({ length: 10 }, () => Tag.define());
const [a, b, c, d, e, f, g, h, i, j] = T;
const mdProps = { props: [styleTags({ HeaderMark: [a, t.processingInstruction], HardBreak: [b, t.processingInstruction], QuoteMark: [c, t.processingInstruction], ListMark: [d, t.processingInstruction], LinkMark: [e, t.processingInstruction], EmphasisMark: [f, t.processingInstruction], CodeMark: [g, t.processingInstruction], TableDelimiter: [h, t.processingInstruction], StrikethroughMark: [i, t.processingInstruction], InlineCode: [j, t.monospace] })] };
const mdHl = tagHighlighter([[a, "md-header-mark"], [b, "md-hard-break"], [c, "md-quote-mark"], [d, "md-list-mark"], [e, "md-link-mark"], [f, "md-emphasis-mark"], [g, "md-code-mark"], [h, "md-table-delimiter"], [i, "md-strikethrough-mark"], [j, "md-inline-code"]].map(([tag, cls]) => ({ tag, class: cls })));
const hl = tagHighlighter(mk(t));
const others = languages.filter((l) => l.name !== "Markdown");
const mdDesc = LanguageDescription.of({ name: "Markdown", alias: ["md", "mkd", "gfm"], extensions: ["md"], load: async () => markdown({ addKeymap: false, base: markdownLanguage, codeLanguages: others, extensions: [mdProps] }) });
const table = [...others, mdDesc]; for (const d of table) if (!d.support) await d.load();
const yamlParser = StreamLanguage.define(yamlLegacy).parser;
const norm = (s) => s.split(/\s+/).filter((x) => x.startsWith("tok-") || x.startsWith("md-")).sort().join(" ");
const body = readFileSync("fixtures/edge-body.md", "utf8");
function classes(text, view) {
  const S = scan(text); const out = new Array(text.length).fill(""); const region = new Array(text.length).fill(false);
  const put = (from, to, cls) => { for (let k = from; k < to; k++) out[k] = norm(cls); };
  for (const bl of S.fences) {
    const code = text.slice(bl.from, bl.to); for (let k = bl.from; k < bl.to; k++) region[k] = true;
    const d = bl.info ? LanguageDescription.matchLanguageName(table, bl.info, true) : null;
    if (d) highlightTree(d.support.language.parser.parse(code), [hl, mdHl], (f1, t1, cls) => put(bl.from + f1, bl.from + t1, cls));
    else if (view === "editor") put(bl.from, bl.to, "tok-monospace");
  }
  if (S.front) { // front matter: --- marks and legacy YAML inside
    const lines = text.slice(S.front.from, S.front.to).split("\n"); const first = lines[0].length, lastStart = S.front.to - lines[lines.length - 1].length;
    put(S.front.from, S.front.from + first, "md-code-mark tok-processing-instruction"); put(lastStart, S.front.to, "md-code-mark tok-processing-instruction");
    const inner = text.slice(S.front.from + first + 1, lastStart - 1);
    for (let k = S.front.from; k < S.front.to; k++) region[k] = true;
    highlightTree(yamlParser.parse(inner), [hl, mdHl], (f1, t1, cls) => put(S.front.from + first + 1 + f1, S.front.from + first + 1 + t1, cls));
  }
  for (const m of S.math) { // $$ marks only
    const ls = text.slice(m.from, m.to).split("\n"); const first = ls[0].length; put(m.from, m.from + first, "md-code-mark tok-processing-instruction"); put(m.to - ls[ls.length - 1].length, m.to, "md-code-mark tok-processing-instruction");
    for (let k = m.from; k < m.to; k++) region[k] = true;
  }
  return { out, region, S };
}
const gt = JSON.parse(readFileSync("data/inkdrop-edge/edge-editor.json", "utf8"));
const { out: mine, region, S } = classes(body, "editor");
let off = 0, n = 0, bad = 0; const badLines = new Map(); const inkOutside = [];
for (const l of gt.lines) {
  let p = 0; const theirs = [];
  for (const [s, cl] of l.runs) { for (let k = 0; k < s.length; k++) theirs[p + k] = norm(cl); p += s.length; }
  for (let k = 0; k < l.text.length; k++) {
    if (/\s/.test(l.text[k])) continue;
    if (region[off + k]) { n++; if ((mine[off + k] ?? "") !== (theirs[k] ?? "")) { bad++; badLines.set(l.n, (badLines.get(l.n) ?? 0) + 1); } }
  }
  off += l.text.length + 1;
}
console.log(`editor: scanner found ${S.fences.length} fenced blocks, front matter ${!!S.front}, math ${S.math.length}; chars in those regions ${bad}/${n} differ`, [...badLines].map(([l, c]) => `L${l}:${c}`).join(" "));
// the converse: lines Inkdrop colours as code (tok-* other than markdown structure) that are outside the scanner's regions
off = 0; const outside = [];
for (const l of gt.lines) { if (l.runs.some(([s, cl]) => /tok-(definition-keyword|monospace|content|keyword|string|atom|meta|variable-name)/.test(cl) && !/md-|heading|tok-link|tok-url|tok-emphasis|tok-strong/.test(cl)) && !region[off + (l.text.search(/\S/) < 0 ? 0 : l.text.search(/\S/))]) outside.push(`L${l.n}:${l.text.slice(0, 30)}`); off += l.text.length + 1; }
console.log("Inkdrop code-coloured lines outside the scanner's regions:", outside.length ? outside.join(" | ") : "none");

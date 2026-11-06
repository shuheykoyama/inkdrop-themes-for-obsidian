import { readFileSync } from "node:fs";
import { languages } from "@codemirror/language-data";
import { LanguageDescription } from "@codemirror/language";
import { tagHighlighter, highlightTree, tags as t, styleTags, Tag } from "@lezer/highlight";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags as mk } from "../src/tok-table.js";
const [view = "preview"] = process.argv.slice(2);
const T = Array.from({ length: 10 }, () => Tag.define());
const [a, b, c, d, e, f, g, h, i, j] = T;
const mdProps = { props: [styleTags({ HeaderMark: [a, t.processingInstruction], HardBreak: [b, t.processingInstruction], QuoteMark: [c, t.processingInstruction], ListMark: [d, t.processingInstruction], LinkMark: [e, t.processingInstruction], EmphasisMark: [f, t.processingInstruction], CodeMark: [g, t.processingInstruction], TableDelimiter: [h, t.processingInstruction], StrikethroughMark: [i, t.processingInstruction], InlineCode: [j, t.monospace] })] };
const mdHl = tagHighlighter([[a, "md-header-mark"], [b, "md-hard-break"], [c, "md-quote-mark"], [d, "md-list-mark"], [e, "md-link-mark"], [f, "md-emphasis-mark"], [g, "md-code-mark"], [h, "md-table-delimiter"], [i, "md-strikethrough-mark"], [j, "md-inline-code"]].map(([tag, cls]) => ({ tag, class: cls })));
const hl = tagHighlighter(mk(t));
const others = languages.filter((l) => l.name !== "Markdown");
const mdDesc = LanguageDescription.of({ name: "Markdown", alias: ["md", "mkd", "gfm"], extensions: ["md"], load: async () => markdown({ addKeymap: false, base: markdownLanguage, codeLanguages: others, extensions: [mdProps] }) });
const table = [...others, mdDesc];
for (const d of table) if (!d.support) await d.load(); // everything preloaded: nested code resolves
const gt = JSON.parse(readFileSync(`data/inkdrop-lang135/inkdrop-${view === "preview" ? "preview" : "editor"}.json`, "utf8"));
const norm = (s) => s.split(/\s+/).filter((x) => x.startsWith("tok-") || x.startsWith("md-")).sort().join(" ");
let tot = 0, bad = 0; const per = [];
for (const blk of gt.blocks) {
  if (blk.error) { per.push([blk.lang, "NOT MEASURED " + blk.error]); continue; }
  const text = blk.text;
  const d = LanguageDescription.matchLanguageName(table, blk.lang, true);
  const mine = new Array(text.length).fill("");
  if (d) highlightTree(d.support.language.parser.parse(text), [hl, mdHl], (from, to, cls) => { for (let k = from; k < to; k++) mine[k] = norm(cls); });
  else if (view === "editor") mine.fill("tok-monospace");
  const theirs = new Array(text.length).fill("");
  for (const r of blk.ranges) for (let k = r.from; k < r.to && k < text.length; k++) theirs[k] = norm(r.cls);
  let n = 0, x = 0; const ex = [];
  for (let k = 0; k < text.length; k++) { if (/\s/.test(text[k])) continue; n++; if (mine[k] !== theirs[k]) { x++; if (ex.length < 2) ex.push(`${JSON.stringify(text.slice(k, k + 10))} mine="${mine[k]}" ink="${theirs[k]}"`); } }
  tot += n; bad += x; per.push([blk.lang, `${x}/${n}`, ex.join(" | ")]);
}
const diff = per.filter((p) => p[1] !== undefined && !/^0\//.test(p[1]));
console.log(view, "blocks", gt.blocks.length, "identical:", per.length - diff.length, "differing:", diff.length, `chars ${bad}/${tot} (${(100 * (1 - bad / tot)).toFixed(3)}% match)`);
for (const p of diff) console.log("  ", p.join("  "));

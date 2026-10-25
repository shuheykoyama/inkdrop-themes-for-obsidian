// V-31: tokenise the fenced code blocks of a note with the Lezer parsers and the tokenHighlighter that ship
// in Inkdrop 6.1.5 (renderer/assets of the app bundle), without starting Inkdrop. Prints JSON: per block,
// the language and the highlighted ranges ({ from, to, text, cls }), offsets relative to the block body.
//
// The colour variable of each range is resolved against inkdropapp/css syntax.css (below).
//
// usage: node --permission --allow-fs-read=<assets dir> --allow-fs-read=<note> --allow-fs-read=<syntax.css> \
//          tests/visual/inkdrop-tokens.mjs <assets dir> <note.md> <inkdropapp_css/syntax.css>
// <assets dir> is renderer/assets of the extracted app.asar (6.1.5 and 6.2.0 checked). Chunk names change with
// every build, so the chunks are found by what they contain (`locate` below); a feature that matches no chunk,
// or more than one, stops the run instead of picking one.
//
// The tokenHighlighter table is Inkdrop's own (`<name>=<tagHighlighter>([{tag:<tags>.comment,class:`tok-comment`}…`):
// it is read from the bundle and rebuilt with the bundle's own tagHighlighter, so the classes are exactly what
// Inkdrop puts on the editor and the preview code blocks (the preview's Highlighter uses the same table, 14 §6.17).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { locate } from "./inkdrop-chunks.mjs";

const [assets, notePath, baseCssPath] = process.argv.slice(2);
const files = Object.fromEntries(readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => [f, readFileSync(join(assets, f), "utf8")]));
const found = locate(files);
const chunk = (name) => import(pathToFileURL(join(assets, name)).href);

// @lezer/highlight and @codemirror/language as bundled, by the names the chunk exports them under.
const lezer = await chunk(found.lezer.file);
const [tags, highlightTree, tagHighlighter, StreamLanguage] = ["tags", "highlightTree", "tagHighlighter", "StreamLanguage"].map((k) => lezer[found.lezer[k]]);

// Rebuild the table: each entry is `{tag:b.x,class:`...`}` or `{tag:b.mod(b.x),class:`...`}` (b: the table's tags alias).
const table = found.table.entries.map(([expr, cls]) => {
  const a = found.table.alias;
  // b.x → tags.x; b.mod(b.x) → tags.mod(tags.x)
  const m = expr.match(new RegExp(`^${a}\\.(\\w+)\\(${a}\\.(\\w+)\\)$`));
  const tag = m ? tags[m[1]](tags[m[2]]) : expr.startsWith(`${a}.`) ? tags[expr.slice(a.length + 1)] : undefined;
  if (!tag) throw new Error(`unknown tag ${expr}`);
  return { tag, class: cls };
});
const highlighter = tagHighlighter(table);

// The languages of Inkdrop's code-block list (language-data) for the V-12 set, loaded as the app does: the
// chunk, an optional namespace export (`.then(e=>e.t)`), then the language function or the legacy mode.
const load = ({ file, ns, fn, args, legacy, dialect }) => async () => {
  let m = await chunk(file);
  if (ns) m = m[ns];
  if (legacy) return StreamLanguage.define(m[legacy]);
  if (dialect) return m.sql({ dialect: m[dialect] });
  return m[fn](args);
};
const loaders = Object.fromEntries(Object.entries(found.languages).map(([k, v]) => [k, load(v)]));
// Fence names that Inkdrop's language list resolves to the same languages (aliases and extensions).
Object.assign(loaders, { javascript: loaders.js, typescript: loaders.ts, py: loaders.python, bash: loaders.sh, shell: loaders.sh, zsh: loaders.sh, yml: loaders.yaml, rs: loaders.rust, md: loaders.markdown });

// Fenced blocks of the note: ```lang ... ```
const note = readFileSync(notePath, "utf8");
const blocks = [...note.matchAll(/^```(\w+)\n([\s\S]*?)\n```$/gm)].map(([, lang, code]) => ({ lang, code }));

// The colour variable each range gets: the rules of inkdropapp/css syntax.css (`.tok-a { color: var(--x) }`
// and `.tok-a.tok-b { … }`, all in one block), applied as the cascade does: of the rules whose classes the
// span has, the most specific wins, and of equally specific ones the last.
const baseCss = readFileSync(baseCssPath, "utf8");
const rules = [...baseCss.matchAll(/^\s*((?:\.tok-[\w-]+)+)\s*\{\s*color:\s*var\((--[\w-]+)/gm)].map(([, sel, v], i) => ({
  classes: sel.split(".").filter(Boolean),
  v,
  i,
}));
const colourVar = (cls) => {
  const have = new Set(cls.split(" "));
  let best = null;
  for (const r of rules) {
    if (!r.classes.every((c) => have.has(c))) continue;
    // Higher specificity, or the same and later in the file.
    if (!best || r.classes.length > best.classes.length || (r.classes.length === best.classes.length && r.i > best.i)) best = r;
  }
  return best ? best.v : null;
};

const out = [];
for (const { lang, code } of blocks) {
  const load = loaders[lang];
  if (!load) throw new Error(`no loader for ${lang}`);
  const support = await load();
  // LanguageSupport → .language; StreamLanguage is already a Language.
  const parser = (support.language ?? support).parser;
  const tree = parser.parse(code);
  const ranges = [];
  highlightTree(tree, highlighter, (from, to, cls) =>
    ranges.push({ from, to, text: code.slice(from, to), cls, var: colourVar(cls) }));
  out.push({ lang, code, ranges });
}
console.log(JSON.stringify(out, null, 1));

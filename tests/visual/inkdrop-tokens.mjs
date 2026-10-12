// V-31: tokenise the fenced code blocks of a note with the Lezer parsers and the tokenHighlighter that ship
// in Inkdrop 6.1.5 (renderer/assets of the app bundle), without starting Inkdrop. Prints JSON: per block,
// the language and the highlighted ranges ({ from, to, text, cls }), offsets relative to the block body.
//
// The colour variable of each range is resolved against inkdropapp/css syntax.css (below).
//
// usage: node --permission --allow-fs-read=<assets dir> --allow-fs-read=<note> --allow-fs-read=<syntax.css> \
//          tests/visual/inkdrop-tokens.mjs <assets dir> <note.md> <inkdropapp_css/syntax.css>
// <assets dir> is renderer/assets of the extracted app.asar. The chunk names are those of 6.1.5.
//
// The tokenHighlighter table is the one in notebook-picker-*.js (`Xd=re([...])`): it is read from the
// bundle and rebuilt with the bundle's own tagHighlighter, so the classes are exactly what Inkdrop puts on
// the editor and the preview code blocks (the preview's Highlighter uses the same table, 14 §6.17).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [assets, notePath, baseCssPath] = process.argv.slice(2);
const chunk = (name) => import(pathToFileURL(join(assets, name)).href);

// @lezer/highlight and @codemirror/language as bundled: R = tags, F = highlightTree, L = tagHighlighter,
// f = StreamLanguage (from the chunk's export list).
const lezer = await chunk("dist-HRoI40E2.js");
const { R: tags, F: highlightTree, L: tagHighlighter, f: StreamLanguage } = lezer;

// Rebuild the table: each entry is `{tag:b.x,class:`...`}` or `{tag:b.mod(b.x),class:`...`}`.
const picker = readFileSync(join(assets, "notebook-picker-Bo2H_0--.js"), "utf8");
const start = picker.indexOf("Xd=re([");
const body = picker.slice(start, picker.indexOf("])", start));
const table = [...body.matchAll(/\{tag:(.*?),class:`(.*?)`\}/g)].map(([, expr, cls]) => {
  // b.x → tags.x; b.mod(b.x) → tags.mod(tags.x)
  const m = expr.match(/^b\.(\w+)\(b\.(\w+)\)$/);
  const tag = m ? tags[m[1]](tags[m[2]]) : tags[expr.replace(/^b\./, "")];
  if (!tag) throw new Error(`unknown tag ${expr}`);
  return { tag, class: cls };
});
const highlighter = tagHighlighter(table);

// The languages of Inkdrop's code-block list (language-data) for the V-12 set, loaded as the app does.
const loaders = {
  js: async () => (await chunk("dist-mSdurF7y.js")).t.javascript(),
  ts: async () => (await chunk("dist-mSdurF7y.js")).t.javascript({ typescript: true }),
  python: async () => (await chunk("dist-CuQpLQ6g.js")).python(),
  css: async () => (await chunk("dist-geTA03zK.js")).i.css(),
  html: async () => (await chunk("dist-fqy6Ua6R.js")).t.html(),
  json: async () => (await chunk("dist-BkUsYw4p.js")).json(),
  sh: async () => StreamLanguage.define((await chunk("shell-Du5Qg9im.js")).shell),
  go: async () => (await chunk("dist-D7WIBBJt.js")).go(),
  rust: async () => (await chunk("dist-DcCsaAop.js")).rust(),
  yaml: async () => (await chunk("dist-Bay2AUzm.js")).yaml(),
  sql: async () => { const m = await chunk("dist-Dx44Ajy5.js"); return m.sql({ dialect: m.StandardSQL }); },
  markdown: async () => (await chunk("dist-BKzBtnmQ.js")).n.markdown(),
};
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

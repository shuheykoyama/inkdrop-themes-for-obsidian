import { Plugin } from "obsidian";
import { ViewPlugin, Decoration } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { tagHighlighter, highlightTree, tags as t } from "@lezer/highlight";
import { tags as mk } from "../src/tok-table.js";
import { mdHighlighter, yamlParser } from "../src/inkdrop-markdown.js";
import { find, previewParser } from "../src/languages.js";
import { scan } from "../src/blocks.js";

const highlighters = [tagHighlighter(mk(t)), mdHighlighter];
const refresh = StateEffect.define();
const parsers = new Map(); // info -> parser | null (no such language in Inkdrop's table)

async function ensure(info, code) {
  if (!parsers.has(info)) {
    const d = find(info);
    let p = null;
    if (d) { if (!d.support) await d.load(); p = d.support ? d.support.language.parser : null; }
    parsers.set(info, p);
  }
  // Markdown parses its own fenced code with the languages loaded so far: load the ones this text names first
  if (code && find(info)?.name === "Markdown")
    for (const m of code.matchAll(/^\s*(?:`{3,}|~{3,})\s*([^\s`]+)/gm)) await ensure(m[1]);
  return parsers.get(info);
}
// [from, to, class] of one fenced block; `ranges` (the CodeText pieces) keeps quote and list markers out of the code
function fenceSpans(text, f) {
  const p = parsers.get(f.info), out = [];
  // a tree parsed over ranges starts at 0 = the first range's start
  if (p) highlightTree(p.parse(text, undefined, f.ranges), highlighters, (a, z, cls) => out.push([a + f.ranges[0].from, z + f.ranges[0].from, cls]));
  return out;
}
const readingCache = new Map();
async function readingSpans(info, code) {
  const key = info + "\0" + code;
  if (!readingCache.has(key)) { const p = await previewParser(info, code), out = []; if (p) highlightTree(p.parse(code), highlighters, (a, z, cls) => out.push([a, z, cls])); readingCache.set(key, out); }
  return readingCache.get(key);
}

let lastDoc = null, lastScan = null;
function scanDoc(doc) { if (doc !== lastDoc) { lastScan = scan(doc.toString()); lastDoc = doc; } return lastScan; }

const editorExt = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.docChanged || u.viewportChanged || u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)))) this.decorations = this.build(u.view); }
  build(view) {
    const items = []; // [from, to, class]
    const S = scanDoc(view.state.doc);
    for (const f of S.fences) {
      if (f.to <= f.from) continue;
      const code = S.text.slice(f.from, f.to);
      if (!parsers.has(f.info)) { ensure(f.info, code).then(() => { try { view.dispatch({ effects: [refresh.of(null)] }); } catch {} }); continue; }
      // Inkdrop's editor marks the code of a block without a known language as monospace
      if (parsers.get(f.info) === null) { for (const r of f.ranges) items.push([r.from, r.to, "tok-monospace"]); continue; }
      items.push(...fenceSpans(S.text, f));
    }
    // front matter and $$ math blocks: highlighted by the same tree (YAML / LaTeX inside, md-code-mark on the marks)
    for (const m of S.marks) highlightTree(S.tree, highlighters, (a, z, cls) => items.push([a, z, cls]), m.from, m.to);
    items.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const b = new RangeSetBuilder();
    for (const [a, z, cls] of items) if (z > a) b.add(a, z, Decoration.mark({ class: cls }));
    return b.finish();
  }
}, { decorations: (v) => v.decorations });

function readingYaml(text) { const out = []; highlightTree(yamlParser.parse(text), highlighters, (a, z, cls) => out.push([a, z, cls])); return out; }
function paint(code, spans) {
  const text = code.textContent, frag = document.createDocumentFragment(); let pos = 0;
  for (const [a, z, cls] of spans) { if (a > pos) frag.append(text.slice(pos, a)); const s = document.createElement("span"); s.className = cls; s.textContent = text.slice(a, z); frag.append(s); pos = z; }
  if (pos < text.length) frag.append(text.slice(pos));
  code.replaceChildren(frag);
}

function fenceInfo(ctx, el, code) {
  const sec = ctx.getSectionInfo(el); if (!sec) return null;
  const line = sec.text.split("\n")[sec.lineStart + Number(code.dataset.line || 0)] ?? "";
  const w = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
  const info = w?.[1]?.replace(/:.*$/, "");
  return info && info.toLowerCase() === code.className.split(" ").find((c) => c.startsWith("language-")).slice(9).replace(/:.*$/, "") ? info : null;
}

export default class InkHighlight extends Plugin {
  async onload() {
    // tells the theme the plugin is running (its CSS lets Inkdrop's token colours replace Obsidian's own)
    document.body.classList.add("ink-highlight"); this.register(() => document.body.classList.remove("ink-highlight"));
    this.registerEditorExtension(editorExt);
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      for (const code of el.querySelectorAll("pre > code")) {
        const m = [...code.classList].find((c) => c.startsWith("language-"));
        // Obsidian's properties shown as source (Settings > Editor > Properties in document): coloured like the front matter in Inkdrop's editor
        const isFront = !!code.closest(".frontmatter");
        if (!m && !isFront) continue;
        let spans;
        if (isFront) spans = readingYaml(code.textContent);
        else {
          let info = m.slice(9).replace(/:.*$/, ""); // Inkdrop's preview takes the language before a :filename suffix
          // Obsidian lower-cases the language class, but Inkdrop's preview treats only exactly `markdown` and `md` as its Markdown: read the fence line
          if (info === "markdown" || info === "md") info = fenceInfo(ctx, el, code) ?? info;
          spans = await readingSpans(info, code.textContent);
        }
        const apply = () => {
          if (code.querySelector('[class^="tok-"]')) return;
          const text = code.textContent, frag = document.createDocumentFragment(); let pos = 0;
          for (const [a, z, cls] of spans) {
            if (a > pos) frag.append(text.slice(pos, a));
            const s = document.createElement("span"); s.className = cls; s.textContent = text.slice(a, z); frag.append(s); pos = z;
          }
          if (pos < text.length) frag.append(text.slice(pos));
          code.replaceChildren(frag); obs.takeRecords();
        };
        // Obsidian runs Prism after the post-processors and rewrites the code element: re-apply when it does
        const obs = new MutationObserver(() => { obs.disconnect(); apply(); obs.observe(code, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }); });
        obs.observe(code, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
        this.register(() => obs.disconnect());
        apply();
      }
    });
  }
}

import { Plugin } from "obsidian";
import { ViewPlugin, Decoration } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
const refresh = StateEffect.define();
import { LanguageDescription, StreamLanguage } from "@codemirror/language";
import { yaml as yamlLegacy } from "@codemirror/legacy-modes/mode/yaml";
import { scan } from "../src/blocks.js";
import { tagHighlighter, highlightTree, tags as t } from "@lezer/highlight";
import { languages } from "@codemirror/language-data";
import { tags as mk } from "../src/tok-table.js";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { styleTags, Tag } from "@lezer/highlight";

// Inkdrop's Markdown tags (HeaderMark etc.) and the classes it gives them (the `md-*` table of its preview highlighter).
const T = Array.from({ length: 10 }, () => Tag.define());
const [mHeader, mBreak, mQuote, mList, mLink, mEmph, mCode, mTable, mStrike, mInline] = T;
const mdProps = { props: [styleTags({
  HeaderMark: [mHeader, t.processingInstruction], HardBreak: [mBreak, t.processingInstruction], QuoteMark: [mQuote, t.processingInstruction],
  ListMark: [mList, t.processingInstruction], LinkMark: [mLink, t.processingInstruction], EmphasisMark: [mEmph, t.processingInstruction],
  CodeMark: [mCode, t.processingInstruction], TableDelimiter: [mTable, t.processingInstruction], StrikethroughMark: [mStrike, t.processingInstruction],
  InlineCode: [mInline, t.monospace],
})] };
const mdHl = tagHighlighter([[mHeader, "md-header-mark"], [mBreak, "md-hard-break"], [mQuote, "md-quote-mark"], [mList, "md-list-mark"], [mLink, "md-link-mark"],
  [mEmph, "md-emphasis-mark"], [mCode, "md-code-mark"], [mTable, "md-table-delimiter"], [mStrike, "md-strikethrough-mark"], [mInline, "md-inline-code"]].map(([tag, cls]) => ({ tag, class: cls })));
const hl = tagHighlighter(mk(t));

// Inkdrop's language table: language-data, with Markdown given the aliases md, mkd and gfm and Markdown code blocks parsed with the same table.
const others = languages.filter((l) => l.name !== "Markdown");
const mdDesc = LanguageDescription.of({ name: "Markdown", alias: ["md", "mkd", "gfm"], extensions: ["md", "markdown", "mkd", "gfm"],
  load: async () => markdown({ addKeymap: false, base: markdownLanguage, codeLanguages: others, extensions: [mdProps] }) });
const table = [...others, mdDesc];

// Languages only Inkdrop's table has (not in language-data): left to Obsidian's own highlighting
const INKDROP_ONLY = new Set(["elixir", "ex", "graphql", "svelte", "nix", "mermaid"]);
const skipInfo = (info) => INKDROP_ONLY.has(info.toLowerCase());
const cache = new Map(); // `${info}\0${code}` -> [[from,to,cls]]
const loaded = new Map(); // info -> parser | null

async function ensure(info, code) {
  if (!loaded.has(info)) {
    const d = LanguageDescription.matchLanguageName(table, info, true);
    let p = null;
    if (d) { if (!d.support) await d.load(); p = d.support ? d.support.language.parser : null; }
    loaded.set(info, p);
  }
  // Markdown parses its own fenced code with the languages loaded so far: load the ones this text names first
  if (code && LanguageDescription.matchLanguageName(table, info, true)?.name === "Markdown")
    for (const m of code.matchAll(/^\s*(?:`{3,}|~{3,})\s*([^\s`]+)/gm)) await ensure(m[1]);
  return loaded.get(info);
}
function spans(info, code) {
  const key = info + "\0" + code;
  if (cache.has(key)) return cache.get(key);
  const p = loaded.get(info);
  const out = [];
  if (p) highlightTree(p.parse(code), [hl, mdHl], (from, to, cls) => out.push([from, to, cls]));
  cache.set(key, out);
  return out;
}

const yamlParser = StreamLanguage.define(yamlLegacy).parser;
const MARK = "md-code-mark tok-processing-instruction";
let lastDoc = null, lastScan = null;
function scanDoc(doc) { if (doc !== lastDoc) { lastScan = scan(doc.toString()); lastDoc = doc; } return lastScan; }

const editorExt = ViewPlugin.fromClass(class {
  constructor(view) { this.view = view; this.decorations = this.build(view); }
  update(u) { if (u.docChanged || u.viewportChanged || u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)))) this.decorations = this.build(u.view); }
  build(view) {
    const items = []; // [from, to, class]
    const doc = view.state.doc, S = scanDoc(doc);
    for (const f of S.fences) {
      if (f.to <= f.from || skipInfo(f.info)) continue;
      const code = doc.sliceString(f.from, f.to);
      if (!loaded.has(f.info) || (loaded.get(f.info) && !cache.has(f.info + "\0" + code))) {
        ensure(f.info, code).then(() => { try { view.dispatch({ effects: [refresh.of(null)] }); } catch {} });
        if (!loaded.has(f.info)) continue;
      }
      // Inkdrop's editor marks the code of a block without a known language as monospace
      if (loaded.get(f.info) === null) { items.push([f.from, f.to, "tok-monospace"]); continue; }
      for (const [a, z, cls] of spans(f.info, code)) items.push([f.from + a, f.from + z, cls]);
    }
    if (S.front) { // front matter: the --- marks and legacy YAML inside
      const text = doc.sliceString(S.front.from, S.front.to), first = text.indexOf("\n"), last = text.lastIndexOf("\n");
      items.push([S.front.from, S.front.from + first, MARK], [S.front.from + last + 1, S.front.to, MARK]);
      const inner = text.slice(first + 1, last);
      highlightTree(yamlParser.parse(inner), [hl, mdHl], (a, z, cls) => items.push([S.front.from + first + 1 + a, S.front.from + first + 1 + z, cls]));
    }
    for (const m of S.math) { const text = doc.sliceString(m.from, m.to), first = text.indexOf("\n"), last = text.lastIndexOf("\n"); items.push([m.from, m.from + first, MARK], [m.from + last + 1, m.to, MARK]); }
    items.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const b = new RangeSetBuilder();
    for (const [a, z, cls] of items) if (z > a) b.add(a, z, Decoration.mark({ class: cls }));
    return b.finish();
  }
}, { decorations: (v) => v.decorations });

export default class InkHighlight extends Plugin {
  async onload() {
    this.registerEditorExtension(editorExt);
    this.registerMarkdownPostProcessor(async (el) => {
      for (const code of el.querySelectorAll("pre > code")) {
        const m = [...code.classList].find((c) => c.startsWith("language-"));
        if (!m || code.closest(".frontmatter, .frontmatter-container")) continue; // Obsidian's own properties block is not a code block
        const info = m.slice(9).replace(/:.*$/, ""); // Inkdrop's preview takes the language before a :filename suffix
        if (skipInfo(info)) continue;
        await ensure(info, code.textContent);
        const text = code.textContent;
        const apply = () => {
          if (code.querySelector('[class^="tok-"]')) return;
          const sp = spans(info, code.textContent);
          const frag = document.createDocumentFragment(); let pos = 0; const t2 = code.textContent;
          for (const [a, z, cls] of sp) {
            if (a > pos) frag.append(t2.slice(pos, a));
            const s = document.createElement("span"); s.className = cls; s.textContent = t2.slice(a, z); frag.append(s); pos = z;
          }
          if (pos < t2.length) frag.append(t2.slice(pos));
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

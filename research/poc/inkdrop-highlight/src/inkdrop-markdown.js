// Inkdrop 6.3.0's Markdown: @codemirror/lang-markdown's GFM base plus the extensions its bundle adds (front matter,
// $$ math blocks, $ inline math, GitHub alerts, bare URLs, and the `md-*` tags). The block and inline parsers follow
// the behaviour measured in Inkdrop (research/14 §6.200, §6.201); the front matter and math ones are written after
// Lezer Markdown's own FencedCode.
import { markdownLanguage } from "@codemirror/lang-markdown";
import { parseMixed } from "@lezer/common";
import { StreamLanguage } from "@codemirror/language";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { Tag, styleTags, tags as t, tagHighlighter } from "@lezer/highlight";
import { URL_RE } from "./url-regex.js";

export const yamlParser = StreamLanguage.define(yaml).parser;
const stexParser = StreamLanguage.define(stex).parser;
const typeId = (cx, name) => cx.parser.nodeSet.types.find((x) => x.name === name)?.id ?? -1;
// a CodeText element, merged into the previous one when they touch
function pushText(cx, children, from, to, id) {
  const last = children[children.length - 1];
  if (last && last.to === from && last.type === id) last.to = to; else children.push(cx.elt("CodeText", from, to));
}

// --- front matter: a --- line at the very start of the text, up to the next --- line (or the end)
let fmText = -1, fmId = -1;
const Frontmatter = { defineNodes: ["Frontmatter"], parseBlock: [{ name: "Frontmatter", before: "HorizontalRule", parse(cx, line) {
  if (fmText === -1) fmText = typeId(cx, "CodeText"); if (fmId === -1) fmId = typeId(cx, "Frontmatter");
  // the opening line is exactly three dashes, on the first line of the text
  if (cx.lineStart > cx.ranges[0].from || line.next !== 45) return false;
  let end = line.pos + 1; while (end < line.text.length && line.text.charCodeAt(end) === line.next) end++;
  if (end < line.pos + 3 || line.text.length > 3) return false;
  const from = cx.lineStart + line.pos, ch = line.next, markLen = end - line.pos;
  const children = [cx.elt("CodeMark", from, from + markLen)];
  for (let first = true; cx.nextLine(); first = false) {
    let p = line.pos;
    if (line.indent - line.baseIndent < 4) while (p < line.text.length && line.text.charCodeAt(p) === ch) p++;
    if (p - line.pos >= markLen && line.skipSpace(p) === line.text.length) { children.push(cx.elt("CodeMark", cx.lineStart + line.pos, cx.lineStart + p)); cx.nextLine(); break; }
    if (!first) pushText(cx, children, cx.lineStart - 1, cx.lineStart, fmText);
    const f = cx.lineStart + line.basePos, to = cx.lineStart + line.text.length;
    if (f < to) pushText(cx, children, f, to, fmText);
  }
  const node = cx.elt("Frontmatter", children[0].from, children[children.length - 1].to); node.children = children; cx.addElement(node); return true;
} }] };
const frontmatterWrap = { wrap: parseMixed((node) => node.type.id === fmId ? { parser: yamlParser, overlay: (n) => n.type.name === "CodeText" } : null) };

// --- $$ math blocks and $ inline math; their CodeText is LaTeX (legacy stex)
let mathText = -1;
function mathOpen(line) {
  if (line.next !== 36) return -1;
  let end = line.pos + 1; while (end < line.text.length && line.text.charCodeAt(end) === line.next) end++;
  if (end < line.pos + 2) return -1;
  for (let k = end; k < line.text.length; k++) if (line.text.charCodeAt(k) === 36) return -1;
  return end;
}
const FencedMath = { defineNodes: ["MathText"], parseBlock: [{ name: "FencedMath", after: "FencedCode", parse(cx, line) {
  if (mathText === -1) mathText = typeId(cx, "CodeText");
  const end = mathOpen(line); if (end < 0) return false;
  const from = cx.lineStart + line.pos, ch = line.next, markLen = end - line.pos;
  const children = [cx.elt("CodeMark", from, from + markLen)];
  for (let first = true; cx.nextLine() && line.depth >= cx.stack.length; first = false) {
    let p = line.pos;
    if (line.indent - line.baseIndent < 4) while (p < line.text.length && line.text.charCodeAt(p) === ch) p++;
    if (p - line.pos >= markLen && line.skipSpace(p) === line.text.length) {
      for (const m of line.markers) children.push(m);
      children.push(cx.elt("CodeMark", cx.lineStart + line.pos, cx.lineStart + p)); cx.nextLine(); break;
    }
    if (!first) pushText(cx, children, cx.lineStart - 1, cx.lineStart, mathText);
    for (const m of line.markers) children.push(m);
    const f = cx.lineStart + line.basePos, to = cx.lineStart + line.text.length;
    if (f < to) pushText(cx, children, f, to, mathText);
  }
  const node = cx.elt("MathText", children[0].from, children[children.length - 1].to); node.children = children; cx.addElement(node); return true;
} }] };
const InlineMath = { defineNodes: ["MathText"], parseInline: [{ name: "InlineMath", after: "Emphasis", parse(cx, next, pos) {
  if (next !== 36 || (pos && cx.char(pos - 1) === 36)) return -1;
  let end = pos + 1; while (end < cx.end && cx.char(end) === 36) end++;
  const size = end - pos; let run = 0;
  for (; end < cx.end; end++) {
    if (cx.char(end) === 36) { run++; if (run === size && cx.char(end + 1) !== 36) { const el = cx.elt("MathText", pos, end + 1); el.children = [cx.elt("CodeMark", pos, pos + size), cx.elt("CodeText", pos + size, end), cx.elt("CodeMark", end + 1 - size, end + 1)]; cx.addElement(el); return el.to; } }
    else run = 0;
  }
  return -1;
} }] };
const mathWrap = { wrap: parseMixed((node) => node.type.name === "MathText" ? { parser: stexParser, overlay: (n) => n.type.name === "CodeText" } : null) };

// --- GitHub alerts: > [!NOTE] and the other four kinds
const KINDS = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
const alertComposite = (cx, line, value) => { if (line.next !== 62) return false; const el = cx.elt("AlertQuoteMark" + KINDS[value], cx.lineStart + line.pos, cx.lineStart + line.pos + 1); line.addMarker(el); return true; };
const alertTags = { Alert: Tag.define("Alert") };
for (const k of KINDS) for (const p of ["Alert", "AlertHeading", "AlertQuoteMark"]) alertTags[p + k] = Tag.define(p + k);
const Alerts = { defineNodes: [
  { name: "Alert", block: true, composite: alertComposite, style: { "Alert/...": alertTags.Alert } },
  ...KINDS.flatMap((k) => [
    { name: "Alert" + k, block: true, style: { ["Alert" + k + "/..."]: alertTags["Alert" + k] }, composite: alertComposite },
    { name: "AlertQuoteMark" + k, style: { ["AlertQuoteMark" + k + "/..."]: alertTags["AlertQuoteMark" + k] } },
    { name: "AlertHeading" + k, style: { ["AlertHeading" + k + "/..."]: alertTags["AlertHeading" + k] } },
  ])], parseBlock: [{ name: "Alert", before: "Blockquote", parse(cx, line) {
    if (line.next !== 62) return false;
    const start = line.pos + 1 + +(line.text.charCodeAt(line.pos + 1) === 32);
    const m = /^\[\!([A-Z]+)\]/.exec(line.text.slice(start));
    if (!m || !KINDS.includes(m[1])) return false;
    const kind = m[1].toUpperCase(), value = KINDS.indexOf(kind);
    cx.startComposite("Alert", line.pos, value); cx.startComposite("Blockquote", line.pos);
    cx.addElement(cx.elt("AlertQuoteMark" + kind, cx.lineStart + line.pos, cx.lineStart + line.pos + 1));
    const stop = start + m[0].length;
    cx.addElement(cx.elt("AlertHeading" + kind, cx.lineStart + start, cx.lineStart + stop));
    line.moveBase(stop); line.forward(); return null;
  } }] };

// --- bare URLs
const InlineURL = { defineNodes: [], parseInline: [{ name: "InlineURL", parse(cx, next, pos) { const m = URL_RE.exec(cx.slice(pos, cx.end)); if (!m) return -1; return cx.addElement(cx.elt("URL", pos, pos + m[0].length)); } }] };

// --- the md-* tags
const mTags = Array.from({ length: 10 }, () => Tag.define());
const [mHeader, mBreak, mQuote, mList, mLink, mEmph, mCode, mTable, mStrike, mInline] = mTags;
const mdProps = { props: [styleTags({
  HeaderMark: [mHeader, t.processingInstruction], HardBreak: [mBreak, t.processingInstruction], QuoteMark: [mQuote, t.processingInstruction],
  ListMark: [mList, t.processingInstruction], LinkMark: [mLink, t.processingInstruction], EmphasisMark: [mEmph, t.processingInstruction],
  CodeMark: [mCode, t.processingInstruction], TableDelimiter: [mTable, t.processingInstruction], StrikethroughMark: [mStrike, t.processingInstruction],
  InlineCode: [mInline, t.monospace],
})] };
export const mdHighlighter = tagHighlighter([
  [mHeader, "md-header-mark"], [mBreak, "md-hard-break"], [mQuote, "md-quote-mark"], [mList, "md-list-mark"], [mLink, "md-link-mark"], [mEmph, "md-emphasis-mark"],
  [mCode, "md-code-mark"], [mTable, "md-table-delimiter"], [mStrike, "md-strikethrough-mark"], [mInline, "md-inline-code"],
  [alertTags.Alert, "md-alert"],
  ...KINDS.flatMap((k) => [[alertTags["AlertHeading" + k], "md-alert-heading-" + k.toLowerCase()], [alertTags["Alert" + k], "md-alert-" + k.toLowerCase()], [alertTags["AlertQuoteMark" + k], "md-alert-quote-mark-" + k.toLowerCase()]]),
].map(([tag, cls]) => ({ tag, class: cls })));

// Inkdrop's order: [Frontmatter + wrap, FencedMath, InlineMath, math wrap, md props, InlineURL, Alerts]
export const inkExtensions = [Frontmatter, frontmatterWrap, FencedMath, InlineMath, mathWrap, mdProps, InlineURL, Alerts];
export const inkParser = markdownLanguage.parser.configure(inkExtensions);

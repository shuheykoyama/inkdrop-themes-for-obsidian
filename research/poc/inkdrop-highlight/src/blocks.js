import { markdownLanguage } from "@codemirror/lang-markdown";

// Inkdrop's two extra block types that decide where a fenced block is: front matter at the very start, and $$ math blocks.
const Frontmatter = { defineNodes: ["Frontmatter"], parseBlock: [{ name: "Frontmatter", before: "HorizontalRule", parse(cx, line) {
  if (cx.lineStart !== 0 || line.text.trimEnd() !== "---") return false;
  const from = cx.lineStart; let closed = false;
  while (cx.nextLine()) { if (line.text.trimEnd() === "---") { closed = true; break; } }
  if (!closed) return false; // not closed: nothing is consumed by the caller on false only before nextLine; handled by re-parse below
  const to = cx.lineStart + line.text.length; cx.nextLine();
  cx.addElement(cx.elt("Frontmatter", from, to)); return true;
} }] };
const FencedMath = { defineNodes: ["FencedMath"], parseBlock: [{ name: "FencedMath", parse(cx, line) {
  const rest = line.text.slice(line.pos); const m = /^\$\$+(?=[^$]*$)/.exec(rest);
  if (!m || line.indent - line.baseIndent >= 4) return false;
  const open = m[0].length, from = cx.lineStart + line.pos; let to = cx.lineStart + line.text.length;
  while (cx.nextLine() && line.depth >= cx.stack.length) {
    const r = line.text.slice(line.pos); const c = /^\$+/.exec(r);
    to = cx.lineStart + line.text.length;
    if (c && c[0].length >= open && /^\s*$/.test(r.slice(c[0].length)) && line.indent - line.baseIndent < 4) { cx.nextLine(); break; }
  }
  cx.addElement(cx.elt("FencedMath", from, to)); return true;
} }] };
export const mdParser = markdownLanguage.parser.configure([Frontmatter, FencedMath]);

// What the plugin decorates: fenced code (info = first word of the info string), the front matter, and the $$ math blocks
export function scan(text) {
  const tree = mdParser.parse(text); const out = { fences: [], front: null, math: [] };
  tree.iterate({ enter(n) {
    if (n.name === "FencedCode") { const info = n.node.getChild("CodeInfo"); const ct = n.node.getChildren("CodeText"); const infoText = info ? text.slice(info.from, info.to) : ""; out.fences.push({ info: infoText.split(/\s+/)[0] ?? "", from: ct.length ? ct[0].from : n.to, to: ct.length ? ct[ct.length - 1].to : n.to }); }
    else if (n.name === "Frontmatter") out.front = { from: n.from, to: n.to };
    else if (n.name === "FencedMath") out.math.push({ from: n.from, to: n.to });
  } });
  return out;
}

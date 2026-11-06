import { inkParser } from "./inkdrop-markdown.js";

// What the plugin decorates in a document: fenced code (info = first word of the info string), front matter and $$ math
// blocks. Parsed with Inkdrop's Markdown, so the blocks are the ones Inkdrop sees.
export function scan(text) {
  const tree = inkParser.parse(text); const out = { text, tree, fences: [], marks: [] };
  tree.iterate({ enter(n) {
    if (n.name === "FencedCode") {
      const info = n.node.getChild("CodeInfo"); const ct = n.node.getChildren("CodeText");
      const infoText = info ? text.slice(info.from, info.to) : "";
      out.fences.push({ info: infoText.split(/\s+/)[0] ?? "", from: ct.length ? ct[0].from : n.to, to: ct.length ? ct[ct.length - 1].to : n.to, ranges: ct.map((c) => ({ from: c.from, to: c.to })) });
    } else if (n.name === "Frontmatter" || (n.name === "MathText" && n.node.parent?.name === "Document")) out.marks.push({ from: n.from, to: n.to });
  } });
  return out;
}

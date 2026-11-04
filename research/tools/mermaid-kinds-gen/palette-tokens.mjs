// Adds every --mermaid-* token of Inkdrop's data (research/data/inkdrop-<theme>-tokens.csv: the theme's own values and the base
// css' defaults) that the palette does not have yet, and what they reference, in the palette's own format
// (research/14 section 1.5): the dark branch of light-dark(), --ink- names, the source comment. Inkdrop's Pele stylesheet reads
// them all (research/14 section 6.196). usage: node palette-tokens.mjs  (rewrites src/palette/<theme>.css in place)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { darkBranch, norm, normalizeNotation, paletteName, readCsv } from "../../../tests/lib/css.mjs";
const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const rows = readCsv(path.join(REPO, "research/data", `inkdrop-${theme}-tokens.csv`));
  const byToken = new Map();
  for (const r of rows) if (!byToken.has(r.token) || r.source === "theme") byToken.set(r.token, r);
  const file = path.join(REPO, "src/palette", `${theme}.css`);
  let css = readFileSync(file, "utf8");
  const defined = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const rename = (v) => v.replace(/var\(\s*(--[\w-]+)/g, (m, n) => (byToken.has(n) ? `var(${paletteName(n, byToken.get(n).raw_value)}` : m));
  // --color-neutral-950: the page colour of Inkdrop's dark mode, which its Pele stylesheet uses for --pele-bg
  const lines = []; const queue = [...byToken.keys()].filter((t) => t.startsWith("--mermaid-") || t === "--color-neutral-950");
  const seen = new Set();
  while (queue.length) {
    const t = queue.shift(); if (seen.has(t)) continue; seen.add(t);
    const r = byToken.get(t); if (!r) continue;
    const name = paletteName(t, r.raw_value);
    // what the dark branch references must be defined too
    const dark = /light-dark\(/.test(r.raw_value) ? darkBranch(r.raw_value) : norm(r.raw_value);
    for (const m of dark.matchAll(/var\(\s*(--[\w-]+)/g)) if (byToken.has(m[1])) queue.push(m[1]);
    if (defined.has(name)) continue;
    defined.add(name);
    const ld = /light-dark\(/.test(r.raw_value);
    const asDeclared = rename(dark), value = normalizeNotation(asDeclared);
    const marks = [ld ? "light-dark(): dark branch" : null, value !== asDeclared ? "notation (official lint)" : null].filter(Boolean);
    lines.push(`  ${name}: ${value}; /* ${r["file:line"]}${marks.length ? ` | ${marks.join(" | ")}` : ""} */`);
  }
  const block = `\n  /* Mermaid, every diagram type (research/14 section 6.196): the rest of the --mermaid-* tokens, which Inkdrop's Pele stylesheet\n     reads (research/tools/mermaid-kinds-gen/palette-tokens.mjs), and the tokens they reference */\n${lines.join("\n")}\n`;
  const i = css.lastIndexOf("}");
  css = css.slice(0, i).replace(/\n*$/, "\n") + block + css.slice(i);
  writeFileSync(file, css);
  console.log(theme, "added", lines.length);
}

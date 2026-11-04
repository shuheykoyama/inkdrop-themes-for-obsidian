// Ports Inkdrop's Mermaid-plugin stylesheet (packages/mermaid/styles/mermaid.css of @inkdropapp/mermaid, MIT, bundled in the
// installed Inkdrop's `mermaid` package) to this theme for Obsidian 1.15's Pele diagrams (research/14 section 6.196):
//  - nesting is resolved (the sources forbid it), `.mermaid-diagram` becomes Obsidian's `.theme-dark .markdown-rendered .mermaid`,
//  - --mermaid-* tokens become the palette's --ink-mermaid-*, light-dark() keeps its dark branch,
//  - non-kebab-case classes (.pele-gitGraph) are written [class~="..."] (official lint),
//  - hsl(from <token> ...) colours (relative colour syntax: a colour literal for the colour checks) become derived palette
//    colours --ink-derived-mermaid-*, computed here from the tokens' resolved values in research/data.
// usage: node pele-port.mjs <Inkdrop mermaid.css>   writes src/common/components/mermaid-pele.css and the palette blocks
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { readCsv } from "../../../tests/lib/css.mjs";
const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const src = readFileSync(process.argv[2], "utf8");
const SCOPE = ".theme-dark .markdown-rendered .mermaid";
const THEMES = ["solarized-dark", "kanagawa-dragon"];
// ---- resolved colours of the tokens, per theme
const resolved = {};
for (const t of THEMES) {
  const m = new Map();
  for (const r of readCsv(path.join(REPO, "research/data", `inkdrop-${t}-tokens.csv`))) if (!m.has(r.token) || r.source === "theme") m.set(r.token, r);
  resolved[t] = m;
}
const hexToHsl = (hex) => { const h = hex.replace("#", ""); const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255; const [r, g, b] = [n(0), n(2), n(4)]; const a = h.length >= 8 ? n(6) : 1; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0; const L = (mx + mn) / 2; const d = mx - mn; if (d) { S = d / (1 - Math.abs(2 * L - 1)); H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60; if (H < 0) H += 360; } return { h: H, s: S * 100, l: L * 100, a }; };
const channel = (expr, c) => { // h | s | l | calc(l - 10) | calc(h + 60) | number
  const e = expr.trim().replace(/^calc\((.*)\)$/, "$1").trim();
  const m = /^([hsl])\s*([+-])\s*([\d.]+)$/.exec(e); if (m) return c[m[1]] + (m[2] === "-" ? -1 : 1) * Number(m[3]);
  if (/^[hsl]$/.test(e)) return c[e]; if (!Number.isNaN(Number(e))) return Number(e);
  throw new Error(`channel ${expr}`);
};
// Tokens that Inkdrop 6.3.0's @inkdropapp/css (0.10.4) mermaid.css has and research/data (css@add48d9) does not: written out as derived
// palette tokens (dark branch of light-dark()); the line is that of the installed mermaid.css.
const NEW = [["node-shadow", "drop-shadow(0 1px 2px hsl(var(--hsl-black) / 50%))", 41], ["flow-container-border-color", "var(--ink-mermaid-secondary-border-color)", 54],
  ["usecase-actor-background-color", "var(--ink-mermaid-actor-background-color)", 197], ["usecase-actor-border-color", "var(--ink-mermaid-actor-border-color)", 198],
  ["usecase-background-color", "var(--ink-mermaid-node-background-color)", 199], ["usecase-border-color", "var(--ink-mermaid-node-border-color)", 200],
  ["usecase-boundary-background-color", "var(--ink-mermaid-cluster-background-color)", 201], ["usecase-boundary-border-color", "var(--ink-mermaid-cluster-border-color)", 202],
  ["usecase-include-line-color", "var(--ink-mermaid-line-color)", 203], ["usecase-extend-line-color", "var(--ink-mermaid-line-color)", 204]];
const derived = {}; // name -> {theme -> value}
const derive = (name, expr) => { // expr: hsl(from var(--mermaid-x) H S L)
  const m = /^hsl\(\s*from\s+var\((--mermaid-[\w-]+)\)\s+(.+?)\s+(calc\([^)]*\)|[hsl\d.]+)\s+(calc\([^)]*\)|[hsl\d.]+)\s*\)$/.exec(expr.replace(/\s+/g, " ").trim());
  if (!m) throw new Error(`cannot derive ${expr}`);
  derived[name] ??= {};
  for (const t of THEMES) {
    const row = resolved[t].get(m[1]); if (!row) throw new Error(`${m[1]} not in ${t}`);
    // the exact HSL of the token (research/data notes: substituted=hsl(...)), not its 8-bit hex
    const sub = /substituted=hsl\(([\d.-]+)deg ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+)%)?\)/.exec(row.notes);
    const c = sub ? { h: Number(sub[1]), s: Number(sub[2]), l: Number(sub[3]), a: sub[4] === undefined ? 1 : Number(sub[4]) / 100 } : hexToHsl(row.resolved_value);
    const H = ((channel(m[2], c) % 360) + 360) % 360, S = channel(m[3], c), L = channel(m[4], c);
    derived[name][t] = `hsl(${Math.round(H * 1e4) / 1e4}deg ${Math.round(S * 1e4) / 1e4}% ${Math.round(L * 1e4) / 1e4}%${c.a < 1 ? ` / ${Math.round(c.a * 1000) / 10}%` : ""})`;
  }
};
// ---- flatten
const root = postcss.parse(src);
const out = [];
const isKebab = (c) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(c);
const fixSel = (s) => s.replace(/\.([A-Za-z_][\w-]*)/g, (m, c) => (isKebab(c) ? m : `[class~="${c}"]`));
const walk = (node, parents) => {
  for (const n of node.nodes ?? []) {
    if (n.type === "rule") {
      const sels = n.selectors.map((s) => s.trim());
      const full = parents.length === 0 ? sels : parents.flatMap((p) => sels.map((s) => (s.includes("&") ? s.replace(/&/g, p) : `${p} ${s}`)));
      const decls = (n.nodes ?? []).filter((x) => x.type === "decl");
      if (decls.length) out.push({ sels: full, decls: decls.map((d) => ({ prop: d.prop, value: d.value })) });
      walk(n, full);
    } else if (n.type === "atrule") { /* @media print, @container, @keyframes: host-specific, not ported */ }
  }
};
walk(root, []);
// ---- convert
const keep = out.filter((r) => r.sels.some((s) => /\.pele\b|\.mermaid-diagram$/.test(s)) || r.sels.some((s) => /^\.mermaid-diagram\s+\.pele/.test(s)));
const ctxOf = (sels) => (sels[0].match(/\.pele-([A-Za-z]+)/) ?? [, "all"])[1].toLowerCase();
const convValue = (prop, value, sels) => {
  let v = value.replace(/\s+/g, " ").trim();
  v = v.replace(/light-dark\(((?:[^()]|\([^()]*(?:\([^()]*\)[^()]*)*\))*?),\s*((?:[^()]|\([^()]*(?:\([^()]*\)[^()]*)*\))*)\)/g, (m, a, b) => b.trim());
  if (/hsl\(from/.test(v)) {
    const name = `--ink-derived-mermaid-${ctxOf(sels)}-${prop.replace(/^--pele-/, "")}`;
    derive(name, v); return `var(${name})`;
  }
  v = v.replace(/var\(([^,()]+),\s*#[0-9a-fA-F]{3,8}\)/g, "var($1)"); // Pele sets its own default; a literal fallback is a colour literal
  v = v.replace(/--mermaid-(usecase-[\w-]+|node-shadow|flow-container-border-color)/g, "--ink-derived-mermaid-$1").replace(/--mermaid-/g, "--ink-mermaid-").replace(/var\(--page-font\)/g, "var(--ink-page-font)").replace(/var\(--muted-text-color\)/g, "var(--ink-muted-text-color)").replace(/var\(--color-(neutral-950|white)\)/g, "var(--ink-color-$1)");
  return v;
};
const blocks = [];
for (const r of keep) {
  const sels = r.sels.map((s) => s.replace(/^\.mermaid-diagram\b/, SCOPE)).map((s) => (s.startsWith(SCOPE) ? s : `${SCOPE} ${s}`)).map(fixSel);
  const decls = r.decls.filter((d) => !/^(position|overflow|padding|border-radius|background|background-image|background-size|color-scheme)$/.test(d.prop)).map((d) => `${d.prop}: ${convValue(d.prop, d.value, r.sels)};`);
  if (decls.length) blocks.push({ sels, decls });
}
let css = `/* Components: the diagrams of Obsidian 1.15 and later, which draws Mermaid text with Pele (research/14 section 6.196). The rules are
   Inkdrop's own: the stylesheet of its Mermaid plugin (@inkdropapp/mermaid, MIT; Inkdrop 6.3.0 ships Pele 1.9.0, Obsidian
   1.15.0 Pele 1.8.0) ported by research/tools/mermaid-kinds-gen/pele-port.mjs: the same selectors on Pele's markup, nesting
   resolved, --mermaid-* read from the palette's --ink-mermaid-*, light-dark() resolved to its dark branch, hsl(from ...) colours
   as derived palette colours. Obsidian maps its own --mermaid-* variables onto Pele's --pele-* on body and .mermaid; the
   variables below, set on the diagram's own .mermaid, are the ones Inkdrop's plugin sets and win over them. Do not edit by
   hand. Obsidian 1.14 draws with Mermaid.js: mermaid-kinds.css and mermaid.css (their selectors do not match Pele's SVG). */
/* Pele names its private colour aliases --_fg, --_s, ... (not kebab-case), and Inkdrop's selectors use :has() and :where(): the official
   lint's rules for those do not apply to rules that mirror Pele's markup. */
/* stylelint-disable no-descending-specificity, custom-property-pattern, selector-pseudo-class-disallowed-list */
`;
for (const b of blocks) css += `\n${b.sels.join(",\n")} {\n  ${b.decls.join("\n  ")}\n}\n`;
css += "\n/* stylelint-enable no-descending-specificity, custom-property-pattern, selector-pseudo-class-disallowed-list */\n";
writeFileSync(path.join(REPO, "src/common/components/mermaid-pele.css"), css);
for (const t of THEMES) {
  const f = path.join(REPO, "src/palette", `${t}-mermaid.css`);
  const base = readFileSync(f, "utf8").replace(/\n  \/\* Derived Mermaid colours for Pele[\s\S]*?(?=\n\}\s*$)/, "");
  let p = base.replace(/\}\s*$/, "");
  p += `\n  /* Derived Mermaid colours for Pele (research/tools/mermaid-kinds-gen/pele-port.mjs): Inkdrop's stylesheet writes them as
     hsl(from <token> h s calc(l - 10)); computed here from the token's resolved value in research/data. Not Inkdrop tokens. */\n`;
  for (const [name, v] of Object.entries(derived)) p += `  ${name}: ${v[t]};\n`;
  for (const [n, v, line] of NEW) p += `  --ink-derived-mermaid-${n}: ${v}; /* derived: inkdropapp_css@0.10.4 mermaid.css:${line} (Inkdrop 6.3.0; not in research/data) | light-dark(): dark branch */\n`;
  p += "}\n";
  writeFileSync(f, p);
}
console.log(`rules ${blocks.length}, derived colours ${Object.keys(derived).length}`);

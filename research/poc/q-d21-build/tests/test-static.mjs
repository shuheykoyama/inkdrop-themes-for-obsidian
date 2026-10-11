// Q-D21 PoC static tests (T1 value fidelity, T2 build reproducibility, cross-method equivalence).
// usage: node tests/test-static.mjs        (from research/poc/q-d21-build, after `npm ci`)
// Exit status is non-zero if any test fails. Prints one PASS / FAIL line per check.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postcss from "postcss";

const root = path.resolve(import.meta.dirname, "..");
const research = path.resolve(root, "..", "..");
const THEMES = {
  "solarized-dark": { csv: "inkdrop-solarized-dark-tokens.csv", foreign: /--kanagawa-/ },
  "kanagawa-dragon": { csv: "inkdrop-kanagawa-dragon-tokens.csv", foreign: /--hsl-neutral-|--hsl-blue-/ },
};
const METHODS = ["p1", "p2", "p3"];
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
  if (!ok) failures++;
};

// ---------- helpers ----------
// Collapse whitespace and the padding inside parentheses: "hsl( var(--x) / 70% )" == "hsl(var(--x) / 70%)".
const norm = (v) => v.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();

// Minimal RFC 4180 CSV reader (the data files quote fields that contain commas).
function readCsv(file) {
  const text = readFileSync(file, "utf8");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// Custom property declarations of a stylesheet, in order: [{selector, prop, value, important}].
function declarations(css) {
  const out = [];
  postcss.parse(css).walkDecls((d) => {
    out.push({ selector: norm(d.parent.selector ?? `@${d.parent.name}`), prop: d.prop, value: norm(d.value), important: d.important });
  });
  return out;
}

// Replace var(--name) by the value of --name in `defs` until nothing changes (one theme's tokens).
function substitute(value, defs) {
  let v = value;
  for (let i = 0; i < 10; i++) {
    const next = v.replace(/var\((--[\w-]+)\)/g, (m, name) => (defs.has(name) ? defs.get(name) : m));
    if (next === v) break;
    v = next;
  }
  return norm(v);
}

// Dark branch of light-dark(a, b) (Inkdrop's base tokens use it; both themes are dark).
function darkBranch(v) {
  const m = /^light-dark\((.*)\)$/s.exec(norm(v));
  if (!m) return v;
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return norm(m[1].slice(i + 1));
  }
  return v;
}

// hsl(H S% L% [/ A%]) -> [r, g, b, a] with 8-bit rounding (CSS Color 4 hsl-to-rgb), for the hex cross-check.
function hslToRgba(expr) {
  const m = /^hsl\((-?[\d.]+)deg ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+)%)?\)$/.exec(expr);
  if (!m) return null;
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const a = m[4] === undefined ? 1 : Number(m[4]) / 100;
  const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)).concat([Math.round(a * 255)]);
}
const hexToRgba = (hex) => {
  const h = hex.replace("#", "");
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
};

// Which Inkdrop token (and which declaration of it) each --ink-* palette entry copies.
const SOURCES = {
  "--ink-sidebar-background": { token: "--sidebar-background" },
  "--ink-note-list-bar-background": { token: "--note-list-bar-background" },
  "--ink-editor-background": { token: "--editor-background" },
  "--ink-sidebar-background-acrylic": { token: "--sidebar-background", acrylic: true },
  "--ink-note-list-bar-background-acrylic": { token: "--note-list-bar-background", acrylic: true },
  "--ink-editor-background-acrylic": { token: "--editor-background", acrylic: true },
  "--ink-primary-color": { token: "--primary-color" },
  "--ink-text-color": { token: "--text-color" },
  "--ink-note-list-view-item-selected-background": { token: "--note-list-view-item-selected-background" },
  "--ink-sidebar-menu-item-inactive-background": { token: "--sidebar-menu-item-inactive-background" },
};

function build(method, src, out) {
  if (method === "p1") return spawnSync("node", [path.join(root, "p1-postcss/build.mjs"), src, out], { encoding: "utf8" });
  if (method === "p2") return spawnSync("bash", [path.join(root, "p2-concat/build.sh"), src, out], { encoding: "utf8" });
  return spawnSync(path.join(root, "node_modules/.bin/sass"), ["--no-source-map", "--no-charset", "--style=expanded", `${path.join(src, "themes")}:${out}`], { encoding: "utf8" });
}
const srcOf = (method) => (method === "p3" ? path.join(root, "p3-sass/scss") : path.join(root, "src"));

// ---------- build everything into a temporary directory ----------
const tmp = mkdtempSync(path.join(os.tmpdir(), "q-d21-poc-"));
const outputs = {};
for (const m of METHODS) {
  for (const run of ["a", "b"]) {
    const res = build(m, srcOf(m), path.join(tmp, run, m));
    check(`T2 ${m} build run ${run} exits 0`, res.status === 0, res.status === 0 ? "" : (res.stderr || res.stdout).trim().slice(0, 300));
  }
  outputs[m] = {};
  for (const t of Object.keys(THEMES)) {
    const a = readFileSync(path.join(tmp, "a", m, `${t}.css`), "utf8");
    const b = readFileSync(path.join(tmp, "b", m, `${t}.css`), "utf8");
    check(`T2 ${m} ${t} deterministic (two builds byte-identical)`, a === b);
    outputs[m][t] = a;
  }
}

// ---------- T1: palette source vs research/data (the primary data) ----------
for (const [theme, info] of Object.entries(THEMES)) {
  const rows = readCsv(path.join(research, "data", info.csv));
  // A token can have a base row and a theme row; the theme's declaration is the one Inkdrop applies.
  const csv = new Map();
  for (const r of rows) if (!csv.has(r.token) || r.source === "theme") csv.set(r.token, r);
  const csvDefs = new Map([...csv].map(([k, r]) => [k, r.raw_value]));
  const palette = declarations(readFileSync(path.join(root, "src/palette", `${theme}.css`), "utf8"));
  const defs = new Map(palette.map((d) => [d.prop, d.value]));

  for (const d of palette) {
    if (!d.prop.startsWith("--ink-")) {
      // Primitive HSL triplet: must equal the CSV raw value character for character.
      const row = csv.get(d.prop);
      check(`T1 ${theme} primitive ${d.prop} verbatim`, row && row.raw_value === d.value, row ? `${d.value} vs ${row.raw_value}` : "not in CSV");
      continue;
    }
    if (/^--ink-accent-[hsl]$/.test(d.prop)) continue; // checked below
    const src = SOURCES[d.prop];
    if (!src) { check(`T1 ${theme} ${d.prop} has a declared source`, false); continue; }
    const row = csv.get(src.token);
    let expected;
    if (src.acrylic) {
      // Theme's own acrylic override: "@<file:line> = <value>" inside the conditional-overrides note.
      const m = /:root:has\(body\.acrylic-window\) @(?:styles|packages\/dragon\/styles)\/ui\.css:\d+ = ([^|;]+)/.exec(row.notes);
      expected = m && m[1];
    } else {
      expected = darkBranch(row.raw_value);
    }
    const ours = substitute(d.value, defs);
    const theirs = expected && substitute(expected, csvDefs);
    check(`T1 ${theme} ${d.prop} = Inkdrop ${src.token}${src.acrylic ? " (acrylic)" : ""}`, ours === theirs, `${ours} vs ${theirs}`);
    // Numeric cross-check against the CSV's 8-bit resolved value (opaque tokens only; acrylic has none).
    if (!src.acrylic && /^#[0-9a-f]{6,8}$/i.test(row.resolved_value)) {
      const rgba = hslToRgba(ours);
      const ref = hexToRgba(row.resolved_value);
      const ok = rgba && rgba.every((x, i) => Math.abs(x - ref[i]) <= 1);
      check(`T1 ${theme} ${d.prop} resolves to ${row.resolved_value} (+-1/255)`, ok, rgba ? `rgba(${rgba})` : "unparsed");
    }
  }
  // Accent components = the primary colour's HSL triplet (hue unitless).
  const primary = substitute(defs.get("--ink-primary-color"), defs);
  const tri = /^hsl\((-?[\d.]+)deg ([\d.]+%) ([\d.]+%)/.exec(primary);
  check(`T1 ${theme} accent h/s/l = primary triplet`, tri && defs.get("--ink-accent-h") === tri[1] && defs.get("--ink-accent-s") === tri[2] && defs.get("--ink-accent-l") === tri[3],
    `${defs.get("--ink-accent-h")} ${defs.get("--ink-accent-s")} ${defs.get("--ink-accent-l")} vs ${primary}`);
  // P3 keeps its own copy of the palette (Sass maps): its output must carry the same declarations.
}

// ---------- T1: outputs keep the declarations, no conversion, no mixing ----------
for (const [theme, info] of Object.entries(THEMES)) {
  const palette = declarations(readFileSync(path.join(root, "src/palette", `${theme}.css`), "utf8"));
  for (const m of METHODS) {
    const css = outputs[m][theme];
    const decls = declarations(css);
    const missing = palette.filter((p) => !decls.some((d) => d.prop === p.prop && d.value === p.value));
    check(`T1 ${m} ${theme} every palette declaration present verbatim`, missing.length === 0, missing.map((x) => x.prop).join(", "));
    const hex = decls.filter((d) => /#[0-9a-f]{3,8}\b/i.test(d.value) || /\brgba?\(/.test(d.value));
    check(`T1 ${m} ${theme} no HEX / rgb() produced`, hex.length === 0, hex.map((d) => `${d.prop}: ${d.value}`).join("; "));
    check(`T1 ${m} ${theme} no variables of the other theme`, !info.foreign.test(css));
    const inkDefs = decls.filter((d) => d.prop.startsWith("--ink-"));
    const dup = inkDefs.filter((d, i) => inkDefs.findIndex((x) => x.prop === d.prop) !== i);
    check(`T1 ${m} ${theme} each --ink-* token defined once`, dup.length === 0, dup.map((d) => d.prop).join(", "));
  }
}

// ---------- T2: output hygiene and cross-method equivalence ----------
for (const t of Object.keys(THEMES)) {
  for (const m of METHODS) {
    const css = outputs[m][t];
    let parsed = null;
    try { parsed = postcss.parse(css); } catch (e) { parsed = e; }
    check(`T2 ${m} ${t} output parses as CSS`, !(parsed instanceof Error), parsed instanceof Error ? parsed.message : "");
    let imports = 0;
    if (!(parsed instanceof Error)) parsed.walkAtRules("import", () => { imports++; });
    check(`T2 ${m} ${t} no @import rule left in output`, !(parsed instanceof Error) && imports === 0, `${imports} @import rule(s)`);
    check(`T2 ${m} ${t} no @charset / BOM`, !/@charset/.test(css) && css.charCodeAt(0) !== 0xfeff);
    const empty = [];
    if (!(parsed instanceof Error)) parsed.walkRules((r) => { if (!r.nodes.some((n) => n.type === "decl" || n.type === "rule")) empty.push(r.selector); });
    check(`T2 ${m} ${t} no empty / comment-only rules`, empty.length === 0, empty.join(" | "));
  }
  const key = (m) => JSON.stringify(declarations(outputs[m][t]));
  check(`T2 ${t} P1 and P2 declarations identical (selector, property, value, !important, order)`, key("p1") === key("p2"));
  check(`T2 ${t} P1 and P3 declarations identical (selector, property, value, !important, order)`, key("p1") === key("p3"));
}

// ---------- T2: a missing source file makes every method fail with a non-zero status ----------
for (const m of METHODS) {
  const broken = path.join(tmp, `broken-${m}`);
  cpSync(srcOf(m), broken, { recursive: true });
  rmSync(path.join(broken, m === "p3" ? "common/_mobile.scss" : "common/mobile.css"));
  const res = build(m, broken, path.join(tmp, "broken-out", m));
  check(`T2 ${m} missing source -> non-zero exit`, res.status !== 0, `status ${res.status}`);
}

rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);

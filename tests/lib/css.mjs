// Shared helpers for the static and runtime tests: CSV reading, declaration extraction, var()
// substitution, Inkdrop -> palette name rules, and hsl() -> rgb arithmetic.
// Reused from the Q-D21 PoC (research/poc/q-d21-build/tests/test-static.mjs and tests/runtime.mjs).
import { readFileSync } from "node:fs";
import postcss from "postcss";

// Collapse whitespace and the padding inside parentheses: "hsl( var(--x) / 70% )" == "hsl(var(--x) / 70%)".
export const norm = (v) => v.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();

// Minimal RFC 4180 CSV reader (the data files quote fields that contain commas).
export function readCsv(file) {
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

// Declarations of a stylesheet in order, with the comment that directly follows each one on the same
// line (the source comment of palette entries): [{selector, prop, value, important, comment, line}].
export function declarations(css) {
  const out = [];
  postcss.parse(css).walkDecls((d) => {
    const next = d.next();
    const sameLine = next && next.type === "comment" && next.source?.start?.line === d.source?.end?.line;
    out.push({
      selector: norm(d.parent.selector ?? `@${d.parent.name} ${d.parent.params ?? ""}`),
      prop: d.prop,
      value: norm(d.value),
      important: d.important,
      comment: sameLine ? next.text.trim() : null,
      line: d.source?.start?.line,
    });
  });
  return out;
}

// Replace var(--name) by the value of --name in `defs` until nothing changes.
export function substitute(value, defs) {
  let v = value;
  for (let i = 0; i < 20; i++) {
    const next = v.replace(/var\((--[\w-]+)\)/g, (m, name) => (defs.has(name) ? defs.get(name) : m));
    if (next === v) break;
    v = next;
  }
  return norm(v);
}

// Dark branch of light-dark(a, b) (Inkdrop's base tokens use it; both themes are dark).
export function darkBranch(v) {
  const m = /^light-dark\((.*)\)$/s.exec(norm(v));
  if (!m) return norm(v);
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return norm(m[1].slice(i + 1));
  }
  return norm(v);
}

// Inkdrop name -> name in our palette (research/14 §1.5):
//   HSL triplets (raw value "Hdeg S% L%") keep the name, camelCase written in kebab-case;
//   every other Inkdrop token gets the --ink- prefix.
export const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
export const isTriplet = (raw) => /^-?[\d.]+deg [\d.]+% [\d.]+%$/.test(norm(raw));
export function paletteName(inkdropName, rawValue) {
  return isTriplet(rawValue) ? kebab(inkdropName) : `--ink-${kebab(inkdropName).slice(2)}`;
}

// hsl(H S% L% [/ A%]) -> {rgb: [r, g, b] (0-255, unrounded), a} per CSS Color 4; null if not that form.
export function hslToRgb(expr) {
  const m = /^hsl\((-?[\d.]+)deg ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+)%)?\)$/.exec(norm(expr));
  if (!m) return null;
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return { rgb: [f(0), f(8), f(4)].map((x) => x * 255), a: m[4] === undefined ? 1 : Number(m[4]) / 100 };
}

// "#rrggbb" / "#rrggbbaa" -> {rgb, a}.
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], a: h.length === 8 ? n(6) / 255 : 1 };
}

// Computed-style colour string ("rgb(r, g, b)" / "rgba(r, g, b, a)") -> {rgb, a}; null if anything else
// (e.g. "none", "", a gradient), so an unparseable value can never compare equal.
export function parseComputedColor(s) {
  const m = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
}

// Same colour within +-1 per 8-bit channel and +-0.01 alpha. Both sides must be parsed colours.
export function sameColor(a, b) {
  if (!a || !b) return false;
  return a.rgb.every((x, i) => Math.abs(x - b.rgb[i]) <= 1) && Math.abs(a.a - b.a) <= 0.01;
}

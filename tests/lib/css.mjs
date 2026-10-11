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

// Find the calls `name(...)` in a value: [{start, end, args: [string, ...]}] with the arguments split at
// top-level commas (parentheses are matched, so nested calls stay inside their argument).
function calls(v, name) {
  const out = [];
  const re = new RegExp(`(?<![\\w-])${name}\\(`, "g");
  let m;
  while ((m = re.exec(v))) {
    let depth = 1, i = m.index + m[0].length, argStart = i;
    const args = [];
    for (; i < v.length && depth > 0; i++) {
      const c = v[i];
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) args.push(v.slice(argStart, i)); }
      else if (c === "," && depth === 1) { args.push(v.slice(argStart, i)); argStart = i + 1; }
    }
    if (depth !== 0) break; // unbalanced: leave the rest untouched
    out.push({ start: m.index, end: i, args: args.map((a) => a.trim()) });
  }
  return out;
}

// Replace every call `name(...)` by fn(args) (or keep it when fn returns null). Each pass replaces only
// the innermost calls (no call of the same name inside), which never overlap, from right to left so the
// earlier offsets stay valid; passes repeat until nothing changes.
function replaceCalls(v, name, fn) {
  const nested = new RegExp(`(?<![\\w-])${name}\\(`);
  for (let guard = 0; guard < 100; guard++) {
    const found = calls(v, name).filter((c) => !c.args.some((a) => nested.test(a)));
    let changed = false;
    for (const c of found.reverse()) {
      const rep = fn(c.args);
      if (rep !== null && rep !== undefined) { v = v.slice(0, c.start) + rep + v.slice(c.end); changed = true; }
    }
    if (!changed) break;
  }
  return v;
}

// Replace var(--name) and var(--name, fallback) by the definition of --name in `defs` (or by the
// fallback when --name is undefined) until nothing changes.
export function substitute(value, defs) {
  const v = replaceCalls(value, "var", (args) => {
    const name = args[0];
    if (defs.has(name)) return defs.get(name);
    return args.length > 1 ? args.slice(1).join(", ") : null;
  });
  return norm(v);
}

// Dark branch of every light-dark(a, b) in a value, nested ones included (Inkdrop's base tokens use it;
// both themes are dark-only, Q-D11). This is the one intentional rewrite of Inkdrop's declarations,
// recorded in the source comment of each affected palette entry (research/14 §1.5).
export const hasLightDark = (v) => calls(v, "light-dark").length > 0;
export function darkBranch(v) {
  return norm(replaceCalls(v, "light-dark", (args) => (args.length === 2 ? args[1] : null)));
}

// Notation normalisation for the official lint config (user decision 2026-10-11, research/14 §1.9):
// the VALUE stays the same, only its spelling changes, and the palette comment says "notation".
//   - legacy rgb()/rgba() with commas -> modern rgb(r g b / A%) (color-function-notation,
//     color-function-alias-notation, alpha-value-notation); alpha 0.067 -> 6.7%
//   - unquoted font family names with capitals in a comma list -> single-quoted (value-keyword-case);
//     generic and vendor keywords such as sans-serif and -apple-system are lowercase and stay unquoted.
export function normalizeNotation(v) {
  let out = v.replace(/\brgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/g, (m, r, g, b, a) =>
    a === undefined ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Number((Number(a) * 100).toFixed(4))}%)`);
  if (!out.includes("(") || /^var\([^()]*\),/.test(out)) {
    // A font list: split at top-level commas (none of these values nest a comma inside parentheses).
    out = out.split(",").map((item) => {
      const t = item.trim();
      return /^[A-Za-z][A-Za-z0-9 -]*$/.test(t) && /[A-Z]/.test(t) ? item.replace(t, `'${t}'`) : item;
    }).join(",");
  }
  return out;
}

// Colours and font names a value denotes, independent of notation: rgb()/rgba() in either syntax ->
// "r,g,b,a" with alpha as a fraction; quoted or unquoted family names -> the bare name. Used by S1 to
// prove that a notation-normalised value denotes the same thing as Inkdrop's declaration.
export function denotation(v) {
  const colours = [...v.matchAll(/\brgba?\(([^)]*)\)/g)].map((m) => {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const a = p[3] === undefined ? 1 : p[3].endsWith("%") ? Number(p[3].slice(0, -1)) / 100 : Number(p[3]);
    return `${Number(p[0])},${Number(p[1])},${Number(p[2])},${Number(a.toFixed(6))}`;
  });
  const rest = v.replace(/\brgba?\([^)]*\)/g, "C").split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).join(",");
  return `${colours.join(";")}|${norm(rest)}`;
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

// Any colour expression the palette uses, after var() substitution: hsl(H S% L% [/ A%]), rgb() / rgba() in
// the legacy (commas) or modern (spaces, "/ A%") syntax, or transparent. null if anything else.
export function parseColor(expr) {
  const v = norm(String(expr ?? ""));
  if (v === "transparent") return { rgb: [0, 0, 0], a: 0 };
  const legacy = parseComputedColor(v);
  if (legacy) return legacy;
  const m = /^rgba?\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)(%?))?\)$/.exec(v);
  if (m) return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : m[5] ? Number(m[4]) / 100 : Number(m[4]) };
  return hslToRgb(v);
}

// Same colour within +-1 per 8-bit channel and +-0.01 alpha. Both sides must be parsed colours.
export function sameColor(a, b) {
  if (!a || !b) return false;
  return a.rgb.every((x, i) => Math.abs(x - b.rgb[i]) <= 1) && Math.abs(a.a - b.a) <= 0.01;
}

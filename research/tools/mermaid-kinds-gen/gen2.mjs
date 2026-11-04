// Step 2: from the dumps of gen1.mjs (Solarized Dark and Kanagawa Dragon) write the common CSS of the Mermaid diagram types
// and the two palette files of derived colours. usage: node gen2.mjs <gen1-sd.json> <gen1-kd.json> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const [sdFile, kdFile, outDir, sd3File, kd3File] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const SD = JSON.parse(readFileSync(sdFile, "utf8")), KD = JSON.parse(readFileSync(kdFile, "utf8"));
// :is([id], #a) has the specificity of an id (the argument with the highest one) and matches the svg (it has an id): Mermaid's default
// stylesheet carries some declarations as !important under #<diagram id>, which a rule of lower specificity cannot beat.
const SCOPE = '.theme-dark .markdown-rendered .mermaid > svg:is([id], #a)';
const PAINT = /^(fill|stroke|color|background-color|background|stop-color|flood-color|lighting-color|text-decoration-color|border-(top|right|bottom|left)-color|outline-color)$/;
const OPAC = /^(opacity|fill-opacity|stroke-opacity)$/;
// ---- colour parsing -> [r,g,b,a]
const clamp = (x) => Math.max(0, Math.min(255, x));
function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => v * 255); }
function parseColour(v) {
  v = v.trim().toLowerCase(); let m;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(v))) { let h = m[1]; if (h.length <= 4) h = [...h].map((c) => c + c).join(""); const n = (i) => parseInt(h.slice(i, i + 2), 16); return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]; }
  if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/.exec(v))) { const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return [+m[1], +m[2], +m[3], a]; }
  if ((m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:[ ,/]+([\d.]+%?))?\s*\)$/.exec(v))) { const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return [...hsl2rgb(+m[1], m[2] / 100, m[3] / 100), a]; }
  if (v === "transparent") return [0, 0, 0, 0];
  const NAMED = { white: [255,255,255], black: [0,0,0], red: [255,0,0], grey: [128,128,128], gray: [128,128,128], lightgrey: [211,211,211], lightgray: [211,211,211], navy: [0,0,128], green: [0,128,0], blue: [0,0,255], yellow: [255,255,0], orange: [255,165,0], purple: [128,0,128], silver: [192,192,192], darkgrey: [169,169,169], darkgray: [169,169,169], pink: [255,192,203], lightblue: [173,216,230], lightyellow: [255,255,224], brown: [165,42,42] };
  if (NAMED[v]) return [...NAMED[v], 1];
  return null;
}
const key = (c) => c.map((x, i) => (i < 3 ? Math.round(x) : Math.round(x * 1000) / 1000)).join(",");
const fmt = (c) => { const [r, g, b, a] = c; const base = `${Math.round(clamp(r))} ${Math.round(clamp(g))} ${Math.round(clamp(b))}`; return a >= 0.9995 ? `rgb(${base})` : `rgb(${base} / ${Math.round(a * 1000) / 10}%)`; };
// ---- existing tokens by (SD, KD) value
const inkPair = new Map();
for (const [n, v] of Object.entries(SD.ink)) { const c1 = parseColour(v), c2 = parseColour(KD.ink[n]); if (c1 && c2) { const k = key(c1) + "|" + key(c2); if (!inkPair.has(k) || n.length < inkPair.get(k).length) inkPair.set(k, n); } }
const gen = new Map(); // pair key -> {name, sd, kd}
const tokenFor = (sdVal, kdVal) => {
  const c1 = parseColour(sdVal), c2 = parseColour(kdVal); if (!c1 || !c2) return null;
  const k = key(c1) + "|" + key(c2);
  if (inkPair.has(k)) return inkPair.get(k);
  if (!gen.has(k)) gen.set(k, { name: `--ink-mermaid-gen-${String(gen.size + 1).padStart(3, "0")}`, sd: c1, kd: c2 });
  return gen.get(k).name;
};
// ---- walk the rules
const kinds = Object.keys(SD.kinds);
const flat = (d, k) => { const v = d.kinds[k]; const out = []; const walk = (rules) => { for (const r of rules) { if (r.at) { if (/keyframes/.test(r.at)) continue; walk(r.rules); continue; } if (r.sel) out.push({ sel: r.sel.split(",").map((s) => s.trim().replace("#" + v.id, "§")), decls: r.decls }); } }; walk(v.rules); return out; };
const continue_ = () => {};
const blocks = []; const unmatched = [];
for (const k of kinds) {
  const a = flat(SD, k), b = flat(KD, k);
  if (a.length !== b.length) throw new Error(`${k}: rule count differs`);
  const role = SD.kinds[k].role;
  const rules = new Map(); // selector-list + decls signature -> merge by selector text
  a.forEach((r, i) => {
    const decls = [];
    r.decls.forEach(([p, v1, pr], j) => {
      const v2 = b[i].decls[j][1];
      if (PAINT.test(p)) {
        if (parseColour(v1) && parseColour(v2)) { const t = tokenFor(v1, v2); decls.push(`${p}: var(${t}) !important;`); }
        else if (/^(currentcolor|initial|inherit|revert|unset)$/i.test(v1)) continue_(); else if (/^none$/i.test(v1) && v1 === v2) decls.push(`${p}: ${v1} !important;`);
        else if (/url\(/i.test(v1)) decls.push(`${p}: ${v1} !important;`);
        else unmatched.push([k, r.sel[0], p, v1, v2]);
      } else if (OPAC.test(p)) decls.push(`${p}: ${v1} !important;`);
    });
    // four equal border colours: the shorthand (official lint)
    const bc = ["top", "right", "bottom", "left"].map((x) => decls.find((d) => d.startsWith(`border-${x}-color:`)));
    if (bc.every(Boolean)) { const vals = bc.map((d) => d.replace(/^[a-z-]+: /, "").replace(/;$/, "")); for (const d of bc) decls.splice(decls.indexOf(d), 1); decls.push(`border-color: ${vals.every((v) => v === vals[0]) ? vals[0] : vals.map((v) => v.replace(" !important", "")).join(" ") + " !important"};`.replace(" !important !important", " !important")); }
    if (!decls.length) return;
    const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    const rest = r.sel.map((x) => (x === "§" ? "" : x.replace(/^§ ?/, "")).replace(/\.([A-Za-z_][\w-]*)/g, (m, c) => (KEBAB.test(c) ? m : `[class~="${c}"]`)).replace(/#([A-Za-z_][\w-]*)/g, '[id="$1"]'));
    blocks.push({ k, role, rest, decls });
  });
}
// ---- phase B: colours carried by presentation attributes (fill / stroke / stop-color)
const locked = [];
if (sd3File && kd3File) {
  const S3 = JSON.parse(readFileSync(sd3File, "utf8")), K3 = JSON.parse(readFileSync(kd3File, "utf8"));
  for (const k of kinds) {
    const sa = S3.kinds[k], ka = K3.kinds[k]; const role = sa.role;
    const cand = new Map(); // key -> {tokens:Set, ctx}
    sa.act.forEach((a, i) => {
      const rS = sa.ref[i], rK = ka.ref[i]; if (!rS || !rK || a.tag !== rS.tag) return;
      for (const p of ["fill", "stroke", "stop-color"]) for (const via of ["attr", "style"]) {
        const d = via === "attr" ? a.attrs[p] : a.sty[p], vS = via === "attr" ? rS.attrs[p] : rS.sty[p], vK = via === "attr" ? rK.attrs[p] : rK.sty[p];
        if (d === undefined || vS === undefined || vK === undefined) continue;
        const val = (x) => (via === "attr" ? x : x.replace(/^[a-z-]+\s*:\s*/, ""));
        if (!parseColour(val(vS)) || !parseColour(val(vK))) continue;
        const dc = parseColour(val(d)) ?? [0, 0, 0, 0];
        if (key(dc) === key(parseColour(val(vS))) && key(dc) === key(parseColour(val(vK)))) continue;
        if (a.imp.includes(p)) { locked.push([k, a.tag, p, d]); continue; }
        const tok = tokenFor(val(vS), val(vK));
        const pp = via === "attr" ? p : p + "@style";
        for (const [ctx, kk] of [["", `${a.tag}|${pp}|${d}`], [a.parent, `${a.tag}|${pp}|${d}|${a.parent}`], [a.parent + ">" + a.cls, `${a.tag}|${pp}|${d}|${a.parent}|${a.cls}`]]) { const e = cand.get(kk) ?? { tokens: new Set(), tag: a.tag, p: pp, d, parent: a.parent, cls: a.cls, level: ctx === "" ? 0 : ctx === a.parent ? 1 : 2 }; e.tokens.add(tok); cand.set(kk, e); }
      }
    });
    // pick the least specific key whose token is unique; an element needing a deeper key makes the shallower one ambiguous
    const need = new Map(); // base key -> level needed
    for (const e of cand.values()) if (e.level === 0 && e.tokens.size > 1) need.set(`${e.tag}|${e.p}|${e.d}`, 1);
    for (const e of cand.values()) if (e.level === 1 && e.tokens.size > 1) need.set(`${e.tag}|${e.p}|${e.d}|${e.parent}`, 2);
    const done = new Set();
    for (const e of cand.values()) {
      const base = `${e.tag}|${e.p}|${e.d}`, l1 = `${base}|${e.parent}`;
      const lvl = !need.has(base) ? 0 : !need.has(l1) ? 1 : 2;
      if (e.level !== lvl) continue;
      const [tok] = e.tokens; if (e.tokens.size > 1) { unmatched.push([k, "ambiguous", e.tag, e.p, e.d]); continue; }
      const isSt = e.p.endsWith("@style"), pn = e.p.replace("@style", ""); const attr = isSt ? `[style*="${e.d}"]` : `[${pn}="${e.d}"]`; const sel = `${e.tag}${attr}`;
      const par = lvl >= 1 ? e.parent.split("|")[0].split(" ").filter(Boolean).map((c) => (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(c) ? "." + c : `[class~="${c}"]`)).join("") : "";
      const parTag = e.parent.split("|")[1];
      const own = lvl >= 2 ? e.cls.split(" ").filter(Boolean).map((c) => (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(c) ? "." + c : `[class~="${c}"]`)).join("") : "";
      const rest = lvl >= 1 ? `${parTag}${par} > ${e.tag}${own}${attr}` : sel;
      const kk = `${k}|${rest}|${pn}`; if (done.has(kk)) continue; done.add(kk);
      blocks.push({ k, role, rest: [rest], decls: [`${pn}: var(${tok}) !important;`] });
    }
  }
}
// ---- emit
const roles = kinds.map((k) => SD.kinds[k].role);
let css = `/* Components: the Mermaid diagram types other than Flowchart and Sequence (the user's request of 2026-11-04: every diagram Obsidian draws
   takes Inkdrop's colours; research/14 section 6.195). GENERATED by research/tools/mermaid-kinds-gen (gen1 + gen2) from Mermaid's own
   stylesheet of each type: the sample of each type is rendered with the base theme and themeVariables taken from the theme's
   --ink-mermaid-* tokens (what Inkdrop's Mermaid plugin does), and the colour declarations of that stylesheet are written here with
   the diagram's id replaced by the type's scope, !important like the Flowchart and Sequence rules (Obsidian's own stylesheet
   is scoped by the diagram's id, and a few of its declarations are !important too: the scope carries the specificity of an id
   through :is([id], #a), which matches the svg because it has an id). A colour is the theme's --ink-mermaid-* token when it is one of them, otherwise
   a derived colour --ink-mermaid-gen-N of the palette (src/palette/<theme>-mermaid.css: Mermaid derives these from the
   tokens, e.g. the colour scales). Mermaid's camelCase classes are written [class~="..."] (official lint). Do not edit by hand. */

/* The rules are scoped to one diagram type each (or several that share a rule), so no two of them can match the same element
   of a diagram, and their order against the Flowchart and Sequence rules is irrelevant: no-descending-specificity compares the
   selectors only textually. */
/* stylelint-disable no-descending-specificity */

/* No inversion: the colours are set below. */
${SCOPE}:is(${roles.map((r) => `[aria-roledescription="${r}"]`).join(", ")}) {
  filter: none;
}
`;
const spec = (sel) => { const t = sel.replace(/\[[^\]]*\]/g, " .A").replace(/:(is|not|where)\(/g, " "); const b = (t.match(/\.|:(?!:)/g) ?? []).length; const c = (t.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length + (t.match(/::/g) ?? []).length; return b * 100 + c; };
const groups = new Map();
for (const b of blocks) { const g = `${b.rest.join(",")}\u0000${b.decls.join("")}`; if (!groups.has(g)) groups.set(g, { rest: b.rest, decls: b.decls, roles: [] }); const r = groups.get(g).roles; if (!r.includes(b.role)) r.push(b.role); }
for (const g of [...groups.values()].map((g, i) => ({ ...g, i, sp: Math.max(...g.rest.map(spec)) })).sort((x, y) => x.sp - y.sp || x.i - y.i)) {
  const head = g.roles.length === 1 ? `${SCOPE}[aria-roledescription="${g.roles[0]}"]` : `${SCOPE}:is(${g.roles.map((r) => `[aria-roledescription="${r}"]`).join(", ")})`;
  const sel = g.rest.map((x) => (x ? `${head} ${x}` : head));
  css += `\n${sel.join(",\n")} {\n  ${g.decls.join("\n  ")}\n}\n`;
}
css += "\n/* stylelint-enable no-descending-specificity */\n";
writeFileSync(path.join(outDir, "mermaid-kinds.css"), css);
for (const [label, D, pick] of [["solarized-dark", SD, (g) => g.sd], ["kanagawa-dragon", KD, (g) => g.kd]]) {
  let p = `/* Palette: derived Mermaid colours of ${label}, GENERATED (research/tools/mermaid-kinds-gen gen2). Mermaid 11.13.0's base theme
   derives them from the --ink-mermaid-* themeVariables (e.g. cScale0-11, the pie slices, the git branch colours, the gantt
   bars); each value is the colour of that stylesheet declaration rendered with this theme's variables. Not Inkdrop tokens. */
.theme-dark {\n`;
  for (const g of gen.values()) p += `  ${g.name}: ${fmt(pick(g))};\n`;
  p += "}\n";
  writeFileSync(path.join(outDir, `${label}-mermaid.css`), p);
}
console.log(`kinds ${kinds.length}, rule blocks ${blocks.length} (${groups.size} after merging), generated tokens ${gen.size}, reused ink tokens ${new Set(inkPair.values()).size}, unmatched ${unmatched.length}`);
if (unmatched.length) console.log(JSON.stringify(unmatched.slice(0, 15)));
console.log(`locked (inline !important, CSS cannot override): ${locked.length}`, JSON.stringify([...new Set(locked.map((l) => l.join("|")))].slice(0, 6)));

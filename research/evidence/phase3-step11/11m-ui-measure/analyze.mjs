// Reads probe.json (probe.mjs) and prints, per UI, which visible colours still equal Obsidian's own dark default
// (condition "none") and are not in the theme's Inkdrop palette ("default left"), which were changed but sit off the
// palette ("derived"), and the variable groups. Nearest palette colour: CIEDE2000 on opaque palette entries (sRGB, D65),
// an approximation: alpha is ignored. No judgement is made here.
//
// usage: node analyze.mjs <probe.json>
import { readFileSync } from "node:fs";

const { results } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s ?? ""); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lab = ({ r, g, b }) => {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B, Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const de2000 = (a, b) => {
  const [L1, a1, b1] = a, [L2, a2, b2] = b, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const h = (y, x) => { const v = Math.atan2(y, x) / rad; return v < 0 ? v + 360 : v; };
  const hp1 = Cp1 === 0 ? 0 : h(b1, ap1), hp2 = Cp2 === 0 ? 0 : h(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = hp2 - hp1; if (Cp1 * Cp2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2), Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2; if (Cp1 * Cp2 === 0) hm = hp1 + hp2; else if (Math.abs(hp1 - hp2) > 180) hm = (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2; else hm /= 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTh = 30 * Math.exp(-(((hm - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
};
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const rgbOf = (n) => ({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 });

const out = [];
const say = (s = "") => out.push(s);
const paletteOf = (key) => {
  const entries = Object.entries(results[key].base.palette);
  const exact = new Map();
  for (const [n, c] of entries) { const k = c.replace(/\s/g, ""); (exact.get(k) ?? exact.set(k, []).get(k)).push(n.replace(/^--ink-/, "")); }
  const opaque = entries.map(([n, c]) => [n, parse(c)]).filter(([, p]) => p && p.a === 1).map(([n, p]) => [n.replace(/^--ink-/, ""), lab(p)]);
  return { exact, opaque };
};
const nearest = (pal, c) => { const l = lab(c); let best = null; for (const [n, pl] of pal.opaque) { const d = de2000(l, pl); if (!best || d < best.d) best = { n, d }; } return best; };
const norm = (s) => (s ?? "").replace(/\s/g, "");

// ---- variables
say("## Variables (final values; \"default\" = same as Obsidian's own dark)");
const groups = { canvas: /^--canvas/, graph: /^--graph/, bases: /^--bases/, metadata: /^--metadata/, "color-": /^--color-/ };
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  say(`\n### ${theme}`);
  const pal = paletteOf(theme);
  for (const [g, re] of Object.entries(groups)) {
    const names = Object.keys(results.none.base.vars).filter((n) => re.test(n));
    const changed = names.filter((n) => norm(results[theme].base.vars[n]?.rgb) !== norm(results.none.base.vars[n].rgb));
    say(`${g}: ${names.length} variables, ${names.length - changed.length} default, ${changed.length} changed`);
    for (const n of names) {
      const v = results[theme].base.vars[n], d = results.none.base.vars[n];
      const same = norm(v.rgb) === norm(d.rgb);
      const p = parse(v.rgb);
      if (!p || p.a === 0) continue;
      const inPal = pal.exact.get(norm(v.rgb));
      if (g === "color-" || !same || g === "canvas" || g === "graph")
        say(`  ${n}: ${v.rgb}${same ? " [default]" : ""}${inPal ? " = " + inPal.slice(0, 2).join(" | ") : p.a === 1 ? ` (nearest ${nearest(pal, p).n} dE ${nearest(pal, p).d.toFixed(1)})` : ""}`);
    }
  }
}

// ---- graph colours (the renderer's own, read from view.renderer.colors)
say("\n## Graph View renderer colours (view.renderer.colors)");
for (const key of ["none", "solarized-dark", "kanagawa-dragon"]) {
  const pal = key === "none" ? null : paletteOf(key);
  say(`\n### ${key}`);
  for (const [k, v] of Object.entries(results[key].graph.colours ?? {})) {
    const c = rgbOf(v.rgb);
    const same = key !== "none" && results.none.graph.colours[k].rgb === v.rgb && results.none.graph.colours[k].a === v.a;
    const inPal = pal?.exact.get(norm(`rgb(${c.r},${c.g},${c.b})`));
    const n = pal ? nearest(pal, c) : null;
    say(`  ${k}: ${hex(v.rgb)} a=${v.a}${same ? " [default]" : ""}${inPal ? " = " + inPal.slice(0, 2).join(" | ") : n ? ` (nearest ${n.n} dE ${n.d.toFixed(1)})` : ""}`);
  }
}

// ---- element colours per UI
const sections = (r) => {
  const s = {};
  for (const m of ["live", "reading"]) s[`properties/${m}`] = r.properties[m];
  s.canvas = r.canvas.all;
  for (const [f, v] of Object.entries(r.bases)) s[`bases/${f}`] = v.all;
  s.graph = r.graph.controls;
  for (const [t, v] of Object.entries(r.dock)) s[`dock/${t}`] = v.rows;
  return s;
};
const VIS = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "fill", "stroke"];
say("\n## Element colours (visible colours only; text colour for leaf text; borders only with width > 0)");
const rowsOf = (sec) => { const m = new Map(), seen = new Map(); for (const r of sec?.rows ?? []) { const base = r.sig + "|" + r.text, n = (seen.get(base) ?? 0) + 1; seen.set(base, n); m.set(base + "#" + n, r); } return { props: sec?.props ?? [], map: m }; };
const SVG = /^(svg|path|circle|polygon|polyline|line|rect|g|pattern|use|ellipse|text)(\.|\||$)/;
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  say(`\n### ${theme}`);
  const pal = paletteOf(theme);
  const base = sections(results.none), cur = sections(results[theme]);
  for (const name of Object.keys(cur)) {
    const B = rowsOf(base[name]), C = rowsOf(cur[name]);
    const idx = (p) => C.props.indexOf(p);
    const left = new Map(), derived = new Map(), inPal = new Map();
    let total = 0, onlyTheme = 0;
    for (const [k, row] of C.map) {
      const b = B.map.get(k);
      if (!b) { onlyTheme++; }
      total++;
      for (const p of VIS) {
        const v = row.v[idx(p)], c = parse(v);
        if (!c || c.a === 0) continue;
        if (p === "color" && !row.text) continue;
        if ((p === "fill" || p === "stroke") && !SVG.test(row.sig)) continue;
        if (p === "outline-color") continue;
        if (p.startsWith("border-") && !(parseFloat(row.v[idx(p.includes("left") || p.includes("right") ? "border-left-width" : "border-top-width")]) > 0)) continue;
        const bv = b?.v[idx(p)];
        const same = bv !== undefined && norm(bv) === norm(v);
        const names = pal.exact.get(norm(v));
        const key = `${p} ${v}`;
        const tgt = names ? inPal : same ? left : derived;
        const e = tgt.get(key) ?? { sigs: [], names, bv }; if (e.sigs.length < 3) e.sigs.push(row.sig.replace(/\|$/, "")); tgt.set(key, e);
      }
    }
    say(`\n${name}: ${total} element signatures (${onlyTheme} without a counterpart under no theme); visible colours: ${inPal.size} in the palette, ${left.size} default-left off-palette, ${derived.size} changed off-palette`);
    const show = (title, m, withNear) => {
      if (!m.size) return;
      say(`  ${title}`);
      for (const [k, e] of m) {
        const c = parse(k.slice(k.indexOf(" ") + 1));
        const n = withNear && c.a === 1 ? nearest(pal, c) : null;
        say(`    ${k}${n ? `  (nearest ${n.n} dE ${n.d.toFixed(1)})` : ""}  <- ${e.sigs.join(", ")}`);
      }
    };
    show("default-left, off-palette:", left, true);
    show("changed, off-palette:", derived, true);
  }
}
console.log(out.join("\n"));

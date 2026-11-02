// KD Canvas colours 2-6: which existing Kanagawa palette colours could make them tell apart (research/14 §6.174).
// Reads the HSL triplets of the palette file (src/palette/kanagawa-dragon.css), so no value is typed here. Numbers only:
// CIEDE2000 between colours, WCAG contrast on the editor background, and the closest pair among the six colours and
// against the uncoloured node colour (the editor background with --ink-disabled-text-color over it).
// usage: node candidates.mjs <repo>
import { readFileSync } from "node:fs";
import path from "node:path";
import { contrast, de2000, lab, over } from "../11m-ui-measure/color.mjs";

const repo = process.argv[2] ?? ".";
const css = readFileSync(path.join(repo, "src/palette/kanagawa-dragon.css"), "utf8");
const triplet = (name) => { const m = new RegExp(`--${name}:\\s*([\\d.]+)deg\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(css); if (!m) throw new Error(`no ${name}`); return m.slice(1).map(Number); };
const hslToRgb = ([h, s, l]) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)), a: 1 }; };
const col = (name) => { const t = triplet(name); return { name, hsl: t, rgb: hslToRgb(t) }; };
const bg = hslToRgb(triplet("kanagawa-dragon-black3")); // --ink-editor-background (rgb(30,29,26))
const neutral = over({ r: 197, g: 201, b: 197, a: 0.3 }, bg); // --ink-disabled-text-color over the background
const hex = (c) => `rgb(${c.r},${c.g},${c.b})`;
const chroma = (c) => { const [, a, b] = lab(c); return Math.hypot(a, b); };

// Current Canvas colour 1..6 in the trial: --ink-red, -orange, -yellow, -green, -teal, -violet.
const CURRENT = { 1: "kanagawa-dragon-red", 2: "kanagawa-dragon-orange", 3: "kanagawa-dragon-yellow", 4: "kanagawa-dragon-green2", 5: "kanagawa-dragon-aqua", 6: "kanagawa-dragon-violet" };
// Candidates by meaning: hue range of the colour's name; only palette colours inside it.
const POOL = {
  2: ["kanagawa-dragon-orange", "kanagawa-autumn-yellow", "kanagawa-ronin-yellow"],
  3: ["kanagawa-dragon-yellow", "kanagawa-old-white"],
  4: ["kanagawa-dragon-green2", "kanagawa-spring-green", "kanagawa-autumn-green"],
  5: ["kanagawa-dragon-aqua", "kanagawa-wave-aqua1"],
  6: ["kanagawa-dragon-violet", "kanagawa-dragon-teal", "kanagawa-dragon-pink"],
};
console.log(`background ${hex(bg)}; uncoloured node colour (over the background) ${hex(neutral)}`);
console.log("\nname  | hsl | rgb | chroma | contrast | dE to uncoloured | dE to current of its slot");
const all = new Map();
for (const [slot, names] of Object.entries(POOL)) for (const n of names) all.set(n, col(n));
for (const n of Object.values(CURRENT)) all.set(n, col(n));
for (const [slot, names] of Object.entries(POOL)) {
  console.log(`\nslot ${slot} (current ${CURRENT[slot]})`);
  for (const n of names) { const c = all.get(n); console.log(`  ${n.padEnd(24)} hsl(${c.hsl[0]} ${c.hsl[1]}% ${c.hsl[2]}%) ${hex(c.rgb).padEnd(16)} C ${chroma(c.rgb).toFixed(0).padStart(3)}  contrast ${contrast(c.rgb, bg).toFixed(2)}  dE-uncoloured ${de2000(lab(c.rgb), lab(neutral)).toFixed(1).padStart(5)}  dE-current ${de2000(lab(c.rgb), lab(all.get(CURRENT[slot]).rgb)).toFixed(1).padStart(5)}`); }
}
const red = all.get(CURRENT[1]);
const score = (pick) => {
  const six = [red, ...[2, 3, 4, 5, 6].map((s) => all.get(pick[s]))];
  let pair = Infinity, pairNames = "";
  for (let i = 0; i < six.length; i++) for (let j = i + 1; j < six.length; j++) { const d = de2000(lab(six[i].rgb), lab(six[j].rgb)); if (d < pair) { pair = d; pairNames = `${i + 1}-${j + 1}`; } }
  const vsNeutral = Math.min(...six.map((c) => de2000(lab(c.rgb), lab(neutral))));
  const changed = [2, 3, 4, 5, 6].filter((s) => pick[s] !== CURRENT[s]).length;
  return { pair, pairNames, vsNeutral, changed, minC: Math.min(...six.map((c) => chroma(c.rgb))) };
};
const combos = [];
const slots = [2, 3, 4, 5, 6];
const walk = (i, pick) => { if (i === slots.length) { combos.push({ pick: { ...pick }, ...score(pick) }); return; } for (const n of POOL[slots[i]]) { pick[slots[i]] = n; walk(i + 1, pick); } };
walk(0, {});
const cur = combos.find((c) => c.changed === 0);
console.log(`\ncurrent set: closest pair ${cur.pairNames} dE ${cur.pair.toFixed(1)}, closest to uncoloured dE ${cur.vsNeutral.toFixed(1)}`);
// Fewest changes first among sets that raise both numbers; print the best per number of changed slots.
const better = combos.filter((c) => c.pair > cur.pair && c.vsNeutral > cur.vsNeutral).sort((a, b) => a.changed - b.changed || Math.min(b.pair, b.vsNeutral * 2) - Math.min(a.pair, a.vsNeutral * 2));
console.log("\nbest sets by number of changed slots (slot: colour); pair = closest pair among the six, vs uncoloured = closest to the uncoloured node colour");
for (let k = 1; k <= 5; k++) { const c = better.find((x) => x.changed === k); if (c) console.log(`  ${k} changed: ${Object.entries(c.pick).filter(([s, n]) => n !== CURRENT[s]).map(([s, n]) => `${s}:${n}`).join(", ")} -> pair ${c.pairNames} dE ${c.pair.toFixed(1)}, vs uncoloured dE ${c.vsNeutral.toFixed(1)}`); }

// ---- hue and chroma: what makes a 1px border look coloured rather than grey is its chroma, not its lightness
const hue = (c) => { const [, a, b] = lab(c); const h = (Math.atan2(b, a) * 180) / Math.PI; return h < 0 ? h + 360 : h; };
console.log("\nchroma C and Lab hue h of the uncoloured node colour and each candidate (a border with C below ~15 reads as grey)");
console.log(`  uncoloured: C ${chroma(neutral).toFixed(0)}`);
for (const n of new Set([CURRENT[1], ...Object.values(POOL).flat()])) { const c = all.get(n) ?? col(n); console.log(`  ${n.padEnd(24)} C ${chroma(c.rgb).toFixed(0).padStart(3)}  h ${hue(c.rgb).toFixed(0).padStart(3)}`); }
const show = (label, pick) => {
  const six = [1, 2, 3, 4, 5, 6].map((s) => (s === 1 ? red : all.get(pick[s])));
  console.log(`\n${label}: ${six.map((c, i) => `${i + 1}=${c.name.replace("kanagawa-", "")}`).join(", ")}`);
  console.log("  chroma: " + six.map((c, i) => `${i + 1}:${chroma(c.rgb).toFixed(0)}`).join(" "));
  const rows = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) rows.push(`${i + 1}-${j + 1}:${de2000(lab(six[i].rgb), lab(six[j].rgb)).toFixed(0)}`);
  console.log("  pairwise dE2000: " + rows.join(" "));
};
show("current", CURRENT);
show("proposed (2 and 4 only)", { ...CURRENT, 2: "kanagawa-autumn-yellow", 4: "kanagawa-spring-green" });
show("alternative (2 loud)", { ...CURRENT, 2: "kanagawa-ronin-yellow", 4: "kanagawa-spring-green" });

// Step 11E: WCAG contrast of the themes' text colours (research/14 §6.30.3 11E). Q-D15: the ratios are recorded,
// never used to adjust a colour; a pair below AA is a fact for the record, not a failure of this tool.
//
// Colours are the values the runtime checks MEASURED in Obsidian (a result file of tests/runtime/run.mjs,
// desktop, opaque), paired by tests/quality/contrast-pairs.json. Background layers are composited bottom to
// top (source-over), then the text over them. For a translucent window the first layer is replaced by the
// same-session native pixel of the V-38 Obsidian capture (research/evidence/phase3-v38, display colour space,
// grey backdrop, active window): the real backdrop of that environment, not a CSS value.
//
// usage: node tests/quality/contrast.mjs <runtime-result.json> <v38-compare-gray-active.csv> [--out <file.json>]
// Exit status 1 only when a colour is missing or unreadable (never because of a low ratio).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseColor, readCsv } from "../lib/css.mjs";
import { contrast, level, over } from "./lib.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const [resultFile, v38File, ...rest] = process.argv.slice(2);
const outFile = rest[0] === "--out" ? rest[1] : null;
if (!resultFile || !v38File) { console.error("usage: node tests/quality/contrast.mjs <runtime-result.json> <v38-compare-gray-active.csv> [--out <file.json>]"); process.exit(2); }
const run = JSON.parse(readFileSync(resultFile, "utf8"));
const pairs = JSON.parse(readFileSync(path.join(repo, "tests/quality/contrast-pairs.json"), "utf8")).pairs;
// V-38: obsidian_region -> mean RGB per theme (rows of v38-compare.py's CSV).
const v38 = {};
for (const r of readCsv(v38File)) (v38[r.theme] ??= {})[r.obsidian_region] = JSON.parse(r.obsidian_mean_rgb);

const problems = [];
// The measured colour of a check (desktop, opaque, first pass) as [r, g, b, a]; a gradient gives its first colour.
function measured(theme, id) {
  const r = run.results.find((x) => x.id === id && x.theme === theme && x.platform === "desktop" && x.appearance === "opaque");
  const raw = r?.measured?.value;
  const text = /gradient\(/.test(raw ?? "") ? /rgba?\([^)]*\)/.exec(raw)?.[0] : raw;
  const c = parseColor(text);
  if (!c) { problems.push(`${theme} ${id}: no readable measured colour (${raw ?? "no result"})`); return null; }
  return [...c.rgb, c.a];
}
const round = (c) => c.map((x) => Math.round(x * 10) / 10);

const out = [];
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  for (const p of pairs) {
    const text = measured(theme, p.text);
    const layers = p.on.map((id) => measured(theme, id));
    if (!text || layers.some((l) => !l)) continue;
    // The first layer must be opaque (the surface); the rest are composited over it.
    if (layers[0][3] !== 1) problems.push(`${theme} ${p.id}: the first layer ${p.on[0]} is not opaque`);
    for (const appearance of ["opaque", "translucent"]) {
      if (appearance === "translucent" && !p.translucent) continue;
      let bg = layers[0].slice(0, 3);
      if (appearance === "translucent") {
        bg = v38[theme]?.[p.translucent];
        if (!bg) { problems.push(`${theme} ${p.id}: no V-38 pixel for ${p.translucent}`); continue; }
      }
      for (const l of layers.slice(1)) bg = over(l, bg);
      const fg = over(text, bg);
      const ratio = contrast(fg, bg);
      out.push({ theme, appearance, pair: p.id, label: p.label, text: p.text, on: p.on, textColour: text, background: round(bg), composited: round(fg), ratio: Math.round(ratio * 100) / 100, level: level(ratio) });
    }
  }
}
for (const r of out) console.log(`${r.theme.padEnd(16)} ${r.appearance.padEnd(11)} ${r.pair.padEnd(22)} ${String(r.ratio).padStart(5)}  ${r.level}`);
const below = out.filter((r) => r.level === "below AA" || r.level === "AA large");
console.log(`\n${out.length} ratios; below 4.5 (normal text AA): ${below.length}${problems.length ? `\nPROBLEMS:\n  ${problems.join("\n  ")}` : ""}`);
if (outFile) writeFileSync(outFile, `${JSON.stringify({ source: { runtime: path.relative(repo, path.resolve(resultFile)), v38: path.relative(repo, path.resolve(v38File)), obsidian: run.environment ?? null }, ratios: out, problems }, null, 1)}\n`);
process.exit(problems.length ? 1 : 0);

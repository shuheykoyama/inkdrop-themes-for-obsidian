// C2 trial, character by character (research/14 §6.151): the Reading view colours of a note's code blocks before and
// after the trial CSS (two c2-probe.mjs results), each compared with the colour Inkdrop 6.2.0 gives the character.
//   static <tokens.json>     for "C2 general.md" (general code). STATIC, not measured: tests/visual/inkdrop-tokens.mjs
//                            on that note with Inkdrop 6.2.0's bundled parsers and syntax.css (G7-0 method; it matched
//                            the G7-1 measurement of the test note except `py`, `rs` and the Markdown list marks,
//                            research/14 §6.131), each variable in the theme's value (read by c2-probe.mjs), untokenised
//                            text in the preview code text colour. `py` is not a language name in Inkdrop 6.2.0
//                            (§6.131), so its whole block counts as untokenised.
//   rendered <fixture.json>  for "Code blocks.md" (the test note): Inkdrop 6.2.0's MEASURED preview colours
//                            (tests/fixtures/inkdrop-rendered-6.2.0.json, G7-1).
// Per language block: non-space characters, how many have Inkdrop's colour before and after, how many the trial
// fixed and broke, how many changed colour but still differ (each by Inkdrop's token class), and how many changed
// colour at all. Blocks without a language and the callout's block are listed too (changes only).
//
// <dump.json> (optional) receives every non-space character of the language blocks: theme, block, language, offset,
// character, Inkdrop's class and colour, and the colour before and after (for c2-de.py).
//
// usage: node c2-general.mjs <base.json> <trial.json> <note> static <tokens.json> [<dump.json>]
//        node c2-general.mjs <base.json> <trial.json> <note> rendered <fixture.json> [<dump.json>]
import { readFileSync, writeFileSync } from "node:fs";

const [baseFile, trialFile, note, kind, inkFile, dumpFile] = process.argv.slice(2);
const dump = [];
if (!["static", "rendered"].includes(kind)) throw new Error("kind must be static or rendered");
const load = (f) => JSON.parse(readFileSync(f, "utf8")).results.filter((r) => r.file === note && r.mode === "reading");
const inkData = JSON.parse(readFileSync(inkFile, "utf8"));
const UNTOKENISED = "--ink-mde-preview-inline-code-text-color";

for (const theme of ["kanagawa-dragon", "solarized-dark"]) {
  const base = load(baseFile).find((r) => r.theme === theme);
  const trial = load(trialFile).find((r) => r.theme === theme);
  if (!base?.chars || !trial?.chars) throw new Error(`${theme}: no character dump`);
  const vars = base.vars;
  const ink = kind === "static" ? inkData : inkData.themes[theme].preview;
  // The language blocks outside the callout, in note order, are Inkdrop's blocks in the same order.
  const isLang = (c) => /language-/.test(c.id) && !c.id.includes("in callout");
  const obsLang = base.chars.filter(isLang);
  if (obsLang.length !== ink.length) throw new Error(`${theme}: ${obsLang.length} Obsidian language blocks, ${ink.length} Inkdrop blocks`);
  // Inkdrop's colour and class of character c of block `block`.
  const inkdropAt = (block, c) => {
    if (kind === "rendered") {
      const r = block.ranges.find((x) => x.from <= c && c < x.to);
      if (!r) throw new Error(`${theme} ${block.lang}: character ${c} not measured`);
      return { colour: r.color, cls: r.cls || "(no token)" };
    }
    const r = block.lang === "py" ? null : block.ranges.find((x) => x.from <= c && c < x.to);
    const colour = vars[r?.var ? r.var.replace("--syntax-", "--ink-syntax-") : UNTOKENISED];
    if (!colour) throw new Error(`${theme}: no value for ${r?.var}`);
    return { colour, cls: r?.cls || "(no token)" };
  };
  const total = { chars: 0, before: 0, after: 0, fixed: 0, broke: 0, moved: 0, changed: 0 };
  console.log(`== ${theme} ${note}: lang chars inkdropBefore inkdropAfter fixed broke stillDiffering changed`);
  for (const b of base.chars) {
    const t = trial.chars.find((x) => x.id === b.id && x.text === b.text);
    if (!t || t.colours.length !== b.colours.length) throw new Error(`${theme} ${b.id}: no matching trial block`);
    const i = obsLang.indexOf(b);
    const block = i >= 0 ? ink[i] : null;
    if (block) {
      const lang = /language-(\S+)/.exec(b.id)[1];
      if (lang !== block.lang || b.text.replace(/\n$/, "") !== block.code) throw new Error(`${theme} block ${i}: ${lang} is not Inkdrop's ${block.lang} text`);
    }
    const row = { chars: 0, before: 0, after: 0, fixed: 0, broke: 0, moved: 0, changed: 0 };
    const fixed = {}, broke = {}, moved = {};
    for (let c = 0; c < b.text.length; c++) {
      if (/\s/.test(b.text[c])) continue;
      row.chars++;
      if (b.colours[c] !== t.colours[c]) row.changed++;
      if (!block) continue;
      const { colour, cls } = inkdropAt(block, c);
      dump.push({ theme, block: i, lang: block.lang, at: c, ch: b.text[c], cls, inkdrop: colour, before: b.colours[c], after: t.colours[c] });
      const was = b.colours[c] === colour, now = t.colours[c] === colour;
      row.before += was; row.after += now;
      if (!was && now) { row.fixed++; fixed[cls] = (fixed[cls] ?? 0) + 1; }
      if (was && !now) { row.broke++; broke[cls] = (broke[cls] ?? 0) + 1; }
      if (!was && !now && b.colours[c] !== t.colours[c]) { row.moved++; moved[cls] = (moved[cls] ?? 0) + 1; }
    }
    if (!block && !row.changed) continue;
    const fmt = (o) => Object.entries(o).map(([k, n]) => `${k} x${n}`).join(", ");
    console.log(`${b.id}: ${row.chars} ${block ? `${row.before} ${row.after} ${row.fixed} ${row.broke} ${row.moved}` : "- - - - -"} ${row.changed}${row.fixed ? `\n    fixed: ${fmt(fixed)}` : ""}${row.broke ? `\n    broke: ${fmt(broke)}` : ""}${row.moved ? `\n    still differing: ${fmt(moved)}` : ""}`);
    if (block) for (const k of Object.keys(total)) total[k] += row[k];
  }
  console.log(`TOTAL ${theme} ${note} (language blocks) ${JSON.stringify(total)}`);
}
if (dumpFile) writeFileSync(dumpFile, JSON.stringify(dump));

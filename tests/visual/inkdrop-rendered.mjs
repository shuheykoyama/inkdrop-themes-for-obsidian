// Step 11G (research/14 §6.135.3): the Q-D13 fidelity reference -- the colours Inkdrop 6.2.0 renders for the test
// note in its editor and preview, per theme -- made from the G7-1 measurements (research/evidence/phase3-step11/
// 11g-g7/g7-1/measurements). Deterministic: the same measurement files give the same bytes. Each view of each theme
// must be a COMPLETE measurement of Inkdrop 6.2.0 with the note's blocks in order (language and text as
// tests/fixtures/inkdrop-tokens.json); its ranges must carry their text and cover every character of each block
// once (in the editor, the newlines between lines are not text nodes and stay uncovered). Neighbouring ranges of
// the same colour and classes are joined.
//
// usage: node tests/visual/inkdrop-rendered.mjs [--check]   (writes tests/fixtures/inkdrop-rendered-6.2.0.json;
//        --check only compares the file with what would be written)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..", "..");
const MEASURED = "research/evidence/phase3-step11/11g-g7/g7-1/measurements";
const OUT = "tests/fixtures/inkdrop-rendered-6.2.0.json";
// The measurement run (research/14 §6.131) and the theme packages installed in that Inkdrop (read from their
// package.json on 2026-10-29; the run itself did not record them).
const SOURCE = { inkdrop: "6.2.0", measuredAt: "2026-10-27T04:40:43Z", commit: "2316ea8", themePackages: { "solarized-dark": "2.2.1", "kanagawa-dragon": "1.2.1" } };

// One view of one theme: the blocks with their joined ranges, or an Error naming what is wrong.
export function renderedView(measurement, blocks, view) {
  if (measurement.state !== "COMPLETE") throw new Error(`${measurement.name}: not COMPLETE`);
  const res = measurement.result;
  if (res.inkdropVersion !== SOURCE.inkdrop || res.mode !== view) throw new Error(`${measurement.name}: Inkdrop ${res.inkdropVersion}, ${res.mode}`);
  if (res.blocks.length !== blocks.length) throw new Error(`${measurement.name}: ${res.blocks.length} blocks, not ${blocks.length}`);
  return blocks.map((b, i) => {
    const m = res.blocks[i];
    if (m.index !== i || m.lang !== b.lang || m.text !== b.code) throw new Error(`${measurement.name}: block ${i} is not ${b.lang}'s text`);
    const seen = new Array(b.code.length).fill(0);
    const ranges = [];
    for (const r of [...m.ranges].sort((x, y) => x.from - y.from)) {
      if (r.text !== b.code.slice(r.from, r.to) || !r.color) throw new Error(`${measurement.name}: block ${i} range ${r.from}-${r.to} has the wrong text or no colour`);
      for (let c = r.from; c < r.to; c++) seen[c]++;
      const last = ranges.at(-1);
      // Join with the previous range when they touch and look the same.
      if (last && last.to === r.from && last.color === r.color && last.cls === r.cls) last.to = r.to;
      else ranges.push({ from: r.from, to: r.to, color: r.color, cls: r.cls });
    }
    const bad = seen.findIndex((n, c) => n > 1 || (n === 0 && !(view === "editor" && b.code[c] === "\n")));
    if (bad >= 0) throw new Error(`${measurement.name}: block ${i} character ${bad} covered ${seen[bad]} times`);
    return { lang: b.lang, code: b.code, ranges };
  });
}

function build() {
  const blocks = JSON.parse(readFileSync(path.join(repo, "tests/fixtures/inkdrop-tokens.json"), "utf8"));
  const out = { description: "Colours Inkdrop renders for tests/fixtures/vault/Code blocks.md (research/14 §6.135.3), made by tests/visual/inkdrop-rendered.mjs", source: { ...SOURCE, files: {} }, themes: {} };
  for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
    out.themes[theme] = {};
    for (const view of ["editor", "preview"]) {
      const rel = `${MEASURED}/inkdrop-${theme}-g7-${view}.json`;
      const raw = readFileSync(path.join(repo, rel));
      out.source.files[rel] = createHash("sha256").update(raw).digest("hex");
      out.themes[theme][view] = renderedView(JSON.parse(raw), blocks, view);
    }
  }
  return `${JSON.stringify(out, null, 1)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = build();
  if (process.argv[2] === "--check") {
    const same = readFileSync(path.join(repo, OUT), "utf8") === text;
    console.log(same ? `${OUT} is what the measurements give` : `${OUT} differs from what the measurements give`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(path.join(repo, OUT), text);
  console.log(`wrote ${OUT}`);
}

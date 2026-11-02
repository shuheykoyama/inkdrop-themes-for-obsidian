// Would the 11 new checks catch the CSS being absent? Compares the variables of the final build (11m-ui-measure/probe.json, which
// has no canvas-graph.css) with the tokens the checks expect, and the same for the trial build (probe-trial.json).
// usage: node mutant-check.mjs ../11m-ui-measure/probe.json probe-trial.json
import { readFileSync } from "node:fs";
const expect = { "--canvas-color": "--ink-disabled-text-color", "--canvas-color-1": "--ink-red", "--canvas-color-2": "--ink-orange", "--canvas-color-3": "--ink-yellow", "--canvas-color-4": "--ink-green", "--canvas-color-5": "--ink-teal", "--canvas-color-6": "--ink-violet", "--canvas-dot-pattern": "--ink-solid-border-color", "--graph-line": "--ink-strong-border-color", "--graph-node-tag": "--ink-green", "--graph-node-attachment": "--ink-yellow" };
const [bf, af] = process.argv.slice(2);
for (const [label, file] of [["without the CSS (final build)", bf], ["with the CSS (trial build)", af]]) {
  const r = JSON.parse(readFileSync(file, "utf8")).results;
  for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
    const ok = Object.entries(expect).filter(([v, t]) => r[theme].base.vars[v].rgb.replace(/\s/g, "") === r[theme].base.palette[t].replace(/\s/g, "")).length;
    console.log(`${label}, ${theme}: ${ok} of ${Object.keys(expect).length} variables equal the expected token`);
  }
}

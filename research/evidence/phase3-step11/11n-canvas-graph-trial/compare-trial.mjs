// Before / after of the Canvas and Graph trial (research/14 §6.170): compares probe.json (final build) with
// probe-trial.json (the same probe on the trial build) for Solarized Dark and Kanagawa Dragon, and checks the "no theme"
// condition did not move. Prints: variables whose resolved value changed, the Graph renderer colours, the element
// colours that changed (grouped), and the contrast / distinguishability numbers behind the choice of colours.
// A reading aid, not a judgement: contrast is WCAG on the opaque editor background, dE is CIEDE2000.
//
// usage: node compare-trial.mjs ../11m-ui-measure/probe.json probe-trial.json
import { readFileSync } from "node:fs";
import { parse, lab, de2000, contrast, over } from "../11m-ui-measure/color.mjs";

const [beforeFile, afterFile] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforeFile, "utf8")).results, after = JSON.parse(readFileSync(afterFile, "utf8")).results;
const norm = (s) => (s ?? "").replace(/\s/g, "");
const out = [];
const say = (s = "") => out.push(s);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// "none" must be identical (the trial build is not loaded there).
const noneVars = Object.keys(before.none.base.vars).filter((n) => norm(before.none.base.vars[n].rgb) !== norm(after.none.base.vars[n]?.rgb));
say(`no theme: ${noneVars.length} variables differ between the two probes (expected 0)`);

for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const b = before[theme], a = after[theme];
  say(`\n## ${theme}`);
  const names = Object.keys(b.base.vars);
  const changed = names.filter((n) => norm(b.base.vars[n].rgb) !== norm(a.base.vars[n]?.rgb) || b.base.vars[n].raw !== a.base.vars[n]?.raw);
  say(`variables read: ${names.length}; changed: ${changed.length}${names.length !== Object.keys(a.base.vars).length ? " (the set of names differs!)" : ""}`);
  for (const n of changed) say(`  ${n}: ${b.base.vars[n].rgb} -> ${a.base.vars[n].rgb}`);

  say("Graph renderer colours:");
  for (const k of Object.keys(b.graph.colours)) {
    const x = b.graph.colours[k], y = a.graph.colours[k];
    if (x.rgb !== y.rgb || x.a !== y.a) say(`  ${k}: ${hex(x.rgb)} a=${x.a} -> ${hex(y.rgb)} a=${y.a}`);
  }
  const same = Object.keys(b.graph.colours).filter((k) => b.graph.colours[k].rgb === a.graph.colours[k].rgb && b.graph.colours[k].a === a.graph.colours[k].a);
  say(`  unchanged: ${same.join(", ")}`);

  // Element colours: every row whose values differ, by section.
  const sections = (r) => {
    const s = {};
    for (const m of ["live", "reading"]) s[`properties/${m}`] = r.properties[m];
    s.canvas = r.canvas.all;
    for (const [f, v] of Object.entries(r.bases)) s[`bases/${f}`] = v.all;
    s.graph = r.graph.controls;
    for (const [t, v] of Object.entries(r.dock)) s[`dock/${t}`] = v.rows;
    return s;
  };
  const rowsOf = (sec) => { const m = new Map(), seen = new Map(); for (const r of sec?.rows ?? []) { const base = r.sig + "|" + r.text, n = (seen.get(base) ?? 0) + 1; seen.set(base, n); m.set(base + "#" + n, r); } return m; };
  const B = sections(b), A = sections(a);
  say("Element colours that changed (section: property before -> after, elements):");
  for (const name of Object.keys(B)) {
    const props = B[name]?.props ?? [], rb = rowsOf(B[name]), ra = rowsOf(A[name]);
    const groups = new Map();
    let unmatched = 0;
    for (const [k, row] of ra) {
      const old = rb.get(k);
      if (!old) { unmatched++; continue; }
      props.forEach((p, i) => { if (norm(old.v[i]) !== norm(row.v[i])) { const g = `${p}: ${old.v[i]} -> ${row.v[i]}`; (groups.get(g) ?? groups.set(g, []).get(g)).push(row.sig.replace(/\|$/, "")); } });
    }
    if (groups.size || unmatched) say(`  ${name}${unmatched ? ` (${unmatched} rows without a counterpart)` : ""}`);
    for (const [g, sigs] of groups) say(`    ${g}  <- ${[...new Set(sigs)].slice(0, 4).join(", ")}${sigs.length > 4 ? ` (+${sigs.length - 4})` : ""}`);
  }

  // Contrast and distinguishability, after the trial.
  const bg = parse(a.base.palette["--ink-editor-background"]);
  const v = (n) => over(parse(a.base.vars[n].rgb), bg);
  say("Against the editor background " + a.base.palette["--ink-editor-background"] + " (alpha composited):");
  const items = ["--canvas-color", "--canvas-dot-pattern", "--graph-line", "--graph-node-tag", "--graph-node-attachment", ...[1, 2, 3, 4, 5, 6].map((i) => `--canvas-color-${i}`)];
  for (const n of items) say(`  ${n}: ${a.base.vars[n].rgb} -> contrast ${contrast(v(n), bg).toFixed(2)}`);
  const neutral = lab(v("--canvas-color"));
  const sixes = [1, 2, 3, 4, 5, 6].map((i) => [i, lab(v(`--canvas-color-${i}`))]);
  say("  uncoloured node vs each coloured node (dE2000): " + sixes.map(([i, l]) => `${i}: ${de2000(neutral, l).toFixed(1)}`).join(", "));
  const pairs = [];
  for (let i = 0; i < sixes.length; i++) for (let j = i + 1; j < sixes.length; j++) pairs.push([`${sixes[i][0]}-${sixes[j][0]}`, de2000(sixes[i][1], sixes[j][1])]);
  pairs.sort((x, y) => x[1] - y[1]);
  say("  closest pairs among the six colours (dE2000): " + pairs.slice(0, 3).map(([k, d]) => `${k}: ${d.toFixed(1)}`).join(", "));
}
console.log(out.join("\n"));

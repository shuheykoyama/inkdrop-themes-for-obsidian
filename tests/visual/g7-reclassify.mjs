// Step 11G G7-2 (research/14 §6.133): Q-D13 fidelity judged again against what Inkdrop 6.2.0 renders (G7-1)
// instead of the static token expectation (tests/fixtures/inkdrop-tokens.json), from recorded data only (no app
// is run). Per character of the test note, per theme, Obsidian context and view:
//   - the static expectation: the colour of the fixture's --syntax-* variable in Obsidian's palette (what
//     qd13.fidelity compared with);
//   - Obsidian's colour: the static one, or for the characters of a recorded differing run (the `measured` list of
//     syn.<view>.<lang>.fidelity) the colour the theme gave that run's group (syn.<view>.classes);
//   - Inkdrop's colour: measured in G7-1 (editor for Source mode and Live Preview, preview for Reading view).
// The recorded differing runs carry their text but no offsets: each is placed at the next place in its block
// with that text, the same Inkdrop class and the same Obsidian classes (correspondence table of V-12/V-31).
// Their order is kept, so a run of the same text and classes may be swapped with an equal one; the counts per
// block do not change by that.
// The class groups of (C) are rebuilt from the correspondence table (Obsidian classes per character, desktop
// only: the table was dumped on desktop) and classified with Inkdrop's measured colours (EXACT / MISMATCH /
// CONFLICT / DOMINATED, by characters; bare text apart), next to the same classification with the static colours
// to check the rebuild against the recorded tallies.
//
// usage: node tests/visual/g7-reclassify.mjs <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseComputedColor, sameColor } from "../lib/css.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const VIEWS = ["source", "live", "reading"];
const same = (a, b) => sameColor(parseComputedColor(a), parseComputedColor(b));

// RFC 4180-style CSV (quoted fields with doubled quotes; no newline inside a field in this table).
export function parseCsv(text) {
  return text.trim().split("\n").map((line) => {
    const out = [];
    for (let i = 0; i <= line.length; ) {
      if (line[i] === '"') {
        let v = "", j = i + 1;
        for (;;) { const q = line.indexOf('"', j); if (line[q + 1] === '"') { v += line.slice(j, q + 1); j = q + 2; } else { v += line.slice(j, q); i = q + 2; break; } }
        out.push(v);
      } else { const c = line.indexOf(",", i); const e = c < 0 ? line.length : c; out.push(line.slice(i, e)); i = e + 1; }
    }
    return out;
  });
}

// The table's rows of one block, placed in its code in order: only whitespace may lie between two rows.
export function alignRows(code, rows) {
  let at = 0;
  return rows.map((r) => {
    const p = code.indexOf(r.text, at);
    if (p < 0 || code.slice(at, p).trim()) throw new Error(`row "${r.text}" not found at ${at}`);
    at = p + r.text.length;
    return { ...r, from: p, to: at };
  });
}

// Obsidian classes as the table writes them: without cm-hmd-codeblock / token, sorted, "-" for none.
export const normClasses = (s) => [...new Set(s.split(/[\s.<]+/).filter((c) => c && c !== "cm-hmd-codeblock" && c !== "token" && c !== "(bare" && c !== "text)"))].sort().join(" ") || "-";

// Places each differing run (in order) at the next position with its text whose Inkdrop class and Obsidian
// classes match; returns per character the run's index or -1. Throws when a run cannot be placed.
export function placeMisses(code, misses, inkCls, obsCls) {
  const at = new Array(code.length).fill(-1);
  let from = 0;
  misses.forEach((m, k) => {
    for (let p = code.indexOf(m.text, from); p >= 0; p = code.indexOf(m.text, p + 1)) {
      if ((inkCls[p] || "(no token)") === m.inkdrop && obsCls[p] === normClasses(m.obsidian)) {
        for (let c = p; c < p + m.text.length; c++) at[c] = k;
        from = p + m.text.length;
        return;
      }
    }
    throw new Error(`differing run "${m.text}" (${m.inkdrop}, ${m.obsidian}) not placed after ${from}`);
  });
  return at;
}

// (C) for one group: the theme's colours and Inkdrop's colours with their characters.
export function classify(themeColours, inks) {
  const theme = [...new Set(themeColours)];
  if (theme.length !== 1) return "MIXED";
  const hit = [...inks.keys()].some((c) => same(c, theme[0]));
  return inks.size === 1 ? (hit ? "EXACT" : "MISMATCH") : (hit ? "CONFLICT" : "DOMINATED");
}

function main(outPath) {
  const read = (p) => readFileSync(path.join(repo, p), "utf8");
  const spec = JSON.parse(read("tests/spec/syntax.json"));
  const fixture = JSON.parse(read("tests/fixtures/inkdrop-tokens.json"));
  const run = JSON.parse(read("research/evidence/phase3-step11/11h/regress-1.14.5/runtime-electron-39.5.1-run1.json")).results;
  const [head, ...body] = parseCsv(read("research/evidence/phase3-step8/v12-v31-correspondence.csv"));
  const table = body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  const G7 = "research/evidence/phase3-step11/11g-g7/g7-1/measurements";
  const out = { inputs: { fixture: "tests/fixtures/inkdrop-tokens.json", obsidian: "11h/regress-1.14.5/runtime-electron-39.5.1-run1.json (desktop/opaque, phone/opaque)", table: "phase3-step8/v12-v31-correspondence.csv", inkdrop: G7 }, results: [] };

  // Per block: the table's rows placed in the code, and per character the fixture's class and variable.
  const blocks = fixture.map((b) => {
    const rows = alignRows(b.code, table.filter((r) => r.lang === b.lang).map((r) => ({ text: r.text, obs: { source: r.obsidian_source, live: r.obsidian_live, reading: r.obsidian_reading }, cls: r.inkdrop_classes })));
    const inkCls = new Array(b.code.length).fill(""), inkVar = new Array(b.code.length).fill(null);
    for (const r of b.ranges) for (let c = r.from; c < r.to; c++) { inkCls[c] = r.cls; inkVar[c] = r.var ?? null; }
    const obsCls = Object.fromEntries(VIEWS.map((v) => [v, new Array(b.code.length).fill("-")]));
    for (const r of rows) {
      if (r.cls !== (inkCls[r.from] || "-")) throw new Error(`${b.lang} "${r.text}": table class ${r.cls}, fixture ${inkCls[r.from]}`);
      for (const v of VIEWS) for (let c = r.from; c < r.to; c++) obsCls[v][c] = r.obs[v];
    }
    return { ...b, rows, inkCls, inkVar, obsCls };
  });

  for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
    const g7 = Object.fromEntries(["editor", "preview"].map((v) => [v, JSON.parse(read(`${G7}/inkdrop-${theme}-g7-${v}.json`)).result]));
    for (const platform of ["desktop", "phone"]) {
      const rec = run.filter((x) => x.theme === theme && x.platform === platform && x.appearance === "opaque" && x.state === "syntax");
      for (const view of VIEWS) {
        const kind = view === "reading" ? "reading" : "editing";
        const classes = rec.find((x) => x.id === `syn.${view}.classes`);
        // Obsidian's palette from the recorded groups: Inkdrop variable -> colour, group -> the theme's colour.
        const pal = {}, groupColour = {};
        for (const g of classes.measured) { groupColour[g.sig] = g.theme; for (const i of g.inks) for (const t of i.tokens) pal[t] = i.colour; }
        const staticName = (v) => (v ? v.replace("--syntax-", "") .replace(/-color$/, "") : spec.inkdropDefault[kind].replace(/-color$/, ""));
        const meas = g7[view === "reading" ? "preview" : "editor"];
        const res = { theme, platform, view, chars: 0, oldDiff: 0, newDiff: 0, expErr: 0, noToken: { chars: 0, asDefault: 0, colours: {} }, checks: { before: 0, now: 0 }, both: { resolved: 0, still: 0, newly: 0 }, oldRuns: 0, runsResolved: 0, perBlock: {}, groups: null };
        const groupData = new Map(); // desktop: key -> { bare, theme: [], old: Map, now: Map }
        for (const [k, b] of blocks.entries()) {
          const fid = rec.find((x) => x.id === `syn.${view}.${b.lang}.fidelity`);
          const misses = fid.measured ?? [];
          const at = placeMisses(b.code, misses, b.inkCls, b.obsCls[view]);
          const got = meas.blocks[k].ranges;
          const inkNow = new Array(b.code.length).fill(null);
          for (const r of got) for (let c = r.from; c < r.to; c++) inkNow[c] = r.color;
          const pb = { lang: b.lang, chars: 0, oldDiff: 0, newDiff: 0, expErr: 0, examples: {} };
          const runOk = misses.map(() => true);
          for (let c = 0; c < b.code.length; c++) {
            if (/\s/.test(b.code[c])) continue;
            const stat = pal[staticName(b.inkVar[c])];
            if (!stat) throw new Error(`${theme} ${view}: no colour for ${staticName(b.inkVar[c])}`);
            const obs = at[c] >= 0 ? groupColour[misses[at[c]].group] : stat;
            const now = inkNow[c];
            const oldD = at[c] >= 0, newD = !same(obs, now), err = !same(stat, now);
            if (at[c] >= 0 && newD) runOk[at[c]] = false;
            // Text without a static token (no --syntax-* variable): its expectation is the view's default colour.
            if (!b.inkVar[c]) { res.noToken.chars++; res.noToken.asDefault += !err; res.noToken.colours[now] = (res.noToken.colours[now] ?? 0) + 1; }
            pb.chars++; pb.oldDiff += oldD; pb.newDiff += newD; pb.expErr += err;
            if (oldD && !newD) res.both.resolved++; else if (oldD && newD) res.both.still++; else if (newD) res.both.newly++;
            if (err) { const key = `"${b.inkCls[c] || "(no token)"}" static ${stat} -> Inkdrop ${now}`; pb.examples[key] = (pb.examples[key] ?? "") + b.code[c]; }
            if (platform === "desktop") {
              const cls = b.obsCls[view][c];
              const lang = spec.langAliases?.[b.lang] ?? b.lang;
              // The table flattens nested elements into one class set, which can join two of qd13's groups; the
              // theme's colour (one per qd13 group) keeps them apart.
              const key = (cls === "-" ? (kind === "reading" ? `${lang} (bare text)` : "(bare text)") : (kind === "reading" ? `${lang} ` : "") + cls) + ` @ ${obs}`;
              if (!groupData.has(key)) groupData.set(key, { bare: cls === "-", theme: [], old: new Map(), now: new Map(), byFence: {} });
              const g = groupData.get(key);
              g.theme.push(obs);
              g.old.set(stat, (g.old.get(stat) ?? 0) + 1);
              g.now.set(now, (g.now.get(now) ?? 0) + 1);
              if (newD) g.byFence[b.lang] = (g.byFence[b.lang] ?? 0) + 1;
            }
          }
          res.checks.before += misses.length > 0; res.checks.now += pb.newDiff > 0;
          res.oldRuns += misses.length; res.runsResolved += runOk.filter(Boolean).length;
          for (const f of ["chars", "oldDiff", "newDiff", "expErr"]) res[f] += pb[f];
          if (pb.oldDiff || pb.newDiff || pb.expErr) res.perBlock[b.lang] = pb;
        }
        if (platform === "desktop") {
          res.groups = [...groupData.entries()].map(([sig, g]) => {
            const theme = g.theme[0];
            const now = [...g.now.entries()].sort((a, b) => b[1] - a[1]);
            const hitNow = now.find(([c]) => same(c, theme))?.[1] ?? 0;
            return { sig, bare: g.bare, theme, before: classify(g.theme, g.old), after: classify(g.theme, g.now), chars: g.theme.length,
              inkdrop: now.map(([colour, n]) => ({ colour, chars: n })), differing: g.theme.length - hitNow,
              // The most a colour choice for this group could reach: all characters of its most common Inkdrop colour.
              bestColour: now[0][0], gainIfBest: now[0][1] - hitNow, byFence: g.byFence };
          });
          const tally = (f, bare) => Object.fromEntries(["EXACT", "CONFLICT", "MISMATCH", "DOMINATED", "MIXED"].map((c) => [c, res.groups.filter((x) => x[f] === c && x.bare === bare).length]));
          // Differing characters a colour choice per group could fix, and those it could not (bare text apart).
          const sum = (bare, f) => res.groups.filter((g) => g.bare === bare).reduce((n, g) => n + f(g), 0);
          res.reach = Object.fromEntries([["element", false], ["bare", true]].map(([k, bare]) => [k, { differing: sum(bare, (g) => g.differing), fixable: sum(bare, (g) => g.gainIfBest), left: sum(bare, (g) => g.differing - g.gainIfBest) }]));
          res.tally = { recorded: classes.detail.replace(/ -- .*/, ""), rebuiltStatic: { element: tally("before", false), bare: tally("before", true) }, measured: { element: tally("after", false), bare: tally("after", true) } };
        }
        out.results.push(res);
      }
    }
  }
  writeFileSync(outPath, `${JSON.stringify(out, null, 1)}\n`);
  for (const r of out.results) console.log(`${r.theme} ${r.platform} ${r.view}: ${r.chars} chars; differing before ${r.oldDiff}, now ${r.newDiff} (resolved ${r.both.resolved}, still ${r.both.still}, new ${r.both.newly}); static expectation wrong on ${r.expErr}; DIFF checks ${r.checks.before} -> ${r.checks.now}; no-token chars ${r.noToken.chars} (as the default ${r.noToken.asDefault}); recorded runs ${r.oldRuns}, of them now all Inkdrop's colour ${r.runsResolved}${r.reach ? `\n  colour choice per group: ${JSON.stringify(r.reach)}` : ""}${r.tally ? `\n  recorded: ${r.tally.recorded}\n  rebuilt (static): ${JSON.stringify(r.tally.rebuiltStatic)}\n  measured:         ${JSON.stringify(r.tally.measured)}` : ""}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);

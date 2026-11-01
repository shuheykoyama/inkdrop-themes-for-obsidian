// Q-D13 residual analysis (research/14 §6.146): the qd13.fidelity DIFF checks of one runtime result file, judged
// against the Inkdrop 6.2.0 rendered reference, split by what could change them. No app is run and no CSS changes.
//
// Per theme and view, the class groups of syn.<view>.classes give, for each Obsidian class group, the theme's colour
// and the Inkdrop colours of its characters. A group can take one colour, so the best a CSS change of that group
// can do is the Inkdrop colour with the most characters (an upper bound for the test note, as in §6.133.5).
// Each differing run of a syn.<view>.<lang>.fidelity check falls in one category by its group:
//   1 dom       its Inkdrop colour is not the group's best colour: the group's characters need several colours and
//               the current Obsidian classes cannot tell them apart (token boundaries, lexer, one class for many).
//   2 css       the group's best colour is its Inkdrop colour, and no character of the group has the theme's colour
//               now: recolouring the group (a selector or variable change) gains without loss.
//   3 c2        as 2, for a Reading view bare-text group (per language): the base colour of that language (C2).
//   4 tradeoff  as 2 or 3, but characters of the group match the theme's colour now and would stop matching.
//   5 basis     as 3 or 4 for a Reading bare-text group, but the winning colour is neither the colour Inkdrop gives
//               plain variable names nor its untokenised-text colour in that theme (e.g. property, type or atom
//               colours): the test note's mix decides it, not general code.
// Characters are the run's non-space characters. Source mode and Live Preview have the same groups (no language
// per line, V-12): their recolouring reaches every language at once.
//
// usage: node qd13-residual.mjs <runtime-*.json> [platform] [appearance] > out.txt
import { readFileSync } from "node:fs";

const [file, platform = "desktop", appearance = "opaque"] = process.argv.slice(2);
const results = JSON.parse(readFileSync(file, "utf8")).results.filter((r) => r.platform === platform && r.appearance === appearance);
const chars = (s) => s.replace(/\s/g, "").length;
const PLAIN = /^(tok-variable-name( tok-definition)?|tok-content|\(no token\)|-)$/;

const out = [];
const summary = [];
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  for (const view of ["source", "live", "reading"]) {
    const groups = new Map(results.find((r) => r.id === `syn.${view}.classes` && r.theme === theme).measured.map((g) => [g.sig, g]));
    // Inkdrop's colours of plain names and untokenised text in this theme and view (from every group).
    const plainColours = new Set([...groups.values()].flatMap((g) => g.inks.filter((i) => i.tokens.every((t) => PLAIN.test(t.replace(/ cm-\S+/g, "")))).map((i) => i.colour)));
    // The group's decision: best colour, its characters now matching, the loss of switching.
    const decide = (g) => {
      const best = g.inks.reduce((a, b) => (b.chars > a.chars ? b : a));
      const now = g.inks.find((i) => i.colour === g.theme)?.chars ?? 0;
      return { best: best.colour, gain: best.colour === g.theme ? 0 : best.chars - now, loss: best.colour === g.theme ? 0 : now, plain: plainColours.has(best.colour) };
    };
    const checks = results.filter((r) => r.theme === theme && r.status === "DIFF" && new RegExp(`^syn\\.${view}\\.[^.]+\\.fidelity$`).test(r.id));
    for (const c of checks) {
      const lang = c.id.split(".")[2];
      // Every differing run the check reports must be classified (the detail counts them by kind).
      const reported = [...c.detail.matchAll(/(\d+) (?:shared class|bare text|from failed groups)/g)].reduce((a, m) => a + Number(m[1]), 0);
      if (reported !== c.measured.length) throw new Error(`${c.id} ${theme}: detail reports ${reported} differing runs, measured has ${c.measured.length}`);
      const cat = { dom: 0, css: 0, c2: 0, tradeoff: 0, basis: 0 };
      const why = [];
      for (const m of c.measured) {
        const g = groups.get(m.group);
        if (!g) throw new Error(`${c.id}: no group ${m.group}`);
        const d = decide(g);
        const n = chars(m.text);
        let k;
        if (m.inkdropColour !== d.best) k = "dom";
        else if (view === "reading" && g.bare && !d.plain) k = "basis";
        else if (d.loss > 0) k = "tradeoff";
        else k = view === "reading" && g.bare ? "c2" : "css";
        cat[k] += n;
        why.push(`${k}:${JSON.stringify(m.text)} ${m.inkdrop} ${m.inkdropColour} in [${m.group}]`);
      }
      const total = Object.values(cat).reduce((a, b) => a + b, 0);
      const pass = cat.dom + cat.tradeoff + cat.basis === 0;
      summary.push({ theme, view, lang, total, ...cat, pass });
      out.push(`${theme} ${view} ${lang}: ${c.detail}`, `  chars ${total}: dom ${cat.dom}, css ${cat.css}, c2 ${cat.c2}, tradeoff ${cat.tradeoff}, basis ${cat.basis}${pass ? " -> PASS if the groups were recoloured (upper bound)" : ""}`, ...why.map((w) => `    ${w}`));
    }
    // The groups behind categories 2-5 of this view, with their gain and loss over the whole test note.
    for (const [sig, g] of groups) {
      const d = decide(g);
      if (d.gain > 0) out.push(`  group ${theme} ${view} [${sig}]${g.bare ? " (bare)" : ""}: theme ${g.theme} -> best ${d.best}, gain ${d.gain}, loss ${d.loss}${d.plain ? "" : ", winning tokens not plain"}; inks ${g.inks.map((i) => `${i.colour} x${i.chars} [${i.tokens.join(", ")}]`).join("; ")}`);
    }
  }
}
console.log(out.join("\n"));
console.log("\n== summary (characters of the differing runs)");
console.log("theme view lang total dom css c2 tradeoff basis passIfRecoloured");
for (const s of summary) console.log(`${s.theme} ${s.view} ${s.lang} ${s.total} ${s.dom} ${s.css} ${s.c2} ${s.tradeoff} ${s.basis} ${s.pass}`);
const tot = (f) => summary.filter(f).reduce((a, s) => { for (const k of ["total", "dom", "css", "c2", "tradeoff", "basis"]) a[k] = (a[k] ?? 0) + s[k]; a.checks = (a.checks ?? 0) + 1; a.pass = (a.pass ?? 0) + (s.pass ? 1 : 0); return a; }, {});
for (const theme of ["solarized-dark", "kanagawa-dragon"]) for (const view of ["source", "live", "reading"]) console.log(`TOTAL ${theme} ${view} ${JSON.stringify(tot((s) => s.theme === theme && s.view === view))}`);
for (const theme of ["solarized-dark", "kanagawa-dragon"]) console.log(`TOTAL ${theme} all ${JSON.stringify(tot((s) => s.theme === theme))}`);

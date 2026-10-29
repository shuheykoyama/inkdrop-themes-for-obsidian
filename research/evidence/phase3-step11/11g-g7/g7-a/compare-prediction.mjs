// Option A check (research/14 §6.137): a runtime run judged against the rendered reference, compared with what
// the G7-2 analysis predicted (g7-2/reclassify.json): per theme, context and view, which fidelity checks are DIFF
// and how many non-space characters differ per block, and (desktop) the class tallies and the failing groups.
// The opaque desktop and phone predictions stand for the other desktop appearances and for tablet /
// phone-nonfloating (the recorded 1.14.5 results were the same within each of the two).
//
// usage: node compare-prediction.mjs <runtime-run.json> <reclassify.json>
import { readFileSync } from "node:fs";

const [runPath, predPath] = process.argv.slice(2);
const run = JSON.parse(readFileSync(runPath, "utf8")).results;
const pred = JSON.parse(readFileSync(predPath, "utf8")).results;
const tallyOf = (detail, part) => Object.fromEntries([...(detail.split(";")[part === "element" ? 0 : 1] ?? "").matchAll(/(EXACT|CONFLICT|MISMATCH|DOMINATED) (\d+)/g)].map((m) => [m[1], Number(m[2])]));
let problems = 0;
const contexts = [...new Set(run.filter((r) => r.requirement === "qd13.fidelity").map((r) => `${r.theme}|${r.platform}|${r.appearance}`))];
for (const ctx of contexts) {
  const [theme, platform, appearance] = ctx.split("|");
  const like = platform === "desktop" ? "desktop" : "phone";
  for (const view of ["source", "live", "reading"]) {
    const p = pred.find((x) => x.theme === theme && x.platform === like && x.view === view);
    const rs = run.filter((r) => r.theme === theme && r.platform === platform && r.appearance === appearance && r.id.startsWith(`syn.${view}.`));
    const diffs = [];
    for (const r of rs.filter((x) => x.id.endsWith(".fidelity"))) {
      const lang = r.id.split(".")[2];
      const got = (r.measured ?? []).reduce((n, m) => n + m.text.replace(/\s/g, "").length, 0);
      const want = p.perBlock[lang]?.newDiff ?? 0;
      if (got !== want || (r.status === "DIFF") !== (want > 0)) diffs.push(`${lang}: ${r.status} ${got} chars, predicted ${want}`);
    }
    const impl = rs.filter((x) => x.id.endsWith(".impl") && !String(x.status).startsWith("PASS"));
    const cls = rs.find((x) => x.id === `syn.${view}.classes`);
    const failing = (cls.measured ?? []).filter((g) => !g.bare && ["MISMATCH", "DOMINATED", "MIXED"].includes(g.class)).map((g) => `${g.class} ${g.sig}`);
    let tallyNote = "";
    if (like === "desktop" && p.tally) {
      // The rebuilt groups join two EXACT groups of one colour in Reading view (§6.135.1): compare all but EXACT.
      const e = tallyOf(cls.detail, "element"), w = p.tally.measured.element;
      const off = ["CONFLICT", "MISMATCH", "DOMINATED"].filter((c) => (e[c] ?? 0) !== w[c]);
      if (off.length) { tallyNote = ` tally differs: ${off.map((c) => `${c} ${e[c]} vs ${w[c]}`).join(", ")}`; }
    }
    const bad = diffs.length || impl.length || tallyNote;
    if (bad) problems++;
    console.log(`${bad ? "DIFFERS" : "as predicted"} ${theme} ${platform}/${appearance} ${view}: fidelity DIFF ${rs.filter((x) => x.id.endsWith(".fidelity") && x.status === "DIFF").length}, classes ${cls.status}${failing.length ? ` (${failing.join("; ")})` : ""}, impl not PASS ${impl.length}${diffs.length ? ` -- ${diffs.join("; ")}` : ""}${tallyNote}`);
  }
}
console.log(problems ? `${problems} theme x context x view differ from the prediction` : "every theme x context x view as predicted");
process.exit(problems ? 1 : 0);

// C2 trial on the test note (research/14 §6.151): compares two runtime results (tests/runtime/run.mjs) of the same
// Obsidian, before and after the trial CSS, check by check.
//   1. every check whose status changed (theme, id, platform, appearance, state), and the check ids per change;
//   2. per theme, view, language: the characters of the differing runs of syn.<view>.<lang>.fidelity before and
//      after, the characters that stopped differing (fixed) and the ones that started (broke); a run is matched by
//      its text, Inkdrop classes and Inkdrop colour (as a multiset), its characters are the non-space ones.
// Only desktop / opaque is counted in 2 (the other platforms and appearances have the same note and CSS rules).
//
// usage: node c2-testnote.mjs <before.json> <after.json>
import { readFileSync } from "node:fs";

const [before, after] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")).results);
const key = (r) => `${r.theme}|${r.id}|${r.platform}|${r.appearance}|${r.state}`;
const b = new Map(before.map((r) => [key(r), r]));
const a = new Map(after.map((r) => [key(r), r]));
if (b.size !== before.length || a.size !== after.length) throw new Error("duplicate check keys");
const missing = [...b.keys()].filter((k) => !a.has(k)).concat([...a.keys()].filter((k) => !b.has(k)));
console.log(`checks: ${b.size} before, ${a.size} after, ${missing.length} in only one of them${missing.length ? `: ${missing.slice(0, 5).join(", ")}` : ""}`);

const changes = {};
for (const [k, r] of a) {
  const was = b.get(k)?.status;
  if (was && was !== r.status) (changes[`${was} -> ${r.status}`] ??= []).push(`${r.theme} ${r.id} [${r.platform}, ${r.appearance}, ${r.state}]`);
}
console.log("\n== status changes");
for (const [c, list] of Object.entries(changes)) {
  console.log(`${c}: ${list.length}`);
  const ids = {};
  for (const l of list) { const id = l.replace(/ \[.*/, ""); ids[id] = (ids[id] ?? 0) + 1; }
  for (const [id, n] of Object.entries(ids)) console.log(`  ${id} x${n}`);
}

const chars = (s) => s.replace(/\s/g, "").length;
const runs = (r) => (r?.status === "DIFF" ? r.measured.map((m) => [`${m.text}|${m.inkdrop}|${m.inkdropColour}`, chars(m.text)]) : []);
console.log("\n== fidelity, desktop / opaque: theme view lang: statusBefore -> statusAfter, differing chars before -> after, fixed, broke");
const total = {};
for (const [k, r] of a) {
  const m = /^syn\.(source|live|reading)\.([^.]+)\.fidelity$/.exec(r.id);
  if (!m || r.platform !== "desktop" || r.appearance !== "opaque") continue;
  const old = b.get(k);
  // Multiset difference of the differing runs.
  const left = new Map();
  for (const [x, n] of runs(old)) left.set(x, [...(left.get(x) ?? []), n]);
  let broke = 0, now = 0, was = runs(old).reduce((s, [, n]) => s + n, 0);
  for (const [x, n] of runs(r)) {
    now += n;
    const l = left.get(x);
    if (l?.length) l.pop(); else broke += n;
  }
  const fixed = [...left.values()].flat().reduce((s, n) => s + n, 0);
  const t = (total[`${r.theme} ${m[1]}`] ??= { was: 0, now: 0, fixed: 0, broke: 0, diffChecks: 0 });
  t.was += was; t.now += now; t.fixed += fixed; t.broke += broke; t.diffChecks += r.status === "DIFF";
  if (was !== now || fixed || broke || old?.status !== r.status) console.log(`${r.theme} ${m[1]} ${m[2]}: ${old?.status} -> ${r.status}, ${was} -> ${now}, fixed ${fixed}, broke ${broke}`);
}
console.log("\n== totals (differing chars before -> after, fixed, broke, DIFF checks after)");
for (const [k, t] of Object.entries(total)) console.log(`${k}: ${t.was} -> ${t.now}, fixed ${t.fixed}, broke ${t.broke}, DIFF checks ${t.diffChecks}`);

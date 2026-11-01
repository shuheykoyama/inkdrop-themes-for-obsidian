// Compares two gate.mjs reports unit by unit: the unit state, its evidence files and the states of its parts.
// usage: node gate-compare.mjs <before.json> <after.json>
import { readFileSync } from "node:fs";

const load = (f) => new Map(JSON.parse(readFileSync(f, "utf8")).units.map((u) => [[u.requirement, u.theme, u.os, u.device, u.appVersion ?? "-"].join("|"), u]));
const [before, after] = process.argv.slice(2).map(load);
// A part is a check in an appearance and view; it has one state per run (the run labels differ between the
// inputs, so the states are compared as a sorted list).
const parts = (u) => {
  const m = new Map();
  for (const p of u?.parts ?? []) {
    const k = `${p.check} ${p.appearance ?? "-"} ${p.view ?? "-"}`;
    m.set(k, [...(m.get(k) ?? "").split(",").filter(Boolean), p.state].sort().join(","));
  }
  return m;
};
const files = (u) => (u?.evidence ?? []).map((e) => e.file).sort().join(" ");

let sameState = 0, newEvidence = 0;
const out = [];
for (const k of [...new Set([...before.keys(), ...after.keys()])].sort()) {
  const a = before.get(k), b = after.get(k);
  if (a?.state !== b?.state) out.push(`STATE ${a?.state ?? "-"} -> ${b?.state ?? "-"}  ${k}`);
  else sameState++;
  if (files(a) !== files(b)) newEvidence++;
  const pa = parts(a), pb = parts(b);
  for (const p of new Set([...pa.keys(), ...pb.keys()])) if (pa.get(p) !== pb.get(p)) out.push(`  part ${pa.get(p) ?? "-"} -> ${pb.get(p) ?? "-"}  ${k}  ${p}`);
}
console.log(out.join("\n"));
console.log(`units: ${before.size} before, ${after.size} after; same state ${sameState}; evidence files changed in ${newEvidence}`);

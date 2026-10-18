// Before / after of the title bar probe: every surface and state that differs between the two builds.
import { readFileSync } from "node:fs";
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, "utf8"));
  const by = (b) => new Map(d.states.filter((s) => s.build === b).map((s) => [`${s.theme}|${s.state}`, s]));
  const B = by("before"), A = by("after");
  const diffs = [];
  for (const [k, a] of A) { const b = B.get(k); for (const s of Object.keys(a.surfaces)) if (JSON.stringify(a.surfaces[s]) !== JSON.stringify(b.surfaces[s])) diffs.push(`${k} ${s}: ${JSON.stringify(b.surfaces[s])} -> ${JSON.stringify(a.surfaces[s])}`); if (a.cls !== b.cls) diffs.push(`${k} classes ${b.cls} -> ${a.cls}`); }
  console.log(`${f.split("/").pop()} (${JSON.stringify(d.environment)}): ${diffs.length} difference(s)`);
  for (const x of diffs) console.log("  " + x);
}

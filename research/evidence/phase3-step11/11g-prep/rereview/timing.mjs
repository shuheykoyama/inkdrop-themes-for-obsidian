// Per drawer step of a dry-run cable tour: the plugin's geometry times (start / end of the hold) and the
// screenshot's (cable driver, the same clock in emulation), and whether the screenshot lies between them.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
for (const dir of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(path.join(dir, readdirSync(dir).find((f) => f.startsWith("tour-"))), "utf8"));
  const shots = JSON.parse(readFileSync(path.join(dir, "shots.json"), "utf8")).shots;
  for (const st of t.steps.filter((x) => x.measured?.drawerGeometry)) {
    const sh = shots.find((x) => x.n === st.n);
    const [a, b, c, d] = [st.measured.drawerGeometryStartAt, sh.before, sh.after, st.measured.drawerGeometryAt].map((x) => Date.parse(x));
    console.log(`${path.basename(path.dirname(dir))} ${st.label}: start ${st.measured.drawerGeometryStartAt}, shot ${sh.before} .. ${sh.after}, end ${st.measured.drawerGeometryAt}; shot inside the hold: ${a <= b && c <= d} (margins ${((b - a) / 1000).toFixed(1)} s / ${((d - c) / 1000).toFixed(1)} s)`);
  }
}

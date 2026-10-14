// Repeats the runner's pattern (showLineNumber off -> saved -> on) and records, for every config-file stat
// Obsidian's reloadConfig makes, the file's mtime against configTs at that moment, and whether the
// in-memory value was then changed back by the re-read.
import { evaluate } from "../../../../../tests/runtime/lib/cdp.mjs";
const port = Number(process.argv[2] ?? 9333), trials = Number(process.argv[3] ?? 40);
console.log(JSON.stringify(await evaluate(port, `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = app.vault, a = v.adapter, stats = [];
  const origStat = a.stat.bind(a);
  a.stat = async (p) => { let st; try { st = await origStat(p); } catch (e) { stats.push({ f: p.split("/").pop(), threw: String(e).slice(0, 80) }); throw e; } if (p === v.getConfigFile("app") || p === v.getConfigFile("appearance")) stats.push({ f: p.split("/").pop(), t: Date.now(), mtime: st.mtime, configTs: v.configTs, newer: st.mtime > v.configTs, mem: v.config.showLineNumber }); return st; };
  let reverted = 0;
  const writes = [];
  const origWrite = v.writeConfigJson.bind(v);
  v.writeConfigJson = async (n, d) => { const r = await origWrite(n, d); if (n === "app") { const st = await origStat(v.getConfigFile("app")); writes.push({ t: Date.now(), mtime: st.mtime, value: d.showLineNumber }); } return r; };
  for (let i = 0; i < ${trials}; i++) {
    v.setConfig("showLineNumber", false);
    await sleep(1300);
    v.setConfig("showLineNumber", true);
    await sleep(2500);
    if (v.getConfig("showLineNumber") !== true) reverted++;
  }
  a.stat = origStat; v.writeConfigJson = origWrite;
  const newer = stats.filter((x) => x.newer);
  return { trials: ${trials}, reverted, statCalls: stats.length, newerThanConfigTs: newer.length, newerWhileMemTrue: newer.filter((x) => x.mem === true).length, examples: newer.slice(0, 3), writeSample: writes.slice(0, 3), mtimeMinusWriteResolved: writes.slice(0, 10).map((w) => +(w.mtime - w.t).toFixed(3)) };
})()`, 600000), null, 1));

// Records a stack trace whenever showLineNumber changes in Obsidian's in-memory config outside our own
// setConfig calls, to find what puts the old value back.
import { evaluate } from "../../../../../tests/runtime/lib/cdp.mjs";
const port = Number(process.argv[2] ?? 9333), trials = Number(process.argv[3] ?? 30);
console.log(JSON.stringify(await evaluate(port, `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const v = app.vault, changes = [];
  let ours = false;
  // Trap the property on whatever object is v.config (and a replacement of v.config itself).
  const trap = (obj) => { let val = obj.showLineNumber; Object.defineProperty(obj, "showLineNumber", { configurable: true, enumerable: true, get: () => val, set: (x) => { if (!ours && x !== val) changes.push({ t: Date.now(), from: val, to: x, stack: new Error().stack.split("\\n").slice(2, 9).map((s) => s.trim().slice(0, 140)) }); val = x; } }); };
  let cfg = v.config; trap(cfg);
  Object.defineProperty(v, "config", { configurable: true, get: () => cfg, set: (x) => { changes.push({ t: Date.now(), replaced: true, to: x.showLineNumber, stack: new Error().stack.split("\\n").slice(2, 9).map((s) => s.trim().slice(0, 140)) }); cfg = x; trap(cfg); } });
  const set = (x) => { ours = true; v.setConfig("showLineNumber", x); ours = false; };
  let reverted = 0;
  for (let i = 0; i < ${trials}; i++) {
    set(false); await sleep(1300);
    set(true); await sleep(2500);
    if (v.getConfig("showLineNumber") !== true) { reverted++; set(true); await sleep(1300); }
  }
  return { trials: ${trials}, reverted, changes: changes.slice(0, 4), nChanges: changes.length };
})()`, 600000), null, 1));

// node lang-measure.mjs <work> <note.md> <outdir>   (run from the repo root; the note must already exist in Inkdrop)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const [work, notePath, outDir] = process.argv.slice(2);
const repo = process.cwd();
const { blocks } = await import(path.join(repo, "tests/visual/g7-rules.mjs"));
const rec = JSON.parse(readFileSync(path.join(work, "private", "g7-note.json"), "utf8"));
const want = blocks(readFileSync(notePath, "utf8"));
const list = await (await fetch("http://127.0.0.1:9334/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("windowSlot=0"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => new Promise((res, rej) => { const n = ++id; pend.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression, timeout = 900000) => { const r = await Promise.race([send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeout))]); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
if (process.env.INK_THEME) { // switch Inkdrop's theme for this measurement (the run's restore step puts the user's config back)
  const sel = await evaluate(`window.__P2B_THEME = ${JSON.stringify(process.env.INK_THEME)};\n${readFileSync(path.join(repo, "research/evidence/phase2-p0/tools/inkdrop-select-theme.js"), "utf8")}`);
  if (!sel.active?.includes(process.env.INK_THEME)) { console.log(`STOPPED: theme ${process.env.INK_THEME} is not active (${sel.active})`); process.exit(1); }
}
const theme = await evaluate(`inkdrop.config.get("core.theme")`);
console.log("measuring with theme", theme);
mkdirSync(outDir, { recursive: true });
const measure = readFileSync(path.join(repo, "tests/visual/g7-measure.js"), "utf8");
for (const view of ["editor", "preview"]) {
  const res = await evaluate(`window.__G7 = ${JSON.stringify({ noteId: rec.id, title: rec.title, bodySha256: rec.bodySha256, theme, view, blocks: want, vars: [] })};\n${measure}`);
  writeFileSync(path.join(outDir, `inkdrop-${view}.json`), JSON.stringify(res));
  const bad = (res.blocks ?? []).filter((b) => b.error).length;
  console.log(`${view}: ${res.error ?? "ok"}; blocks ${res.blocks?.length}; not measured ${bad}; docUnchanged ${res.docUnchanged}`);
  if (res.docUnchanged === false) { console.log("DOCUMENT CHANGED"); process.exit(3); }
}
process.exit(0);

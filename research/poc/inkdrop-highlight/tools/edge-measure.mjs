// node edge-measure.mjs <work> <note.md> <outdir>  -- generic: every editor line and every preview code element of the note
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const [work, notePath, outDir] = process.argv.slice(2);
const rec = JSON.parse(readFileSync(path.join(work, "private", "g7-note.json"), "utf8"));
const list = await (await fetch("http://127.0.0.1:9334/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("windowSlot=0"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => new Promise((res, rej) => { const n = ++id; pend.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
mkdirSync(outDir, { recursive: true });
const expr = (view) => `(async () => {
  const noteId = ${JSON.stringify(rec.id)}, mode = ${JSON.stringify(view)};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  if (inkdrop.store.getState().editingNote?._id !== noteId) { inkdrop.commands.dispatch(document.body, "core:open-note", { noteId }); for (let i = 0; i < 40 && inkdrop.store.getState().editingNote?._id !== noteId; i++) await sleep(250); await sleep(800); }
  const previewShown = () => shown(document.querySelector(".mde-preview"));
  if ((mode === "editor" && previewShown()) || (mode === "preview" && !previewShown())) { inkdrop.commands.dispatch(document.body, "view:toggle-preview"); await sleep(1000); }
  const cls = (n, root) => { const o = []; for (let e = n.parentElement; e && e !== root; e = e.parentElement) for (const c of e.classList) if (c.startsWith("tok-") || c.startsWith("md-")) o.unshift(c); return o.join(" "); };
  const runsOf = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const runs = []; let n; while ((n = w.nextNode())) runs.push([n.textContent, cls(n, root)]); return runs; };
  if (mode === "preview") {
    const pre = document.querySelector(".mde-preview"); const sc = pre.closest(".mde-preview") || pre;
    const out = [];
    const all = [...document.querySelectorAll(".mde-preview pre")];
    for (const p of all) { p.scrollIntoView({ block: "center" }); await sleep(150); const c = p.querySelector("code.mde-preview-code-body") || p.querySelector("code"); out.push({ codeClass: c ? [...c.classList].join(" ") : null, preClass: [...p.classList].join(" "), runs: c ? runsOf(c) : [] }); }
    return { mode, blocks: out };
  }
  const cm = inkdrop.getExports()["@codemirror"].view.EditorView.findFromDOM(document.querySelector(".cm-editor"));
  const doc = cm.state.doc; const lines = [];
  for (let n = 1; n <= doc.lines; n++) {
    const ln = doc.line(n);
    let el = null;
    for (let k = 0; k < 12 && !el; k++) {
      cm.dispatch({ effects: inkdrop.getExports()["@codemirror"].view.EditorView.scrollIntoView(ln.from, { y: "center" }) });
      await sleep(k ? 120 : 30);
      try { const at = cm.domAtPos(ln.from); el = (at.node.nodeType === 1 ? at.node : at.node.parentElement)?.closest(".cm-line"); if (el && !cm.visibleRanges.some((v) => v.from <= ln.from && ln.to <= v.to)) el = null; } catch { el = null; }
    }
    lines.push({ n, text: ln.text, runs: el ? runsOf(el) : null });
  }
  return { mode, lines, docUnchanged: true };
})()`;
for (const view of ["editor", "preview"]) {
  const res = await evaluate(expr(view));
  writeFileSync(path.join(outDir, `edge-${view}.json`), JSON.stringify(res));
  console.log(view, res.lines ? `lines ${res.lines.length}, unmeasured ${res.lines.filter((l) => !l.runs).length}` : `code elements ${res.blocks.length}`);
}
process.exit(0);

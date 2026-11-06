// node run-ob.mjs <mode: source|live|reading> [plugin on|off]
import { readFileSync } from "node:fs";
const mode = process.argv[2];
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("obsidian.md"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; p.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
if (mode === "reading") await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 60000, deviceScaleFactor: 1, mobile: false }); else await send("Emulation.clearDeviceMetricsOverride");
await ev(`(async()=>{
  const l = app.workspace.getLeaf();
  await l.setViewState({type:"markdown", state:{file:"Languages.md", mode: ${JSON.stringify(mode === "reading" ? "preview" : "source")}, source: ${mode === "source"}}});
  app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
  await new Promise(r=>setTimeout(r,4000));
  return 1})()`);
const data = await ev(`(async()=>{
  const mode = ${JSON.stringify(mode)};
  const cls = (n, root) => { const out=[]; for (let e=n.parentElement; e && e!==root; e=e.parentElement) for (const c of e.classList) if (c.startsWith("tok-")||c.startsWith("md-")) out.unshift(c); return out; };
  const runsOf = (root) => { const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const runs=[]; let n; while((n=w.nextNode())) runs.push([n.textContent, cls(n, root).join(" "), getComputedStyle(n.parentElement).color]); return runs; };
  const blocks=[];
  if (mode==="reading") {
    for (const code of document.querySelectorAll(".markdown-reading-view pre > code")) {
      const lang=[...code.classList].find(c=>c.startsWith("language-"))?.slice(9)||"";
      blocks.push({lang, runs: runsOf(code)});
    }
    return blocks;
  }
  // editing views: scroll through the document and keep the runs of every code line by its line number
  const cm=app.workspace.activeEditor.editor.cm, doc=cm.state.doc, sc=cm.scrollDOM;
  const byLine=new Map();
  // which doc lines are inside a fenced block (by the text), to wait until Obsidian's incremental parse has classed them
  const isCode=new Set(); { let op=null; for (let n=1;n<=doc.lines;n++){ const t=doc.line(n).text; const m=/^(\`{3,}|~{3,})/.exec(t); if(!op){ if(m){op=m[1]; isCode.add(n);} continue;} isCode.add(n); if(m && m[1][0]===op[0] && t.trim()===m[1]) op=null; } }
  const visible=()=>{ const o=[]; for (const el of document.querySelectorAll(".cm-content > .cm-line")) { let ln; try { ln=doc.lineAt(cm.posAtDOM(el)).number; } catch { continue; } o.push([ln,el]); } return o; };
  for (let y=0; y<=sc.scrollHeight+600; y+=500) {
    sc.scrollTop=y;
    await new Promise(r=>setTimeout(r,250));
    for (const [ln,el] of visible()) if (isCode.has(ln)) byLine.set(ln, runsOf(el));
  }
  let cur=null; let open=null;
  for (let n=1;n<=doc.lines;n++) {
    const t=doc.line(n).text; const m=/^(\`{3,}|~{3,})\\s*([^\\s\`]*)/.exec(t);
    if (!open) { if (m) { open=m[1]; cur={lang:m[2]||"", lines:[], missing:0}; } continue; }
    if (m && m[1][0]===open[0] && t.trim()===m[1]) { blocks.push(cur); open=null; cur=null; continue; }
    const r=byLine.get(n); if (r) cur.lines.push(r); else { cur.lines.push([[t,"?"]]); cur.missing++; }
  }
  return blocks;})()`);
const gt = JSON.parse(readFileSync("data/" + (process.env.GT_DIR ?? "inkdrop-lang135") + "/inkdrop-" + (mode === "reading" ? "preview" : "editor") + ".json", "utf8")).blocks.filter((x) => !x.error && x.lang !== "julia").map((x) => ({ lang: x.lang, code: x.text, ranges: x.ranges }));
const norm = (c) => c.split(/\s+/).filter(Boolean).sort().join(" ");
let notFound = 0; const taken = new Set(); const diffs = []; let totalBad = 0, total = 0;
for (const g of gt) {
  const b = data.find((d, i) => d.lang === g.lang && !taken.has(i)); if (!b) { console.log(g.lang.padEnd(11), "block not found in DOM"); notFound++; continue; }
  taken.add(data.indexOf(b));
  // per-char classes of Obsidian's DOM
  const mine = []; const text = [];
  const runs = mode === "reading" ? b.runs : b.lines.map((l, i) => (i ? [["\n", ""]] : []).concat(l)).flat(); if (b.missing) { diffs.push([g.lang, "LINES NOT RENDERED", String(b.missing), ""]); }
  for (const [s, c, col] of runs) for (const ch of s) { text.push(ch); mine.push(col ?? ""); }
  let code = g.code; const theirs = new Array(code.length).fill("");
  for (const r of g.ranges) { for (let i = r.from; i < r.to && i < code.length; i++) theirs[i] = r.color; }
  const dom = text.join("").replace(/\n$/, "");
  const same = dom === code || dom === code + "\n";
  let bad = 0, n = 0; const ex = [];
  for (let i = 0; i < code.length; i++) { if (/\s/.test(code[i])) continue; n++; if ((mine[i] ?? "") !== (theirs[i] ?? "")) { bad++; if (ex.length < 2) ex.push(`${JSON.stringify(code.slice(i, i + 8))} mine="${mine[i]}" ink="${theirs[i]}"`); } }
  total += n; totalBad += bad;
  if (bad || !same) { let k = 0; while (k < dom.length && dom[k] === code[k]) k++; diffs.push([g.lang, same ? "" : "TEXT DIFFERS", `${bad}/${n}`, ex.join(" | "), same ? "" : `first text diff at ${k}: dom=${JSON.stringify(dom.slice(k - 5, k + 15))} gt=${JSON.stringify(code.slice(k - 5, k + 15))} lens ${dom.length}/${code.length}`]); }
}
console.log(`blocks compared ${taken.size}, not found ${notFound}, differing ${diffs.length}`); for (const d of diffs) console.log("  ", d.join("  ").slice(0, 300));
console.log(`TOTAL ${totalBad}/${total} differ => ${(100 * (1 - totalBad / total)).toFixed(2)}% match`);
process.exit(0);

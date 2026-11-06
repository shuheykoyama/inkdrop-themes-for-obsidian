// node run-ob-edge.mjs <source|live|reading>
import { readFileSync, writeFileSync } from "node:fs";
const mode = process.argv[2]; const FILE = process.argv[3] || "Edge.md"; const TAG = FILE.replace(/\.md$/, "").toLowerCase();
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("obsidian.md"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; p.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 12000, deviceScaleFactor: 1, mobile: false });
await ev(`(async()=>{ const l = app.workspace.getLeaf(); await l.setViewState({type:"markdown", state:{file:${JSON.stringify(FILE)}, mode: ${JSON.stringify(mode === "reading" ? "preview" : "source")}, source: ${mode === "source"}}}); app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse(); await new Promise(r=>setTimeout(r,3500)); return 1})()`);
const data = await ev(`(async()=>{
  const mode=${JSON.stringify(mode)};
  const cls=(n,root)=>{const o=[];for(let e=n.parentElement;e&&e!==root;e=e.parentElement)for(const c of e.classList)if(c.startsWith("tok-")||c.startsWith("md-"))o.unshift(c);return o.join(" ")};
  const runsOf=(root)=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const r=[];let n;while((n=w.nextNode()))r.push([n.textContent,cls(n,root)]);return r};
  if (mode==="reading") { await new Promise(r=>setTimeout(r,1500)); return {blocks:[...document.querySelectorAll(".markdown-reading-view pre")].map(p=>{const c=p.querySelector("code");return {codeClass:c?[...c.classList].join(" "):null, runs:c?runsOf(c):[]}})}; }
  const cm=app.workspace.activeEditor.editor.cm, doc=cm.state.doc, sc=cm.scrollDOM; const byLine=new Map();
  for (let y=0;y<=sc.scrollHeight+600;y+=400){ sc.scrollTop=y; await new Promise(r=>setTimeout(r,300)); for (const el of document.querySelectorAll(".cm-content > .cm-line")) { let ln; try{ln=doc.lineAt(cm.posAtDOM(el)).number}catch{continue} byLine.set(ln, runsOf(el)); } }
  return {lines:[...byLine].map(([n,runs])=>({n,text:doc.line(n).text,runs}))};
})()`);
writeFileSync(`ob-${TAG}-${mode}.json`, JSON.stringify(data));
console.log(mode, data.lines ? `lines ${data.lines.length}` : `pre elements ${data.blocks.length}`);
process.exit(0);

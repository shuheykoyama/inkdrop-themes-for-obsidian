// Compares the computed style (colour, italic, weight, decoration, ...) of every text run the plugin gives a class chain, in Obsidian
// with the theme, against the same chain styled by Inkdrop's own CSS (its @inkdropapp/css + the Solarized Dark package), rendered in
// an iframe. node style-check.mjs <notes: Languages,Ext,Quirk,Edge> 
import { readFileSync } from "node:fs";
import path from "node:path";
import { docClasses } from "./predict.mjs";
// usage (isolated Obsidian on 9333 with the theme and the plugin, notes Languages.md Ext.md Quirk.md Edge.md in its vault; Inkdrop's app.asar extracted to $INKDROP_ASAR):
//   node tools/style-check.mjs Languages,Ext,Quirk,Edge
const HOME = process.env.HOME;
const BASE = path.join(process.env.INKDROP_ASAR, "node_modules/@inkdropapp/css");
const PKG = `${HOME}/Library/Application Support/inkdrop/packages/solarized-dark/styles`;
const css = ["layers.css", "tokens.css", "syntax.css"].map((f) => readFileSync(path.join(BASE, f), "utf8")).join("\n") + "\n" + ["tokens.css", "syntax.css"].map((f) => readFileSync(path.join(PKG, f), "utf8")).join("\n");
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("obsidian.md"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const p = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; p.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
const PROPS = ["color", "font-style", "font-weight", "text-decoration-line", "text-decoration-style", "text-decoration-color", "text-underline-position", "border-bottom-width", "border-bottom-style", "border-bottom-color", "background-color", "padding-top", "padding-left", "outline-width", "outline-style", "outline-color"];
const notes = (process.argv[2] ?? "Ext,Quirk,Edge").split(",");
await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 60000, deviceScaleFactor: 1, mobile: false });
const collector = (mode, mask) => `(async()=>{
  const PROPS=${JSON.stringify(PROPS)}; const mode=${JSON.stringify(mode)}; const mask=${JSON.stringify(mask)};
  const chainOf=(n,root)=>{const o=[];for(let e=n.parentElement;e&&e!==root;e=e.parentElement){const g=[...e.classList].filter(c=>c.startsWith("tok-")||c.startsWith("md-"));if(g.length)o.unshift(g.join(" "))}return o.join(" > ")};
  const styleOf=(el)=>{const s=getComputedStyle(el);const o={};for(const p of PROPS)o[p]=s.getPropertyValue(p);return o};
  const out=new Map(); const add=(root,cm)=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(!n.textContent.trim())continue;if(cm){let off;try{off=cm.posAtDOM(n,0)}catch{continue}if(mask[off]!=='1')continue}const ch=chainOf(n,root);const k=JSON.stringify([ch,styleOf(n.parentElement)]);out.set(k,(out.get(k)||0)+n.textContent.length)}};
  if(mode==="reading"){ await new Promise(r=>setTimeout(r,2000)); for(const c of document.querySelectorAll(".markdown-reading-view pre > code")) add(c,null); }
  else { const cm=app.workspace.activeEditor.editor.cm, doc=cm.state.doc, sc=cm.scrollDOM;
    for(let y=0;y<=sc.scrollHeight+600;y+=500){sc.scrollTop=y;await new Promise(r=>setTimeout(r,250));for(const el of document.querySelectorAll(".cm-content > .cm-line")){let ln;try{ln=doc.lineAt(cm.posAtDOM(el)).number}catch{continue} add(el,cm)}} }
  return [...out].map(([k,c])=>[JSON.parse(k),c]); })()`;
const seen = new Map(); // chain -> Map(styleJSON -> chars)
for (const note of notes) for (const mode of ["source", "live", "reading"]) {
  await ev(`(async()=>{const l=app.workspace.getLeaf();await l.setViewState({type:"markdown",state:{file:${JSON.stringify(note + ".md")},mode:${JSON.stringify(mode === "reading" ? "preview" : "source")},source:${mode === "source"}}});app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await new Promise(r=>setTimeout(r,3500));return 1})()`);
  const body = readFileSync({ Languages: "data/Languages.md", Ext: "fixtures/ext-body.md", Quirk: "fixtures/quirk-body.md", Edge: "fixtures/edge-body.md" }[note], "utf8"); const mask = docClasses(body).region.map((x) => (x ? "1" : "0")).join("");
  const got = await ev(collector(mode, mask));
  for (const [[chain, style], chars] of got) { if (!seen.has(chain)) seen.set(chain, new Map()); const m = seen.get(chain); const k = JSON.stringify(style); m.set(k, (m.get(k) ?? 0) + chars); const w = (globalThis.__where ??= new Map()); if (!w.has(chain + k)) w.set(chain + k, `${note}/${mode}`); }
  console.log(note, mode, "chains so far", seen.size);
}
// reference: Inkdrop's CSS in an iframe
const chains = [...seen.keys()];
const ref = await ev(`(async()=>{
  const PROPS=${JSON.stringify(PROPS)}; const chains=${JSON.stringify(chains)};
  const f=document.createElement("iframe"); f.style.cssText="position:fixed;left:-9999px;width:800px;height:600px";
  f.srcdoc='<!doctype html><html style="color-scheme:dark"><head><style>'+${JSON.stringify(css)}.replace(/<\\/style/g,"")+'</style></head><body class="dark-mode"><div class="cm-editor" style="color:var(--editor-foreground-color)"><div class="cm-line" id="root"></div></div></body></html>';
  document.body.appendChild(f); await new Promise(r=>f.onload=r); const d=f.contentDocument, root=d.getElementById("root");
  const res={};
  for(const ch of chains){ root.textContent=""; let parent=root; const names=ch?ch.split(" > "):[]; 
    // one span per class: outermost first, as the plugin's spans are each one highlighter range; Inkdrop's rules then see the chain
    let el=document.createElement("span"); 
    for(const n of names){ const s=d.createElement("span"); s.className=n; parent.appendChild(s); parent=s; }
    const t=d.createElement("span"); t.textContent="x"; parent.appendChild(t);
    const s=f.contentWindow.getComputedStyle(parent); const o={}; for(const p of PROPS)o[p]=s.getPropertyValue(p); res[ch]=o; }
  f.remove(); return res; })()`);
let bad = 0, total = 0; const lines = [];
for (const [chain, styles] of seen) for (const [k, chars] of styles) {
  total += chars; const mine = JSON.parse(k), want = ref[chain]; const cmp = chain === "" ? ["color", "font-style", "font-weight", "text-decoration-line"] : PROPS; // bare text: its parent is Obsidian's line or code element, whose box (padding, border) is not text styling
  const diff = cmp.filter((p) => mine[p] !== want[p]);
  if (diff.length) { bad += chars; lines.push(`  [${globalThis.__where.get(chain + k)}] chain "${chain}" (${chars} chars): ${diff.map((p) => `${p}: obsidian=${mine[p]} inkdrop=${want[p]}`).join("; ")}`); }
}
console.log(`distinct class chains ${chains.length}; characters compared ${total}; characters whose style differs ${bad}`);
console.log(lines.slice(0, 25).join("\n"));
process.exit(0);

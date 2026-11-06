// Renders the same Julia text with both Julia parsers under Inkdrop's own CSS (Solarized Dark and Kanagawa Dragon), compares the
// computed style of every character, and takes a screenshot of each theme.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tagHighlighter, highlightTree, tags as t } from "@lezer/highlight";
import { tags as mk } from "../src/tok-table.js";
const HOME = process.env.HOME;
const BASE = path.join(process.env.INKDROP_ASAR, "node_modules/@inkdropapp/css");
const hl = tagHighlighter(mk(t));
const text = JSON.parse(readFileSync("data/inkdrop-lang135/inkdrop-editor.json", "utf8")).blocks.find((b) => b.lang === "julia").text;
import { julia } from "@plutojl/lang-julia";
import { languages } from "@codemirror/language-data";
const first = languages.find((l) => l.name === "Julia"); await first.load();
const parsers = { "1st Julia (language-data, StreamLanguage) = what Inkdrop itself uses": first.support.language.parser, "2nd Julia (Inkdrop's own Lezer entry; @plutojl/lang-julia 1.2.0, the same grammar and rules) = what the plugin now uses": julia().language.parser };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const render = (parser) => { let out = "", pos = 0; highlightTree(parser.parse(text), hl, (a, z, cls) => { out += esc(text.slice(pos, a)) + `<span class="${cls}">${esc(text.slice(a, z))}</span>`; pos = z; }); return out + esc(text.slice(pos)); };
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((x) => x.type === "page" && x.url.includes("obsidian.md"));
const bws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (bws.onopen = r));
let bid = 0; const bp = new Map(); bws.onmessage = (e) => { const m = JSON.parse(e.data); if (bp.has(m.id)) { bp.get(m.id)(m); bp.delete(m.id); } };
const bsend = (method, params = {}) => new Promise((res, rej) => { const n = ++bid; bp.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); bws.send(JSON.stringify({ id: n, method, params })); });
await bsend("Emulation.setDeviceMetricsOverride", { width: 900, height: 1500, deviceScaleFactor: 1, mobile: false });
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const pkg = `${HOME}/Library/Application Support/inkdrop/packages/${theme}/styles`;
  const files = theme === "kanagawa-dragon" ? ["palette.css", "ui.css", "syntax.css"] : ["tokens.css", "ui.css", "syntax.css"];
  const css = ["layers.css", "tokens.css", "ui.css", "syntax.css"].map((f) => readFileSync(path.join(BASE, f), "utf8")).join("\n") + "\n" + files.map((f) => readFileSync(path.join(pkg, f), "utf8")).join("\n");
  const blocks = Object.entries(parsers).map(([name, p]) => `<h3>${name}</h3><div class="cm-editor" style="color:var(--editor-foreground-color)"><pre class="cm-content">${render(p)}</pre></div>`).join("");
  const html = `<!doctype html><html style="color-scheme:dark"><head><meta charset="utf-8"><style>${css}\nbody{margin:0;padding:16px;background:var(--editor-background-color);color:var(--editor-foreground-color);font:13px/1.5 Menlo,monospace}h3{font:600 13px system-ui;margin:12px 0 4px}pre{margin:0;white-space:pre-wrap}</style></head><body class="dark-mode"><div style="font:600 14px system-ui;margin-bottom:6px">${theme} (Inkdrop's own CSS)</div>${blocks}</body></html>`;
  const ev = await bsend("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression: `(async()=>{document.getElementById("jl")?.remove();const f=document.createElement("iframe");f.id="jl";f.style.cssText="position:fixed;left:0;top:0;width:900px;height:1500px;z-index:99999;border:0;background:#000";f.srcdoc=${JSON.stringify(html)};document.body.appendChild(f);await new Promise(r=>f.onload=r);await new Promise(r=>setTimeout(r,500));const d=f.contentDocument;const out=[];for(const pre of d.querySelectorAll("pre")){const w=d.createTreeWalker(pre,NodeFilter.SHOW_TEXT);const chars=[];let n;while((n=w.nextNode())){const s=f.contentWindow.getComputedStyle(n.parentElement);for(const ch of n.textContent)chars.push([ch,s.color,s.fontStyle,s.fontWeight,s.textDecorationLine])}out.push(chars)}return out})()` });
  const [A, B] = ev.result.value; let n = 0, diff = 0; const colours = new Set();
  for (let i = 0; i < A.length; i++) { if (/\s/.test(A[i][0])) continue; n++; if (A[i].slice(1).join("|") !== B[i].slice(1).join("|")) diff++; colours.add(A[i][1]); }
  console.log(`${theme}: characters ${n}, rendered differently by the two parsers ${diff} (${(100 * diff / n).toFixed(1)}%); colours used: 1st ${new Set(A.map((c) => c[1])).size}, 2nd ${new Set(B.map((c) => c[1])).size}`);
  const shot = await bsend("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 900, height: 1500, scale: 1 } });
  writeFileSync(`julia-${theme}.png`, Buffer.from(shot.data, "base64"));
  await bsend("Runtime.evaluate", { expression: `document.getElementById("jl")?.remove()` });
}
process.exit(0);

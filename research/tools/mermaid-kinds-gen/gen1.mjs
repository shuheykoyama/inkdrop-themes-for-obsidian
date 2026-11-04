// Step 1 of the Mermaid generator (research/14 section 6.195; README.md): for every kind, render the sample with the base theme and the theme's themeVariables
// (what Inkdrop's plugin does) and dump the diagram's own stylesheet as rules. usage: node gen1.mjs <themeFolder> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SAMPLES } from "./samples.mjs";
const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const [theme, outFile] = process.argv.slice(2);
const tokens = JSON.parse(readFileSync(path.join(REPO, "tests/spec/mermaid.json"), "utf8")).tokens;
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("index.html"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const p = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
const ev = (expr) => new Promise((res) => { const n = ++id; p.set(n, (m) => res(m.result?.exceptionDetails ? { error: JSON.stringify(m.result.exceptionDetails).slice(0, 300) } : m.result?.result?.value)); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
await ev(`(async () => { app.customCss.setTheme(${JSON.stringify(theme)}); await app.customCss.loadTheme(); app.customCss.setTranslucency(false); await new Promise(r=>setTimeout(r,1200)); return 1 })()`);
await ev(`(async () => { app.saveLocalStorage("mermaid-vault-trust", true); const leaf = app.workspace.getLeaf("tab"); await leaf.setViewState({type:"markdown", state:{file:"Mermaid.md", mode:"preview"}, active:true}); for (let i=0;i<30 && !window.mermaid;i++) { leaf.view.currentMode.applyScroll(8); await new Promise(r=>setTimeout(r,300)); } return !!window.mermaid })()`);
const TV = await ev(`(() => { const probe = document.body.createEl("span"); const tv = Object.fromEntries(Object.entries(${JSON.stringify(tokens)}).map(([k, t]) => { probe.style.color = "var(--ink-mermaid-" + t + ")"; return [k, getComputedStyle(probe).color]; })); probe.remove(); return tv })()`);
const names = [...new Set((readFileSync(path.join(REPO, "src/palette/solarized-dark.css"), "utf8").match(/--ink-mermaid-[a-z0-9-]+/g)) ?? [])];
const INK = await ev(`(() => { const probe = document.body.createEl("span"); const o = Object.fromEntries(${JSON.stringify(names)}.map((n) => { probe.style.color = "var(" + n + ")"; return [n, getComputedStyle(probe).color]; })); probe.remove(); return o })()`);
const out = { theme, themeVariables: TV, ink: INK, kinds: {} };
for (const [k, code] of Object.entries(SAMPLES)) {
  const r = await ev(`(async () => { try {
    const init = "%%{init: " + ${JSON.stringify(JSON.stringify({ theme: "base", themeVariables: TV }))} + "}%%\\n";
    const { svg } = await window.mermaid.render("genref${k}" + Date.now(), init + ${JSON.stringify(code)});
    const d = document.createElement("div"); d.innerHTML = svg; const s = d.querySelector("svg");
    const css = s.querySelector("style").textContent; const sid = s.id;
    const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
    const dump = (rules) => [...rules].map((r) => r.cssRules && !r.style ? { at: r.cssText.split("{")[0].trim(), rules: dump(r.cssRules) } : r.style ? { sel: r.selectorText, decls: [...r.style].map((n) => [n, r.style.getPropertyValue(n), r.style.getPropertyPriority(n)]) } : { other: r.cssText.slice(0, 80) });
    return { role: s.getAttribute("aria-roledescription"), id: sid, rules: dump(sheet.cssRules) } } catch (e) { return { error: String(e.message ?? e).slice(0, 160) } } })()`);
  out.kinds[k] = r; console.log(k, r.error ?? `${r.role} ${r.rules.length} rules`);
}
writeFileSync(outFile, JSON.stringify(out, null, 1)); ws.close(); process.exit(0);

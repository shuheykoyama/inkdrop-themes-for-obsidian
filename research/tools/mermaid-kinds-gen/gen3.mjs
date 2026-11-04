// Step 1b: colours carried by presentation attributes (fill / stroke / stop-color), which Mermaid's stylesheet does not hold: for every
// kind, the element-by-element attributes of the default rendering (what Obsidian draws) and of the reference rendering.
// usage: node gen3.mjs <themeFolder> <out.json>
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
const ev = (expr) => new Promise((res) => { const n = ++id; p.set(n, (m) => res(m.result?.exceptionDetails ? { error: JSON.stringify(m.result.exceptionDetails).slice(0, 400) } : m.result?.result?.value)); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
await ev(`(async () => { app.customCss.setTheme(${JSON.stringify(theme)}); await app.customCss.loadTheme(); app.customCss.setTranslucency(false); await new Promise(r=>setTimeout(r,1000)); return 1 })()`);
const out = { theme, kinds: {} };
for (const [k, code] of Object.entries(SAMPLES)) {
  out.kinds[k] = await ev(`(async () => {
    const probe = document.body.createEl("span");
    const TV = Object.fromEntries(Object.entries(${JSON.stringify(tokens)}).map(([k, t]) => { probe.style.color = "var(--ink-mermaid-" + t + ")"; return [k, getComputedStyle(probe).color]; })); probe.remove();
    const init = "%%{init: " + JSON.stringify({ theme: "base", themeVariables: TV }) + "}%%\\n";
    const a = await window.mermaid.render("g3ref" + Date.now(), init + ${JSON.stringify(code)});
    const b = await window.mermaid.render("g3act" + Date.now(), ${JSON.stringify(code)});
    const mk = (svg) => { const d = document.createElement("div"); d.innerHTML = svg; return d.querySelector("svg"); };
    const rs = mk(a.svg), as = mk(b.svg);
    const read = (s) => [...s.querySelectorAll("*")].filter((e) => !e.closest("style")).map((e) => ({ tag: e.localName, cls: e.getAttribute("class") ?? "", parent: (e.parentElement?.getAttribute("class") ?? "") + "|" + (e.parentElement?.localName ?? ""), grand: e.parentElement?.parentElement?.getAttribute("class") ?? "", attrs: Object.fromEntries(["fill", "stroke", "stop-color"].filter((n) => e.hasAttribute(n)).map((n) => [n, e.getAttribute(n)])), sty: Object.fromEntries(["fill", "stroke", "stop-color"].map((n) => { const m = (e.getAttribute("style") ?? "").match(new RegExp("(?:^|[;\\\\s])(" + n + "\\\\s*:\\\\s*[^;!]+?)\\\\s*(?:;|$)")); return m && e.style.getPropertyPriority(n) !== "important" ? [n, m[1]] : null; }).filter(Boolean)), imp: [...(e.style ?? [])].filter((n) => e.style.getPropertyPriority(n) === "important") }));
    return { role: as.getAttribute("aria-roledescription"), act: read(as), ref: read(rs) } })()`);
  const r = out.kinds[k]; console.log(k, r.error ?? `${r.act.length}/${r.ref.length}`);
}
writeFileSync(outFile, JSON.stringify(out)); ws.close(); process.exit(0);

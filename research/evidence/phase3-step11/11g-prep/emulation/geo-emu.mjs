// Phone emulation (390 x 844) in the isolated Obsidian (9333): for each theme and drawer, run
// tests/device/drawer-geometry.js and take a CDP screenshot; writes <out>/<theme>-<side>.png and geometry.json.
import fs from "node:fs";
import path from "node:path";
const [repo, vault, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
const connect = async () => { const t = (await (await fetch("http://127.0.0.1:9333/json/list")).json()).find((t) => t.type === "page" && /obsidian\.md\/index\.html/.test(t.url)); ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } }; };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const ready = async () => { for (let i = 0; i < 80; i++) { try { await connect(); if (await ev("!!(window.app && app.workspace.layoutReady)")) return; } catch {} await sleep(500); } throw new Error("not ready"); };
await ready();
for (const th of ["solarized-dark", "kanagawa-dragon"]) {
  const dir = path.join(vault, ".obsidian/themes", th); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: th, version: "0.0.0", minAppVersion: "1.14.4", author: "t" }));
  fs.writeFileSync(path.join(dir, "theme.css"), fs.readFileSync(path.join(repo, "dist", th, "theme.css"), "utf8"));
}
await ev("(() => { electronWindow.setSize(390, 844); app.emulateMobile(true); return 1; })()");
await sleep(3000); await ready(); await sleep(1500);
const geo = fs.readFileSync(path.join(repo, "tests/device/drawer-geometry.js"), "utf8");
const result = [];
for (const th of ["solarized-dark", "kanagawa-dragon"]) {
  await ev(`(async () => { await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(th)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 800)); return app.customCss.theme; })()`);
  for (const side of ["left", "right"]) {
    await ev(`(async () => { app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse(); await new Promise((r) => setTimeout(r, 600)); app.workspace.${side}Split.expand(); await new Promise((r) => setTimeout(r, 1500)); return 1; })()`);
    const g = await ev(`window.__DRAWER = { inset: 4 };\n${geo}`);
    const shot = (await send("Page.captureScreenshot", { format: "png" })).data;
    const file = `${th}-${side}.png`;
    fs.writeFileSync(path.join(out, file), Buffer.from(shot, "base64"));
    result.push({ theme: th, side, file, theme_applied: await ev("app.customCss.theme"), geometry: g });
  }
}
await ev("(() => { app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse(); app.emulateMobile(false); return 1; })()").catch(() => {});
fs.writeFileSync(path.join(out, "geometry.json"), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.map((r) => ({ t: r.theme, s: r.side, applied: r.theme_applied, d: r.geometry.drawers.map((d) => ({ side: d.side, header: d.header?.rect, hbg: d.header?.backgroundColor, hbf: d.header?.backdropFilter, headerArea: d.headerArea, bodyArea: d.bodyArea })) })), null, 1));
process.exit(0);

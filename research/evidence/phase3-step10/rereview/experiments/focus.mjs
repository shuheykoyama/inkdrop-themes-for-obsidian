// With the window not focused (document.hasFocus() false), compare each state with and without CDP focus
// emulation held on a persistent session.
import { evaluate, pointer, escape } from "../../../../../tests/runtime/lib/cdp.mjs";
const port = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => evaluate(port, e, 60000);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const send = (method, params = {}) => new Promise((res) => { const n = ++id; ws.addEventListener("message", function h(e) { const m = JSON.parse(e.data); if (m.id === n) { ws.removeEventListener("message", h); res(m); } }); ws.send(JSON.stringify({ id: n, method, params })); });
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const until = (sel, ms) => ev(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { if (document.querySelector(${JSON.stringify(sel)})) return Math.round(performance.now() - t0); await new Promise((r) => setTimeout(r, 100)); } return null; })()`);
await ev(`(async () => { await app.workspace.openLinkText("Sample note", "", false); app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand(); app.vault.setConfig("showLineNumber", true); return 1; })()`);
await sleep(1500);
async function round(label) {
  const r = { label, docFocus: await ev("document.hasFocus()"), winFocused: await ev("electronWindow.isFocused()") };
  const link = await center(".workspace-leaf.mod-active .cm-hmd-internal-link, .workspace-leaf.mod-active .internal-link");
  await pointer(port, { x: link[0], y: link[1], modifiers: 4 }); r.popover = await until(".popover.hover-popover", 3000);
  const spot = await center(".status-bar"); await pointer(port, { x: spot[0], y: spot[1] }); await escape(port); await sleep(1500);
  const b = await center(".workspace-ribbon.mod-primary .side-dock-ribbon-action"); await pointer(port, { x: b[0], y: b[1] }); r.tooltip = await until(".tooltip", 3000);
  await pointer(port, { x: spot[0], y: spot[1] }); await escape(port); await sleep(1000);
  r.fold = await ev(`(async () => { const sleep = (ms) => new Promise((x) => setTimeout(x, ms)); const l = app.workspace.getMostRecentLeaf(); await l.setViewState({ type: "markdown", state: { file: "Editor chrome.md", mode: "source", source: true }, active: true }); app.workspace.setActiveLeaf(l, { focus: true }); await sleep(800); const ed = l.view.editor; ed.focus(); app.commands.executeCommandById("editor:unfold-all"); const line = ed.getValue().split("\\n").findIndex((x) => x.includes("## Folded")); ed.setCursor({ line, ch: 1 }); const before = [document.hasFocus(), ed.hasFocus()]; app.commands.executeCommandById("editor:toggle-fold"); await sleep(600); const n = [l.view.contentEl.querySelectorAll(".cm-foldPlaceholder").length, ...before]; app.commands.executeCommandById("editor:unfold-all"); await l.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true }); await sleep(500); return n; })()`);
  r.settings = await ev(`(async () => { app.setting.open(); await new Promise((x) => setTimeout(x, 700)); const m = app.setting.modalEl; const d = m && m.isConnected ? m.ownerDocument : null; const e = d && d.querySelector(".modal.mod-settings .vertical-tab-nav-item.is-active"); const w = e ? Math.round(e.getBoundingClientRect().width) : -1; app.setting.close(); await new Promise((x) => setTimeout(x, 500)); return w; })()`);
  r.docFocusAfter = await ev("document.hasFocus()");
  return r;
}
const out = [];
for (let i = 0; i < 3; i++) out.push(await round("no emulation " + i));
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
out.push(await round("focus emulation"));
out.push(await round("focus emulation 2"));
await send("Emulation.setFocusEmulationEnabled", { enabled: false });
for (let i = 0; i < 3; i++) out.push(await round("no emulation again " + i));
ws.close();
for (const r of out) console.log(JSON.stringify(r));

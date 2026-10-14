// Timing of the states that failed on Electron 39: how long after the action the element appears, and
// whether it appears at all, over repeated trials (isolated instance, test vault only).
import { evaluate, pointer, escape } from "../../../../../tests/runtime/lib/cdp.mjs";
const port = 9333, n = Number(process.argv[2] ?? 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e, t = 60000) => evaluate(port, e, t);
// Poll in the page every 50 ms for up to `ms`: returns ms until fn() is true, or null.
const until = (fn, ms) => ev(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { if ((${fn})()) return Math.round(performance.now() - t0); await new Promise((r) => setTimeout(r, 50)); } return null; })()`);
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
await ev(`(async () => { await app.workspace.openLinkText("Sample note", "", false); app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand(); return 1; })()`);
await sleep(1500);
const out = { settings: [], fold: [], popover: [], tooltip: [] };
for (let i = 0; i < n; i++) {
  // Settings: open, time until the active nav item has a box.
  await ev("(() => { app.setting.open(); return 1; })()");
  out.settings.push(await until(`() => { const m = app.setting.modalEl; const e = m && m.isConnected && m.ownerDocument.querySelector(".modal.mod-settings .vertical-tab-nav-item.is-active"); return !!e && e.getBoundingClientRect().width > 0; }`, 5000));
  await ev("(() => { app.setting.close(); return 1; })()"); await sleep(400);
}
for (let i = 0; i < n; i++) {
  // Fold: open "Editor chrome" in source mode, cursor on "## Folded", toggle fold, time until the placeholder.
  await ev(`(async () => { const l = app.workspace.getMostRecentLeaf(); await l.setViewState({ type: "markdown", state: { file: "Editor chrome.md", mode: "source", source: true }, active: true }); app.workspace.setActiveLeaf(l, { focus: true }); return 1; })()`);
  await until(`() => !!app.workspace.activeLeaf.view.contentEl.querySelector(".cm-content .cm-line")`, 5000);
  out.fold.push(await ev(`(async () => { const ed = app.workspace.activeLeaf.view.editor; ed.focus(); const line = ed.getValue().split("\\n").findIndex((l) => l.includes("## Folded")); ed.setCursor({ line, ch: 1 }); const ok = app.commands.executeCommandById("editor:toggle-fold"); const t0 = performance.now(); while (performance.now() - t0 < 5000) { if (document.querySelector(".workspace-leaf.mod-active .cm-foldPlaceholder")) return { ok, ms: Math.round(performance.now() - t0) }; await new Promise((r) => setTimeout(r, 50)); } return { ok, ms: null, focused: document.activeElement?.className?.toString().slice(0, 40), sel: ed.getCursor() }; })()`));
  await ev(`(async () => { const l = app.workspace.activeLeaf; await l.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true }); return 1; })()`);
  await sleep(300);
}
for (let i = 0; i < n; i++) {
  const link = await center(".workspace-leaf.mod-active .cm-hmd-internal-link, .workspace-leaf.mod-active .internal-link");
  if (link) await pointer(port, { x: link[0], y: link[1], modifiers: 4 });
  out.popover.push(link ? await until(`() => !!document.querySelector(".popover.hover-popover")`, 5000) : "no link");
  const spot = await center(".status-bar"); await pointer(port, { x: spot[0], y: spot[1] }); await escape(port);
  await until(`() => !document.querySelector(".popover.hover-popover")`, 4000); await sleep(300);
  const b = await center(".workspace-ribbon.mod-primary .side-dock-ribbon-action");
  if (b) await pointer(port, { x: b[0], y: b[1] });
  out.tooltip.push(b ? await until(`() => !!document.querySelector(".tooltip")`, 5000) : "no button");
  await pointer(port, { x: spot[0], y: spot[1] }); await escape(port);
  await until(`() => !document.querySelector(".tooltip")`, 4000); await sleep(300);
}
const summary = (a) => { const v = a.map((x) => (x && typeof x === "object" ? x.ms : x)); const ok = v.filter((x) => typeof x === "number"); return { n: v.length, missing: v.length - ok.length, max: Math.max(...ok), over1500: ok.filter((x) => x > 1500).length, over700: ok.filter((x) => x > 700).length, all: v }; };
console.log(JSON.stringify({ settings: summary(out.settings), fold: summary(out.fold), foldMisses: out.fold.filter((x) => x.ms === null), popover: summary(out.popover), tooltip: summary(out.tooltip) }, null, 1));

// G8 (research/14 §6.185): one app (Inkdrop 6.3.0 on 9334 or the isolated Obsidian on 9333), one theme, a fixed list of
// overlay states. Per state: open it, wait, take the page's own screenshot (Page.captureScreenshot, not the screen),
// record the computed style of the named elements, close it. Read only with respect to the app's data: no note is
// created, changed or deleted (dialogs are closed without submitting).
// usage: node g8-drive.mjs <inkdrop|obsidian> <theme-label> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const [app, label, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PORT = app === "inkdrop" ? 9334 : 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const conns = new Map();
async function target(sub) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === "page" && (sub.startsWith("title:") ? x.title.startsWith(sub.slice(6)) : x.url.includes(sub)));
  if (!t) return null;
  if (conns.get(t.id)) return conns.get(t.id);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
  const c = { send, ws, id: t.id };
  conns.set(t.id, c);
  return c;
}
const ev = async (c, expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const key = async (c, k) => { const code = { Escape: 27, Enter: 13 }[k]; await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: code }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code }); };
const mouse = async (c, x, y, click) => { await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); if (click) { await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); } };
const shot = async (c, file, clip) => { const r = await c.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(path.join(out, file), Buffer.from(r.data, "base64")); };

// Page-side: computed style of the first visible element matching each selector.
const MEASURE = (items) => `(() => {
  const props = ["background-color", "color", "border-top-width", "border-top-style", "border-top-color", "border-radius", "box-shadow", "padding", "font-size", "font-weight", "opacity", "backdrop-filter"];
  const out = {};
  for (const [name, sel] of ${JSON.stringify(items)}) {
    const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none"; });
    if (!el) { out[name] = null; continue; }
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    out[name] = { sel, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], ...Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
  }
  return out;
})()`;

const INKDROP = {
  main: "windowSlot=0",
  states: [
    { id: "palette", open: async (c) => ev(c, `inkdrop.commands.dispatch(document.body, "core:toggle-telescope"), 1`), items: [["container", ".telescope-container"], ["input", ".telescope-input"], ["row-selected", ".telescope-option-view.selected"], ["row", ".telescope-option-view:not(.selected)"], ["overlay", ".modal-container.visible"]], close: async (c) => key(c, "Escape"), clip: "container" },
    { id: "menu", open: async (c) => mouse(c, 618, 92, true), items: [["menu", ".ui.dropdown.active .menu, .ui.dropdown .menu.visible"], ["item", ".ui.dropdown .menu.visible .item, .ui.dropdown.active .menu .item"]], close: async (c) => key(c, "Escape"), clip: "menu" },
    { id: "modal", open: async (c) => ev(c, `inkdrop.commands.dispatch(document.body, "core:new-notebook"), 1`), items: [["modal", ".ui.modal.active"], ["header", ".ui.modal.active .header"], ["input", ".ui.modal.active input"], ["button", ".ui.modal.active .actions .button:not(.primary)"], ["button-primary", ".ui.modal.active .actions .button.primary, .ui.modal.active .actions .primary"]], close: async (c) => key(c, "Escape"), clip: "modal" },
    { id: "notification", open: async (c) => ev(c, `inkdrop.notifications.addInfo("G8 sample notification", { detail: "Detail line for comparison", dismissable: true }), 1`), items: [["notification", ".notification-item-view"], ["bar", ".notification-bar"]], close: async (c) => ev(c, `(() => { try { inkdrop.notifications.clear?.(); } catch (e) {} const b = document.querySelector(".notification-item-view .close, .notification-item-view [class*=close], .notification-item-view button"); b?.click(); return 1; })()`), clip: "notification" },
    { id: "preferences", win: "Type=preferences", openMain: async (c) => ev(c, `inkdrop.commands.dispatch(document.body, "application:open-preferences"), 1`), openWin: async (w) => { await ev(w, `(() => { const it = [...document.querySelectorAll("a,div,span,li")].find((e) => e.textContent.trim() === "General" && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().x < 170); it?.click(); return 1; })()`); }, items: [["window", "body"], ["sidebar-item-active", ".item.active"], ["dropdown", ".ui.selection.dropdown"], ["checkbox", ".ui.checkbox"], ["button", ".ui.button"]], closeWin: async (w) => ev(w, `(() => { window.close(); return 1; })()`), clip: null },
  ],
};

const OBSIDIAN = {
  main: "app://obsidian.md/index.html",
  setup: async (c, themeName) => ev(c, `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await app.customCss.readThemes();
    for (let i = 0; i < 20; i++) { if (app.customCss.theme !== ${JSON.stringify(themeName)}) app.customCss.setTheme(${JSON.stringify(themeName)}); await app.customCss.loadTheme(); await wait(300); if (app.customCss.theme === ${JSON.stringify(themeName)} && app.customCss.styleEl.textContent.length > 0) break; }
    app.customCss.setTranslucency(false);
    app.vault.setConfig("nativeMenus", false);
    await app.workspace.openLinkText("Sample note", "", false);
    electronWindow.setBounds({ x: 400, y: 250, width: 1200, height: 700 });
    await wait(1500);
    return { theme: app.customCss.theme, size: electronWindow.getSize(), version: (window.electron?.process?.versions?.electron ?? null) };
  })()`),
  states: [
    { id: "palette", open: async (c) => ev(c, `app.commands.executeCommandById("command-palette:open"), 1`), items: [["container", ".prompt"], ["input", ".prompt-input"], ["row-selected", ".suggestion-item.is-selected"], ["row", ".suggestion-item:not(.is-selected)"], ["overlay", ".modal-container"]], close: async (c) => key(c, "Escape"), clip: "container" },
    { id: "menu", open: async (c) => { const r = await ev(c, `(() => { const el = [...document.querySelectorAll(".nav-file-title")].find((e) => e.textContent.includes("Sample")); const b = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 40, clientY: b.y + 10, button: 2 })); return 1; })()`); await sleep(700); const m = await ev(c, `(() => { const e = document.querySelector(".menu .menu-item"); const b = e.getBoundingClientRect(); return [b.x + 20, b.y + b.height / 2]; })()`); await mouse(c, m[0], m[1], false); }, items: [["menu", ".menu"], ["item-selected", ".menu-item.selected"], ["item", ".menu-item:not(.selected)"]], close: async (c) => key(c, "Escape"), clip: "menu" },
    { id: "modal", open: async (c) => ev(c, `(() => { app.workspace.openLinkText("Sample note", "", false); return app.commands.executeCommandById("app:delete-file"); })()`), items: [["modal", ".modal"], ["header", ".modal-title"], ["content", ".modal-content"], ["button", ".modal-button-container button:not(.mod-warning):not(.mod-cta)"], ["button-primary", ".modal-button-container button.mod-warning, .modal-button-container button.mod-cta"]], close: async (c) => key(c, "Escape"), clip: "modal" },
    { id: "notification", open: async (c) => ev(c, `(() => { new Notice("G8 sample notification", 0); return 1; })()`), items: [["notification", ".notice"], ["bar", ".notice-container"]], close: async (c) => ev(c, `(() => { document.querySelector(".notice")?.click(); return 1; })()`), clip: "notification" },
    { id: "preferences", win: "title:Settings", openMain: async (c) => ev(c, `(() => { app.setting.open(); app.setting.openTabById("appearance"); return 1; })()`), openWin: async (w) => { await sleep(300); }, items: [["window", ".modal.mod-settings, body"], ["sidebar-item-active", ".vertical-tab-nav-item.is-active"], ["dropdown", ".dropdown"], ["checkbox", ".checkbox-container"], ["button", "button:not(.mod-cta)"]], closeWin: async (w) => ev(w, `(() => { window.close(); return 1; })()`), clip: null },
  ],
};
const conf = app === "inkdrop" ? INKDROP : OBSIDIAN;
const results = { app, label, at: new Date().toISOString(), states: {} };
const main = await target(conf.main);
if (app === "obsidian") { const themeName = process.argv[5]; results.setup = await conf.setup(main, themeName); }
for (const st of conf.states) {
  try {
    let winConn = null;
    if (st.win) { await st.openMain(main); await sleep(2500); winConn = await target(st.win); await st.openWin(winConn); }
    else { await st.open(main); }
    await sleep(1300);
    const tc = st.win ? winConn : main;
    const m = await ev(tc, MEASURE(st.items));
    let clip = null;
    const box = m[st.clip]?.rect;
    if (box) { const pad = 24; clip = { x: Math.max(0, box[0] - pad), y: Math.max(0, box[1] - pad), width: box[2] + pad * 2, height: box[3] + pad * 2 }; }
    await shot(tc, `${app}-${label}-${st.id}.png`);
    if (clip) await shot(tc, `${app}-${label}-${st.id}-crop.png`, clip);
    results.states[st.id] = m;
    if (st.win) await st.closeWin(winConn); else await st.close(main);
    await sleep(900);
  } catch (e) { results.states[st.id] = { error: String(e.message ?? e) }; console.error(st.id, "ERROR", e.message); try { await key(main, "Escape"); } catch {} }
}
writeFileSync(path.join(out, `${app}-${label}.json`), JSON.stringify(results, null, 1));
for (const c of conns.values()) c.ws.close();
console.log("states:", Object.entries(results.states).map(([k, v]) => `${k}:${v.error ? "ERR" : Object.values(v).filter(Boolean).length + "/" + Object.keys(v).length}`).join(" "));

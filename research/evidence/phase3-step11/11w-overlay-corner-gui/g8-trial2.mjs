// Follow-up of g8-trial.mjs (research/14 §6.186): menus opened from other places and near the window edge, with the real pointer.
// usage: node g8-trial2.mjs <label> <theme-name> <out-dir>
import { writeFileSync } from "node:fs";
import path from "node:path";
const [label, themeName, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const t = list.find((x) => x.type === "page" && x.url.includes("index.html"));
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const click = async (x, y, button = "left") => { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1 }); };
const esc = async () => { await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); };
const menuInfo = () => ev(`(() => { const m = document.querySelector(".menu"); if (!m) return null; const r = m.getBoundingClientRect(); const items = [...m.querySelectorAll(".menu-item")]; return { rect: [r.x, r.y, r.width, r.height].map(Math.round), radius: getComputedStyle(m).borderRadius, insideViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, items: items.length }; })()`);
await ev(`(async () => { await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(themeName)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 1200)); app.customCss.setTranslucency(false); app.vault.setConfig("nativeMenus", false); await app.workspace.openLinkText("Sample note", "", false); electronWindow.setBounds({ x: 400, y: 250, width: 1200, height: 700 }); await new Promise((r) => setTimeout(r, 1200)); return app.customCss.theme; })()`);
const R = { label, themeName };
// real right-click in the editor, near the bottom-right corner of the window
await click(1150, 600, "right"); await sleep(700); R.editorEdge = await menuInfo();
const shot = async (file, clip) => { const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(path.join(out, file), Buffer.from(r.data, "base64")); };
if (R.editorEdge) await shot(`${label}-menu-edge.png`, { x: 700, y: 250, width: 500, height: 450 });
await esc(); await sleep(500);
// the "more options" button of the note header, found by position
const more = await ev(`(() => { const b = [...document.querySelectorAll(".view-header .view-action, .view-actions .clickable-icon")].find((e) => /more/i.test(e.getAttribute("aria-label") || "")); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, b.getAttribute("aria-label")]; })()`);
R.moreButton = more;
if (more) { await click(more[0], more[1]); await sleep(700); R.moreMenu = await menuInfo(); if (R.moreMenu) await shot(`${label}-menu-more.png`, { x: 800, y: 20, width: 400, height: 460 }); await esc(); await sleep(400); }
// real right-click on a tab header
const tab = await ev(`(() => { const r = document.querySelector(".workspace-tab-header.is-active")?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; })()`);
if (tab) { await click(tab[0], tab[1], "right"); await sleep(700); R.tabMenu = await menuInfo(); await esc(); await sleep(400); }
R.leftover = await ev(`document.querySelectorAll(".menu, .prompt, .modal").length`);
writeFileSync(path.join(out, `trial2-${label}.json`), JSON.stringify(R, null, 1)); ws.close();
console.log(label, JSON.stringify({ editorEdge: R.editorEdge && { radius: R.editorEdge.radius, inside: R.editorEdge.insideViewport }, more: R.moreMenu && R.moreMenu.radius, tab: R.tabMenu && R.tabMenu.radius, leftover: R.leftover }));

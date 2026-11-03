// G8 (research/14 §6.185): the states of one button in the preferences / settings window of one app and theme:
// normal, hover, pressed (mouse down) and keyboard focus. Computed style only; nothing is clicked (the mouse is released
// away from the button, so no click event fires).
// usage: node g8-buttons.mjs <inkdrop|obsidian> <theme-label> <out-dir>
import { writeFileSync } from "node:fs";
import path from "node:path";
const [app, label, out] = process.argv.slice(2);
const PORT = app === "inkdrop" ? 9334 : 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target(match) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === "page" && match(x));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
  return { send, ws };
}
const ev = async (c, expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const main = await target((x) => (app === "inkdrop" ? x.url.includes("windowSlot=0") : x.url.includes("index.html")));
await ev(main, app === "inkdrop" ? `inkdrop.commands.dispatch(document.body, "application:open-preferences"), 1` : `(() => { app.setting.open(); app.setting.openTabById("appearance"); return 1; })()`);
await sleep(2500);
const win = await target((x) => (app === "inkdrop" ? x.url.includes("windowType=preferences") : x.title.startsWith("Settings")));
if (app === "inkdrop") { await ev(win, `(() => { const it = [...document.querySelectorAll("a,div,span,li")].find((e) => e.textContent.trim() === "General" && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().x < 170); it?.click(); return 1; })()`); await sleep(1200); }
const SEL = app === "inkdrop" ? ".ui.button" : ".setting-item-control button:not(.mod-cta)";
const box = await ev(win, `(() => { const el = [...document.querySelectorAll(${JSON.stringify(SEL)})].find((e) => e.getBoundingClientRect().width > 20); const b = el.getBoundingClientRect(); window.__g8btn = el; return [b.x + b.width / 2, b.y + b.height / 2, (el.textContent || "").trim().slice(0, 30)]; })()`);
const M = `(() => { const el = window.__g8btn, cs = getComputedStyle(el); const p = ["background-color", "color", "border-top-width", "border-top-color", "border-radius", "box-shadow", "outline-style", "outline-color", "outline-width", "transform", "opacity", "padding"]; return Object.fromEntries(p.map((k) => [k, cs.getPropertyValue(k)])); })()`;
const mm = (x, y, type, extra = {}) => win.send("Input.dispatchMouseEvent", { type, x, y, ...extra });
const res = { app, label, button: box[2], states: {} };
await mm(20, 20, "mouseMoved"); await sleep(400);
res.states.normal = await ev(win, M);
await mm(box[0], box[1], "mouseMoved"); await sleep(500);
res.states.hover = await ev(win, M);
await mm(box[0], box[1], "mousePressed", { button: "left", clickCount: 1 }); await sleep(400);
res.states.pressed = await ev(win, M);
await mm(5, 5, "mouseMoved", { buttons: 1 }); await mm(5, 5, "mouseReleased", { button: "left", clickCount: 1 }); await sleep(300);
await ev(win, `(() => { window.__g8btn.focus(); return 1; })()`);
for (const k of ["Tab"]) { await win.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: 9 }); await win.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: 9 }); }
await ev(win, `(() => { window.__g8btn.focus(); return 1; })()`); await sleep(300);
res.states.focus = await ev(win, M);
await mm(20, 20, "mouseMoved");
await ev(win, `(() => { document.activeElement?.blur(); window.close(); return 1; })()`);
writeFileSync(path.join(out, `${app}-${label}-button-states.json`), JSON.stringify(res, null, 1));
win.ws.close(); main.ws.close();
console.log(app, label, "button:", box[2]);

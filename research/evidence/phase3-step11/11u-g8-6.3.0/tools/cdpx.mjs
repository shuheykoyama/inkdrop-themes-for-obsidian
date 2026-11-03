// Small CDP helper for the G8 pass (research/14 §6.185): evaluate in, or screenshot, one page target of an app on <port>
// chosen by a URL substring. No screen capture: Page.captureScreenshot returns the page's own pixels.
// usage: node cdpx.mjs <port> <urlSubstring> eval <file.js|-e "expr"> | shot <out.png> [x,y,w,h] | key <Escape|Enter|...> | move <x> <y> | click <x> <y> | list
import { readFileSync, writeFileSync } from "node:fs";
const [port, sub, cmd, ...rest] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
if (cmd === "list") { for (const t of list) console.log(t.type, t.url.slice(-70), "|", t.title.slice(0, 40)); process.exit(0); }
const page = list.find((t) => t.type === "page" && t.url.includes(sub));
if (!page) { console.error("no page for", sub); process.exit(2); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
try {
  if (cmd === "eval") {
    const src = rest[0] === "-e" ? rest[1] : readFileSync(rest[0], "utf8");
    const r = await send("Runtime.evaluate", { expression: src, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { console.error(JSON.stringify(r.exceptionDetails).slice(0, 400)); process.exit(1); }
    console.log(JSON.stringify(r.result.value, null, 1));
  } else if (cmd === "key") {
    const codes = { Escape: 27, Enter: 13, ArrowDown: 40, ArrowUp: 38, Tab: 9 };
    const k = rest[0];
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: codes[k] });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: codes[k] });
  } else if (cmd === "move") {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: +rest[0], y: +rest[1] });
  } else if (cmd === "click") {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: +rest[0], y: +rest[1] });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: +rest[0], y: +rest[1], button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: +rest[0], y: +rest[1], button: "left", clickCount: 1 });
  } else if (cmd === "shot") {
    const params = { format: "png" };
    if (rest[1]) { const [x, y, width, height] = rest[1].split(",").map(Number); params.clip = { x, y, width, height, scale: 1 }; }
    const r = await send("Page.captureScreenshot", params);
    writeFileSync(rest[0], Buffer.from(r.data, "base64"));
  }
} finally { ws.close(); }

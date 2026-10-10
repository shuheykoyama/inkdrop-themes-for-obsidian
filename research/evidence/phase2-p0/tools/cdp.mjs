// Minimal Chrome DevTools Protocol client for the Phase 2B runtime checks (diagnostic only).
//
// usage:
//   node cdp.mjs <port> eval <file.js>          evaluate a JS file in the Obsidian window, print JSON result
//   node cdp.mjs <port> shot <out.png> [w h]    capture a PNG screenshot of the window
//
// Requires Node 22+ (global WebSocket and fetch). Connects to the first "page" target whose URL
// starts with CDP_URL_PREFIX (default app://obsidian.md, the main Obsidian window), so other
// targets are never touched. For Inkdrop, set CDP_URL_PREFIX to the prefix printed by
// `curl http://127.0.0.1:<port>/json/list` for its main window.
import { readFileSync, writeFileSync } from "node:fs";

const [port, cmd, arg, w, h] = process.argv.slice(2);
const prefix = process.env.CDP_URL_PREFIX || "app://obsidian.md";

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && t.url.startsWith(prefix));
if (!page) {
  console.error("no Obsidian page target:", targets.map((t) => t.url));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
await new Promise((resolve) => (ws.onopen = resolve));

// Send one CDP command and wait for its response.
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

if (cmd === "eval") {
  // Optional fixed layout viewport (e.g. CDP_VIEWPORT=1024x800) so measurements match the screenshots.
  if (process.env.CDP_VIEWPORT) {
    const [vw, vh] = process.env.CDP_VIEWPORT.split("x").map(Number);
    await send("Emulation.setDeviceMetricsOverride", { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
    await new Promise((r) => setTimeout(r, 600));
  }
  const expression = readFileSync(arg, "utf8");
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) {
    console.error(JSON.stringify(res.result.exceptionDetails, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(res.result?.result?.value, null, 2));
} else if (cmd === "shot") {
  // Optionally force a fixed viewport so both captures use the same size.
  if (w && h) {
    await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
  }
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(arg, Buffer.from(res.result.data, "base64"));
  console.log("wrote", arg);
} else if (cmd === "hovershot") {
  // hovershot <out.png> <x> <y> [w h]: move the mouse to (x, y) in CSS px, then capture (hover states).
  const [out, x, y, vw, vh] = process.argv.slice(4);
  if (vw && vh) {
    await send("Emulation.setDeviceMetricsOverride", { width: +vw, height: +vh, deviceScaleFactor: 1, mobile: false });
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: +x, y: +y });
  await new Promise((r) => setTimeout(r, 700));
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(res.result.data, "base64"));
  console.log("wrote", out);
} else {
  console.error("unknown command", cmd);
  process.exit(1);
}
ws.close();

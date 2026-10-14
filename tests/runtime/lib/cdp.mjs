// Minimal Chrome DevTools Protocol client for the isolated Obsidian (127.0.0.1 only).
// Adapted from research/evidence/phase2-p0/tools/cdp.mjs (a CLI) into a module: same target selection
// (the first "page" target whose URL is exactly the main window, so popouts and other targets are never
// driven directly) and the same Runtime.evaluate call. Requires Node 22+.

async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  // The main window's URL is app://obsidian.md/index.html; popout windows (e.g. Settings in 1.14.4) have
  // other paths, so they are never picked by mistake while one is open.
  const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url))
    ?? targets.find((t) => t.type === "page" && t.url.startsWith("app://obsidian.md"));
  if (!page) throw new Error(`no Obsidian page target on port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { send, close: () => ws.close() };
}

// Evaluate `expression` in the main Obsidian window and return its JSON-serialisable result.
// Throws on a connection problem, an exception inside the page, or when the page has not answered within
// `timeoutMs` (a promise in the page that never settles would otherwise stall the whole run).
export async function evaluate(port, expression, timeoutMs = 180000) {
  const s = await connect(port);
  let timer;
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`page did not answer within ${timeoutMs / 1000} s`)), timeoutMs); });
    const res = await Promise.race([s.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }), timeout]);
    if (res?.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(res.exceptionDetails).slice(0, 500)}`);
    return res?.result?.value;
  } finally {
    clearTimeout(timer);
    s.close();
  }
}

// Keep the main window's page focused as far as the page can tell (document.hasFocus(), CodeMirror's
// hasFocus), without taking the macOS focus from whatever app the person at the Mac is using: CDP focus
// emulation, which lasts as long as this session stays open. Returns a function that ends it. Obsidian's
// editor commands act only on a focused editor (editor:toggle-fold toggles Properties instead), and the
// isolated window loses the OS focus whenever another window takes it (research/14 §6.25).
export async function holdFocus(port) {
  const s = await connect(port);
  await s.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  return () => s.close();
}

// Real input in the main window (CDP Input domain): move the mouse to (x, y) CSS px, optionally with
// modifiers (bit field: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift), and click (left or right button) if asked. Used
// for states that need a genuine pointer: :hover, menus opened by a click, link previews opened by
// hovering with the modifier key.
export async function pointer(port, { x, y, click = false, button = "left", modifiers = 0 }) {
  const s = await connect(port);
  try {
    await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, modifiers });
    if (click) {
      await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1, modifiers });
      await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1, modifiers });
    }
  } finally {
    s.close();
  }
}

// Type text into the focused element of the main window (CDP Input.insertText), one character at a time
// so that editor extensions (e.g. Obsidian's link suggestions after "[[") react as to real typing.
export async function typeText(port, text, delayMs = 120) {
  const s = await connect(port);
  try {
    for (const ch of text) {
      await s.send("Input.insertText", { text: ch });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } finally {
    s.close();
  }
}

// Press Escape in the main window (closes menus and prompts; a hover popover closes when the pointer leaves).
export async function escape(port) {
  const s = await connect(port);
  try {
    for (const type of ["keyDown", "keyUp"]) await s.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  } finally {
    s.close();
  }
}

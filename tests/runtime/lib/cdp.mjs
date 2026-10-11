// Minimal Chrome DevTools Protocol client for the isolated Obsidian (127.0.0.1 only).
// Adapted from research/evidence/phase2-p0/tools/cdp.mjs (a CLI) into a module: same target selection
// (the first "page" target whose URL starts with app://obsidian.md, i.e. the main window, so popouts and
// other targets are never driven directly) and the same Runtime.evaluate call. Requires Node 22+.

// Evaluate `expression` in the main Obsidian window and return its JSON-serialisable result.
// Throws on a connection problem or an exception inside the page.
export async function evaluate(port, expression) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("app://obsidian.md"));
  if (!page) throw new Error(`no Obsidian page target on port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  try {
    const res = await new Promise((resolve) => {
      ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id === 1) resolve(msg); };
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    });
    if (res.error) throw new Error(`CDP error: ${JSON.stringify(res.error)}`);
    if (res.result?.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(res.result.exceptionDetails).slice(0, 500)}`);
    return res.result?.result?.value;
  } finally {
    ws.close();
  }
}

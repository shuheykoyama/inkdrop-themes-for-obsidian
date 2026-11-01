// Opens a note of the test vault in Reading view (only when InkdropThemeTest is open).
const [port, note] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const expr = `(() => { if (app.vault.getName() !== "InkdropThemeTest") return "not the test vault"; const f = app.vault.getAbstractFileByPath(${JSON.stringify(note)}); if (!f) return "no such note"; app.workspace.getLeaf(false).openFile(f, { state: { mode: "preview" } }); return "opened"; })()`;
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); console.log(`${note}: ${m.result?.result?.value}`); ws.close(); };
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));

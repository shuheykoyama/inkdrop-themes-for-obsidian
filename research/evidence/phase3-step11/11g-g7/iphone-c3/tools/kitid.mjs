// Read only: the open vault's name, the marker's kit id, the plugin's own check and device-results/.
const port = process.argv[2] ?? "9244";
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
if (!page) throw new Error("no Obsidian page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); pending.get(m.id)?.(m); pending.delete(m.id); };
const raw = (expression) => new Promise((resolve) => { const n = ++id; pending.set(n, (m) => resolve(m.result?.result?.value)); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true } })); });
// Same settle-and-poll as cable.mjs: the bridge ignores awaitPromise.
await raw(`(() => { window.__inkKid = null; (async () => {
  const m = JSON.parse(await app.vault.adapter.read(app.vault.configDir + "/inkdrop-device-kit.json"));
  const p = app.plugins.plugins["ink-device-check"];
  const files = (await app.vault.adapter.exists("device-results")) ? (await app.vault.adapter.list("device-results")).files : [];
  return { vault: app.vault.getName(), markerKitId: m.kitId, pluginLoaded: !!p, pluginCheck: p ? (await p.notTheKitVault()) ?? "ok" : null, pluginVersion: p?.manifest?.version, deviceResults: files };
})().then((v) => { window.__inkKid = { v }; }, (e) => { window.__inkKid = { e: String(e) }; }); return 1; })()`);
for (let k = 0; k < 100; k++) {
  const r = await raw("window.__inkKid");
  if (r) { console.log(JSON.stringify(r, null, 1)); break; }
  await new Promise((s) => setTimeout(s, 150));
}
ws.close();

// Read-only look at the vault open in the iPhone's Obsidian (Web Inspector CDP on 9244): vault name, the
// kit plugin and its methods, whether the kit marker exists, and the names in device-results. Writes nothing.
const list = await (await fetch("http://127.0.0.1:9244/json/list")).json();
const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const raw = (expression) => new Promise((res) => { const n = ++id; pending.set(n, (m) => res(m.result?.result?.value)); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true } })); });
await raw(`(() => { window.__inkLook = null; (async () => { const p = app.plugins.plugins["ink-device-check"]; const proto = p ? Object.getOwnPropertyNames(Object.getPrototypeOf(p)) : null; const markerPath = app.vault.configDir + "/inkdrop-device-kit.json"; const ls = (await app.vault.adapter.exists("device-results")) ? (await app.vault.adapter.list("device-results")).files : null; return { vault: app.vault.getName(), plugin: !!p, methods: proto, marker: await app.vault.adapter.exists(markerPath), deviceResults: ls, ua: navigator.userAgent.match(/obsidian\\/[\\d.]+/g), viewport: [innerWidth, innerHeight, devicePixelRatio] }; })().then((v) => { window.__inkLook = { v }; }, (e) => { window.__inkLook = { e: String(e) }; }); return 1; })()`);
for (let i = 0; i < 50; i++) { const r = await raw("window.__inkLook"); if (r) { console.log(JSON.stringify(r, null, 1)); break; } await new Promise((r) => setTimeout(r, 200)); }
await raw("(() => { delete window.__inkLook; return 1; })()");
ws.close();

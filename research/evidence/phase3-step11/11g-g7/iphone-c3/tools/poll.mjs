// Polls the page like cable.mjs tour does (the notice query every 300 ms) for <seconds>; prints the answer times.
const [port, seconds] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); pending.get(m.id)?.(); pending.delete(m.id); };
const ask = () => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: `[...document.querySelectorAll(".notice")].map((n) => n.textContent).find((t) => /^\\d+\\/\\d+ /.test(t)) ?? null`, returnByValue: true } })); });
const times = []; const end = Date.now() + Number(seconds) * 1000;
while (Date.now() < end) { const t = Date.now(); await ask(); times.push(Date.now() - t); await new Promise((r) => setTimeout(r, 300)); }
times.sort((a, b) => a - b);
console.log(`poll: n=${times.length} median=${times[times.length >> 1]} ms max=${times.at(-1)} ms`);
ws.close();

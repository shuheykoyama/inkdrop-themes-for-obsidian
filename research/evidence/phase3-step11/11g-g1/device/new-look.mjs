// Read-only copy of the old (pre-RV6, no kit marker) test vault's device-results on the iPhone (G1, option (a)):
// the vault must be InkdropThemeTest with the old kit plugin and exactly the three recorded files; each file is
// read through the Web Inspector (app.vault.adapter.read, nothing written on the device) into <out>.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const out = process.argv[2];
const EXPECTED = ["device-results/results-2026-10-13T08-07-36-497Z.json", "device-results/results-2026-10-13T09-11-01-399Z.json", "device-results/tour-2026-10-13T09-21-51-767Z.json"];
const list = await (await fetch("http://127.0.0.1:9244/json/list")).json();
const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const raw = (expression) => new Promise((res) => { const n = ++id; pending.set(n, (m) => res(m.result?.result?.value)); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true } })); });
// The page settles the value into window.__inkOld and we poll it (the bridge ignores awaitPromise).
const ask = async (expr) => {
  await raw(`(() => { window.__inkOld = null; Promise.resolve().then(() => (${expr})).then((v) => { window.__inkOld = { v: JSON.stringify(v ?? null) }; }, (e) => { window.__inkOld = { e: String(e) }; }); return 1; })()`);
  for (let i = 0; i < 600; i++) { const r = await raw("window.__inkOld"); if (r) { await raw("(() => { delete window.__inkOld; return 1; })()"); if (r.e) throw new Error(r.e); return JSON.parse(r.v); } await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("no answer");
};
const look = await ask(`(async () => { const p = app.plugins.plugins["ink-device-check"]; const m = JSON.parse(await app.vault.adapter.read(app.vault.configDir + "/inkdrop-device-kit.json")); return { vault: app.vault.getName(), markerKitId: m.kitId, why: p ? await p.notTheKitVault() : "no plugin", enabled: app.plugins.enabledPlugins.has("ink-device-check"), classes: [...document.body.classList].filter((c) => /^is-(phone|tablet|mobile|ios)$/.test(c)), results: (await app.vault.adapter.exists("device-results")) ? (await app.vault.adapter.list("device-results")).files : [] }; })()`);
console.log(JSON.stringify(look)); ws.close(); process.exit(0);
const sameFiles = JSON.stringify([...look.files].sort()) === JSON.stringify([...EXPECTED].sort());
console.log(JSON.stringify({ ...look, sameFiles }));
if (look.vault !== "InkdropThemeTest" || !look.oldPlugin || look.marker || !sameFiles) { ws.close(); console.error("not the recorded old test vault; nothing copied"); process.exit(1); }
mkdirSync(out, { recursive: true });
for (const f of EXPECTED) {
  const text = await ask(`app.vault.adapter.read(${JSON.stringify(f)})`);
  writeFileSync(path.join(out, path.basename(f)), text);
  console.log(`${f}: ${text.length} chars`);
}
ws.close();

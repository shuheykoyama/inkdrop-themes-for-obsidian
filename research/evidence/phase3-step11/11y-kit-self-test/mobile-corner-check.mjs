// Mobile-emulation check of the 3 corner rules: final CSS (without the rules) vs trial CSS (with them), research/14 §6.189.
import { writeFileSync } from "node:fs";
const out = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// emulateMobile reloads the page, so every step reconnects
let ws, id = 0, pending = new Map();
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
      const t = list.find((x) => x.type === "page" && x.url.includes("index.html"));
      if (!t) throw new Error("no page");
      ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
      await ev("!!(window.app && app.workspace && app.workspace.layoutReady)").then((ok) => { if (!ok) throw new Error("not ready"); });
      return;
    } catch { await sleep(1000); }
  }
  throw new Error("cannot connect");
}
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const reloadWith = async (call) => { try { await Promise.race([ev(call), sleep(3000)]); } catch {} try { ws.close(); } catch {} await sleep(4000); await connect(); await sleep(2500); };
const R = {};
const probe = `(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const cls = [...document.body.classList].filter((c) => /mobile|phone|tablet/.test(c));
  const cs = (el, p) => getComputedStyle(el)[p];
  app.commands.executeCommandById("command-palette:open"); await w(900);
  const p = document.querySelector(".prompt"); const row = p?.querySelector(".suggestion-item");
  const prompt = p ? { radius: cs(p, "borderRadius"), row: row ? cs(row, "borderRadius") : null } : null;
  p?.querySelector("input")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true })); await w(500);
  document.querySelectorAll(".prompt").forEach((e) => e.remove());
  // elements carrying the rules' classes, in the real body (so the :not(.is-mobile) context is the real one)
  const mk = (c) => { const e = document.createElement("div"); e.className = c; document.body.appendChild(e); return e; };
  const menu = mk("menu"), pr = mk("prompt"); const it = document.createElement("div"); it.className = "suggestion-item"; pr.appendChild(it);
  const probe = { menu: cs(menu, "borderRadius"), prompt: cs(pr, "borderRadius"), promptRow: cs(it, "borderRadius") };
  menu.remove(); pr.remove();
  return { cls, prompt, probe, theme: app.customCss.theme };
})()`;
await connect();
for (const [theme, label] of [["DEV solarized-dark (unnamed) [final]", "sd-final"], ["DEV solarized-dark (unnamed) [trial]", "sd-trial"], ["DEV kanagawa-dragon (unnamed) [final]", "kd-final"], ["DEV kanagawa-dragon (unnamed) [trial]", "kd-trial"]]) {
  await ev(`(async () => { await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(theme)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 1200)); app.customCss.setTranslucency(false); app.vault.setConfig("nativeMenus", false); return 1; })()`);
  R[label] = { desktop: await ev(probe) };
  await reloadWith("app.emulateMobile(true)");
  R[label].mobile = await ev(probe);
  await reloadWith("app.emulateMobile(false)");
}
R.desktopAfter = await ev(`[...document.body.classList].filter((c) => /mobile|phone|tablet/.test(c))`);
writeFileSync(out, JSON.stringify(R, null, 1)); ws.close(); console.log(JSON.stringify(R));

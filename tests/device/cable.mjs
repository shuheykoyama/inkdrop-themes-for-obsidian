// Drives the device kit (tests/device/build-kit.mjs) on an iPhone connected to the Mac by cable (step 10,
// research/14 §6.23), so the only manual steps are importing the kit and the two keyboard taps of the tour.
// Optional: the kit also works without a cable (commands from the palette, files back by AirDrop).
//
// Needs pymobiledevice3 (Python, outside the repo: `uv tool install pymobiledevice3`; remove with
// `uv tool uninstall pymobiledevice3`), Web Inspector on in the iPhone's Safari settings, and two bridges
// started in other shells:
//   pymobiledevice3 remote start-tunnel --native --script-mode   # prints "<host> <port>" (Apple's tunnel, no root)
//   pymobiledevice3 webinspector cdp --port <cdpPort>            # Web Inspector as a CDP endpoint
// Every command except `shot` first checks that the vault open in Obsidian is InkdropThemeTest and stops
// otherwise, so a user vault is never driven.
//
// usage: node tests/device/cable.mjs <cdpPort> <command> [args]
//   probe                          vault, theme, iOS (frozen UA value), viewport, kit commands (read only)
//   reload                         reload Obsidian (needed after replacing the kit: the old plugin stays in memory)
//   checks <outDir>                run "Run checks" and copy the new results file to <outDir>
//   tour <host> <port> <outDir>    run "Screenshot tour" and take a screenshot inside every step's hold
//   pull <outDir>                  copy device-results/*.json out of the test vault (read only)
//   shot <host> <port> <out.png>   one screenshot
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [port, cmd, ...rest] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VAULT = "InkdropThemeTest";

// One WebSocket session to the Obsidian page (Safari's own tabs are http(s) pages and are never picked).
async function session() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.webSocketDebuggerUrl && /^(capacitor|app):\/\//.test(t.url ?? ""));
  if (!page) throw new Error(`no Obsidian page (is Obsidian in the foreground?): ${JSON.stringify(list.map((t) => [t.type, t.title, t.url]))}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const raw = (expression, timeoutMs) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error(`no answer within ${timeoutMs} ms`)); }, timeoutMs);
    pending.set(n, (m) => {
      clearTimeout(timer);
      // WebKit's protocol reports page exceptions with wasThrown (Chrome's with exceptionDetails).
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else if (m.result?.wasThrown || m.result?.exceptionDetails) reject(new Error(`page exception: ${JSON.stringify(m.result).slice(0, 400)}`));
      else resolve(m.result?.result?.value);
    });
    ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  });
  // The bridge ignores awaitPromise: the page settles each value into window.__inkCable[k] and we poll it.
  let slot = 0;
  const evaluate = async (expression, timeoutMs = 60000) => {
    const k = ++slot;
    await raw(`(() => { const d = (window.__inkCable ??= {}); d[${k}] = null; Promise.resolve().then(() => (${expression})).then((v) => { d[${k}] = { v: JSON.stringify(v ?? null) }; }, (e) => { d[${k}] = { e: String(e && e.stack || e) }; }); return 1; })()`, 10000);
    const end = Date.now() + timeoutMs;
    for (;;) {
      const r = await raw(`(() => { const r = window.__inkCable[${k}]; if (r) delete window.__inkCable[${k}]; return r; })()`, 10000);
      if (r) { if (r.e) throw new Error(`page exception: ${r.e.slice(0, 400)}`); return JSON.parse(r.v); }
      if (Date.now() > end) throw new Error(`no answer within ${timeoutMs} ms`);
      await sleep(150);
    }
  };
  const name = await evaluate("app.vault.getName()");
  if (name !== VAULT) { ws.close(); throw new Error(`the open vault is not ${VAULT}; stopping`); }
  return { evaluate, close: () => ws.close() };
}

const LIST = `(async () => (await app.vault.adapter.exists("device-results")) ? (await app.vault.adapter.list("device-results")).files : [])()`;

// Copies the named files of device-results/ to outDir.
async function copyOut(s, files, outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const text = await s.evaluate(`app.vault.adapter.read(${JSON.stringify(f)})`, 120000);
    writeFileSync(path.join(outDir, path.basename(f)), text);
    console.log(`${f} -> ${outDir} (${text.length} chars)`);
  }
}

function shot(host, rsdPort, out) {
  const before = new Date().toISOString();
  const r = spawnSync("pymobiledevice3", ["developer", "dvt", "screenshot", "--rsd", host, rsdPort, out], { encoding: "utf8", timeout: 60000 });
  const after = new Date().toISOString();
  if (r.status !== 0) throw new Error(`screenshot failed: ${(r.stderr || r.stdout).slice(-400)}`);
  return { file: path.basename(out), before, after };
}

if (cmd === "probe") {
  const s = await session();
  console.log(await s.evaluate(`({ vault: app.vault.getName(), theme: app.customCss.theme, ua: navigator.userAgent.match(/(iPhone|CPU) OS [\\d_]+|obsidian\\/[\\d.]+/g), viewport: [innerWidth, innerHeight, devicePixelRatio], uptime: Math.round(performance.now() / 1000), commands: Object.keys(app.commands.commands).filter((k) => k.startsWith("ink-device-check")) })`));
  s.close();
} else if (cmd === "reload") {
  const s = await session();
  await s.evaluate("(() => { setTimeout(() => location.reload(), 300); return 1; })()");
  s.close();
  // Wait for the reloaded page and the kit's plugin.
  for (let k = 0; k < 60; k++) {
    await sleep(1000);
    try {
      const t = await session();
      const ok = await t.evaluate(`app.workspace.layoutReady && !!app.commands.commands["ink-device-check:run-checks"]`);
      t.close();
      if (ok) { console.log("reloaded"); process.exit(0); }
    } catch {}
  }
  throw new Error("Obsidian did not come back with the kit's plugin");
} else if (cmd === "checks") {
  const [outDir] = rest;
  const s = await session();
  const before = await s.evaluate(LIST);
  await s.evaluate(`(() => { app.commands.executeCommandById("ink-device-check:run-checks"); return 1; })()`);
  // About 6 minutes on an iPhone 12 Pro.
  let added = [];
  for (let k = 0; k < 360 && !added.length; k++) {
    await sleep(5000);
    added = (await s.evaluate(LIST).catch(() => [])).filter((f) => !before.includes(f) && f.includes("results-"));
  }
  if (!added.length) throw new Error("no new results file within 30 minutes");
  await copyOut(s, added, outDir);
  s.close();
} else if (cmd === "tour") {
  const [host, rsdPort, outDir] = rest;
  mkdirSync(outDir, { recursive: true });
  const s = await session();
  const before = await s.evaluate(LIST);
  await s.evaluate(`(() => { app.commands.executeCommandById("ink-device-check:screenshot-tour"); return 1; })()`);
  const shots = [];
  let seen = 0;
  let total = Infinity;
  // Each step: a Notice "n/total label" appears, the plugin waits 3.5 s, then holds the view for the step's
  // `wait` (9 s, or 20 s on the keyboard steps), measures it and moves on. Shoot inside that hold.
  for (let tries = 0; tries < 4000 && seen < total; tries++) {
    const notice = await s.evaluate(`[...document.querySelectorAll(".notice")].map((n) => n.textContent).find((t) => /^\\d+\\/\\d+ /.test(t)) ?? null`).catch(() => null);
    const m = notice && notice.match(/^(\d+)\/(\d+) (.*)$/);
    if (!m || Number(m[1]) <= seen) { await sleep(300); continue; }
    seen = Number(m[1]);
    total = Number(m[2]);
    const label = m[3];
    const t0 = Date.now();
    if (/keyboard/.test(label)) {
      // A person has to tap a line (iOS shows the keyboard only for a tap). Shoot about 4 s before the 20 s hold ends (a screenshot takes about 2.5 s).
      console.log(`${seen}/${total} ${label}  -> tap a line of text on the iPhone now`);
      await sleep(3500 + 16000);
    } else {
      await sleep(3500 + 3000);
    }
    const name = `${String(seen).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}.png`;
    try {
      shots.push({ n: seen, label, ...shot(host, rsdPort, path.join(outDir, name)) });
      console.log(`${seen}/${total} shot ${name} (${Date.now() - t0} ms after the notice)`);
    } catch (e) { shots.push({ n: seen, label, error: String(e) }); console.log(`${seen}/${total} FAILED ${e}`); }
  }
  // The tour log is written after the last step; the judge compares each shot with its step's hold.
  let tourFile = null;
  for (let k = 0; k < 120 && !tourFile; k++) {
    tourFile = (await s.evaluate(LIST).catch(() => [])).find((f) => !before.includes(f) && f.includes("tour-")) ?? null;
    if (!tourFile) await sleep(1000);
  }
  if (tourFile) await copyOut(s, [tourFile], outDir);
  writeFileSync(path.join(outDir, "shots.json"), `${JSON.stringify({ tourFile, shots }, null, 1)}\n`);
  console.log(`tour log: ${tourFile}; ${shots.filter((x) => !x.error).length}/${total} screenshots`);
  s.close();
} else if (cmd === "pull") {
  const s = await session();
  await copyOut(s, (await s.evaluate(LIST)).filter((f) => f.endsWith(".json")), rest[0]);
  s.close();
} else if (cmd === "shot") {
  console.log(shot(rest[0], rest[1], rest[2]));
} else {
  console.error("usage: node tests/device/cable.mjs <cdpPort> probe|reload|checks|tour|pull|shot ...");
  process.exit(2);
}

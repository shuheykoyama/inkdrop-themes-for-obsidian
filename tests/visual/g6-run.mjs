// Step 11G G6 (research/14 §6.95): drive the isolated Inkdrop on 127.0.0.1:9334 (started by
// tests/runtime/inkdrop-isolated.sh) for V-35. One subcommand per step, so every step that needs the user's
// approval can be run on its own:
//   isolation <work> <out.json>    stage A1: is the instance on 9334 the isolated one (g6-rules.mjs)? exit 0 / 4
//   notes <out.json>               stage A1: read-only inventory of the notes (g6-notes.js)
//   settings <acrylic:true|false>  stage A2: theme-independent settings of the isolated instance (line numbers,
//                                  active line, acrylic; acrylic takes effect after a restart)
//   capture <out> <tmp> <noteId> <plainLine> <codeLine> <word> <opaque|acrylic>
//                                  stage A2: both themes x the states of that mode, native captures + probes
// Never addresses an app by name (no AppleScript): with two Inkdrop instances that would reach the user's.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isolationProblems } from "./g6-rules.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const PORT = 9334;
const p2b = path.join(repo, "research/evidence/phase2-p0/tools");
const here = (f) => readFileSync(path.join(repo, "tests/visual", f), "utf8");

// Evaluate in the isolated Inkdrop's main window (the page loaded from the app bundle).
async function evaluate(expression, timeoutMs = 60000) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("file://") && t.url.includes("Inkdrop.app"));
  if (!page) throw new Error(`no Inkdrop page target on port ${PORT}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  try {
    const res = await Promise.race([
      new Promise((resolve) => { ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id === 1) resolve(m.result); }; ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })); }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("page did not answer")), timeoutMs)),
    ]);
    if (res?.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(res.exceptionDetails).slice(0, 400)}`);
    return res?.result?.value;
  } finally { ws.close(); }
}
const run = (cmd, a) => spawnSync(cmd, a, { cwd: repo, encoding: "utf8" });
const others = () => run("pgrep", ["-x", "Inkdrop"]).stdout.trim().split("\n").filter(Boolean).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [sub, ...a] = process.argv.slice(2);
if (sub === "isolation") {
  const [work, out] = a;
  const started = Number(readFileSync(path.join(work, "inkdrop.pid"), "utf8"));
  const report = await evaluate(here("g6-isolation.js")).catch(() => null);
  const listener = Number(run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"]).stdout.trim().split("\n")[0]) || null;
  const before = readFileSync(path.join(work, "others-before.txt"), "utf8").trim().split("\n").filter(Boolean).sort();
  const now = others().filter((p) => Number(p) !== started);
  const data = readFileSync(path.join(work, "data-path.txt"), "utf8").trim();
  const prod = process.env.G6_PROD_DIR || path.join(process.env.HOME, "Library/Application Support/inkdrop");
  const problems = isolationProblems({ report, data, prod, listener, started, othersBefore: before, othersNow: now });
  writeFileSync(out, `${JSON.stringify({ checkedAt: new Date().toISOString(), report, listener, started, problems }, null, 1)}\n`);
  console.log(problems.length ? `NOT ISOLATED: ${problems.join("; ")}` : "isolated: data, config, packages and db in the isolated directory; 9334 is the started instance; the user's Inkdrop unchanged");
  process.exit(problems.length ? 4 : 0);
} else if (sub === "notes") {
  const res = await evaluate(here("g6-notes.js"));
  writeFileSync(a[0], `${JSON.stringify(res, null, 1)}\n`);
  for (const n of res.notes) console.log(n.title, "| plain", n.plainLines.length ? n.plainLines[0] : "-", "| code", n.codeLines.length ? n.codeLines[0] : "-");
  console.log(`${res.count} notes; update_seq ${res.updateSeq}`);
} else if (sub === "settings") {
  const acrylic = a[0] === "true";
  console.log(JSON.stringify(await evaluate(`(() => { inkdrop.config.set("editor.lineNumbers", true); inkdrop.config.set("editor.styleActiveLine", true); inkdrop.config.set("core.mainWindow.acrylicEnabled", ${acrylic}); return { lineNumbers: inkdrop.config.get("editor.lineNumbers"), styleActiveLine: inkdrop.config.get("editor.styleActiveLine"), acrylic: inkdrop.config.get("core.mainWindow.acrylicEnabled") }; })()`)));
} else if (sub === "capture") {
  const [out, tmp, noteId, plainLine, codeLine, word, mode] = a;
  const states = mode === "acrylic" ? [["active", Number(plainLine)]] : [["active", Number(plainLine)], ["search", Number(plainLine)], ["code", Number(codeLine)]];
  mkdirSync(path.join(out, "screenshots"), { recursive: true });
  mkdirSync(path.join(out, "measurements"), { recursive: true });
  mkdirSync(path.join(tmp, "bin"), { recursive: true });
  const backdrop = path.join(tmp, "bin", "backdrop");
  if (!existsSync(backdrop)) run("swiftc", ["-O", path.join(p2b, "backdrop.swift"), "-o", backdrop]);
  for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
    const sel = await evaluate(`window.__P2B_THEME = ${JSON.stringify(theme)};\n${readFileSync(path.join(p2b, "inkdrop-select-theme.js"), "utf8")}`);
    if (!sel.active?.includes(theme)) { console.log(`STOPPED: theme ${theme} is not active (${sel.active})`); process.exit(1); }
    await evaluate(readFileSync(path.join(p2b, "inkdrop-window-geometry.js"), "utf8"));
    for (const [state, line] of states) {
      const name = `inkdrop-${theme}-v35-${mode}-${state}`;
      const st = await evaluate(`window.__G6 = ${JSON.stringify({ noteId, state, line, word })};\n${here("g6-state.js")}`);
      // The gray backdrop window behind the Inkdrop window (V-32 geometry), closed right after the shot.
      const bproc = spawn(backdrop, ["gray", "300", "150", "1400", "900"], { stdio: "ignore" });
      await sleep(1000);
      // Front and focus through the instance's own Electron APIs (never by app name).
      const focus = await evaluate(`(async () => { const r = require("@electron/remote"); r.app.focus({ steal: true }); const w = r.getCurrentWindow(); w.moveTop(); w.focus(); await new Promise((x) => setTimeout(x, 800)); return { focused: w.isFocused() }; })()`);
      const before = await evaluate(here("g6-probe.js"));
      const shot = path.join(out, "screenshots", `${name}.png`);
      run("/usr/sbin/screencapture", ["-x", "-R400,250,1200,700", shot]);
      const at = new Date().toISOString();
      const after = await evaluate(here("g6-probe.js"));
      bproc.kill();
      const img = readFileSync(shot);
      const rec = { name, theme, mode, state, line, capturedAt: at, image: path.relative(out, shot), imageSha256: createHash("sha256").update(img).digest("hex"),
        pixels: [img.readUInt32BE(16), img.readUInt32BE(20)], windowRectPoints: [400, 250, 1200, 700], backdrop: "gray", stateResult: st, focus, probeBefore: before, probeAfter: after };
      writeFileSync(path.join(out, "measurements", `${name}.json`), `${JSON.stringify(rec, null, 1)}\n`);
      console.log(`${name}: focused ${after.window.focused}, dpr ${after.window.devicePixelRatio}, doc unchanged ${st.docUnchanged}`);
    }
  }
} else {
  console.error("usage: node tests/visual/g6-run.mjs isolation|notes|settings|capture ..."); process.exit(2);
}

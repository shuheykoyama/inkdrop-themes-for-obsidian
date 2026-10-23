// Step 11G G6 (research/14 §6.95): drive the isolated Inkdrop on 127.0.0.1:9334 (started by
// tests/runtime/inkdrop-isolated.sh) for V-35. One subcommand per step, so every step that needs the user's
// approval can be run on its own:
//   isolation <work> <name.json>   stage A1: is the instance on 9334 the isolated one (g6-rules.mjs)?
//   notes <work> <name.json>       stage A1: read-only inventory of the notes (g6-notes.js); only counts and
//                                  yes/no answers are printed
//   note <work> <noteId> <name.json>  method C: the identity of the one note used (ID, revision, updatedAt, body
//                                  hash) into <work>/private, to compare before and after; prints nothing of it
// In method C (<work>/mode.txt is "production", written by tests/runtime/inkdrop-production.sh) the check is
// productionProblems instead: the started PID on 9334, the user's config.json, the version, nothing else running.
// isolation, notes and note write only to <work>/private/<name.json> (privateOut): <work> is the A1 scratch directory outside the
// repository, the Obsidian vault (iCloud) and the user's Inkdrop profile, private/ a real directory (not a
// link) and the file new; any other place is refused (exit 7) before anything else runs.
//   settings <work> <acrylic:true|false>  stage A2: line numbers, active line, acrylic (after a restart)
//   capture <work> <out> <tmp> <noteId> <plainLine> <codeLine> <word> <opaque|acrylic>
//                                  both themes x the states of that mode, native captures + probes; the public
//                                  records in <out> keep only whether the note stayed the same, its identity goes
//                                  to <work>/private; a failed capture stops the run (exit 1), the backdrop is
//                                  always closed; a note or document that changed stops it at once (exit 3)
// Every subcommand first checks the isolation again and does nothing when it fails (exit 4), or when the window
// shows the sign-in screen instead of the app (exit 6: A1 stops there; no sign-in is attempted, §6.97).
// Never addresses an app by name (no AppleScript): with two Inkdrop instances that would reach the user's.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isolationProblems, productionProblems } from "./g6-rules.mjs";
import { captureLoop, shoot, splitNote } from "./g6-shot.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const PORT = Number(process.env.G6_PORT || 9334); // G6_PORT: self-test only
const p2b = path.join(repo, "research/evidence/phase2-p0/tools");
const here = (f) => readFileSync(path.join(repo, "tests/visual", f), "utf8");

// Evaluate in the isolated Inkdrop's main window (the page loaded from the app bundle).
async function evaluate(expression, timeoutMs = 60000) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("file://") && t.url.includes("Inkdrop.app"));
  if (!page) throw new Error(`no Inkdrop page target on port ${PORT}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  // The time-out timer is cleared at the end, or it would keep the process alive for its full length.
  let timer;
  try {
    const res = await Promise.race([
      new Promise((resolve) => { ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id === 1) resolve(m.result); }; ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("page did not answer")), timeoutMs); }),
    ]);
    if (res?.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(res.exceptionDetails).slice(0, 400)}`);
    return res?.result?.value;
  } finally { clearTimeout(timer); ws.close(); }
}
const run = (cmd, a) => spawnSync(cmd, a, { cwd: repo, encoding: "utf8" });
const others = () => run("pgrep", ["-x", "Inkdrop"]).stdout.trim().split("\n").filter(Boolean).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The one place raw A1 data (note IDs, revisions, body hashes) may go: <work>/private/<name>, refused unless
// <work> really is outside the repository, the iCloud folders and the user's Inkdrop profile, private/ is a real
// directory and <name> a plain new file name. Returns the path, or null with the reason printed.
function privateOut(work, name) {
  const real = (p) => { try { return realpathSync.native(p); } catch { return null; } };
  const under = (p, d) => d && (p === d || p.startsWith(`${d}/`));
  const w = real(work);
  const home = process.env.HOME;
  const blocked = [real(repo), real(path.join(home, "Library/Mobile Documents")), real(process.env.G6_PROD_DIR || path.join(home, "Library/Application Support/inkdrop"))];
  const why = !w ? "the work directory does not exist"
    : blocked.some((d) => under(w, d)) ? "the work directory is inside the repository, iCloud or the user's Inkdrop profile"
    : typeof name !== "string" || !/^[\w.-]+\.json$/.test(name) ? "the output must be a plain file name ending in .json"
    : null;
  if (why) { console.log(`REFUSED (nothing done): ${why}`); return null; }
  const dir = path.join(w, "private");
  if (!existsSync(dir)) mkdirSync(dir, { mode: 0o700 });
  const st = lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || real(dir) !== dir) { console.log("REFUSED (nothing done): <work>/private is not a real directory"); return null; }
  const out = path.join(dir, name);
  if (existsSync(out) || (() => { try { lstatSync(out); return true; } catch { return false; } })()) { console.log("REFUSED (nothing done): the output file already exists"); return null; }
  return out;
}
// The check every subcommand runs first: the isolation (A') or, in method C, that the instance on 9334 is the
// user's Inkdrop this run started. Paths are compared as real paths where they exist.
async function checkInstance(work) {
  const real = (p) => { if (typeof p !== "string" || !path.isAbsolute(p)) return p; try { return realpathSync.native(p); } catch { return path.resolve(p); } };
  const read = (f) => { try { return readFileSync(path.join(work, f), "utf8").trim(); } catch { return null; } };
  const started = Number(read("inkdrop.pid")) || null;
  const raw = await evaluate(here("g6-isolation.js")).catch(() => null);
  const report = raw && { ...raw, env: real(raw.env), paths: Object.fromEntries(Object.entries(raw.paths ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.map(real) : real(v)])) };
  const listener = Number(run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"]).stdout.trim().split("\n")[0]) || null;
  const othersNow = others().filter((p) => Number(p) !== started);
  const prod = real(process.env.G6_PROD_DIR || path.join(process.env.HOME, "Library/Application Support/inkdrop"));
  if (read("mode.txt") === "production") {
    const problems = productionProblems({ report, listener, started, configExpected: real(path.join(prod, "config.json")), othersNow });
    return { mode: "production", report, listener, started, problems };
  }
  // Files open in the started process and its descendants (the database may be held by a helper).
  const tree = [];
  for (let q = started ? [started] : []; q.length;) { const p = q.shift(); tree.push(p); q.push(...run("pgrep", ["-P", String(p)]).stdout.trim().split("\n").filter(Boolean).map(Number)); }
  const lsof = tree.length ? run("lsof", ["-nP", "-Fn", "-p", tree.join(",")]) : null;
  const openFiles = lsof && lsof.status === 0 ? [...new Set(lsof.stdout.split("\n").filter((l) => l.startsWith("n/")).map((l) => real(l.slice(1))))] : null;
  const before = read("others-before.txt");
  const othersBefore = before === null ? null : before.split("\n").filter(Boolean).sort();
  const data = real(read("data-path.txt"));
  const problems = isolationProblems({ report, openFiles, data, prod, listener, started, othersBefore, othersNow });
  return { mode: "isolated", report, listener, started, problems, openFilesInData: openFiles?.filter((f) => f.startsWith(`${data}/`)).length ?? null };
}
const [sub, work, ...a] = process.argv.slice(2);
if (!["isolation", "notes", "note", "settings", "capture"].includes(sub) || !work) { console.error("usage: node tests/visual/g6-run.mjs isolation|notes|note|settings|capture <work> ..."); process.exit(2); }
const out = ["isolation", "notes"].includes(sub) ? privateOut(work, a[0]) : sub === "note" ? privateOut(work, a[1]) : undefined;
if (out === null) process.exit(7);
const iso = await checkInstance(work);
if (sub === "isolation") writeFileSync(out, `${JSON.stringify({ checkedAt: new Date().toISOString(), ...iso, report: iso.report && { ...iso.report, paths: undefined, env: undefined } }, null, 1)}\n`, { flag: "wx", mode: 0o600 });
if (iso.problems.length) { console.log(`NOT ${iso.mode === "production" ? "THE STARTED INKDROP" : "ISOLATED"} (nothing done): ${iso.problems.join("; ")}`); process.exit(4); }
if (!iso.report.mainUi) { console.log("SIGN-IN SCREEN: the instance is not signed in; the stage stops here (no sign-in is attempted)"); process.exit(6); }
if (sub === "isolation") {
  console.log(iso.mode === "production" ? `the started Inkdrop ${iso.report.inkdropVersion} on 9334, using the user's config.json, nothing else running; signed in`
    : "isolated: userData, config, packages and db in the isolated directory; 9334 is the started instance; the user's Inkdrop unchanged; signed in");
} else if (sub === "notes") {
  const res = await evaluate(here("g6-notes.js"));
  writeFileSync(out, `${JSON.stringify(res, null, 1)}\n`, { flag: "wx", mode: 0o600 });
  const tut = res.notes.filter((n) => n.tutorial);
  console.log(`${res.count} notes; ${tut.length} tagged as the tutorial (only those were read); with a plain line and a code block line: ${tut.filter((n) => n.plainLines.length && n.codeLines.length).length}`);
} else if (sub === "note") {
  const res = await evaluate(`(async () => { const d = await inkdrop.localDB.notes.get(${JSON.stringify(a[0])}).catch(() => null); if (!d) return null; const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(d.body ?? "")))].map((b) => b.toString(16).padStart(2, "0")).join(""); return { _id: d._id, _rev: d._rev, updatedAt: d.updatedAt, bodySha256: h }; })()`);
  if (!res) { console.log("the note was not found"); process.exit(1); }
  writeFileSync(out, `${JSON.stringify(res, null, 1)}\n`, { flag: "wx", mode: 0o600 });
  console.log("note identity recorded (private)");
} else if (sub === "settings") {
  const acrylic = a[0] === "true";
  console.log(JSON.stringify(await evaluate(`(() => { inkdrop.config.set("editor.lineNumbers", true); inkdrop.config.set("editor.styleActiveLine", true); inkdrop.config.set("core.mainWindow.acrylicEnabled", ${acrylic}); return { lineNumbers: inkdrop.config.get("editor.lineNumbers"), styleActiveLine: inkdrop.config.get("editor.styleActiveLine"), acrylic: inkdrop.config.get("core.mainWindow.acrylicEnabled") }; })()`)));
} else if (sub === "capture") {
  const [dir, tmp, noteId, plainLine, codeLine, word, mode] = a;
  const states = mode === "acrylic" ? [["active", Number(plainLine)]] : [["active", Number(plainLine)], ["search", Number(plainLine)], ["code", Number(codeLine)]];
  mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  mkdirSync(path.join(dir, "measurements"), { recursive: true });
  mkdirSync(path.join(tmp, "bin"), { recursive: true });
  const backdrop = path.join(tmp, "bin", "backdrop");
  if (!existsSync(backdrop)) run("swiftc", ["-O", path.join(p2b, "backdrop.swift"), "-o", backdrop]);
  const conditions = ["solarized-dark", "kanagawa-dragon"].flatMap((theme) => states.map(([state, line]) => ({ theme, state, line, name: `inkdrop-${theme}-v35-${mode}-${state}` })));
  let theme = null;
  const result = await captureLoop({
    conditions,
    setState: async (c) => {
      if (c.theme !== theme) {
        const sel = await evaluate(`window.__P2B_THEME = ${JSON.stringify(c.theme)};\n${readFileSync(path.join(p2b, "inkdrop-select-theme.js"), "utf8")}`);
        if (!sel.active?.includes(c.theme)) throw new Error(`theme ${c.theme} is not active (${sel.active})`);
        await evaluate(readFileSync(path.join(p2b, "inkdrop-window-geometry.js"), "utf8"));
        theme = c.theme;
      }
      return evaluate(`window.__G6 = ${JSON.stringify({ noteId, state: c.state, line: c.line, word })};\n${here("g6-state.js")}`);
    },
    takeShot: async (c, st) => {
      const shot = path.join(dir, "screenshots", `${c.name}.png`);
      let focus;
      // The gray backdrop window behind the Inkdrop window (V-32 geometry) only for this shot; the window is
      // brought to the front through Inkdrop's own window API (6.x has no @electron/remote; never by app name).
      const before = await shoot({ backdrop: [backdrop, "gray", "300", "150", "1400", "900"], capture: ["/usr/sbin/screencapture", "-x", "-R400,250,1200,700", shot], file: shot,
        between: async () => {
          focus = await evaluate(`(async () => { await inkdrop.window.show(); await inkdrop.window.focus(); await new Promise((x) => setTimeout(x, 800)); return { focused: document.hasFocus() }; })()`);
          return evaluate(here("g6-probe.js"));
        } });
      const at = new Date().toISOString();
      const after = await evaluate(here("g6-probe.js"));
      const split = splitNote(before, after);
      const priv = privateOut(work, `note-${c.name}.json`);
      if (!priv) throw new Error("no private place for the note identity");
      writeFileSync(priv, `${JSON.stringify(split.private, null, 1)}\n`, { flag: "wx", mode: 0o600 });
      const img = readFileSync(shot);
      const rec = { name: c.name, theme: c.theme, mode, state: c.state, line: c.line, capturedAt: at, image: path.relative(dir, shot), imageSha256: createHash("sha256").update(img).digest("hex"),
        pixels: [img.readUInt32BE(16), img.readUInt32BE(20)], windowRectPoints: [400, 250, 1200, 700], backdrop: "gray", stateResult: st, focus, ...split.public };
      writeFileSync(path.join(dir, "measurements", `${c.name}.json`), `${JSON.stringify(rec, null, 1)}\n`, { flag: "wx" });
      console.log(`${c.name}: focused ${after.window.focused}, dpr ${after.window.devicePixelRatio}, doc unchanged ${st.docUnchanged}, note unchanged ${split.public.noteUnchanged}`);
      return rec;
    },
  }).catch((e) => ({ error: e.message }));
  if (result.error) { console.log(`STOPPED: ${result.error}`); process.exit(1); }
  // A changed note: recorded and stopped; nothing is written back and no further step runs (exit 3).
  if (result.stopped) { writeFileSync(path.join(dir, `NOTE-CHANGED-${mode}.txt`), `${result.stopped}\n`); console.log(`NOTE CHANGED, STOPPED: ${result.stopped}`); process.exit(3); }
  console.log(`${result.done} captures (${mode})`);
}

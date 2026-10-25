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
// Step 11G G7-1 (research/14 §6.125), method C only, run by tests/visual/g7-c-run.sh:
//   note-create <work> <note.md>   creates the one temporary verification note (tests/visual/g7-rules.mjs noteDoc) in
//                                  the tutorial notebook; its ID, notebook and body hash go to <work>/private/g7-note.json
//                                  BEFORE it is written, so the clean-up always knows what to delete
//   syntax <work> <out> <tmp> <note.md> <theme>  that theme, the editor and the preview: g7-measure.js and judgeBlocks
//                                  into <out>/measurements, reference captures page by page into <out>/screenshots;
//                                  exit 5 when a view is INCOMPLETE (the records are kept), 1 when it stopped (theme
//                                  not active, another note shown, a failed capture), 3 when the document changed
//   note-remove <work>             deletes that note, only if its title and body hash are still the ones created, and
//                                  confirms it is gone (REMOVED / ABSENT / NOT REMOVED; exit 1 unless REMOVED or ABSENT)
// Every subcommand first checks the isolation again and does nothing when it fails (exit 4), or when the window
// shows the sign-in screen instead of the app (exit 6: A1 stops there; no sign-in is attempted, §6.97).
// Never addresses an app by name (no AppleScript): with two Inkdrop instances that would reach the user's.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isolationProblems, productionProblems } from "./g6-rules.mjs";
import { captureLoop, shoot, splitNote } from "./g6-shot.mjs";
import { NOTE_TITLE, blocks, judgeBlocks, noteDoc } from "./g7-rules.mjs";

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
if (!["isolation", "notes", "note", "settings", "capture", "note-create", "syntax", "note-remove"].includes(sub) || !work) { console.error("usage: node tests/visual/g6-run.mjs isolation|notes|note|settings|capture|note-create|syntax|note-remove <work> ..."); process.exit(2); }
const out = ["isolation", "notes"].includes(sub) ? privateOut(work, a[0]) : sub === "note" ? privateOut(work, a[1]) : sub === "note-create" ? privateOut(work, "g7-note.json") : undefined;
if (out === null) process.exit(7);
const iso = await checkInstance(work);
// G7 runs only on the user's Inkdrop started by method C (the note is created there, §6.125).
if (["note-create", "syntax", "note-remove"].includes(sub) && iso.mode !== "production") { console.log("REFUSED (nothing done): G7 runs only in method C"); process.exit(4); }
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
} else if (sub === "note-create") {
  const body = readFileSync(a[0], "utf8");
  const bodySha256 = createHash("sha256").update(body).digest("hex");
  // The notebook of the tutorial notes (the only part of the user's data G6 read, §6.103.2); a fresh ID from Inkdrop.
  const where = await evaluate(`(async () => { const db = inkdrop.localDB; const tags = await db.tags.all(); const t = tags.find((x) => /^tutorial$/i.test(x.name)); if (!t) return null; const r = await db.notes.findWithTag(t._id, { includeDocs: true, limit: 1 }); const n = r?.rows?.[0]; const d = n && "doc" in n ? n.doc : n; return d?.bookId ? { bookId: d.bookId, id: db.notes.createId() } : null; })()`);
  if (!where?.id?.startsWith("note:") || !where.bookId?.startsWith("book:")) { console.log("STOPPED (nothing created): no tutorial notebook or no note ID"); process.exit(1); }
  // Recorded before the write: whatever happens next, the clean-up knows which note to look for.
  writeFileSync(out, `${JSON.stringify({ id: where.id, bookId: where.bookId, title: NOTE_TITLE, bodySha256, recordedAt: new Date().toISOString() }, null, 1)}\n`, { flag: "wx", mode: 0o600 });
  const doc = noteDoc({ id: where.id, bookId: where.bookId, body, now: Date.now() });
  const got = await evaluate(`(async () => { const db = inkdrop.localDB.notes; if (await db.get(${JSON.stringify(where.id)}).then(() => true, () => false)) return { error: "a note with that ID exists" }; await db.put(${JSON.stringify(doc)}); const d = await db.get(${JSON.stringify(where.id)}).catch(() => null); return d ? { title: d.title, body: d.body } : { error: "not found after put" }; })()`).catch((e) => ({ error: e.message }));
  if (got.error || got.title !== NOTE_TITLE || createHash("sha256").update(got.body ?? "").digest("hex") !== bodySha256) { console.log(`STOPPED: the note was not created as written (${got.error ?? "title or body differ"})`); process.exit(1); }
  writeFileSync(path.join(path.dirname(out), "g7-note-created.txt"), `${new Date().toISOString()}\n`, { flag: "wx", mode: 0o600 });
  console.log("NOTE CREATED: the temporary verification note (ID private)");
} else if (sub === "syntax") {
  const [dir, tmp, notePath, theme] = a;
  const rec = JSON.parse(readFileSync(path.join(work, "private", "g7-note.json"), "utf8"));
  const want = blocks(readFileSync(notePath, "utf8"));
  const vars = [...new Set(JSON.parse(readFileSync(path.join(repo, "tests/fixtures/inkdrop-tokens.json"), "utf8")).flatMap((b) => b.ranges.map((r) => r.var)).filter(Boolean))].sort();
  for (const d of ["screenshots", "measurements"]) mkdirSync(path.join(dir, d), { recursive: true });
  mkdirSync(path.join(tmp, "bin"), { recursive: true });
  const backdrop = path.join(tmp, "bin", "backdrop");
  if (!existsSync(backdrop)) run("swiftc", ["-O", path.join(p2b, "backdrop.swift"), "-o", backdrop]);
  const sel = await evaluate(`window.__P2B_THEME = ${JSON.stringify(theme)};\n${readFileSync(path.join(p2b, "inkdrop-select-theme.js"), "utf8")}`);
  if (!sel.active?.includes(theme)) { console.log(`STOPPED: theme ${theme} is not active (${sel.active})`); process.exit(1); }
  await evaluate(readFileSync(path.join(p2b, "inkdrop-window-geometry.js"), "utf8"));
  let incomplete = false;
  for (const view of ["editor", "preview"]) {
    const res = await evaluate(`window.__G7 = ${JSON.stringify({ noteId: rec.id, view, blocks: want, vars })};\n${here("g7-measure.js")}`, 180000);
    const verdict = res?.error ? { state: "INCOMPLETE", problems: [res.error] } : judgeBlocks(want, res);
    const name = `inkdrop-${theme}-g7-${view}`;
    writeFileSync(path.join(dir, "measurements", `${name}.json`), `${JSON.stringify({ name, theme, view, ...verdict, result: res }, null, 1)}\n`, { flag: "wx" });
    console.log(`${name}: ${verdict.state}${verdict.problems.length ? ` (${verdict.problems.slice(0, 3).join("; ")})` : ""}`);
    if (res?.docUnchanged === false) { console.log("DOCUMENT CHANGED, STOPPED"); process.exit(3); }
    if (verdict.state !== "COMPLETE") incomplete = true;
    // Reference captures, page by page from the top (the scroller of the view, 90 % of its height per page).
    for (let k = 0, pages = 1; k < pages; k++) {
      const pg = await evaluate(`(async () => { const mode = ${JSON.stringify(view)}; let s = null; if (mode === "editor") s = document.querySelector(".cm-scroller"); else for (let e = document.querySelector(".mde-preview"); e && !s; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight) s = e; } if (!s) return { error: "no scroller" }; const step = Math.floor(s.clientHeight * 0.9); s.scrollTop = ${k} * step; await new Promise((r) => setTimeout(r, 700)); return { pages: Math.max(1, Math.ceil((s.scrollHeight - s.clientHeight) / step) + 1), scrollTop: s.scrollTop, noteOk: inkdrop.store.getState().editingNote?._id === ${JSON.stringify(rec.id)} }; })()`);
      if (pg?.error || !pg.noteOk) { console.log(`STOPPED: ${pg?.error ?? "another note is shown"}`); process.exit(1); }
      pages = pg.pages;
      const shot = path.join(dir, "screenshots", `${name}-p${String(k + 1).padStart(2, "0")}.png`);
      const focus = await shoot({ backdrop: [backdrop, "gray", "300", "150", "1400", "900"], capture: ["/usr/sbin/screencapture", "-x", "-R400,250,1200,700", shot], file: shot,
        between: () => evaluate(`(async () => { await inkdrop.window.show(); await inkdrop.window.focus(); await new Promise((x) => setTimeout(x, 800)); return { focused: document.hasFocus() }; })()`) });
      const img = readFileSync(shot);
      writeFileSync(path.join(dir, "measurements", `${name}-p${String(k + 1).padStart(2, "0")}.json`), `${JSON.stringify({ image: path.relative(dir, shot), imageSha256: createHash("sha256").update(img).digest("hex"), pixels: [img.readUInt32BE(16), img.readUInt32BE(20)], page: k + 1, pages, scrollTop: pg.scrollTop, focus, capturedAt: new Date().toISOString() }, null, 1)}\n`, { flag: "wx" });
    }
  }
  process.exit(incomplete ? 5 : 0);
} else if (sub === "note-remove") {
  const file = path.join(work, "private", "g7-note.json");
  if (!existsSync(file)) { console.log("ABSENT: no note was recorded by this run"); process.exit(0); }
  const rec = JSON.parse(readFileSync(file, "utf8"));
  // Only the note this run created: same ID, title and body hash; anything else is left alone and reported.
  const res = await evaluate(`(async () => { const db = inkdrop.localDB.notes; const id = ${JSON.stringify(rec.id)}; const d = await db.get(id).catch(() => null); if (!d) return { state: "ABSENT" }; const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(d.body ?? "")))].map((b) => b.toString(16).padStart(2, "0")).join(""); if (d.title !== ${JSON.stringify(rec.title)} || h !== ${JSON.stringify(rec.bodySha256)}) return { state: "NOT REMOVED", why: "the note is not the one this run created (title or body changed)" }; await db.remove(id); const gone = await db.get(id).then(() => false, () => true); return gone ? { state: "REMOVED" } : { state: "NOT REMOVED", why: "still found after remove" }; })()`).catch((e) => ({ state: "NOT REMOVED", why: e.message }));
  writeFileSync(path.join(work, "private", `g7-note-${res.state === "NOT REMOVED" ? "not-removed" : res.state.toLowerCase()}-${Date.now()}.json`), `${JSON.stringify({ ...res, at: new Date().toISOString() }, null, 1)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`${res.state}${res.why ? `: ${res.why}` : ""}`);
  process.exit(res.state === "NOT REMOVED" ? 1 : 0);
}

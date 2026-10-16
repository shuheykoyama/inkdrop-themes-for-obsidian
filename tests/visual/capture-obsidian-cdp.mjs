// CDP screenshots of the ISOLATED Obsidian under the V-30 conditions (research/11 §13.2, §14.3): one DevTools
// session sets the viewport to 1024x800 CSS px at device scale factor 1, prepares the state and captures the
// page with Page.captureScreenshot -- the method of the Inkdrop V-30 captures, so the two are compared CDP to
// CDP (research/14 §3.7; never against a native capture). Opaque only: a CDP capture does not composite the
// macOS window material, so a translucent window cannot be captured this way.
//
// usage: node tests/visual/capture-obsidian-cdp.mjs <theme> <state> <out_dir> [<vault>]
//   theme: the theme name in the isolated vault (copied there by this script from dist/<theme>)
//   state: 1-live | 1-source | 2 | 3 | 4 | 5   (the V-30 states, research/11 §14.3; see STATES below)
//   vault: the isolated vault (to copy the theme into); omit when the theme is already there
// Requires the isolated instance on 127.0.0.1:9333 (tests/runtime/obsidian-isolated.sh). Writes
// <out_dir>/screenshots/obsidian-<theme>-<state>.png and <out_dir>/measurements/obsidian-<theme>-<state>.json
// (capture metadata, the body classes, and the element and computed background under each sampled point).
// Inspect every image before committing it.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [theme, state, out, vault] = process.argv.slice(2);
const STATES = {
  // 1. Default: the note in the editor, the editor focused, no selection (Inkdrop: line numbers and the
  //    active line off, its default). Obsidian keeps its own default view (Live Preview); Source mode is
  //    captured too because Inkdrop's editor shows the Markdown source.
  "1-live": { view: "live", focus: "editor", lines: false },
  "1-source": { view: "source", focus: "editor", lines: false },
  // 2. The note list focused with the note selected -> the File Explorer leaf active, the note open.
  "2": { view: "live", focus: "explorer", lines: false },
  // 3. A sidebar row hovered -> the pointer on a File Explorer row (not the open note).
  "3": { view: "live", focus: "editor", lines: false, hover: "Other note.md" },
  // 4. Line numbers and the active line on, "bold" selected (Source mode: Inkdrop's editor shows the source).
  "4": { view: "source", focus: "editor", lines: true, select: "bold" },
  // 5. The preview -> Reading view.
  "5": { view: "reading", focus: "editor", lines: false },
};
const spec = STATES[state];
if (!theme || !spec || !out) {
  console.error(`usage: node tests/visual/capture-obsidian-cdp.mjs <theme> <${Object.keys(STATES).join("|")}> <out_dir> [<vault>]`);
  process.exit(2);
}
const root = path.resolve(import.meta.dirname, "..", "..");
let themeName = theme;
if (vault) {
  // The manifest's name is the folder name Obsidian expects under .obsidian/themes.
  themeName = JSON.parse(readFileSync(path.join(root, "dist", theme, "manifest.json"), "utf8")).name;
  const dir = path.join(vault, ".obsidian", "themes", themeName);
  mkdirSync(dir, { recursive: true });
  for (const f of ["theme.css", "manifest.json"]) cpSync(path.join(root, "dist", theme, f), path.join(dir, f));
}

const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
if (!page) throw new Error("no isolated Obsidian main window on 127.0.0.1:9333");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
// One CDP command; rejects on a protocol error or after 60 s without an answer.
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++nextId;
  const timer = setTimeout(() => reject(new Error(`${method}: no answer within 60 s`)), 60000);
  pending.set(n, (m) => { clearTimeout(timer); m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result); });
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (fn, arg) => {
  const r = await send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(r.exceptionDetails).slice(0, 600)}`);
  return r.result.value;
};

try {
  // The V-30 viewport, for the whole session (the override ends when the session closes).
  await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 800, deviceScaleFactor: 1, mobile: false });
  // The page believes it has the focus even while the person at the Mac uses another window.
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const setup = await evaluate(async ({ themeName, spec }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ws = app.workspace;
    // Select the theme and wait until its stylesheet is loaded and stable (as tests/visual/obsidian-capture-setup.js).
    await app.customCss.readThemes();
    let last = -1;
    for (let i = 0; i < 20; i++) {
      if (app.customCss.theme !== themeName) app.customCss.setTheme(themeName);
      await app.customCss.loadTheme();
      await sleep(300);
      const len = app.customCss.styleEl.textContent.length;
      if (app.customCss.theme === themeName && len > 0 && len === last) break;
      last = len;
    }
    app.customCss.setTranslucency(false);
    // The V-30 captures show a focused Inkdrop window; Obsidian marks its focused window with body.is-focused
    // (tab and view-header text colours), so bring the isolated window to the front with its own Electron
    // APIs (research/evidence/phase2-v04/tools/obsidian-focus.js; the user's Obsidian is never addressed).
    const remote = window.require("@electron/remote");
    remote.app.focus({ steal: true });
    electronWindow.moveTop();
    electronWindow.focus();
    app.vault.setConfig("showLineNumber", !!spec.lines);
    // Inkdrop has no right pane: only the left dock (File Explorer) is open, as wide as Inkdrop's note list.
    ws.rightSplit.collapse();
    ws.leftSplit.expand();
    const fe = ws.getLeavesOfType("file-explorer")[0];
    if (fe) ws.revealLeaf(fe);
    ws.leftSplit.setSize(300);
    // A fresh view for every capture: switching the same view between modes several times left its editor
    // without the Markdown parse (no syntax classes, the frontmatter's closing line drawn over the next
    // line; seen in the first trial captures), so the note's leaf is emptied and the note opened again.
    // The leaf is the note's own (in the centre), never a new one: a new leaf needs an active tab group,
    // which there is not while a sidebar leaf is active.
    const leaf = ws.getLeavesOfType("markdown")[0] ?? ws.getLeavesOfType("empty")[0];
    if (!leaf) throw new Error("no centre leaf to open the note in");
    await leaf.setViewState({ type: "empty" });
    await sleep(300);
    const st = spec.view === "reading" ? { mode: "preview" } : { mode: "source", source: spec.view === "source" };
    await leaf.setViewState({ type: "markdown", state: { file: "Sample note.md", ...st }, active: true });
    await sleep(600);
    const v = leaf.view;
    // Close the editor's find bar if an earlier capture left it open.
    v.containerEl.querySelector(".document-search-close-button")?.click();
    if (v.getMode() === "preview") v.previewMode.applyScroll(0);
    else {
      v.editor.focus();
      // Without a selection the cursor goes to the last line, below the captured area, so that the active
      // line (always painted, Q-D23) does not cover the editor surface of states 1-3 (Inkdrop has it off).
      const line = spec.select ? v.editor.getValue().split("\n").findIndex((l) => l.includes(spec.select)) : v.editor.lastLine();
      const ch = spec.select ? v.editor.getLine(line).indexOf(spec.select) : 0;
      v.editor.setCursor({ line, ch });
      if (spec.select) v.editor.setSelection({ line, ch }, { line, ch: ch + spec.select.length });
      await sleep(200);
      v.editor.scrollTo(null, 0);
    }
    if (spec.focus === "explorer" && fe) ws.setActiveLeaf(fe, { focus: true });
    else ws.setActiveLeaf(leaf, { focus: true });
    if (spec.focus !== "explorer" && v.getMode() !== "preview") v.editor.focus();
    await sleep(800);
    let hover = null;
    if (spec.hover) {
      const el = document.querySelector(`.nav-file-title[data-path="${spec.hover}"]`);
      const r = el?.getBoundingClientRect();
      hover = r ? { x: Math.round(r.left + r.width * 0.75), y: Math.round(r.top + r.height / 2) } : null;
    }
    // The note must be parsed as Markdown: a heading carries its syntax class in the editor, an h1 in Reading view.
    // A freshly started window can take a few seconds to parse the first note, so wait up to 5 s.
    let parsed = false;
    for (let i = 0; i < 25 && !parsed; i++) {
      parsed = !!v.contentEl.querySelector(v.getMode() === "preview" ? ".markdown-rendered h1" : ".cm-line .cm-header-1");
      if (!parsed) await sleep(200);
    }
    return {
      parsed,
      theme: app.customCss.theme,
      themeCssLength: app.customCss.styleEl.textContent.length,
      viewport: [innerWidth, innerHeight, devicePixelRatio],
      mode: v.getMode(), source: v.getState().source ?? null,
      lineNumbers: app.vault.getConfig("showLineNumber"),
      activeLeafType: ws.activeLeaf?.view?.getViewType(),
      hover,
      electron: (/Electron\/([\d.]+)/.exec(navigator.userAgent) || [])[1] ?? null,
      chrome: (/Chrome\/([\d.]+)/.exec(navigator.userAgent) || [])[1] ?? null,
      appVersion: window.require("electron").ipcRenderer.sendSync("version"),
    };
  }, { themeName, spec });
  if (setup.theme !== themeName || !setup.themeCssLength) throw new Error(`theme not loaded: ${JSON.stringify(setup)}`);
  if (!setup.parsed) throw new Error("the note is not rendered as Markdown (no heading element); capture again");
  if (spec.hover) {
    if (!setup.hover) throw new Error(`no File Explorer row for ${spec.hover}`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.hover.x, y: setup.hover.y });
  } else {
    // Park the pointer where it hovers nothing: the right margin of the note (the bottom corner is the status
    // bar, whose sync icon shows a tooltip).
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1012, y: 420 });
  }
  await new Promise((r) => setTimeout(r, 900));
  const after = await evaluate((hoverPath) => ({
    body: [...document.body.classList].filter((c) => /^(is-|theme-|mod-)/.test(c)).sort(),
    activeElement: document.activeElement?.className?.toString().slice(0, 80) ?? null,
    hasFocus: document.hasFocus(),
    selection: app.workspace.activeEditor?.editor?.getSelection() ?? null,
    hovered: hoverPath ? !!document.querySelector(`.nav-file-title[data-path="${hoverPath}"]`)?.matches(":hover") : null,
  }), spec.hover ?? null);
  // State 3 shows a hovered row: a capture whose row is not under the pointer any more (a real pointer moved
  // over the window) is not that state.
  if (spec.hover && !after.hovered) throw new Error(`the File Explorer row ${spec.hover} is not hovered; capture again`);
  // A capture without the focused-window state is not a V-30 state: fail rather than keep it (the window
  // loses the macOS focus when someone uses another window during the run; run the capture again).
  if (!after.body.includes("is-focused")) throw new Error(`the isolated window is not focused (body: ${after.body.join(" ")}); capture again`);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  // The hover must also hold after the screenshot (a real pointer over the frontmost window takes it away).
  if (spec.hover && !(await evaluate((p) => !!document.querySelector(`.nav-file-title[data-path="${p}"]`)?.matches(":hover"), spec.hover))) {
    throw new Error(`the File Explorer row ${spec.hover} lost the hover during the screenshot; capture again`);
  }
  const name = `obsidian-${theme}-${state}`;
  mkdirSync(path.join(out, "screenshots"), { recursive: true });
  mkdirSync(path.join(out, "measurements"), { recursive: true });
  const png = Buffer.from(shot.data, "base64");
  writeFileSync(path.join(out, "screenshots", `${name}.png`), png);
  writeFileSync(path.join(out, "measurements", `${name}.json`), `${JSON.stringify({
    capture: {
      method: "CDP Page.captureScreenshot, Emulation.setDeviceMetricsOverride 1024x800 deviceScaleFactor 1 (the V-30 method)",
      capturedAt: new Date().toISOString(), file: `screenshots/${name}.png`, pixels: [png.readUInt32BE(16), png.readUInt32BE(20)],
      sha256: createHash("sha256").update(png).digest("hex"), theme, state, spec,
    },
    setup, after,
  }, null, 1)}\n`);
  console.log(`${name} | obsidian ${setup.appVersion} electron ${setup.electron} | ${setup.mode}${setup.source ? " (source)" : ""} | lines ${setup.lineNumbers} | active ${setup.activeLeafType} | selection ${JSON.stringify(after.selection)} | ${after.body.join(" ")}`);
} finally {
  ws.close();
}

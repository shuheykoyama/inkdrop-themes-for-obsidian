// G4 (research/14 §6.67.4, §6.152): one theme in a real macOS full screen of the isolated Obsidian (9333). A copy of
// ../11g-g4/g4.mjs (Solarized Dark only) with the theme as an argument and a guaranteed exit from full screen.
//   node g4.mjs <repo> <vault> <out.json> prep <theme>   install the theme, read the surfaces opaque and translucent
//   node g4.mjs <repo> <vault> <out.json> full <theme>   setFullScreen(true), read, setFullScreen(false), read
// <theme> is solarized-dark or kanagawa-dragon (dist/<theme>/theme.css of <repo>). prep checks that Obsidian loaded
// exactly that file (theme name, length and SHA-256 of the loaded text); full refuses an <out.json> prepared for
// another theme or with another file, and checks the loaded theme again before entering.
// Before entering, full also requires (research/14 §6.160): the Obsidian and Electron versions named by G4_EXPECT_APP
// and G4_EXPECT_ELECTRON (e.g. 1.14.5 and 43.8.3) in prep's record and in the live window, all 12 surfaces read in
// prep, the window out of full screen (no is-fullscreen), and the macOS Spaces by type readable (../11g-g4/spaces.sh,
// or G4_SPACES); otherwise it refuses without asking for full screen.
// full always tries to leave full screen once it asked to enter, whatever fails in between, and then reads
// isFullScreen(), the body's is-fullscreen class and the Spaces by type (for up to 10 s until they equal the counts
// before). Only a run that entered, read, left and got the same Spaces back with no error is stored as `during` /
// `after` with status COMPLETE; any other run is stored apart as `failedRun` with status ABORTED (left full screen,
// but something failed or the Spaces differ) or STUCK (did not leave: tell the user, stop the isolated instance), and
// the exit status is 1 (ABORTED) or 3 (STUCK).
// Self-test: g4-self-test.mjs (a fake <repo> whose tests/runtime/lib/cdp.mjs plays the window).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const THEMES = ["solarized-dark", "kanagawa-dragon"];
const [repo, vault, out, phase, theme] = process.argv.slice(2);
if (!["prep", "full"].includes(phase) || !THEMES.includes(theme)) {
  console.error(`usage: node g4.mjs <repo> <vault> <out.json> prep|full ${THEMES.join("|")}`);
  process.exit(2);
}
const { evaluate, holdFocus } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * (Number(process.env.G4_TIME_SCALE) || 1)));
const E = (expr, t) => evaluate(9333, expr, t);
const themeName = `G4 ${theme}`;
const css = fs.readFileSync(path.join(repo, `dist/${theme}/theme.css`), "utf8");
const cssSha256 = createHash("sha256").update(css).digest("hex");
const SURFACES = {
  ribbon: [".workspace-ribbon.mod-primary"],
  ribbonCorner: [".workspace-ribbon.mod-primary", "::before"],
  statusBar: [".status-bar"],
  leftLeaf: ['.workspace-split.mod-left-split .workspace-leaf:has(> [data-type="file-explorer"])'],
  leftLeafContent: ['.workspace-split.mod-left-split .workspace-leaf-content[data-type="file-explorer"]'],
  leftTabStrip: [".workspace-split.mod-left-split .workspace-tab-header-container"],
  rightLeaf: ['.workspace-split.mod-right-split .workspace-leaf:has(> [data-type="outline"])'],
  rightLeafContent: ['.workspace-split.mod-right-split .workspace-leaf-content[data-type="outline"]'],
  rightTabStrip: [".workspace-split.mod-right-split .workspace-tab-header-container"],
  centreTabStrip: [".workspace-split.mod-root .workspace-tab-header-container"],
  editor: [".workspace-split.mod-root .workspace-leaf.mod-active .view-content"],
  vaultProfile: [".workspace-split.mod-left-split .workspace-sidedock-vault-profile"],
};
const read = () => E(`(() => {
  const S = ${JSON.stringify(SURFACES)};
  const v = {};
  for (const [k, [sel, pseudo]] of Object.entries(S)) { const e = document.querySelector(sel); v[k] = e ? getComputedStyle(e, pseudo ?? null).backgroundColor : null; }
  return { at: new Date().toISOString(), isFullScreen: electronWindow.isFullScreen(), classes: [...document.body.classList].filter((c) => /^is-(translucent|fullscreen|focused)$/.test(c)), theme: app.customCss.theme, values: v };
})()`);
// The theme Obsidian has loaded: its name, and the length and SHA-256 of the loaded text.
const loaded = () => E(`(async () => { const t = app.customCss.styleEl.textContent; const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return { theme: app.customCss.theme, length: t.length, sha256: [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("") }; })()`);
const sameTheme = (l) => l.theme === themeName && l.length === css.length && l.sha256 === cssSha256;
const state = () => E('(() => ({ isFullScreen: electronWindow.isFullScreen(), isFullscreenClass: document.body.classList.contains("is-fullscreen") }))()');
const spaces = () => {
  try { return JSON.parse(execFileSync("sh", [process.env.G4_SPACES || path.join(import.meta.dirname, "../11g-g4/spaces.sh")], { encoding: "utf8" })); } catch (e) { return { error: String(e.message ?? e) }; }
};

const result = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
let exitCode = 0;
const release = await holdFocus(9333);
try {
  if (phase === "prep") {
    for (let i = 0; i < 80 && !(await E("(() => !!(window.app && app.workspace.layoutReady))()").catch(() => false)); i++) await sleep(500);
    const dir = path.join(vault, `.obsidian/themes/${themeName}`); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: themeName, version: "0.0.0", minAppVersion: "1.14.4", author: "g4" }));
    fs.writeFileSync(path.join(dir, "theme.css"), css);
    result.environment = await E(`(async () => { await app.customCss.readThemes(); for (let i = 0; i < 20; i++) { app.customCss.setTheme(${JSON.stringify(themeName)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 300)); if (app.customCss.styleEl.textContent.length === ${css.length}) break; }
      // Both docks open, the outline in the right one, as the runtime checks' default state.
      app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand();
      const outline = app.workspace.getLeavesOfType("outline")[0]; if (outline) app.workspace.revealLeaf(outline);
      await new Promise((r) => setTimeout(r, 800));
      return { app: window.require("electron").ipcRenderer.sendSync("version"), electron: (/Electron\\/([\\d.]+)/.exec(navigator.userAgent) || [])[1], frame: window.require("electron").ipcRenderer.sendSync("frame") || "hidden", themeLength: app.customCss.styleEl.textContent.length, built: ${css.length} }; })()`);
    const l = await loaded();
    Object.assign(result, { theme, cssSha256, cssLength: css.length, loadedTheme: l });
    if (!sameTheme(l)) throw new Error(`the loaded theme is not ${themeName} (${css.length} chars, ${cssSha256}): ${JSON.stringify(l)}`);
    await E("(() => { app.customCss.setTranslucency(false); return 1; })()"); await sleep(1500);
    result.opaque = await read();
    await E("(() => { app.customCss.setTranslucency(true); return 1; })()"); await sleep(1500);
    result.translucentBefore = await read();
  } else {
    if (result.theme !== theme || result.cssSha256 !== cssSha256 || !result.translucentBefore) throw new Error(`${out} was not prepared for ${theme} with this theme.css (prep first)`);
    if ("status" in result) throw new Error(`${out} already holds a full-screen run (${result.status}); use a new file`);
    const l = await loaded();
    if (!sameTheme(l)) throw new Error(`the loaded theme changed since prep: ${JSON.stringify(l)}`);
    // The environment the run is for, in prep's record and in the live window.
    const want = { app: process.env.G4_EXPECT_APP, electron: process.env.G4_EXPECT_ELECTRON };
    if (!want.app || !want.electron) throw new Error("set G4_EXPECT_APP and G4_EXPECT_ELECTRON");
    const live = await E(`(() => ({ app: window.require("electron").ipcRenderer.sendSync("version"), electron: (/Electron\\/([\\d.]+)/.exec(navigator.userAgent) || [])[1] }))()`);
    for (const [k, v] of Object.entries(want)) if (result.environment?.[k] !== v || live[k] !== v) throw new Error(`${k} is ${result.environment?.[k]} in prep and ${live[k]} now, not ${v}`);
    const unread = ["opaque", "translucentBefore"].flatMap((s) => Object.keys(SURFACES).filter((k) => !result[s].values[k]).map((k) => `${s}.${k}`));
    if (unread.length) throw new Error(`surfaces not read in prep: ${unread.join(", ")}`);
    const pre = await state();
    if (pre.isFullScreen || pre.isFullscreenClass) throw new Error(`the window is already in full screen: ${JSON.stringify(pre)}`);
    const spacesBefore = spaces();
    if (spacesBefore.error) throw new Error(`cannot read the Spaces: ${spacesBefore.error}`);
    const run = { expected: want, live, stateBefore: pre, spacesBefore, fullscreenRequestedAt: new Date().toISOString() };
    let error = null;
    try {
      await E("(() => { electronWindow.setFullScreen(true); return 1; })()");
      let ok = false;
      for (let i = 0; i < 60 && !ok; i++) { await sleep(500); ok = await E('(() => electronWindow.isFullScreen() && document.body.classList.contains("is-fullscreen"))()').catch(() => false); }
      run.enteredFullScreen = ok;
      if (!ok) throw new Error("did not enter full screen within 30 s");
      await sleep(1500);
      run.during = await read();
    } catch (e) {
      error = e;
    } finally {
      // Always leave, even after an error: ask, wait, then read the window state and the Spaces.
      run.exitRequestedAt = new Date().toISOString();
      await E("(() => { electronWindow.setFullScreen(false); return 1; })()").catch((e) => { error ??= e; });
      let left = false;
      for (let i = 0; i < 60 && !left; i++) { await sleep(500); left = await E('(() => !electronWindow.isFullScreen() && !document.body.classList.contains("is-fullscreen"))()').catch(() => false); }
      run.leftFullScreen = left;
      await sleep(2000);
      if (!error) run.after = await read().catch((e) => { error = e; return null; });
      run.stateAfterExit = await state().catch((e) => ({ error: String(e.message ?? e) }));
      // macOS may update the Spaces record a little after the exit: read again for up to 10 s.
      const same = (a) => JSON.stringify(a) === JSON.stringify(run.spacesBefore);
      run.spacesAfterExit = spaces();
      for (let i = 0; i < 10 && !same(run.spacesAfterExit); i++) { await sleep(1000); run.spacesAfterExit = spaces(); }
      run.spacesRestored = same(run.spacesAfterExit);
      run.fullscreenEndedAt = new Date().toISOString();
    }
    if (!error && run.leftFullScreen && run.after && run.spacesRestored && run.stateAfterExit.isFullScreen === false && run.stateAfterExit.isFullscreenClass === false) {
      Object.assign(result, run, { status: "COMPLETE" });
    } else {
      result.status = run.leftFullScreen ? "ABORTED" : "STUCK";
      result.failedRun = { ...run, error: error ? String(error.message ?? error) : run.spacesRestored ? null : "the Spaces by type differ from before" };
      exitCode = run.leftFullScreen ? 1 : 3;
    }
  }
} finally {
  release();
  fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
}
if (phase === "prep") console.log(JSON.stringify(result.translucentBefore?.classes), result.environment, result.loadedTheme);
else console.log(result.status, { entered: (result.failedRun ?? result).enteredFullScreen, left: (result.failedRun ?? result).leftFullScreen, spacesBefore: (result.failedRun ?? result).spacesBefore, spacesAfterExit: (result.failedRun ?? result).spacesAfterExit, error: result.failedRun?.error });
if (result.status === "STUCK") console.error("STUCK: the window may still be in full screen. Tell the user; check Mission Control; stop the isolated instance.");
process.exit(exitCode);

// G4 (research/14 §6.67.4): Solarized Dark in a real macOS full screen of the isolated Obsidian (9333).
//   node g4.mjs <repo> <vault> <out.json> prep   install SD, read the surfaces opaque and translucent
//   node g4.mjs <repo> <vault> <out.json> full   setFullScreen(true), read, setFullScreen(false), read
import fs from "node:fs";
import path from "node:path";
const [repo, vault, out, phase] = process.argv.slice(2);
const { evaluate, holdFocus } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E = (expr, t) => evaluate(9333, expr, t);
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
const result = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
const release = await holdFocus(9333);
try {
  if (phase === "prep") {
    for (let i = 0; i < 80 && !(await E("(() => !!(window.app && app.workspace.layoutReady))()").catch(() => false)); i++) await sleep(500);
    const css = fs.readFileSync(path.join(repo, "dist/solarized-dark/theme.css"), "utf8");
    const dir = path.join(vault, ".obsidian/themes/G4 solarized-dark"); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: "G4 solarized-dark", version: "0.0.0", minAppVersion: "1.14.4", author: "g4" }));
    fs.writeFileSync(path.join(dir, "theme.css"), css);
    result.environment = await E(`(async () => { await app.customCss.readThemes(); for (let i = 0; i < 20; i++) { app.customCss.setTheme("G4 solarized-dark"); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 300)); if (app.customCss.styleEl.textContent.length === ${css.length}) break; }
      // Both docks open, the outline in the right one, as the runtime checks' default state.
      app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand();
      const outline = app.workspace.getLeavesOfType("outline")[0]; if (outline) app.workspace.revealLeaf(outline);
      await new Promise((r) => setTimeout(r, 800));
      return { app: window.require("electron").ipcRenderer.sendSync("version"), electron: (/Electron\\/([\\d.]+)/.exec(navigator.userAgent) || [])[1], frame: window.require("electron").ipcRenderer.sendSync("frame") || "hidden", themeLength: app.customCss.styleEl.textContent.length, built: ${css.length} }; })()`);
    await E("(() => { app.customCss.setTranslucency(false); return 1; })()"); await sleep(1500);
    result.opaque = await read();
    await E("(() => { app.customCss.setTranslucency(true); return 1; })()"); await sleep(1500);
    result.translucentBefore = await read();
  } else if (phase === "full") {
    result.spacesBefore = process.env.SPACES_BEFORE ? JSON.parse(process.env.SPACES_BEFORE) : null;
    result.fullscreenRequestedAt = new Date().toISOString();
    await E("(() => { electronWindow.setFullScreen(true); return 1; })()");
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await sleep(500); ok = await E('(() => electronWindow.isFullScreen() && document.body.classList.contains("is-fullscreen"))()').catch(() => false); }
    await sleep(1500);
    result.during = await read();
    result.enteredFullScreen = ok;
    await E("(() => { electronWindow.setFullScreen(false); return 1; })()");
    let left = false;
    for (let i = 0; i < 60 && !left; i++) { await sleep(500); left = await E('(() => !electronWindow.isFullScreen() && !document.body.classList.contains("is-fullscreen"))()').catch(() => false); }
    await sleep(2000);
    result.after = await read();
    result.leftFullScreen = left;
    result.fullscreenEndedAt = new Date().toISOString();
  }
} finally {
  release();
  fs.writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
}
console.log(JSON.stringify(result[phase === "prep" ? "translucentBefore" : "after"]?.classes), phase === "full" ? { entered: result.enteredFullScreen, left: result.leftFullScreen } : result.environment);

// Native-capture setup (isolated test vault only). Caller injects window.__CAP = { theme, translucent } and,
// for Markdown captures (step 6), optionally note (file path), view ("source" | "live" | "reading") and
// scrollTo (text of the line to scroll to the top).
// Same layout and geometry as V-04 (research/evidence/phase2-v04/tools/obsidian-setup.js): sample note,
// File Explorer left, Outline right, docks 260 pt, window 1200x700 pt at (400, 250) -- the geometry of the
// Inkdrop V-32 captures. Additionally selects the built theme (dist/<theme>, copied by capture-obsidian.sh).
(async () => {
  const { theme, translucent, note, view, scrollTo } = window.__CAP;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ws = app.workspace;
  await app.customCss.readThemes();
  let last = -1;
  for (let i = 0; i < 20; i++) {
    if (app.customCss.theme !== theme) app.customCss.setTheme(theme);
    await app.customCss.loadTheme();
    await sleep(300);
    const len = app.customCss.styleEl.textContent.length;
    if (app.customCss.theme === theme && len > 0 && len === last) break;
    last = len;
  }
  await ws.openLinkText("Sample note", "", false);
  if (note) {
    const st = view === "reading" ? { mode: "preview" } : { mode: "source", source: view === "source" };
    await ws.getLeaf(false).setViewState({ type: "markdown", state: { file: note, ...st }, active: true });
  }
  ws.leftSplit.expand();
  ws.rightSplit.expand();
  const fe = ws.getLeavesOfType("file-explorer")[0];
  if (fe) ws.revealLeaf(fe);
  let outline = ws.getLeavesOfType("outline")[0];
  if (!outline) {
    outline = ws.getRightLeaf(false);
    await outline.setViewState({ type: "outline" });
  }
  ws.revealLeaf(outline);
  ws.leftSplit.setSize(260);
  ws.rightSplit.setSize(260);
  app.customCss.setTranslucency(!!translucent);
  // No selection highlight in the captures.
  const ed = ws.activeEditor?.editor;
  if (ed) { ed.setCursor({ line: 0, ch: 0 }); ed.blur?.(); }
  electronWindow.setBounds({ x: 400, y: 250, width: 1200, height: 700 });
  await sleep(800);
  if (note && scrollTo) {
    const v = ws.activeLeaf.view;
    const line = Math.max(0, v.editor.getValue().split("\n").findIndex((l) => l.includes(scrollTo)));
    if (v.getMode() === "preview") {
      v.previewMode.applyScroll(line);
    } else {
      // Put the line at the top of the editor: scroll to the top of its block.
      const cm = v.editor.cm;
      v.editor.scrollTo(null, cm.lineBlockAt(cm.state.doc.line(line + 1).from).top);
    }
    await sleep(600);
  }
  // Re-apply the dock widths after the window has its final size (they can be lost if set earlier).
  ws.leftSplit.setSize(260);
  ws.rightSplit.setSize(260);
  await sleep(400);
  const width = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().width ?? -1);
  return {
    theme: app.customCss.theme,
    themeCssLength: app.customCss.styleEl.textContent.length,
    isTranslucent: document.body.classList.contains("is-translucent"),
    bounds: electronWindow.getBounds(),
    dockWidths: [width(".workspace-split.mod-left-split"), width(".workspace-split.mod-right-split")],
    electron: (/Electron\/([\d.]+)/.exec(navigator.userAgent) || [])[1] ?? null,
    appVersion: window.require("electron").ipcRenderer.sendSync("version"),
  };
})();

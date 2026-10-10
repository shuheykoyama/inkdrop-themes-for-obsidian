// V-04 diagnostic setup (isolated test vault only). Caller injects window.__V04 = { translucent: bool }.
// Opens the sample note, shows File Explorer (left) and Outline (right), fixes the dock widths and
// places the window at 1200x700 pt, (400, 250) -- the same geometry as the Inkdrop V-32 captures.
(async () => {
  const { translucent } = window.__V04;
  const ws = app.workspace;
  await ws.openLinkText("Sample note", "", false);
  ws.leftSplit.expand();
  ws.rightSplit.expand();
  const fe = ws.getLeavesOfType("file-explorer")[0];
  if (fe) ws.revealLeaf(fe);
  let outline = ws.getLeavesOfType("outline")[0];
  if (!outline) {
    const leaf = ws.getRightLeaf(false);
    await leaf.setViewState({ type: "outline" });
    outline = leaf;
  }
  ws.revealLeaf(outline);
  // Fixed dock widths so every capture samples the same areas.
  ws.leftSplit.setSize(260);
  ws.rightSplit.setSize(260);
  // Translucency is a per-vault setting of the isolated test vault (app.customCss.setTranslucency).
  app.customCss.setTranslucency(!!translucent);
  // Collapse the editor selection and put the cursor at the start (no selection highlight in captures).
  const ed = ws.activeEditor?.editor;
  if (ed) { ed.setCursor({ line: 0, ch: 0 }); ed.blur?.(); }
  electronWindow.setBounds({ x: 400, y: 250, width: 1200, height: 700 });
  await new Promise((r) => setTimeout(r, 800));
  return {
    translucencyConfig: app.vault.getConfig("translucency"),
    isTranslucent: document.body.classList.contains("is-translucent"),
    bounds: electronWindow.getBounds(),
    left: fe ? fe.view.containerEl.getBoundingClientRect().width : null,
    activeFile: ws.getActiveFile()?.path ?? null,
  };
})();

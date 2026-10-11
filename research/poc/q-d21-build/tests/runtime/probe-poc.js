// T3 probe (runs inside the isolated Obsidian, test vault only). Caller injects
// window.__POC = { translucent: bool, settingsModal: bool }.
// Reloads the theme from disk, sets the layout and translucency, and returns computed backgrounds.
(async () => {
  const { translucent, settingsModal } = window.__POC;
  const ws = app.workspace;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await app.customCss.loadTheme();
  await ws.openLinkText("Sample note", "", false);
  ws.leftSplit.expand();
  ws.rightSplit.expand();
  const fe = ws.getLeavesOfType("file-explorer")[0];
  if (fe) ws.revealLeaf(fe);
  let outline = ws.getLeavesOfType("outline")[0];
  if (!outline) { outline = ws.getRightLeaf(false); await outline.setViewState({ type: "outline" }); }
  ws.revealLeaf(outline);
  app.customCss.setTranslucency(!!translucent);
  await sleep(600);
  const bg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null; };
  const L = ".workspace-split.mod-left-split";
  const R = ".workspace-split.mod-right-split";
  const M = ".workspace-split.mod-root";
  const out = {
    bodyClasses: [...document.body.classList],
    accentH: getComputedStyle(document.body).getPropertyValue("--accent-h").trim(),
    bodyBackgroundPrimary: getComputedStyle(document.body).getPropertyValue("--background-primary").trim(),
    regions: {
      "app-container": bg(".app-container"),
      ribbon: bg(".workspace-ribbon.mod-primary"),
      "left tab strip": bg(`${L} .workspace-tab-header-container`),
      "left leaf": bg(`${L} .workspace-leaf:has(> [data-type="file-explorer"])`),
      "left leaf-content": bg(`${L} .workspace-leaf-content[data-type="file-explorer"]`),
      "right tab strip": bg(`${R} .workspace-tab-header-container`),
      "right leaf": bg(`${R} .workspace-leaf:has(> [data-type="outline"])`),
      "right leaf-content": bg(`${R} .workspace-leaf-content[data-type="outline"]`),
      "centre tab strip": bg(`${M} .workspace-tab-header-container`),
      "centre active tab": bg(`${M} .workspace-tab-header.is-active`),
      "centre leaf-content": bg(`${M} .workspace-leaf-content`),
      "view header": bg(`${M} .view-header`),
      "centre editor": bg(`${M} .view-content`),
      "status bar": bg(".status-bar"),
    },
  };
  if (settingsModal) {
    // Leak check: a modal outside the centre split must keep the opaque editor colour.
    app.setting.open();
    await sleep(600);
    out.regions["settings modal"] = bg(".modal.mod-settings");
    app.setting.close();
    await sleep(300);
  }
  return out;
})();

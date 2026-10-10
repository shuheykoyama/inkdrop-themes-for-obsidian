// Diagnostic setup (test vault only): open the sample note, expand both side docks,
// show File Explorer on the left and Outline on the right, select a file in the explorer.
(async () => {
  const ws = app.workspace;
  await ws.openLinkText("Sample note", "", false);
  ws.leftSplit.expand();
  ws.rightSplit.expand();
  // Make sure the File Explorer is the active tab of the left dock.
  const fe = ws.getLeavesOfType("file-explorer")[0];
  if (fe) ws.revealLeaf(fe);
  // Put an Outline view into the right dock.
  let outline = ws.getLeavesOfType("outline")[0];
  if (!outline) {
    const leaf = ws.getRightLeaf(false);
    await leaf.setViewState({ type: "outline" });
    outline = leaf;
  }
  ws.revealLeaf(outline);
  // Expand "Folder A" in the explorer so folder and file rows are both visible.
  const view = fe?.view;
  const folder = app.vault.getAbstractFileByPath("Folder A");
  if (view && folder) view.revealInFolder(app.vault.getAbstractFileByPath("Folder A/In folder.md"));
  await new Promise((r) => setTimeout(r, 500));
  return {
    left: ws.leftSplit.collapsed === false,
    right: ws.rightSplit.collapsed === false,
    activeFile: ws.getActiveFile()?.path ?? null,
    leftLeafTypes: ws.leftSplit.children.flatMap((t) => t.children.map((l) => l.view.getViewType())),
    rightLeafTypes: ws.rightSplit.children.flatMap((t) => t.children.map((l) => l.view.getViewType())),
  };
})();

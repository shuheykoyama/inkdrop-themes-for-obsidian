// Diagnostic setup (test vault only): show line numbers and place the cursor so .cm-active exists.
(() => {
  app.vault.setConfig("showLineNumber", true);
  const leaf = app.workspace.getLeavesOfType("markdown")[0];
  app.workspace.setActiveLeaf(leaf, { focus: true });
  leaf.view.editor.setCursor({ line: 12, ch: 2 });
  leaf.view.editor.focus();
  return "ok";
})();

// Phase 2B (approved by the user): switch the sidebar to the workspace of the test notebook,
// show its notes and open the sample note, so screenshots contain only test data.
// The test notebook / note IDs are injected by the caller through window.__P2B_IDS.
(async () => {
  const { bookId, noteId } = window.__P2B_IDS;
  const ex = inkdrop.getExports();
  const dispatch = inkdrop.store.dispatch;
  // Same sequence the app itself runs for "Show in workspace".
  await dispatch(ex.actions.sidebar.showWorkspace(bookId));
  await dispatch(ex.actions.sidebar.updateWorkspace(bookId));
  inkdrop.commands.dispatch(document.body, "core:note-list-show-notes-in-book", { bookId, includeChildren: true, selectFirstNote: false });
  await new Promise((r) => setTimeout(r, 500));
  inkdrop.commands.dispatch(document.body, "core:open-note", { noteId });
  await new Promise((r) => setTimeout(r, 1200));
  const s = inkdrop.store.getState();
  return {
    workspaceVisible: s.sidebar.workspace.visible,
    workspaceIsTestBook: s.sidebar.workspace.bookId === bookId,
    editingIsTestNote: s.editingNote?._id === noteId,
    theme: inkdrop.config.get("core.theme"),
  };
})();

// Phase 2B: restore the user's Inkdrop to the state recorded before the validation.
// The recorded state is injected by the caller through window.__P2B_RESTORE:
//   { ids: { bookId, noteId }, before: { theme, editingNoteId, workspace: { visible, bookId } } }
// Deletes ONLY the test note and test notebook created by inkdrop-create-test-note.js.
(async () => {
  const { ids, before } = window.__P2B_RESTORE;
  const db = inkdrop.localDB;
  const ex = inkdrop.getExports();
  const dispatch = inkdrop.store.dispatch;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = {};
  // 1. editor settings back to the recorded values (both false, Inkdrop's defaults)
  inkdrop.config.set("editor.lineNumbers", false);
  inkdrop.config.set("editor.styleActiveLine", false);
  // 2. leave the test workspace and the test note
  if (!before.workspace.visible) {
    await dispatch(ex.actions.sidebar.hideWorkspace());
    await dispatch(ex.actions.sidebar.unloadWorkspace());
  }
  inkdrop.commands.dispatch(document.body, "core:note-list-show-all-notes");
  await sleep(500);
  // 3. delete the test note, then the test notebook (exact IDs only)
  const note = await db.notes.get(ids.noteId).catch(() => null);
  if (note && note.bookId === ids.bookId && note.title === "Sample note") { await db.notes.remove(ids.noteId); log.noteRemoved = true; }
  const book = await db.books.get(ids.bookId).catch(() => null);
  if (book && book.name === "Theme Validation (Phase 2B)") { await db.books.remove(ids.bookId); log.bookRemoved = true; }
  // 4. theme and acrylic back to the recorded values
  inkdrop.config.set("core.theme", before.theme);
  inkdrop.config.set("core.mainWindow.acrylicEnabled", true);
  await sleep(1000);
  // 5. re-open the note that was open before (navigation only)
  if (before.editingNoteId) inkdrop.commands.dispatch(document.body, "core:open-note", { noteId: before.editingNoteId });
  await sleep(500);
  return {
    ...log,
    theme: inkdrop.config.get("core.theme"),
    acrylicEnabled: inkdrop.config.get("core.mainWindow.acrylicEnabled"),
    lineNumbers: inkdrop.config.get("editor.lineNumbers"),
    styleActiveLine: inkdrop.config.get("editor.styleActiveLine"),
    workspaceVisible: inkdrop.store.getState().sidebar.workspace.visible,
    reopenedPreviousNote: inkdrop.store.getState().editingNote?._id === before.editingNoteId,
    testNoteStillExists: !!(await db.notes.get(ids.noteId).catch(() => null)),
    testBookStillExists: !!(await db.books.get(ids.bookId).catch(() => null)),
  };
})();

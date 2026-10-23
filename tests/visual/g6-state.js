// Step 11G G6 (research/14 §6.95): put the isolated Inkdrop's editor into one V-35 state. Caller sets
// window.__G6 = { noteId, state: "active" | "search" | "code", line, word }. Only view state changes: the note
// is opened, the cursor or the search query is set through CodeMirror; no transaction changes the document.
// Every state starts from a cleared search (empty query, panel closed), so a search of an earlier state never
// carries over (§6.117); the result reports what is highlighted, for g6-judge.py to check.
(async () => {
  const { noteId, state, line, word } = window.__G6;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (inkdrop.store.getState().editingNote?._id !== noteId) {
    inkdrop.commands.dispatch(document.body, "core:open-note", { noteId });
    await sleep(1200);
  }
  const preview = document.querySelector(".mde-preview");
  if (preview && preview.getBoundingClientRect().width > 0) { inkdrop.commands.dispatch(document.body, "view:toggle-preview"); await sleep(500); }
  inkdrop.commands.dispatch(document.body, "editor:focus");
  await sleep(300);
  const cm = inkdrop.getExports()["@codemirror"];
  const view = cm.view.EditorView.findFromDOM(document.querySelector(".cm-editor"));
  const before = view.state.doc.toString();
  const ln = view.state.doc.line(line);
  // Cursor on the line, nothing selected (the start of the first word, so it is visibly inside the line).
  const at = ln.from + Math.max(0, ln.text.search(/\S/));
  view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
  let search = null;
  const s = cm.search;
  if (!s?.setSearchQuery || !s?.SearchQuery) search = "CodeMirror search API not exported";
  else {
    // Clear whatever an earlier state searched for.
    view.dispatch({ effects: s.setSearchQuery.of(new s.SearchQuery({ search: "" })) });
    s.closeSearchPanel?.(view);
  }
  if (state === "search" && !search) {
    s.openSearchPanel?.(view);
    view.dispatch({ effects: s.setSearchQuery.of(new s.SearchQuery({ search: word })) });
    // Back on the line: the panel takes the focus.
    view.dispatch({ selection: { anchor: at } });
    view.focus();
  }
  view.focus();
  await sleep(700);
  const sel = view.state.selection.main;
  return {
    state, line, docUnchanged: view.state.doc.toString() === before, selectionEmpty: sel.empty, cursorLine: view.state.doc.lineAt(sel.head).number,
    searchMatches: document.querySelectorAll(".cm-searchMatch").length, searchError: search,
    searchPanelOpen: !!document.querySelector(".cm-panel.cm-search"),
    selectionMatches: document.querySelectorAll(".cm-selectionMatch").length,
    activeLineHasMatch: !!document.querySelector(".cm-activeLine .cm-searchMatch"),
    activeLineClasses: [...(document.querySelector(".cm-activeLine")?.classList ?? [])],
  };
})();

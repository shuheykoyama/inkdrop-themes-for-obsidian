// Step 11G G6 (research/14 §6.95): put the isolated Inkdrop's editor into one V-35 state. Caller sets
// window.__G6 = { noteId, state: "active" | "search" | "code", line, word }. Only view state changes: the note
// is opened, the cursor or the search query is set through CodeMirror; no transaction changes the document.
// Every state starts from a cleared search (Inkdrop's find bar closed with editor:clear-find, the query emptied),
// so a search of an earlier state never carries over (§6.117). The search state is made the way a user makes it in
// Inkdrop 6.2.0 (§6.117): editor:find opens Inkdrop's own find bar (.mde-search-bar) and the word is typed into
// its input, which sets the query and highlights the matches without moving the cursor (typing calls no
// find-next). The result reports what is highlighted and whether the find bar shows, for g6-judge.py.
(async () => {
  const { noteId, state, line, word } = window.__G6;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The find input of Inkdrop's find bar (the first input of the bar; the replace input shows only when replacing).
  const findInput = () => document.querySelector(".mde-search-bar .field-find-input input, .mde-search-bar .field-find input") ?? document.querySelector(".mde-search-bar input");
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
  const target = document.querySelector(".cm-content") ?? document.body;
  if (!s?.setSearchQuery || !s?.SearchQuery) search = "CodeMirror search API not exported";
  else {
    // Clear whatever an earlier state searched for: Inkdrop's find bar, then the query itself.
    if (document.querySelector(".mde-search-bar")) { inkdrop.commands.dispatch(target, "editor:clear-find", { focus: true }); await sleep(400); }
    view.dispatch({ effects: s.setSearchQuery.of(new s.SearchQuery({ search: "" })) });
    s.closeSearchPanel?.(view);
  }
  view.focus();
  if (state === "search" && !search) {
    // Inkdrop's find bar, as Cmd+F opens it, and the word typed into its input (a React input: the value is set
    // through the native setter and an input event, as typing does).
    inkdrop.commands.dispatch(target, "editor:find");
    await sleep(500);
    const input = findInput();
    if (!input) search = "Inkdrop's find bar or its input did not appear";
    else {
      // Emptied first: the find bar keeps its text after editor:clear-find, and React ignores an input event whose
      // value equals the text it holds, so typing the same word again would set no query.
      const type = (v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v); input.dispatchEvent(new Event("input", { bubbles: true })); };
      type("");
      await sleep(200);
      type(word);
    }
  } else view.focus();
  await sleep(700);
  const sel = view.state.selection.main;
  return {
    state, line, docUnchanged: view.state.doc.toString() === before, selectionEmpty: sel.empty, cursorLine: view.state.doc.lineAt(sel.head).number,
    searchMatches: document.querySelectorAll(".cm-searchMatch").length, searchError: search,
    searchPanelOpen: !!document.querySelector(".cm-panel.cm-search"),
    findBarOpen: !!document.querySelector(".mde-search-bar"),
    findBarText: findInput()?.value ?? null,
    selectionMatches: document.querySelectorAll(".cm-selectionMatch").length,
    activeLineHasMatch: !!document.querySelector(".cm-activeLine .cm-searchMatch"),
    activeLineClasses: [...(document.querySelector(".cm-activeLine")?.classList ?? [])],
  };
})();

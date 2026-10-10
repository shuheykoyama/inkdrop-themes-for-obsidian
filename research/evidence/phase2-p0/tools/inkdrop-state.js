// Phase 2B: put the test note view into one of the documented states (window.__P2B_STATE).
// Only view state changes (focus, cursor, preview); no note content is modified.
//   "editor"    : editor focused, a word selected on the paragraph line (selection + active line)
//   "notelist"  : note list focused (5px accent bar of the selected item)
//   "preview"   : preview mode
//   "reset"     : back to editor mode, editor focused
(async () => {
  const state = window.__P2B_STATE;
  const cmd = (name, detail) => inkdrop.commands.dispatch(document.body, name, detail);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const inPreview = () => !!document.querySelector(".mde-preview") && document.querySelector(".mde-preview").getBoundingClientRect().width > 0;
  if (state !== "preview" && inPreview()) { cmd("view:toggle-preview"); await sleep(500); }
  if (state === "editor" || state === "reset") {
    cmd("editor:focus");
    await sleep(300);
    const { EditorView } = inkdrop.getExports()["@codemirror"].view;
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
    // Select the word "bold" in the paragraph (search the document text; nothing is edited).
    const text = view.state.doc.toString();
    const at = text.indexOf("bold");
    if (state === "editor" && at >= 0) view.dispatch({ selection: { anchor: at, head: at + 4 }, scrollIntoView: true });
    // "reset" clears any selection left by a previous state (cursor at the start of the document).
    if (state === "reset") view.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
    view.focus();
  } else if (state === "notelist") {
    cmd("core:focus-note-list-bar");
  } else if (state === "preview") {
    if (!inPreview()) cmd("view:toggle-preview");
  }
  await sleep(700);
  return { state, activeElement: document.activeElement?.className?.toString().slice(0, 60) ?? null, preview: inPreview() };
})();

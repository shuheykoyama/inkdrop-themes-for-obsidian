// Phase 2B: put line numbers and active-line styling back to Inkdrop's defaults (false), which are
// also the user's recorded settings. Used at the start of each capture and in the final restore.
(() => {
  inkdrop.config.set("editor.lineNumbers", false);
  inkdrop.config.set("editor.styleActiveLine", false);
  return { lineNumbers: inkdrop.config.get("editor.lineNumbers"), styleActiveLine: inkdrop.config.get("editor.styleActiveLine") };
})();

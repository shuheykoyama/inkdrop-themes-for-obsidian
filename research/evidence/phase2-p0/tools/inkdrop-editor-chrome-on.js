// Phase 2B (approved by the user): temporarily enable line numbers and active-line styling so the
// CodeMirror chrome variables can be observed. Both are false by default in Inkdrop 6.1.5 and in the
// user's settings; they are set back to false at the end of the validation (inkdrop-restore.js).
(() => {
  inkdrop.config.set("editor.lineNumbers", true);
  inkdrop.config.set("editor.styleActiveLine", true);
  return { lineNumbers: inkdrop.config.get("editor.lineNumbers"), styleActiveLine: inkdrop.config.get("editor.styleActiveLine") };
})();

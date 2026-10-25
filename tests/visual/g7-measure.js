// Step 11G G7-1 (research/14 §6.125): read-only measurement of the syntax colours Inkdrop renders for the
// temporary verification note, in one view. Caller sets window.__G7 = { noteId, view: "editor" | "preview",
// blocks: [{ lang, code, start }] (tests/visual/g7-rules.mjs blocks()), vars: ["--syntax-…-color", …] }.
// Only view state changes (the note is opened, the view toggled, the editor scrolled); no transaction changes the
// document. Each block is scrolled into view and measured once its text is shown and its highlighting stays the
// same between two reads, so a block outside the viewport or still being highlighted is not measured half done.
// For every text node inside a block: its block offsets, the classes of the elements around it (inside the line or
// the code element) and the computed colour of its parent. The judgement is in g7-rules.mjs (judgeBlocks).
(async () => {
  const { noteId, view: mode, blocks, vars } = window.__G7;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const shown = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  if (inkdrop.store.getState().editingNote?._id !== noteId) {
    inkdrop.commands.dispatch(document.body, "core:open-note", { noteId });
    for (let i = 0; i < 40 && inkdrop.store.getState().editingNote?._id !== noteId; i++) await sleep(250);
    await sleep(800);
  }
  if (inkdrop.store.getState().editingNote?._id !== noteId) return { mode, error: "the note did not open" };
  // The wanted view: the editor alone (preview hidden) or the preview shown.
  const previewShown = () => shown(document.querySelector(".mde-preview"));
  const editorShown = () => shown(document.querySelector(".cm-editor"));
  if ((mode === "editor" && previewShown()) || (mode === "preview" && !previewShown())) { inkdrop.commands.dispatch(document.body, "view:toggle-preview"); await sleep(800); }
  if (mode === "editor" ? !editorShown() || previewShown() : !previewShown()) return { mode, error: `the ${mode} view could not be shown` };

  const cmx = inkdrop.getExports()["@codemirror"];
  const cmView = editorShown() ? cmx.view.EditorView.findFromDOM(document.querySelector(".cm-editor")) : null;
  const docBefore = cmView?.state.doc.toString() ?? null;
  // The classes of the elements from `node` up to (not including) `stop`, innermost first, and the parent's colour.
  const around = (node, stop) => {
    const els = [];
    for (let e = node.parentElement; e && e !== stop; e = e.parentElement) els.push([...e.classList].join(" "));
    return { cls: els.filter(Boolean).join(" < "), color: getComputedStyle(node.parentElement).color };
  };
  // One read of a block: { text, ranges } or null when it is not all in the DOM.
  const readEditor = (b) => {
    const doc = cmView.state.doc;
    const first = doc.lineAt(b.start), last = doc.lineAt(b.start + b.code.length);
    const ranges = [];
    for (let n = first.number; n <= last.number; n++) {
      const line = doc.line(n);
      const at = cmView.domAtPos(line.from);
      const el = (at.node.nodeType === 1 ? at.node : at.node.parentElement)?.closest(".cm-line");
      if (!el || !cmView.visibleRanges.some((v) => v.from <= line.from && line.to <= v.to)) return null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.nodeValue) continue;
        let pos;
        try { pos = cmView.posAtDOM(t, 0); } catch { return null; }
        const from = pos - b.start, to = from + t.nodeValue.length;
        if (to <= 0 || from >= b.code.length) continue;
        ranges.push({ from, to, text: t.nodeValue, ...around(t, el) });
      }
    }
    return { text: doc.sliceString(b.start, b.start + b.code.length), ranges };
  };
  const codes = () => [...document.querySelectorAll(".mde-preview pre > code")];
  const readPreview = (i) => {
    const el = codes()[i];
    if (!el) return null;
    const ranges = [];
    let off = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const len = t.nodeValue.length;
      if (len) ranges.push({ from: off, to: off + len, text: t.nodeValue, ...around(t, el) });
      off += len;
    }
    // The preview keeps the block's final newline; the note's block text has none.
    return { text: el.textContent.replace(/\n$/, ""), ranges: ranges.map((r) => ({ ...r, to: Math.min(r.to, el.textContent.replace(/\n$/, "").length) })).filter((r) => r.from < r.to), lang: [...el.classList].join(" ") };
  };
  const out = [];
  for (const [i, b] of blocks.entries()) {
    let last = null, got = null;
    // Up to 20 reads: scrolled into view, then two equal reads in a row (the highlighting has settled).
    for (let k = 0; k < 20; k++) {
      if (cmView && mode === "editor") cmView.dispatch({ effects: cmx.view.EditorView.scrollIntoView(b.start, { y: "start" }) });
      else codes()[i]?.scrollIntoView({ block: "start" });
      await frames();
      await sleep(k ? 250 : 100);
      const r = mode === "editor" ? readEditor(b) : readPreview(i);
      const key = r && JSON.stringify(r);
      if (r && key === last) { got = r; break; }
      last = key;
    }
    out.push(got ? { index: i, lang: b.lang, ...got } : { index: i, lang: b.lang, error: "not shown or the highlighting did not settle" });
  }
  // The colour each --syntax-* variable gives in this view (a probe span inside the view's own scope). In the
  // editor the probe goes into .cm-editor, never into .cm-content: CodeMirror reads changes there as edits.
  const host = mode === "editor" ? cmView?.dom : document.querySelector(".mde-preview");
  const varColors = {};
  if (host) {
    const probe = document.createElement("span");
    host.appendChild(probe);
    for (const v of vars) { probe.style.color = `var(${v})`; varColors[v] = getComputedStyle(probe).color; }
    probe.remove();
  }
  return {
    mode, measuredAt: new Date().toISOString(), theme: inkdrop.config.get("core.theme"), inkdropVersion: inkdrop.appVersion ?? null,
    docUnchanged: cmView ? cmView.state.doc.toString() === docBefore : null, previewCodeBlocks: codes().length, blocks: out, varColors,
  };
})();

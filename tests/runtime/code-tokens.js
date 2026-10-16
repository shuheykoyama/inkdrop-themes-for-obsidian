// Code token dump: runs inside the ISOLATED Obsidian (test vault only), after
// `window.__CODE = { note, vars: ["--ink-syntax-…", …] }`, with the theme already applied (V-12, step 8).
// Opens `note` in Source mode, Live Preview and Reading view in the active leaf and reports, for each fenced
// code block, the text ranges with their elements' classes and the computed colour, font style and weight;
// offsets are relative to the block body, as in tests/visual/inkdrop-tokens.mjs. Also resolves `vars` to
// computed colours (a span coloured with each variable). Reports what it found, never a judgement
// (tests/runtime/lib/syntax.mjs judges).
//   range: { from, to, text, els: [[classes of the innermost element], [its parent's], …], color, fontStyle, fontWeight }
// `els` stops at the line (editing views) or the <code> element (Reading view).
(async () => {
  const { note, vars } = window.__CODE;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // A tab of its own, closed at the end, so the workspace the next states measure is the one before the dump.
  const previous = app.workspace.activeLeaf;
  const leaf = app.workspace.getLeaf("tab");
  const text = await app.vault.adapter.read(note);
  // Fenced blocks: language, first and last body line (0-based).
  const lines = text.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(\w+)$/);
    if (!m) continue;
    const end = lines.indexOf("```", i + 1);
    blocks.push({ lang: m[1], first: i + 1, last: end - 1 });
    i = end;
  }
  // Ranges of the text nodes under `root` (offsets from `offset`); returns the offset after the last one.
  const walk = (root, offset, out) => {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let pos = offset;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = n.nodeValue;
      if (!t.length) continue;
      const els = [];
      for (let e = n.parentElement; e && e !== root; e = e.parentElement) els.push([...e.classList]);
      const cs = getComputedStyle(n.parentElement);
      out.push({ from: pos, to: pos + t.length, text: t, els, color: cs.color, fontStyle: cs.fontStyle, fontWeight: cs.fontWeight });
      pos += t.length;
    }
    return pos;
  };
  const views = {};
  for (const [view, state] of [["source", { mode: "source", source: true }], ["live", { mode: "source", source: false }], ["reading", { mode: "preview" }]]) {
    await leaf.setViewState({ type: "markdown", state: { file: note, ...state }, active: true });
    await sleep(800);
    const v = leaf.view;
    views[view] = [];
    const used = new Set();
    for (const b of blocks) {
      const ranges = [];
      let error = null;
      if (view === "reading") {
        // Reading view renders lazily: scroll to the block, then take the first not yet used <code> of its language.
        v.currentMode.applyScroll(b.first);
        await sleep(500);
        const find = () => [...v.contentEl.querySelectorAll(".markdown-rendered pre > code")].find((c) => c.classList.contains(`language-${b.lang}`) && !used.has(c));
        const code = find();
        if (code) { used.add(code); walk(code, 0, ranges); } else {
          error = "code element not rendered";
          // Known instability (research/14 §6.54): seen once in 11E, cause not found. What the page looked like,
          // for tracing it if it comes back. The block stays a failure: the second look (after 1.5 s) is
          // recorded, never used.
          const present = () => [...v.contentEl.querySelectorAll(".markdown-rendered pre > code")].map((c) => [...c.classList].find((x) => x.startsWith("language-")) ?? "(none)");
          const diagnosis = { line: b.first, lang: b.lang, scroll: v.currentMode.getScroll?.() ?? null, present: present(), usedOfLang: [...used].filter((c) => c.classList.contains(`language-${b.lang}`)).length,
            sections: v.contentEl.querySelectorAll(".markdown-preview-section > div").length, visibility: document.visibilityState, focus: document.hasFocus(), leafActive: app.workspace.activeLeaf === leaf };
          await sleep(1500);
          diagnosis.foundAfter1500ms = !!find();
          diagnosis.presentAfter1500ms = present();
          error += ` ${JSON.stringify(diagnosis)}`;
        }
      } else {
        // Cursor outside the block; scroll it into view so CodeMirror draws its lines.
        v.editor.setCursor({ line: 0, ch: 0 });
        v.editor.scrollIntoView({ from: { line: b.first, ch: 0 }, to: { line: b.last, ch: 0 } }, true);
        await sleep(400);
        const cm = v.editor.cm;
        let offset = 0;
        for (let ln = b.first; ln <= b.last; ln++) {
          const { node } = cm.domAtPos(cm.state.doc.line(ln + 1).from);
          const lineEl = (node.nodeType === 1 ? node : node.parentElement).closest(".cm-line");
          if (!lineEl) { error = `line ${ln} not drawn`; break; }
          offset = walk(lineEl, offset, ranges) + 1;
        }
      }
      views[view].push({ lang: b.lang, ranges, error });
    }
  }
  leaf.detach();
  if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  await sleep(300);
  const probe = document.body.createEl("span");
  const resolved = {};
  for (const name of vars) { probe.style.color = `var(${name})`; resolved[name] = getComputedStyle(probe).color; }
  probe.remove();
  return { views, vars: resolved };
})()

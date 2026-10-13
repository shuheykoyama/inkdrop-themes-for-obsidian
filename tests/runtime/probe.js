// Runtime probe: runs inside the ISOLATED Obsidian (test vault only), injected by tests/runtime/run.mjs
// after `window.__INK = { theme, translucent, platform, state, deferMeasure, checks: [{ id, selector, pseudo, scrollTo, document, property }] }`.
// With deferMeasure the probe only prepares the state and leaves window.__INK_MEASURE() for the runner,
// which first drives a real pointer (menus, link previews, tooltips) through CDP.
// Selects the theme, prepares the layout for the platform and state, and reports for every check what was
// found, never a judgement: { found, count, displayed, size, value, error }. The judgement (and the rule
// that a missing / hidden / unreadable element can never pass a "match") lives in run.mjs.
// Layout steps reuse research/poc/q-d21-build/tests/runtime/probe-poc.js and tests/runtime.mjs.
(async () => {
  const { theme, translucent, platform, state, checks } = window.__INK;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ws = app.workspace;
  const mobile = platform !== "desktop";

  // Theme: the theme folder must be known to Obsidian before setTheme / loadTheme accept it. Right after a
  // reload (mobile emulation) Obsidian's own load of the previously selected theme can still be queued and
  // overwrite ours, so repeat until the selected theme and its stylesheet stay the same for a moment.
  await app.customCss.readThemes();
  let last = -1;
  for (let i = 0; i < 20; i++) {
    if (app.customCss.theme !== theme) app.customCss.setTheme(theme);
    await app.customCss.loadTheme();
    await sleep(300);
    const len = app.customCss.styleEl.textContent.length;
    if (app.customCss.theme === theme && len > 0 && len === last) break;
    last = len;
  }

  // Notes: "Sample note" active; on desktop also "Other note" in a second centre tab (an inactive tab).
  // After a reload (mobile emulation on / off) Obsidian restores background tabs as deferred leaves, whose
  // view has no file yet: load them, or a note that is open would look missing and be opened a second time.
  for (const l of ws.getLeavesOfType("markdown")) await l.loadIfDeferred?.();
  const leafOf = (name) => ws.getLeavesOfType("markdown").find((l) => l.view?.file?.basename === name);
  if (!leafOf("Sample note")) await ws.openLinkText("Sample note", "", false);
  if (!mobile && !leafOf("Other note")) {
    const other = ws.getLeaf("tab");
    await other.openFile(app.vault.getAbstractFileByPath("Other note.md"));
  }
  ws.setActiveLeaf(leafOf("Sample note"), { focus: true });

  if (mobile) {
    // Translucency exists on macOS desktop only: an opaque mobile probe must not run in a translucent window.
    // The runner turns it off before switching to emulation; the self-test state turns it on on purpose.
    app.customCss.setTranslucency(state === "self-test-translucent-leak");
    // Floating navigation is a vault setting (app.json floatingNavigation) applied by this method.
    app.vault.setConfig("floatingNavigation", platform !== "phone-nonfloating");
    app.updateFloatingNavigationDisplay();
    ws.leftSplit.collapse();
    ws.rightSplit.collapse();
    if (state === "left-drawer-open") ws.leftSplit.expand();
    if (state === "right-drawer-open") ws.rightSplit.expand();
  } else {
    ws.leftSplit.expand();
    ws.rightSplit.expand();
    const fe = ws.getLeavesOfType("file-explorer")[0];
    if (fe) ws.revealLeaf(fe);
    let outline = ws.getLeavesOfType("outline")[0];
    if (!outline) { outline = ws.getRightLeaf(false); await outline.setViewState({ type: "outline" }); }
    ws.revealLeaf(outline);
    ws.setActiveLeaf(leafOf("Sample note"), { focus: true });
    app.customCss.setTranslucency(!!translucent);
    // The File Explorer's leaf becomes the active one: its list "has focus" (Inkdrop's 5 px bar state).
    if (state === "file-explorer-focused" && fe) ws.setActiveLeaf(fe, { focus: true });
  }
  if (state === "user-accent") app.vault.setConfig("accentColor", "#e06c75");
  if (state === "fullscreen-class") document.body.classList.add("is-fullscreen");
  if (state === "quick-switcher-open") app.commands.executeCommandById("switcher:open");
  if (state === "user-font") app.vault.setConfig("interfaceFontFamily", "Courier New");
  // Markdown states (step 6): "Markdown elements" in the leaf of "Sample note" (restored afterwards), in one
  // view mode. The text and code fonts of md-user-fonts are the user's settings that must win (Q-D8).
  const MD_MODES = { "md-source": { mode: "source", source: true }, "md-live": { mode: "source", source: false }, "md-reading": { mode: "preview" }, "md-user-fonts": { mode: "source", source: false } };
  const mdLeaf = MD_MODES[state] ? leafOf("Sample note") : null;
  if (mdLeaf) {
    if (state === "md-user-fonts") { app.vault.setConfig("textFontFamily", "Courier New"); app.vault.setConfig("monospaceFontFamily", "Menlo"); }
    await mdLeaf.setViewState({ type: "markdown", state: { file: "Markdown elements.md", ...MD_MODES[state] }, active: true });
    ws.setActiveLeaf(mdLeaf, { focus: true });
    // Wait (up to 5 s) until the view has drawn the note: the reading view renders its sections lazily.
    const drawn = () => (mdLeaf.view.getMode() === "preview"
      ? mdLeaf.view.previewMode.containerEl.querySelectorAll(".markdown-preview-sizer h1").length > 0
      : mdLeaf.view.contentEl.querySelectorAll(".cm-content .HyperMD-header-1").length > 0);
    for (let i = 0; i < 25 && !drawn(); i++) await sleep(200);
  }
  // Editor chrome states (step 7): "Editor chrome" in the leaf of "Sample note" with line numbers on (the
  // test vault's showLineNumber; "-no-lines" turns them off), the cursor on a given line, and one action.
  // Every setting is restored afterwards.
  const ED_STATES = {
    "ed-source": { source: true, lines: true, at: "Second paragraph" },
    "ed-live": { source: false, lines: true, at: "Second paragraph" },
    "ed-source-no-lines": { source: true, lines: false, at: "Second paragraph" },
    "ed-live-no-lines": { source: false, lines: false, at: "Second paragraph" },
    "ed-code-line": { source: false, lines: true, at: "function call" },
    "ed-widget-line": { source: false, lines: true, at: "half-transparent" },
    "ed-selection": { source: true, lines: true, at: "Second paragraph", select: 6 },
    "ed-search": { source: true, lines: true, at: "Second paragraph", search: "alpha" },
    "ed-fold": { source: true, lines: true, at: "## Folded", fold: true },
    "ed-suggest": { source: true, lines: true, at: "Last line." },
  };
  const ed = ED_STATES[state];
  const edLeaf = ed ? leafOf("Sample note") : null;
  const edBefore = ed ? { lines: app.vault.getConfig("showLineNumber") ?? false } : null;
  let edAttempts = 0;
  if (edLeaf) {
    app.vault.setConfig("showLineNumber", ed.lines);
    await edLeaf.setViewState({ type: "markdown", state: { file: "Editor chrome.md", mode: "source", source: ed.source }, active: true });
    ws.setActiveLeaf(edLeaf, { focus: true });
    for (let i = 0; i < 25 && !edLeaf.view.contentEl.querySelector(".cm-content .cm-line"); i++) await sleep(200);
    // The line-number gutter follows the setting a moment later, and on Electron 39 it sometimes did not follow
    // at all or came back after it had gone (the setting changing again on its own after a moment is the
    // suspected cause; not proven). Wait (up to 5 s) until the gutter is as asked, then check that it stays so
    // for 1 s; otherwise set the setting again, up to 3 times. runner.ed-prepared reports the attempts and the
    // setting at measuring time.
    const gutterAsAsked = () => !!edLeaf.view.contentEl.querySelector(".cm-gutters") === ed.lines;
    for (let attempt = 1; attempt <= 3; attempt++) {
      edAttempts = attempt;
      if (attempt > 1) {
        app.vault.setConfig("showLineNumber", !ed.lines);
        await sleep(300);
        app.vault.setConfig("showLineNumber", ed.lines);
      }
      for (let i = 0; i < 25 && !gutterAsAsked(); i++) await sleep(200);
      await sleep(1000);
      if (gutterAsAsked()) break;
    }
    const editor = edLeaf.view.editor;
    editor.focus();
    const line = editor.getValue().split("\n").findIndex((l) => l.includes(ed.at));
    if (ed.select) editor.setSelection({ line, ch: 0 }, { line, ch: ed.select });
    else editor.setCursor({ line, ch: state === "ed-suggest" ? editor.getLine(line).length : 1 });
    if (ed.fold) app.commands.executeCommandById("editor:toggle-fold");
    if (ed.search) {
      app.commands.executeCommandById("editor:open-search");
      await sleep(300);
      const input = edLeaf.view.containerEl.querySelector(".document-search-input input");
      if (input) { input.value = ed.search; input.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    await sleep(500);
  }
  // DOM menus: macOS defaults to native OS menus, which no theme can style; the test vault switches them off.
  const nativeMenusBefore = app.vault.getConfig("nativeMenus") ?? null;
  if (state === "menu-open") app.vault.setConfig("nativeMenus", false);
  await sleep(800);

  // Measure one element in a given document. Visibility = checkVisibility() (display, content-visibility,
  // visibility) AND a non-empty box; `value` is the computed property (custom properties trimmed) or null.
  const measure = (doc, c) => {
    const all = doc.querySelectorAll(c.selector);
    const el = all[0];
    if (!el) return { found: false, count: 0, displayed: false, size: null, value: null };
    const r = el.getBoundingClientRect();
    const visible = el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
    // c.pseudo ("::before" / "::after" / "::marker"): the property of that pseudo-element of the element (e.g. the
    // corner app.css paints with .workspace-ribbon.mod-primary::before).
    const cs = doc.defaultView.getComputedStyle(el, c.pseudo ?? null);
    const value = cs.getPropertyValue(c.property).trim();
    // kind "em": the element's font size, which the value is relative to.
    const fontSize = c.kind === "em" ? cs.fontSize : undefined;
    return { found: true, count: all.length, displayed: visible && r.width > 0 && r.height > 0, size: [Math.round(r.width), Math.round(r.height)], value: value === "" ? null : value, fontSize };
  };

  window.__INK_MEASURE = async () => {
  const ua = navigator.userAgent;
  const out = {
    // Desktop: the app version from Electron's main process. A device has no Electron; the device runner
    // (tests/device) passes the version it read through the plugin API instead.
    appVersion: window.__INK.appVersion ?? window.require("electron").ipcRenderer.sendSync("version"),
    electron: (/Electron\/([\d.]+)/.exec(ua) || [])[1] ?? null,
    theme: app.customCss.theme,
    themeCssLength: app.customCss.styleEl.textContent.length,
    bodyClasses: [...document.body.classList],
    results: {},
  };
  // Editor chrome states: whether the state was really prepared (the note, the mode and the line-number
  // gutter as asked) at measuring time; the runner turns this into runner.ed-prepared.
  if (ed) {
    const v = ws.activeLeaf?.view;
    out.edPrepared = { leafFound: !!edLeaf, file: v?.file?.basename ?? null, source: v?.getState?.().source ?? null, gutters: !!v?.contentEl?.querySelector(".cm-gutters"), want: ed.lines, setting: app.vault.getConfig("showLineNumber") ?? null, attempts: edAttempts };
  }
  for (const c of checks.filter((x) => x.document === "main")) {
    // c.scrollTo: text of a line of the Markdown note to scroll into view first (CodeMirror draws only the
    // lines near the viewport; the reading view renders sections lazily).
    if (c.scrollTo && mdLeaf) {
      const v = mdLeaf.view;
      const line = v.editor.getValue().split("\n").findIndex((l) => l.includes(c.scrollTo));
      if (v.getMode() === "preview") v.previewMode.applyScroll(Math.max(0, line));
      else v.editor.scrollIntoView({ from: { line: Math.max(0, line), ch: 0 }, to: { line: Math.max(0, line), ch: 0 } }, true);
      await sleep(400);
    }
    out.results[c.id] = measure(document, c);
  }

  const settingsChecks = checks.filter((x) => x.document === "settings");
  if (settingsChecks.length) {
    // Obsidian 1.14.4 opens Settings in a popout window (body.is-popout-modal): measure in the modal's own
    // document (research/13 §2.1.1). If the modal is not there, every settings check reports found: false.
    app.setting.open();
    await sleep(700);
    const m = app.setting.modalEl;
    const doc = m && m.isConnected ? m.ownerDocument : null;
    out.settingsDocument = doc ? { sameAsMain: doc === document, bodyClasses: [...doc.body.classList] } : null;
    for (const c of settingsChecks) out.results[c.id] = doc ? measure(doc, c) : { found: false, count: 0, displayed: false, size: null, value: null, error: "settings document not found" };
    app.setting.close();
    await sleep(400);
  }

  // Undo the per-state settings so the next probe starts from the same vault state.
  if (state === "user-accent") { app.vault.setConfig("accentColor", ""); await sleep(300); }
  if (state === "fullscreen-class") document.body.classList.remove("is-fullscreen");
  if (state === "quick-switcher-open") {
    document.querySelector(".modal-container")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(300);
  }
  if (state === "user-font") { app.vault.setConfig("interfaceFontFamily", ""); await sleep(300); }
  if (state === "menu-open") { document.querySelectorAll(".menu").forEach((m) => m.remove()); app.vault.setConfig("nativeMenus", nativeMenusBefore); }
  if (state === "file-explorer-focused") ws.setActiveLeaf(leafOf("Sample note"), { focus: true });
  if (edLeaf) {
    const editor = edLeaf.view.editor;
    if (ed.search) edLeaf.view.containerEl.querySelectorAll(".document-search-close-button").forEach((b) => b.click());
    if (ed.fold) { editor.setCursor({ line: editor.getValue().split("\n").findIndex((l) => l.includes(ed.at)), ch: 1 }); app.commands.executeCommandById("editor:toggle-fold"); }
    if (state === "ed-suggest") {
      // The runner typed " [[Oth" at the end of the last line; close the suggestions and restore the line.
      document.querySelectorAll(".suggestion-container").forEach((s) => s.remove());
      const last = editor.lineCount() - 1;
      editor.setLine(last, "Last line.");
    }
    app.vault.setConfig("showLineNumber", edBefore.lines);
    await edLeaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
    ws.setActiveLeaf(edLeaf, { focus: true });
    await sleep(300);
  }
  if (mdLeaf) {
    if (state === "md-user-fonts") { app.vault.setConfig("textFontFamily", ""); app.vault.setConfig("monospaceFontFamily", ""); }
    await mdLeaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
    ws.setActiveLeaf(mdLeaf, { focus: true });
    await sleep(300);
  }
  out.modalsLeftOpen = document.querySelectorAll(".modal-container").length;
  return out;
  };
  return window.__INK.deferMeasure ? { deferred: true } : await window.__INK_MEASURE();
})();

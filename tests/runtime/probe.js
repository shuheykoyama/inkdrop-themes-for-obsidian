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
    const value = doc.defaultView.getComputedStyle(el, c.pseudo ?? null).getPropertyValue(c.property).trim();
    return { found: true, count: all.length, displayed: visible && r.width > 0 && r.height > 0, size: [Math.round(r.width), Math.round(r.height)], value: value === "" ? null : value };
  };

  window.__INK_MEASURE = async () => {
  const ua = navigator.userAgent;
  const out = {
    appVersion: window.require("electron").ipcRenderer.sendSync("version"),
    electron: (/Electron\/([\d.]+)/.exec(ua) || [])[1] ?? null,
    theme: app.customCss.theme,
    themeCssLength: app.customCss.styleEl.textContent.length,
    bodyClasses: [...document.body.classList],
    results: {},
  };
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

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

  // Vault settings. Obsidian 1.14.4 saves the config 1 s after setConfig, and its own file watcher then runs
  // reloadConfig about 0.5 s after each save. When appearance.json's mtime comes out 1 ms past configTs (the
  // Date.now() taken right after the save), reloadConfig takes the save for an outside change and re-reads
  // app.json, which puts back the value on disk over one set in the meantime (measured on Electron 39.5.1 and
  // 43.7.7, research/14 §6.25). So every setting is written to disk at once and must still hold after that
  // reload window; `configWanted` is checked again at measuring time (runner.config-prepared).
  const configWanted = {};
  const configLog = [];
  const sameConfig = (key, value) => JSON.stringify(app.vault.getConfig(key) ?? null) === JSON.stringify(value ?? null);
  const setConfigNow = async (key, value) => {
    configWanted[key] = value;
    // Up to 3 writes: a reload already under way when the value was set can still put the old one back once.
    let writes = 0;
    while (writes < 3) {
      writes++;
      app.vault.setConfig(key, value);
      await app.vault.saveConfig();
      await sleep(700);
      if (sameConfig(key, value)) break;
    }
    configLog.push({ key, value, writes, held: sameConfig(key, value) });
  };

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
    await setConfigNow("floatingNavigation", platform !== "phone-nonfloating");
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
  if (state === "user-accent") await setConfigNow("accentColor", "#e06c75");
  if (state === "fullscreen-class") document.body.classList.add("is-fullscreen");
  if (state === "quick-switcher-open") app.commands.executeCommandById("switcher:open");
  if (state === "user-font") await setConfigNow("interfaceFontFamily", "Courier New");
  // Markdown states (step 6): "Markdown elements" in the leaf of "Sample note" (restored afterwards), in one
  // view mode. The text and code fonts of md-user-fonts are the user's settings that must win (Q-D8).
  const MD_MODES = { "md-source": { mode: "source", source: true }, "md-live": { mode: "source", source: false }, "md-reading": { mode: "preview" }, "md-user-fonts": { mode: "source", source: false } };
  const mdLeaf = MD_MODES[state] ? leafOf("Sample note") : null;
  if (mdLeaf) {
    if (state === "md-user-fonts") { await setConfigNow("textFontFamily", "Courier New"); await setConfigNow("monospaceFontFamily", "Menlo"); }
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
    // Runner self-test only: prepared like ed-source / ed-fold, then the prepared state is taken away before
    // measuring (the setting reverted in memory as reloadConfig does; the fold opened), which
    // runner.ed-prepared / runner.config-prepared must report as FAIL.
    "self-test-ed-gutter-lost": { source: true, lines: true, at: "Second paragraph" },
    "self-test-fold-lost": { source: true, lines: true, at: "## Folded", fold: true },
  };
  const ed = ED_STATES[state];
  const edLeaf = ed ? leafOf("Sample note") : null;
  const edBefore = ed ? { lines: app.vault.getConfig("showLineNumber") ?? false } : null;
  const edPrep = {};
  const foldPlaceholder = () => edLeaf.view.contentEl.querySelector(".cm-foldPlaceholder");
  if (edLeaf) {
    await setConfigNow("showLineNumber", ed.lines);
    await edLeaf.setViewState({ type: "markdown", state: { file: "Editor chrome.md", mode: "source", source: ed.source }, active: true });
    ws.setActiveLeaf(edLeaf, { focus: true });
    for (let i = 0; i < 25 && !edLeaf.view.contentEl.querySelector(".cm-content .cm-line"); i++) await sleep(200);
    // The line-number gutter follows the setting a moment later: wait (up to 5 s) until it is as asked, then
    // check that it stays so for 1 s. runner.ed-prepared reports the gutter and the setting at measuring time.
    const gutterAsAsked = () => !!edLeaf.view.contentEl.querySelector(".cm-gutters") === ed.lines;
    for (let i = 0; i < 25 && !gutterAsAsked(); i++) await sleep(200);
    await sleep(1000);
    edPrep.gutterHeld = gutterAsAsked();
    const editor = edLeaf.view.editor;
    editor.focus();
    const line = editor.getValue().split("\n").findIndex((l) => l.includes(ed.at));
    if (ed.select) editor.setSelection({ line, ch: 0 }, { line, ch: ed.select });
    else editor.setCursor({ line, ch: state === "ed-suggest" ? editor.getLine(line).length : 1 });
    if (ed.fold) {
      // Obsidian remembers the folds of each file and puts them back when the file opens, so a toggle alone
      // can open the fold instead (it did after an earlier fold of the same note was left in place). Open
      // every fold first, then fold the heading, and wait (up to 3 s) for the placeholder.
      app.commands.executeCommandById("editor:unfold-all");
      for (let i = 0; i < 15 && foldPlaceholder(); i++) await sleep(200);
      edPrep.unfoldedFirst = !foldPlaceholder();
      editor.setCursor({ line, ch: 1 });
      app.commands.executeCommandById("editor:toggle-fold");
      for (let i = 0; i < 15 && !foldPlaceholder(); i++) await sleep(200);
    }
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
  if (state === "menu-open") await setConfigNow("nativeMenus", false);
  await sleep(800);
  // Runner self-test only: take the prepared state away again (see ED_STATES).
  if (state === "self-test-ed-gutter-lost") { app.vault.config.showLineNumber = false; app.vault.trigger("config-changed", "showLineNumber"); await sleep(800); }
  if (state === "self-test-fold-lost") { app.commands.executeCommandById("editor:unfold-all"); await sleep(500); }

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
    // Whether the page has focus (the runner holds CDP focus emulation; editor commands need it).
    focused: document.hasFocus(),
    results: {},
  };
  // Whether every setting the probe asked for still holds at measuring time (runner.config-prepared), with how
  // many writes each took.
  out.configPrepared = { held: Object.entries(configWanted).every(([k, v]) => sameConfig(k, v)), now: Object.fromEntries(Object.keys(configWanted).map((k) => [k, app.vault.getConfig(k) ?? null])), wanted: { ...configWanted }, writes: configLog.map((x) => ({ ...x })) };
  // Editor chrome states: whether the state was really prepared (the note, the mode, the line-number gutter as
  // asked and, for ed-fold, a folded heading) at measuring time; the runner turns this into runner.ed-prepared.
  if (ed) {
    const v = ws.activeLeaf?.view;
    out.edPrepared = { leafFound: !!edLeaf, file: v?.file?.basename ?? null, source: v?.getState?.().source ?? null, gutters: !!v?.contentEl?.querySelector(".cm-gutters"), want: ed.lines, setting: app.vault.getConfig("showLineNumber") ?? null, ...edPrep, ...(ed.fold ? { folded: !!foldPlaceholder() } : {}) };
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
    const searchInput = app.setting.searchComponent?.inputEl ?? null;
    if (searchInput) { searchInput.readOnly = true; searchInput.blur(); }
    // Wait (up to 3 s) until the modal is there and the active tab's nav item has a box; runner.settings-prepared
    // reports it. When it has none, the report says why: Obsidian hides the whole tab list while the settings
    // search has text (onSearchChanged), and the popout window starts at 0 x 0. The popout takes the macOS focus
    // with its search box focused, so typing meant for another app landed there (2 characters in one Electron
    // 39 run, research/14 §6.25): the search box is made read-only and unfocused at once while the probe has
    // Settings open, a search that already has text is emptied, and only lengths are reported (never the text).
    const activeItem = () => { const mm = app.setting.modalEl; const d = mm && mm.isConnected ? mm.ownerDocument : null; const e = d && d.querySelector(".modal.mod-settings .vertical-tab-nav-item.is-active"); return e && e.getBoundingClientRect().width > 0 ? e : null; };
    await sleep(200);
    const strayLength = app.setting.searchComponent?.getValue?.()?.length ?? 0;
    if (strayLength) { app.setting.searchComponent.setValue(""); app.setting.onSearchChanged(); }
    const t0 = performance.now();
    if (state === "self-test-settings-search") { await sleep(300); app.setting.searchComponent?.setValue("zzzz"); app.setting.onSearchChanged?.(); }
    while (!activeItem() && performance.now() - t0 < 3000) await sleep(100);
    const settingsMs = Math.round(performance.now() - t0);
    await sleep(300);
    const m = app.setting.modalEl;
    const doc = m && m.isConnected ? m.ownerDocument : null;
    out.settingsDocument = doc ? { sameAsMain: doc === document, bodyClasses: [...doc.body.classList] } : null;
    out.settingsPrepared = { activeItemShown: !!activeItem(), ms: settingsMs, tab: app.setting.activeTab?.id ?? null, searchLength: app.setting.searchComponent?.getValue?.()?.length ?? null, strayCleared: strayLength, tabListShown: !!doc?.querySelector(".vertical-tab-header-group-container")?.checkVisibility(), window: doc ? [doc.defaultView.innerWidth, doc.defaultView.innerHeight] : null };
    // Runner self-test only: change Settings > About around the Help row (the row after Language, the tab's only
    // dropdown) that ui.button.background measures, then undo it after measuring (research/14 §6.139).
    const helpRow = doc?.querySelector(".vertical-tab-content .setting-item:has(select.dropdown) + .setting-item");
    const added = [];
    let removed = null;
    const buttonRow = (hidden, red) => {
      const row = doc.createElement("div");
      row.className = "setting-item";
      if (hidden) row.style.display = "none";
      const control = row.appendChild(doc.createElement("div"));
      control.className = "setting-item-control";
      const b = control.appendChild(doc.createElement("button"));
      b.textContent = "self-test";
      if (red) b.style.backgroundColor = "rgb(255, 0, 0)";
      added.push(row);
      return row;
    };
    // A hidden row first (as "Update Available" is on a current installer), then a visible red one.
    if (helpRow && state === "self-test-settings-decoys") helpRow.parentElement.prepend(buttonRow(true, false), buttonRow(false, true));
    // A themed button row right after Language: it must not be taken for Help.
    if (helpRow && state === "self-test-settings-help-displaced") helpRow.before(buttonRow(false, false));
    if (helpRow && state === "self-test-settings-help-gone") { const b = helpRow.querySelector("button"); removed = [b, b.parentElement]; b.remove(); }
    for (const c of settingsChecks) out.results[c.id] = doc ? measure(doc, c) : { found: false, count: 0, displayed: false, size: null, value: null, error: "settings document not found" };
    added.forEach((row) => row.remove());
    if (removed) removed[1].append(removed[0]);
    if (state === "self-test-settings-search") { app.setting.searchComponent?.setValue(""); app.setting.onSearchChanged?.(); }
    if (searchInput) searchInput.readOnly = false;
    app.setting.close();
    await sleep(400);
  }

  // Undo the per-state settings so the next probe starts from the same vault state.
  if (state === "user-accent") await setConfigNow("accentColor", "");
  if (state === "fullscreen-class") document.body.classList.remove("is-fullscreen");
  if (state === "quick-switcher-open") {
    document.querySelector(".modal-container")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(300);
  }
  if (state === "user-font") await setConfigNow("interfaceFontFamily", "");
  if (state === "menu-open") { document.querySelectorAll(".menu").forEach((m) => m.remove()); await setConfigNow("nativeMenus", nativeMenusBefore); }
  if (state === "file-explorer-focused") ws.setActiveLeaf(leafOf("Sample note"), { focus: true });
  if (edLeaf) {
    const editor = edLeaf.view.editor;
    if (ed.search) edLeaf.view.containerEl.querySelectorAll(".document-search-close-button").forEach((b) => b.click());
    // Open the fold again and check it is gone, so no remembered fold reaches the next state.
    if (ed.fold) { app.commands.executeCommandById("editor:unfold-all"); for (let i = 0; i < 15 && foldPlaceholder(); i++) await sleep(200); }
    if (state === "ed-suggest") {
      // The runner typed " [[Oth" at the end of the last line; close the suggestions and restore the line.
      document.querySelectorAll(".suggestion-container").forEach((s) => s.remove());
      const last = editor.lineCount() - 1;
      editor.setLine(last, "Last line.");
    }
    await setConfigNow("showLineNumber", edBefore.lines);
    await edLeaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
    ws.setActiveLeaf(edLeaf, { focus: true });
    await sleep(300);
  }
  if (mdLeaf) {
    if (state === "md-user-fonts") { await setConfigNow("textFontFamily", ""); await setConfigNow("monospaceFontFamily", ""); }
    await mdLeaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
    ws.setActiveLeaf(mdLeaf, { focus: true });
    await sleep(300);
  }
  out.modalsLeftOpen = document.querySelectorAll(".modal-container").length;
  return out;
  };
  return window.__INK.deferMeasure ? { deferred: true } : await window.__INK_MEASURE();
})();

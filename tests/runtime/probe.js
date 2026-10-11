// Runtime probe: runs inside the ISOLATED Obsidian (test vault only), injected by tests/runtime/run.mjs
// after `window.__INK = { theme, translucent, platform, state, checks: [{ id, selector, document, property }] }`.
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
  }
  if (state === "user-accent") app.vault.setConfig("accentColor", "#e06c75");
  if (state === "fullscreen-class") document.body.classList.add("is-fullscreen");
  if (state === "quick-switcher-open") app.commands.executeCommandById("switcher:open");
  await sleep(800);

  // Measure one element in a given document. Visibility = checkVisibility() (display, content-visibility,
  // visibility) AND a non-empty box; `value` is the computed property (custom properties trimmed) or null.
  const measure = (doc, c) => {
    const all = doc.querySelectorAll(c.selector);
    const el = all[0];
    if (!el) return { found: false, count: 0, displayed: false, size: null, value: null };
    const r = el.getBoundingClientRect();
    const visible = el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
    const value = doc.defaultView.getComputedStyle(el).getPropertyValue(c.property).trim();
    return { found: true, count: all.length, displayed: visible && r.width > 0 && r.height > 0, size: [Math.round(r.width), Math.round(r.height)], value: value === "" ? null : value };
  };

  const ua = navigator.userAgent;
  const out = {
    appVersion: window.require("electron").ipcRenderer.sendSync("version"),
    electron: (/Electron\/([\d.]+)/.exec(ua) || [])[1] ?? null,
    theme: app.customCss.theme,
    themeCssLength: app.customCss.styleEl.textContent.length,
    bodyClasses: [...document.body.classList],
    results: {},
  };
  for (const c of checks.filter((x) => x.document === "main")) out.results[c.id] = measure(document, c);

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
  out.modalsLeftOpen = document.querySelectorAll(".modal-container").length;
  return out;
})();

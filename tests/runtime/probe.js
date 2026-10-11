// Runtime probe: runs inside the ISOLATED Obsidian (test vault only), injected by tests/runtime/run.mjs
// after `window.__INK = { theme, translucent, checks: [{ id, selector, document, property }] }`.
// Selects the theme, sets translucency, opens the sample note, and reports for every check what was
// found, never a judgement: { found, count, displayed, size, value, error }. The judgement (and the rule
// that a missing / hidden / unreadable element can never pass a "match") lives in run.mjs.
// Reuses the layout steps of research/poc/q-d21-build/tests/runtime/probe-poc.js.
(async () => {
  const { theme, translucent, checks } = window.__INK;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ws = app.workspace;

  // Theme: the theme folder must be known to Obsidian before setTheme / loadTheme accept it.
  await app.customCss.readThemes();
  if (app.customCss.theme !== theme) app.customCss.setTheme(theme);
  await app.customCss.loadTheme();
  await ws.openLinkText("Sample note", "", false);
  ws.leftSplit.expand();
  ws.rightSplit.expand();
  app.customCss.setTranslucency(!!translucent);
  await sleep(600);

  // Measure one element in a given document. Visibility = checkVisibility() (display, content-visibility,
  // visibility) AND a non-empty box; `value` is the computed property or null.
  const measure = (doc, c) => {
    const all = doc.querySelectorAll(c.selector);
    const el = all[0];
    if (!el) return { found: false, count: 0, displayed: false, size: null, value: null };
    const r = el.getBoundingClientRect();
    const visible = el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
    const value = doc.defaultView.getComputedStyle(el).getPropertyValue(c.property);
    return { found: true, count: all.length, displayed: visible && r.width > 0 && r.height > 0, size: [Math.round(r.width), Math.round(r.height)], value: value === "" ? null : value };
  };

  const out = {
    appVersion: window.require("electron").ipcRenderer.sendSync("version"),
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
  return out;
})();

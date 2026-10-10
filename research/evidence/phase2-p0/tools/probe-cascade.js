// Diagnostic probe (not theme code): computed values after a diagnostic theme is loaded.
(async () => {
  // Re-read the theme file from disk so the newest diagnostic CSS is applied.
  await app.customCss.loadTheme();
  await new Promise((r) => setTimeout(r, 400));
  const q = (sel) => document.querySelector(sel);
  const cs = (sel) => { const el = q(sel); return el ? getComputedStyle(el) : null; };
  const v = (sel, name) => cs(sel)?.getPropertyValue(name).trim() ?? null;
  const p = (sel, prop) => cs(sel)?.[prop] ?? null;
  return {
    themeHead: app.customCss.styleEl.textContent.slice(0, 40),
    // A1 / A2 on body
    body_bgPrimary: v("body", "--background-primary"),
    body_bgSecondary: v("body", "--background-secondary"),
    body_interactiveNormal: v("body", "--interactive-normal"),
    body_textSelection: v("body", "--text-selection"),
    body_canvasColor: v("body", "--canvas-color"),
    body_textAccent: v("body", "--text-accent"),
    // Regions
    ribbon_bg: p(".workspace-ribbon", "backgroundColor"),
    ribbon_classes: q(".workspace-ribbon") ? [...q(".workspace-ribbon").classList] : null,
    titlebar_bg: p(".titlebar", "backgroundColor"),
    statusbar_bg: p(".status-bar", "backgroundColor"),
    root_tabHeader_bg: p(".workspace-split.mod-root .workspace-tab-header-container", "backgroundColor"),
    left_tabHeader_bg: p(".workspace-split.mod-left-split .workspace-tab-header-container", "backgroundColor"),
    right_tabHeader_bg: p(".workspace-split.mod-right-split .workspace-tab-header-container", "backgroundColor"),
    left_split_bg: p(".workspace-split.mod-left-split", "backgroundColor"),
    left_leaf_bg: p(".workspace-split.mod-left-split .workspace-leaf", "backgroundColor"),
    right_leaf_bg: p(".workspace-split.mod-right-split .workspace-leaf", "backgroundColor"),
    root_leaf_bg: p(".workspace-split.mod-root .workspace-leaf", "backgroundColor"),
    root_viewHeader_bg: p(".workspace-split.mod-root .view-header", "backgroundColor"),
    vaultProfile_bg: p(".workspace-sidedock-vault-profile", "backgroundColor"),
    navHeader_bg: p('.workspace-leaf-content[data-type="file-explorer"] .nav-header', "backgroundColor"),
    navFiles_bg: p('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container', "backgroundColor"),
    // Other leaves in the left dock (search / bookmarks) to detect leakage of method 3
    leftOtherLeafContents: [...document.querySelectorAll(".workspace-split.mod-left-split .workspace-leaf-content")]
      .map((el) => ({ type: el.getAttribute("data-type"), bg: getComputedStyle(el).backgroundColor })),
    // A6 / A7
    gutters_color: p(".markdown-source-view.mod-cm6 .cm-gutters", "color"),
    gutters_borderRight: cs(".markdown-source-view.mod-cm6 .cm-gutters")
      ? `${p(".markdown-source-view.mod-cm6 .cm-gutters", "borderRightWidth")} ${p(".markdown-source-view.mod-cm6 .cm-gutters", "borderRightStyle")} ${p(".markdown-source-view.mod-cm6 .cm-gutters", "borderRightColor")}`
      : null,
    gutters_boxShadow: p(".markdown-source-view.mod-cm6 .cm-gutters", "boxShadow"),
    activeLine_exists: !!q(".markdown-source-view.mod-cm6 .cm-line.cm-active"),
    activeLine_bg: p(".markdown-source-view.mod-cm6 .cm-line.cm-active", "backgroundColor"),
    // Did the scoped redefinition leak into body-level derived variables?
    left_split_tabc: v(".workspace-split.mod-left-split", "--tab-container-background"),
    left_split_secondary: v(".workspace-split.mod-left-split", "--background-secondary"),
    left_modtop_stabc: v(".workspace-split.mod-left-split .workspace-tabs.mod-top", "--sidebar-tab-container-background"),
  };
})();

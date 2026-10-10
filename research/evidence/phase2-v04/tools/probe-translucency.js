// V-04 diagnostic probe (not theme code): computed background of every layer that can show
// between the macOS vibrancy material and the note text, plus the window / translucency state.
// Read-only. Reloads the diagnostic theme from disk first so the newest CSS is measured.
(async () => {
  await app.customCss.loadTheme();
  await new Promise((r) => setTimeout(r, 500));
  const q = (sel) => document.querySelector(sel);
  const bg = (sel) => { const el = q(sel); return el ? getComputedStyle(el).backgroundColor : null; };
  const v = (sel, name) => { const el = q(sel); return el ? getComputedStyle(el).getPropertyValue(name).trim() : null; };
  const rect = (sel) => { const el = q(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const L = ".workspace-split.mod-left-split";
  const R = ".workspace-split.mod-right-split";
  const M = ".workspace-split.mod-root";
  const FE = '.workspace-leaf-content[data-type="file-explorer"]';
  const OL = '.workspace-leaf-content[data-type="outline"]';
  // Layers listed from the window outwards to the note text, per region.
  const layers = {
    body: "body",
    "app-container": ".app-container",
    "horizontal-main-container": ".horizontal-main-container",
    workspace: ".workspace",
    ribbon: ".workspace-ribbon.mod-primary",
    "ribbon:before": null,
    "left split": L,
    "left tab-header-container": `${L} .workspace-tab-header-container`,
    "left tabs": `${L} .workspace-tabs`,
    "left leaf": `${L} .workspace-leaf`,
    "left leaf-content (file-explorer)": FE,
    "left nav-header": `${FE} .nav-header`,
    "left nav-files-container": `${FE} .nav-files-container`,
    "left vault-profile": ".workspace-sidedock-vault-profile",
    "root split": M,
    "root tab-header-container": `${M} .workspace-tab-header-container`,
    "root tabs": `${M} .workspace-tabs`,
    "root leaf": `${M} .workspace-leaf`,
    "root leaf-content": `${M} .workspace-leaf-content`,
    "root view-header": `${M} .view-header`,
    "root view-content": `${M} .view-content`,
    "root markdown-source-view": `${M} .markdown-source-view`,
    "root cm-editor": `${M} .cm-editor`,
    "root cm-scroller": `${M} .cm-scroller`,
    "right split": R,
    "right tab-header-container": `${R} .workspace-tab-header-container`,
    "right leaf": `${R} .workspace-leaf:has(> ${OL})`,
    "right leaf-content (outline)": OL,
    "right view-content": `${OL} .view-content`,
    "status-bar": ".status-bar",
    titlebar: ".titlebar",
  };
  const out = {};
  for (const [k, sel] of Object.entries(layers)) {
    if (!sel) continue;
    out[k] = { selector: sel, backgroundColor: bg(sel), rect: rect(sel) };
  }
  const rib = q(".workspace-ribbon.mod-primary");
  out["ribbon:before"] = { selector: ".workspace-ribbon.mod-primary::before", backgroundColor: rib ? getComputedStyle(rib, "::before").backgroundColor : null };
  return {
    measuredAt: new Date().toISOString(),
    obsidian: document.title.match(/Obsidian ([\d.]+)/)?.[1] ?? null,
    electron: navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? null,
    themeHead: app.customCss.styleEl?.textContent.slice(0, 80) ?? null,
    translucencyConfig: app.vault.getConfig("translucency"),
    bodyClasses: [...document.body.classList],
    windowFocused: electronWindow.isFocused(),
    documentHasFocus: document.hasFocus(),
    bounds: electronWindow.getBounds(),
    viewport: [innerWidth, innerHeight, devicePixelRatio],
    vars: {
      "--background-primary": v("body", "--background-primary"),
      "--background-secondary": v("body", "--background-secondary"),
      "--ribbon-background": v("body", "--ribbon-background"),
      "--titlebar-background": v("body", "--titlebar-background"),
      "--tab-container-background": v("body", "--tab-container-background"),
      "--workspace-background-translucent": v("body", "--workspace-background-translucent"),
      "left --background-secondary": v(L, "--background-secondary"),
      "right --background-secondary": v(R, "--background-secondary"),
      "root --background-primary": v(M, "--background-primary"),
    },
    layers: out,
  };
})();

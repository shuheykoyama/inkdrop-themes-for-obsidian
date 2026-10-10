// Diagnostic probe for Inkdrop (read-only): computed styles of the layout regions found by static
// analysis of Inkdrop 6.1.5 (research/data/inkdrop-consumers-6.1.5.csv). Reads no note content,
// only class names, sizes, colours and CSS variable values. Changes nothing.
(() => {
  const VARS = [
    "--page-background", "--sidebar-background", "--sidebar-border-right",
    "--note-list-bar-background", "--note-list-bar-border-right",
    "--editor-background", "--editor-background-color", "--editor-foreground-color", "--header-note-menu-background",
    "--sidebar-menu-item-inactive-background", "--sidebar-menu-item-active-background",
    "--note-list-view-item-selected-background", "--note-list-view-item-active-background",
    "--editor-active-line-background-color", "--editor-gutter-color", "--editor-gutter-border-right",
    "--editor-selection-background", "--editor-focused-selection-background", "--editor-caret-color",
    "--text-color", "--primary-color",
  ];
  const TARGETS = {
    "app-container (page)": "#app-container",
    "main-layout": ".main-layout",
    "sidebar": ".sidebar-layout-content",
    "sidebar item (active)": ".sidebar-menu-item.active",
    "sidebar sync status": ".sidebar-sync-status-view",
    "note-list": ".note-list-bar-layout-content",
    "note-list item (active)": ".note-list-item-view.active",
    "note-list item (focused)": ".note-list-item-view.focused",
    "editor-layout": ".editor-layout",
    "editor-title-bar": ".editor-title-bar-layout",
    "editor-header": ".editor-header-layout",
    "cm-editor": ".cm-editor",
    "cm-scroller": ".cm-scroller",
    "cm-content": ".cm-content",
    "cm-gutters": ".cm-gutters",
    "cm-activeLine": ".cm-activeLine",
    "cm-activeLineGutter": ".cm-activeLineGutter",
    "cm-cursor": ".cm-cursor",
    "cm-selectionBackground": ".cm-selectionBackground",
    "preview": ".mde-preview",
  };
  const pkg = (n) => inkdrop.packages.getLoadedPackage?.(n)?.metadata?.version ?? null;
  const theme = inkdrop.config.get("core.theme");
  const out = {
    measuredAt: new Date().toISOString(),
    inkdropVersion: inkdrop.appVersion ?? null,
    theme, themeVersion: pkg(theme),
    userAgent: navigator.userAgent,
    bodyClasses: [...document.body.classList],
    rootColorScheme: getComputedStyle(document.body).colorScheme,
    viewport: [innerWidth, innerHeight, devicePixelRatio],
    // Layout skeleton: class names of #app-container descendants down to the three panes.
    mainLayoutChildren: (() => {
      const m = document.querySelector(".main-layout");
      return m ? [...m.children].map((c) => ({ cls: [...c.classList].join("."), rect: (({ x, width }) => [Math.round(x), Math.round(width)])(c.getBoundingClientRect()) })) : null;
    })(),
  };
  for (const [name, sel] of Object.entries(TARGETS)) {
    const el = document.querySelector(sel);
    if (!el) { out[name] = { selector: sel, found: false }; continue; }
    const cs = getComputedStyle(el);
    const vars = {};
    for (const v of VARS) vars[v] = cs.getPropertyValue(v).trim();
    const chain = [];
    for (let p = el.parentElement; p && chain.length < 7; p = p.parentElement) {
      chain.push(p.tagName.toLowerCase() + (p.id ? "#" + p.id : "") + (p.classList.length ? "." + [...p.classList].slice(0, 4).join(".") : ""));
    }
    const r = el.getBoundingClientRect();
    out[name] = {
      selector: sel, found: true,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      backgroundColor: cs.backgroundColor, color: cs.color, boxShadow: cs.boxShadow,
      borderRight: `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`,
      borderLeft: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`,
      caretColor: cs.caretColor,
      vars, parents: chain,
    };
  }
  return out;
})();

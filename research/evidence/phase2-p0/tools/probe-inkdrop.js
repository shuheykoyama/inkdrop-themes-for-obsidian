// Diagnostic probe for Inkdrop (NOT RUN YET — prepared for V-20 / V-22 / V-30).
// Read-only: reads computed styles of the layout regions found by static analysis of Inkdrop 6.1.5
// (research/data/inkdrop-consumers-6.1.5.csv). It does not change notes, settings or themes.
(() => {
  const VARS = [
    "--page-background", "--sidebar-background", "--sidebar-border-right",
    "--note-list-bar-background", "--note-list-bar-border-right",
    "--editor-background", "--editor-background-color", "--header-note-menu-background",
    "--sidebar-menu-item-inactive-background", "--sidebar-menu-item-active-background",
    "--note-list-view-item-selected-background", "--note-list-view-item-active-background",
    "--editor-active-line-background-color", "--editor-gutter-color", "--editor-gutter-border-right",
    "--editor-selection-background", "--editor-focused-selection-background",
  ];
  const TARGETS = {
    "app-container (page)": "#app-container",
    "main-layout": ".main-layout",
    "sidebar": ".sidebar-layout-content",
    "sidebar item (active)": ".sidebar-menu-item.active",
    "note-list": ".note-list-bar-layout-content",
    "note-list item (active)": ".note-list-item-view.active",
    "note-list item (focused)": ".note-list-item-view.focused",
    "editor-layout": ".editor-layout",
    "editor-title-bar": ".editor-title-bar-layout",
    "editor-header": ".editor-header-layout",
    "cm-editor": ".cm-editor",
    "cm-gutters": ".cm-gutters",
    "cm-activeLine": ".cm-activeLine",
    "cm-selectionBackground": ".cm-selectionBackground",
    "preview": ".mde-preview",
  };
  const out = {
    userAgent: navigator.userAgent,
    bodyClasses: [...document.body.classList],
    rootColorScheme: getComputedStyle(document.documentElement).colorScheme,
    viewport: [innerWidth, innerHeight, devicePixelRatio],
  };
  for (const [name, sel] of Object.entries(TARGETS)) {
    const el = document.querySelector(sel);
    if (!el) { out[name] = { selector: sel, found: false }; continue; }
    const cs = getComputedStyle(el);
    const vars = {};
    for (const v of VARS) vars[v] = cs.getPropertyValue(v).trim();
    const chain = [];
    for (let p = el.parentElement; p && chain.length < 6; p = p.parentElement) {
      chain.push(p.tagName.toLowerCase() + (p.id ? "#" + p.id : "") + (p.classList.length ? "." + [...p.classList].join(".") : ""));
    }
    const r = el.getBoundingClientRect();
    out[name] = {
      selector: sel, found: true,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      backgroundColor: cs.backgroundColor, color: cs.color, boxShadow: cs.boxShadow,
      borderRight: `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`,
      vars, parents: chain,
    };
  }
  return out;
})();

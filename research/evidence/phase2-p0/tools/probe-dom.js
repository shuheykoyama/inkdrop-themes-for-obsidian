// Diagnostic probe (not theme code): DOM structure and computed styles of the workspace regions.
(() => {
  const VARS = [
    "--background-primary", "--background-secondary", "--ribbon-background",
    "--tab-container-background", "--sidebar-tab-container-background", "--titlebar-background",
    "--text-faint", "--interactive-normal", "--interactive-accent", "--text-selection", "--canvas-color",
  ];
  const TARGETS = {
    "body": "body",
    "ribbon(left)": ".workspace-ribbon.mod-left",
    "split.mod-left-split": ".workspace-split.mod-left-split",
    "split.mod-right-split": ".workspace-split.mod-right-split",
    "split.mod-primary-split": ".workspace-split.mod-primary-split",
    "split.mod-secondary-split": ".workspace-split.mod-secondary-split",
    "split.mod-root": ".workspace-split.mod-root",
    "left: tabs.mod-top": ".workspace-split.mod-left-split .workspace-tabs.mod-top",
    "left: tab-header-container": ".workspace-split.mod-left-split .workspace-tab-header-container",
    "left: leaf": ".workspace-split.mod-left-split .workspace-leaf",
    "left: file-explorer leaf-content": '.workspace-leaf-content[data-type="file-explorer"]',
    "left: nav-header": '.workspace-leaf-content[data-type="file-explorer"] .nav-header',
    "left: nav-files-container": '.workspace-leaf-content[data-type="file-explorer"] .nav-files-container',
    "left: view-content": '.workspace-leaf-content[data-type="file-explorer"] .view-content',
    "left: vault-profile": ".workspace-sidedock-vault-profile",
    "right: tabs.mod-top": ".workspace-split.mod-right-split .workspace-tabs.mod-top",
    "right: tab-header-container": ".workspace-split.mod-right-split .workspace-tab-header-container",
    "right: leaf": ".workspace-split.mod-right-split .workspace-leaf",
    "root: tabs.mod-top": ".workspace-split.mod-root .workspace-tabs.mod-top",
    "root: tab-header-container": ".workspace-split.mod-root .workspace-tab-header-container",
    "root: active tab": ".workspace-split.mod-root .workspace-tab-header.is-active",
    "root: view-header": ".workspace-split.mod-root .view-header",
    "root: view-content": ".workspace-split.mod-root .workspace-leaf.mod-active .view-content",
    "root: cm-editor": ".workspace-split.mod-root .cm-editor",
    "root: cm-gutters": ".markdown-source-view.mod-cm6 .cm-gutters",
    "titlebar": ".titlebar",
    "status-bar": ".status-bar",
    "sidebar-toggle-button(left)": ".sidebar-toggle-button.mod-left",
  };
  const out = {};
  for (const [name, sel] of Object.entries(TARGETS)) {
    const els = document.querySelectorAll(sel);
    const el = els[0];
    if (!el) { out[name] = { selector: sel, count: 0 }; continue; }
    const cs = getComputedStyle(el);
    const vars = {};
    for (const v of VARS) vars[v] = cs.getPropertyValue(v).trim();
    // Parent chain (classes only) up to .workspace, to document nesting.
    const chain = [];
    for (let p = el.parentElement; p && p !== document.body && chain.length < 8; p = p.parentElement) {
      chain.push(p.tagName.toLowerCase() + (p.classList.length ? "." + [...p.classList].join(".") : ""));
    }
    out[name] = {
      selector: sel,
      count: els.length,
      classes: [...el.classList],
      dataType: el.getAttribute("data-type"),
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      borderRight: cs.borderRightWidth + " " + cs.borderRightStyle + " " + cs.borderRightColor,
      vars,
      parents: chain,
    };
  }
  // Which tab groups carry mod-top, and in which split.
  out["_modTopGroups"] = [...document.querySelectorAll(".workspace-tabs.mod-top")].map((el) => {
    const split = el.closest(".workspace-split");
    return split ? [...split.classList].join(".") : null;
  });
  // File Explorer internal child order.
  const fe = document.querySelector('.workspace-leaf-content[data-type="file-explorer"]');
  out["_fileExplorerChildren"] = fe ? [...fe.children].map((c) => [...c.classList].join(".")) : null;
  const vc = fe?.querySelector(".view-content");
  out["_fileExplorerViewContentChildren"] = vc ? [...vc.children].map((c) => [...c.classList].join(".")) : null;
  return out;
})();

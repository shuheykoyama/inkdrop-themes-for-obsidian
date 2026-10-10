// Diagnostic probe (isolated test instance only), run AFTER app.emulateMobile(true) has reloaded the window:
// record which desktop selectors still exist and how the side drawers are built.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!document.body.classList.contains("is-mobile")) return "not in mobile emulation";
  app.workspace.leftSplit.expand?.();
  await sleep(800);
  const q = (s) => document.querySelectorAll(s).length;
  const first = (s) => document.querySelector(s);
  const bg = (s) => (first(s) ? getComputedStyle(first(s)).backgroundColor : null);
  const drawer = first(".workspace-drawer");
  const result = {
    bodyClasses: [...document.body.classList],
    counts: {
      ".workspace-split.mod-left-split": q(".workspace-split.mod-left-split"),
      ".workspace-split.mod-right-split": q(".workspace-split.mod-right-split"),
      ".workspace-split.mod-primary-split": q(".workspace-split.mod-primary-split"),
      ".workspace-split.mod-secondary-split": q(".workspace-split.mod-secondary-split"),
      ".workspace-drawer": q(".workspace-drawer"),
      ".workspace-drawer.mod-left": q(".workspace-drawer.mod-left"),
      ".workspace-drawer.mod-primary": q(".workspace-drawer.mod-primary"),
      ".workspace-tabs.mod-top": q(".workspace-tabs.mod-top"),
      '.workspace-leaf-content[data-type="file-explorer"]': q('.workspace-leaf-content[data-type="file-explorer"]'),
      ".nav-header": q(".nav-header"),
      ".nav-files-container": q(".nav-files-container"),
      ".workspace-ribbon": q(".workspace-ribbon"),
      ".titlebar": q(".titlebar"),
      ".status-bar": q(".status-bar"),
    },
    drawerClasses: [...document.querySelectorAll(".workspace-drawer")].map((d) => [...d.classList]),
    drawerChildren: drawer ? [...drawer.children].map((c) => [...c.classList].join(".")) : null,
    // With the case-A diagnostic CSS loaded, do desktop-scoped rules reach anything on mobile?
    drawer_bg: bg(".workspace-drawer"),
    drawer_leaf_bg: bg(".workspace-drawer .workspace-leaf"),
    navHeader_bg: bg(".nav-header"),
    navFiles_bg: bg(".nav-files-container"),
    body_bgSecondary: getComputedStyle(document.body).getPropertyValue("--background-secondary").trim(),
    body_colorBase00: getComputedStyle(document.body).getPropertyValue("--color-base-00").trim(),
    body_bgPrimary: getComputedStyle(document.body).getPropertyValue("--background-primary").trim(),
    mobileSidebarBackground: getComputedStyle(document.body).getPropertyValue("--mobile-sidebar-background").trim(),
  };
  return result;
})();

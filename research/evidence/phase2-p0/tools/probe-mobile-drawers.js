// Diagnostic probe (mobile emulation, isolated instance): background of both drawers after scoped redefinition.
(async () => {
  await app.customCss.loadTheme();
  app.workspace.leftSplit.expand?.();
  await new Promise((r) => setTimeout(r, 800));
  const out = {};
  for (const sel of [".workspace-drawer.mod-primary", ".workspace-drawer.mod-secondary"]) {
    const el = document.querySelector(sel);
    const cs = el && getComputedStyle(el);
    out[sel] = cs ? { bg: cs.backgroundColor, secondary: cs.getPropertyValue("--background-secondary").trim(),
      mobileSidebarBackground: cs.getPropertyValue("--mobile-sidebar-background").trim() } : null;
  }
  out.isMobile = document.body.classList.contains("is-mobile");
  return out;
})();

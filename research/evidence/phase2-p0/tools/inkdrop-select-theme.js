// Phase 2B (approved by the user): switch the active theme. The theme name is injected by the caller
// through window.__P2B_THEME. The original theme was recorded beforehand and is restored at the end.
(async () => {
  const name = window.__P2B_THEME;
  inkdrop.config.set("core.theme", name);
  // Wait until the theme stylesheets are active.
  for (let i = 0; i < 40; i++) {
    if (inkdrop.themes.getActiveThemeNames?.().includes(name)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 800));
  return { requested: name, active: inkdrop.themes.getActiveThemeNames?.(), bodyClasses: [...document.body.classList] };
})();

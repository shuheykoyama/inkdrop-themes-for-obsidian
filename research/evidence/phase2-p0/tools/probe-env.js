// Diagnostic probe (not theme code): environment, stylesheet order, body classes.
(() => {
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el, i) => ({
    index: i,
    tag: el.tagName.toLowerCase(),
    href: el.getAttribute("href") || null,
    // Identify the theme / snippet style elements by their first characters only.
    head: el.tagName === "STYLE" ? (el.textContent || "").slice(0, 60) : null,
    isThemeStyleEl: window.app?.customCss?.styleEl === el,
  }));
  return {
    userAgent: navigator.userAgent,
    obsidianTitle: document.title,
    bodyClasses: [...document.body.classList],
    cssTheme: window.app?.customCss?.theme ?? null,
    stylesheetOrder: sheets,
    devicePixelRatio: window.devicePixelRatio,
    viewport: [window.innerWidth, window.innerHeight],
  };
})();

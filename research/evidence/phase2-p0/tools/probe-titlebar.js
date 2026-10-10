// Diagnostic probe: titlebar element visibility and which variable paints it.
(() => {
  const t = document.querySelector(".titlebar");
  const cs = t ? getComputedStyle(t) : null;
  const rules = [];
  for (const sheet of document.styleSheets) {
    let list; try { list = sheet.cssRules; } catch { continue; }
    for (const r of list) {
      if (r.selectorText && t && t.matches(r.selectorText) && /background/.test(r.cssText)) {
        rules.push({ sheet: sheet.href ? sheet.href.split("/").pop() : "theme <style>", selector: r.selectorText, css: r.cssText.slice(0, 160) });
      }
    }
  }
  const b = getComputedStyle(document.body);
  return {
    display: cs?.display, height: cs?.height, bg: cs?.backgroundColor,
    titlebarFocused: b.getPropertyValue("--titlebar-background-focused").trim(),
    titlebarBg: b.getPropertyValue("--titlebar-background").trim(),
    matchingBackgroundRules: rules,
  };
})();

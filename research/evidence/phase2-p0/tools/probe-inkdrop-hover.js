// Read-only: computed style of the sidebar row under the mouse (hover state), next to the selected row.
(() => {
  const rows = [...document.querySelectorAll(".sidebar-menu-item")];
  const hovered = rows.filter((el) => el.matches(":hover"));
  const pick = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { classes: [...el.classList], rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      backgroundColor: cs.backgroundColor, color: cs.color, boxShadow: cs.boxShadow };
  };
  return {
    theme: inkdrop.config.get("core.theme"),
    hovered: hovered.map(pick),
    selected: rows.filter((el) => el.classList.contains("active")).map(pick),
    // A non-selected, non-hovered row for comparison.
    idle: rows.filter((el) => !el.classList.contains("active") && !el.matches(":hover")).slice(0, 1).map(pick),
  };
})();

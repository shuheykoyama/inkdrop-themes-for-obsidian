// V-04: put the isolated Obsidian window on top of the z-order WITHOUT focusing it (inactive capture),
// so no other application's window can cover the capture rectangle.
(async () => {
  electronWindow.moveTop();
  await new Promise((r) => setTimeout(r, 500));
  return { focused: electronWindow.isFocused() };
})();

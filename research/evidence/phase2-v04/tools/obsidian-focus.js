// V-04: bring the isolated Obsidian window to the front and make its app active, using its own
// Electron APIs (no AppleScript, so the user's regular Obsidian process is never addressed).
(async () => {
  const remote = require("@electron/remote");
  remote.app.focus({ steal: true });
  electronWindow.moveTop();
  electronWindow.focus();
  await new Promise((r) => setTimeout(r, 800));
  return { focused: electronWindow.isFocused(), hasFocus: document.hasFocus(), bodyFocusedClass: document.body.classList.contains("is-focused") };
})();

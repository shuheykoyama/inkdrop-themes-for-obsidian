// What the new and the old ui.button.background selectors match in Settings > About (research/14 §6.139).
const [repo, label] = process.argv.slice(2);
const { evaluate } = await import(repo + "/tests/runtime/lib/cdp.mjs");
const spec = JSON.parse((await import("node:fs")).readFileSync(repo + "/tests/spec/runtime/desktop.json", "utf8"));
const NEW = spec.checks.find((c) => c.id === "ui.button.background").selector;
const OLD = ".modal.mod-settings .vertical-tab-content button:not(.mod-cta):not(.clickable-icon)";
const r = await evaluate(9333, String.raw`(async () => {
  app.setting.open(); await new Promise((r) => setTimeout(r, 1500));
  const doc = app.setting.modalEl.ownerDocument, ipc = require("electron").ipcRenderer;
  const first = (sel) => { const all = doc.querySelectorAll(sel), e = all[0]; if (!e) return { count: 0 }; const b = e.getBoundingClientRect();
    return { count: all.length, text: e.textContent.trim(), row: e.closest(".setting-item").querySelector(".setting-item-name")?.textContent, size: [Math.round(b.width), Math.round(b.height)], visible: e.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true }) }; };
  const out = { app: ipc.sendSync("version"), electron: process.versions.electron, update: ipc.sendSync("update"), tab: app.setting.activeTab?.id, new: first(${JSON.stringify(NEW)}), old: first(${JSON.stringify(OLD)}) };
  app.setting.close(); return out; })()`, 60000);
console.log(label, JSON.stringify(r));

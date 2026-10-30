// Dumps the structure of Settings > About (each .setting-item: classes, attributes, name, controls) of the
// isolated Obsidian on CDP 9333, for choosing the ui.button.background target (research/14 §6.139).
const [repo, label] = process.argv.slice(2);
const { evaluate } = await import(repo + "/tests/runtime/lib/cdp.mjs");
const PAGE = String.raw`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  app.setting.open(); await sleep(1500);
  const doc = app.setting.modalEl.ownerDocument;
  const ipc = require("electron").ipcRenderer;
  const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
  const attrs = (e) => [...e.attributes].filter((a) => a.name !== "style").map((a) => a.name + "=" + a.value.slice(0, 40)).join(" ");
  const content = doc.querySelector(".modal.mod-settings .vertical-tab-content");
  const items = [...content.querySelectorAll(".setting-item")].map((s, i) => ({
    i, attrs: attrs(s), name: s.querySelector(".setting-item-name")?.textContent.slice(0, 40) ?? null,
    visible: s.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true }), size: box(s),
    controls: [...s.querySelectorAll(".setting-item-control > *")].map((c) => ({ tag: c.tagName.toLowerCase(), attrs: attrs(c), text: c.textContent.trim().slice(0, 30), size: box(c), visible: c.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true }), bg: getComputedStyle(c).backgroundColor })),
  }));
  const out = { appVersion: ipc.sendSync("version"), electron: process.versions.electron, update: ipc.sendSync("update"), tab: app.setting.activeTab?.id, contentAttrs: attrs(content), items };
  app.setting.close();
  return out;
})()`;
const r = await evaluate(9333, PAGE, 60000);
console.log(JSON.stringify({ label, ...r }, null, 1));

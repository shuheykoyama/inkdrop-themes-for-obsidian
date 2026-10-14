// Settings popout under the runner's conditions: theme switch and translucency on / off before opening,
// then the active nav item's box over time, and when it is 0x0, what hides it.
import { evaluate } from "../../../../../tests/runtime/lib/cdp.mjs";
const n = Number(process.argv[2] ?? 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const themes = ["DEV solarized-dark (unnamed)", "DEV kanagawa-dragon (unnamed)"];
const rows = [];
for (let i = 0; i < n; i++) {
  rows.push(await evaluate(9333, `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(themes[i % 2])}); await app.customCss.loadTheme();
    app.customCss.setTranslucency(${i % 4 >= 2}); await sleep(600); app.customCss.setTranslucency(false); await sleep(800);
    app.setting.open();
    const t0 = performance.now(), samples = [];
    let el = null;
    while (performance.now() - t0 < 3000) {
      const m = app.setting.modalEl; const d = m && m.isConnected ? m.ownerDocument : null;
      el = d && d.querySelector(".modal.mod-settings .vertical-tab-nav-item.is-active");
      const r = el ? el.getBoundingClientRect() : null;
      samples.push([Math.round(performance.now() - t0), r ? Math.round(r.width) : -1, d ? d.visibilityState : null, d ? [d.defaultView.innerWidth, d.defaultView.innerHeight] : null]);
      await sleep(100);
    }
    const tab = app.setting.activeTab?.id ?? null;
    // Ancestors of the active item that are not displayed.
    const hidden = []; for (let e = el; e; e = e.parentElement) { const cs = e.ownerDocument.defaultView.getComputedStyle(e); if (cs.display === "none" || e.getBoundingClientRect().width === 0) hidden.push((e.className || e.tagName).toString().slice(0, 50) + " " + cs.display); }
    app.setting.close(); await sleep(400);
    return { tab, at700: samples.find((s) => s[0] >= 700), first: samples[0], last: samples[samples.length - 1], zeroAll: samples.every((s) => s[1] <= 0), hidden: hidden.slice(0, 4) };
  })()`, 60000));
}
console.log(JSON.stringify(rows));

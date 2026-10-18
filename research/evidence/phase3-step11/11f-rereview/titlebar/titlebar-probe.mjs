// Title bar before / after the translucent rule (research/14 §6.56), in an ISOLATED Obsidian (CDP 9333).
// For each build (theme.css of the commit before and after the fix) and theme: opaque -> translucent -> opaque,
// and translucent with the body class is-fullscreen added in the page (an emulation: no real full screen),
// read .titlebar (display, size, computed background-color), the background-color declarations of the rules
// matching it in cascade order (CDP CSS.getMatchedStylesForNode), the background of other surfaces (side
// effects), and a CDP screenshot of the top 60 px.
// usage: node titlebar-probe.mjs <vault> <out.json> <png dir> <name=dist dir>...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [vault, out, pngDir, ...builds] = process.argv.slice(2);
mkdirSync(pngDir, { recursive: true });
const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(`${method} ${JSON.stringify(m.error)}`)) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (fn, arg) => { const r = await send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60 && !(await ev(() => !!(window.app && app.workspace.layoutReady)).catch(() => false)); i++) await sleep(500);
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("DOM.enable"); await send("CSS.enable");
const SURFACES = [".titlebar", ".app-container", ".workspace-ribbon.mod-primary", ".workspace-tabs.mod-top .workspace-tab-header-container", ".mod-left-split .workspace-leaf-content", ".mod-root .view-content", ".status-bar"];
async function rules() {
  const { root } = await send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: ".titlebar" });
  if (!nodeId) return null;
  const m = await send("CSS.getMatchedStylesForNode", { nodeId });
  return m.matchedCSSRules.flatMap((x) => x.rule.style.cssProperties.filter((p) => p.name === "background-color" && !p.disabled && p.parsedOk !== false).map((p) => ({ selector: x.rule.selectorList.text, origin: x.rule.origin, value: p.value, important: !!p.important })));
}
const result = { environment: await ev(() => ({ app: window.require("electron").ipcRenderer.sendSync("version"), electron: (/Electron\/([\d.]+)/.exec(navigator.userAgent) || [])[1], frame: window.require("electron").ipcRenderer.sendSync("frame") })), states: [] };
const frame = result.environment.frame || "hidden";
try {
  for (const b of builds) {
    const [bname, dist] = b.split("=");
    for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
      const css = readFileSync(path.join(dist, theme, "theme.css"), "utf8");
      const name = `TB ${bname} ${theme}`;
      const dir = path.join(vault, ".obsidian/themes", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name, version: "0.0.0", minAppVersion: "1.14.4", author: "probe" }));
      writeFileSync(path.join(dir, "theme.css"), css);
      const ok = await ev(async ({ name, length }) => { await app.customCss.readThemes(); for (let i = 0; i < 30; i++) { app.customCss.setTheme(name); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 300)); if (app.customCss.theme === name && app.customCss.styleEl.textContent.length === length) return true; } return false; }, { name, length: css.length });
      if (!ok) throw new Error(`theme ${name} did not load`);
      for (const [state, translucent, fullscreen] of [["opaque", false, false], ["translucent", true, false], ["translucent, is-fullscreen (class emulated)", true, true], ["opaque again", false, false]]) {
        await ev(({ translucent, fullscreen }) => { app.customCss.setTranslucency(translucent); document.body.classList.toggle("is-fullscreen", fullscreen); return 1; }, { translucent, fullscreen });
        await sleep(800);
        const read = await ev((sel) => ({ cls: [...document.body.classList].filter((c) => /^(is-|theme-)/.test(c)).join(" "), surfaces: Object.fromEntries(sel.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return [s, { display: cs.display, size: [Math.round(r.width), Math.round(r.height)], visible: e.checkVisibility(), background: cs.backgroundColor }]; })) }), SURFACES);
        const shot = (await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1024, height: 60, scale: 1 } })).data;
        const file = `${frame}-${bname}-${theme}-${state.replace(/[^a-z]+/g, "-")}.png`;
        writeFileSync(path.join(pngDir, file), Buffer.from(shot, "base64"));
        result.states.push({ build: bname, theme, state, ...read, titlebarRules: await rules(), png: file });
        console.log(bname, theme, state, "->", read.surfaces[".titlebar"]?.display, read.surfaces[".titlebar"]?.background);
      }
    }
  }
} finally {
  await ev(() => { app.customCss.setTranslucency(false); document.body.classList.remove("is-fullscreen"); return 1; }).catch(() => {});
  ws.close();
}
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);

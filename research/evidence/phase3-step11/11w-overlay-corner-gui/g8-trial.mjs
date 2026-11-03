// G8 corner-radius trial (research/14 §6.186): the command palette and menu of the isolated Obsidian (127.0.0.1:9333 only) with
// one theme build, plus a few unchanged UIs as a side-effect check. Computed values, analytic corner clipping of hovered rows,
// keyboard checks, and page screenshots (Page.captureScreenshot). Nothing is created in the user's Vaults: the isolated vault
// copy is the only one touched, and no note is changed (dialogs are closed without submitting).
// usage: node g8-trial.mjs <label> <theme-name> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const [label, themeName, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target(match) {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === "page" && match(x));
  if (!t) return null;
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: n, method, params })); });
  return { send, ws };
}
const ev = async (c, expr) => { const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const KEYS = { Escape: 27, Enter: 13, ArrowDown: 40, ArrowUp: 38 };
const key = async (c, k) => { await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: KEYS[k] }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: KEYS[k] }); };
const mouse = (c, x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
const shot = async (c, file, clip) => { const r = await c.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(path.join(out, file), Buffer.from(r.data, "base64")); };

// Page-side helpers: measure(selector) -> first visible match; corners(rowRect, boxRect, radius) analytic check.
const HELP = `
  window.__m = (sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none"; }); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { rect: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10), radius: cs.borderRadius, overflow: cs.overflow, bg: cs.backgroundColor }; };
  window.__outside = (box, row, R) => { /* corners of row (x,y,w,h) lying outside the rounded rectangle box (x,y,w,h) with radius R */
    const [bx, by, bw, bh] = box, [rx, ry, rw, rh] = row; let out = 0;
    for (const [px, py] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) {
      const cx = px < bx + R ? bx + R : px > bx + bw - R ? bx + bw - R : px, cy = py < by + R ? by + R : py > by + bh - R ? by + bh - R : py;
      if (Math.hypot(px - cx, py - cy) > R + 0.01) out++;
    }
    return out; };
`;
const R = { label, themeName, at: new Date().toISOString(), checks: {} };
const c = await target((x) => x.url.includes("index.html"));
await ev(c, HELP);
R.setup = await ev(c, `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await app.customCss.readThemes();
  for (let i = 0; i < 20; i++) { if (app.customCss.theme !== ${JSON.stringify(themeName)}) app.customCss.setTheme(${JSON.stringify(themeName)}); await app.customCss.loadTheme(); await wait(300); if (app.customCss.theme === ${JSON.stringify(themeName)} && app.customCss.styleEl.textContent.length > 0) break; }
  app.customCss.setTranslucency(false);
  app.vault.setConfig("nativeMenus", false);
  await app.workspace.openLinkText("Sample note", "", false);
  electronWindow.setBounds({ x: 400, y: 250, width: 1200, height: 700 });
  await wait(1500);
  const css = app.customCss.styleEl.textContent;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(css));
  return { theme: app.customCss.theme, size: electronWindow.getSize(), cssSha256: [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""), cssLength: css.length };
})()`);
const num = (s) => parseFloat(s);

// ---- command palette
await ev(c, `app.commands.executeCommandById("command-palette:open"), 1`); await sleep(900);
const pal = {};
pal.container = await ev(c, `__m(".prompt")`);
pal.selected = await ev(c, `__m(".prompt .suggestion-item.is-selected")`);
pal.plain = await ev(c, `__m(".prompt .suggestion-item:not(.is-selected)")`);
pal.items = await ev(c, `document.querySelectorAll(".prompt .suggestion-item").length`);
// hover the third item with the real pointer, then read which item is selected and its corners against the prompt
const third = await ev(c, `(() => { const r = document.querySelectorAll(".prompt .suggestion-item")[2].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
await mouse(c, third[0], third[1]); await sleep(300);
pal.hover = await ev(c, `(() => { const items = [...document.querySelectorAll(".prompt .suggestion-item")]; const i = items.findIndex((e) => e.classList.contains("is-selected")); const r = items[i].getBoundingClientRect(), b = document.querySelector(".prompt").getBoundingClientRect(), R = parseFloat(getComputedStyle(document.querySelector(".prompt")).borderRadius); return { selectedIndex: i, radius: getComputedStyle(items[i]).borderRadius, cornersOutsidePrompt: __outside([b.x, b.y, b.width, b.height], [r.x, r.y, r.width, r.height], R) }; })()`);
// first and last visible items against the prompt's rounded corners
pal.edgeRows = await ev(c, `(() => { const items = [...document.querySelectorAll(".prompt .suggestion-item")]; const b = document.querySelector(".prompt").getBoundingClientRect(), R = parseFloat(getComputedStyle(document.querySelector(".prompt")).borderRadius); const f = (e) => { const r = e.getBoundingClientRect(); return { inset: [Math.round(r.x - b.x), Math.round(b.right - r.right), Math.round(r.y - b.y), Math.round(b.bottom - r.bottom)], cornersOutsidePrompt: __outside([b.x, b.y, b.width, b.height], [r.x, r.y, r.width, r.height], R) }; }; return { first: f(items[0]), last: f(items[items.length - 1]) }; })()`);
await shot(c, `${label}-palette.png`, pal.container ? { x: Math.max(0, pal.container.rect[0] - 24), y: Math.max(0, pal.container.rect[1] - 24), width: pal.container.rect[2] + 48, height: Math.min(700, pal.container.rect[3] + 48) } : undefined);
// keyboard: ArrowDown twice, type a query, Escape
const sel = () => ev(c, `[...document.querySelectorAll(".prompt .suggestion-item")].findIndex((e) => e.classList.contains("is-selected"))`);
const s0 = await sel(); await key(c, "ArrowDown"); await key(c, "ArrowDown"); await sleep(200); const s1 = await sel();
await c.send("Input.insertText", { text: "backlinks" }); await sleep(500);
const filtered = await ev(c, `document.querySelectorAll(".prompt .suggestion-item").length`);
await key(c, "Escape"); await sleep(600);
pal.keyboard = { selectedBefore: s0, selectedAfterTwoDown: s1, itemsAfterTyping: filtered, closedByEscape: (await ev(c, `document.querySelectorAll(".prompt").length`)) === 0 };
R.checks.palette = pal;

// ---- quick switcher (also a .prompt)
await ev(c, `app.commands.executeCommandById("switcher:open"), 1`); await sleep(800);
R.checks.switcher = { container: await ev(c, `__m(".prompt")`), row: await ev(c, `__m(".prompt .suggestion-item")`) };
await key(c, "Escape"); await sleep(500);

// ---- file context menu: hover first and last item, keyboard, near the window's bottom-right edge
const openMenu = (x, y, sel) => ev(c, `(() => { const el = document.querySelector(${JSON.stringify(sel)}) ?? document.elementFromPoint(${x}, ${y}); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: ${x}, clientY: ${y}, button: 2 })); return 1; })()`);
const fileEl = await ev(c, `(() => { const e = [...document.querySelectorAll(".nav-file-title")].find((x) => x.textContent.includes("Sample")); const b = e.getBoundingClientRect(); return [b.x + 40, b.y + 10]; })()`);
await openMenu(fileEl[0], fileEl[1], ".nav-file-title"); await sleep(700);
const menu = {};
menu.container = await ev(c, `__m(".menu")`);
menu.itemCount = await ev(c, `document.querySelectorAll(".menu .menu-item").length`);
const itemBox = (which) => ev(c, `(() => { const items = [...document.querySelectorAll(".menu .menu-item")].filter((e) => e.getBoundingClientRect().height > 2); const e = items[${which === "first" ? "0" : "items.length - 1"}]; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
for (const which of ["first", "last"]) {
  const p = await itemBox(which); await mouse(c, p[0], p[1]); await sleep(300);
  menu[`hover-${which}`] = await ev(c, `(() => { const items = [...document.querySelectorAll(".menu .menu-item")].filter((e) => e.getBoundingClientRect().height > 2); const i = items.findIndex((e) => e.classList.contains("selected")); const m = document.querySelector(".menu"), b = m.getBoundingClientRect(), R = parseFloat(getComputedStyle(m).borderRadius); if (i < 0) return { selectedIndex: -1 }; const r = items[i].getBoundingClientRect(), cs = getComputedStyle(items[i]); return { selectedIndex: i, bg: cs.backgroundColor, itemRadius: cs.borderRadius, inset: [Math.round(r.x - b.x), Math.round(b.right - r.right), Math.round(r.y - b.y), Math.round(b.bottom - r.bottom)], cornersOutsideMenu: __outside([b.x, b.y, b.width, b.height], [r.x, r.y, r.width, r.height], R) }; })()`);
  if (menu.container) { const b = menu.container.rect; await shot(c, `${label}-menu-hover-${which}.png`, { x: Math.max(0, b[0] - 16), y: Math.max(0, b[1] - 16), width: b[2] + 32, height: Math.min(700 - Math.max(0, b[1] - 16), b[3] + 32) }); }
}
await key(c, "ArrowDown"); await sleep(200);
menu.keyboardSelected = await ev(c, `[...document.querySelectorAll(".menu .menu-item")].filter((e) => e.getBoundingClientRect().height > 2).findIndex((e) => e.classList.contains("selected"))`);
await key(c, "Escape"); await sleep(500);
menu.closedByEscape = (await ev(c, `document.querySelectorAll(".menu").length`)) === 0;
// near the bottom-right edge
await openMenu(1180, 640, ".workspace-leaf-content"); await sleep(700);
menu.edge = await ev(c, `(() => { const m = document.querySelector(".menu"); if (!m) return null; const r = m.getBoundingClientRect(); return { rect: [r.x, r.y, r.width, r.height].map(Math.round), insideViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, radius: getComputedStyle(m).borderRadius }; })()`);
if (menu.edge) await shot(c, `${label}-menu-edge.png`, { x: 700, y: 300, width: 500, height: 400 });
await key(c, "Escape"); await sleep(500);
R.checks.menu = menu;

// ---- other .menu users
const others = {};
await openMenu(500, 300, ".cm-content"); await sleep(600); others.editorContextMenu = await ev(c, `__m(".menu")`); await key(c, "Escape"); await sleep(400);
await ev(c, `(() => { const b = [...document.querySelectorAll(".view-action")].find((e) => (e.getAttribute("aria-label") || "").toLowerCase().includes("more")); b?.click(); return 1; })()`); await sleep(600); others.moreOptionsMenu = await ev(c, `__m(".menu")`); await key(c, "Escape"); await sleep(400);
// ---- unchanged UIs
await ev(c, `app.commands.executeCommandById("graph:open"), 1`); await sleep(2500); others.graphControls = await ev(c, `__m(".graph-controls")`);
await ev(c, `app.workspace.detachLeavesOfType("graph"), 1`); await sleep(400);
await ev(c, `(async () => { await app.workspace.openLinkText("Sample note", "", false); return app.commands.executeCommandById("app:delete-file"); })()`); await sleep(900); others.modal = await ev(c, `__m(".modal")`); await key(c, "Escape"); await sleep(500);
await ev(c, `(() => { new Notice("trial notice", 0); return 1; })()`); await sleep(700); others.notice = await ev(c, `__m(".notice")`); await ev(c, `(() => { document.querySelector(".notice")?.click(); return 1; })()`); await sleep(400);
R.checks.others = others;
const sd = await target((x) => x.title.startsWith("Settings"));
R.checks.leftoverPrompts = await ev(c, `document.querySelectorAll(".prompt, .menu, .modal").length`);
writeFileSync(path.join(out, `trial-${label}.json`), JSON.stringify(R, null, 1));
c.ws.close();
console.log(label, "prompt radius", pal.container?.radius, "| selected row", pal.selected?.radius, "| menu", menu.container?.radius, "| leftovers", R.checks.leftoverPrompts);

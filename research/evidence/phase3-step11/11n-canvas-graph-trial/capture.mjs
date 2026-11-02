// Before / after screenshots of Canvas and Graph View for the trial (research/14 §6.171), in an ISOLATED Obsidian
// (tests/runtime/obsidian-isolated.sh, a copy of tests/fixtures/vault). Four conditions in one window and one vault:
// {Solarized Dark, Kanagawa Dragon} x {final build, trial build}. The two builds are installed side by side as themes
// with their own names, so only the theme changes between shots: same vault, window size and state.
// Shots are taken with CDP Page.captureScreenshot of the Obsidian page (not the macOS screen), after each state is set.
//
// usage: node capture.mjs <base-repo> <trial-repo> <vault> <out-dir> [--check]
//   --check: set every state up and print what is on screen (counts, node kinds), but take no screenshot.
// <out-dir> must not exist. Needs the isolated Obsidian running (CDP on 127.0.0.1:9333).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [baseRepo, trialRepo, vault, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const check = process.argv.includes("--check");
if (!baseRepo || !trialRepo || !vault || !outDir) { console.error("usage: node capture.mjs <base-repo> <trial-repo> <vault> <out-dir> [--check]"); process.exit(2); }
if (existsSync(outDir)) { console.error(`${outDir} exists; refusing to overwrite`); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const PORT = 9333;
const SIZE = { width: 1200, height: 800 };

// ---- test data (vault copy only)
const node = (id, x, y, color, extra = {}) => ({ id, type: "text", text: `# ${id}\n${color ? "colour " + color : "no colour"} node with a line of text`, x, y, width: 230, height: 120, ...(color ? { color } : {}), ...extra });
writeFileSync(path.join(vault, "UI Probe.canvas"), JSON.stringify({
  nodes: [node("n0", 0, 0), ...["1", "2", "3", "4", "5", "6"].map((c, i) => node("c" + c, 270 * (i + 1), 0, c)),
    node("hex", 0, 170, "#ff8800"), { id: "f", type: "file", file: "Other note.md", x: 270, y: 170, width: 230, height: 120 },
    { id: "g", type: "group", label: "Group", x: -20, y: 330, width: 560, height: 170 }, { id: "gc", type: "group", label: "Coloured group", color: "4", x: 560, y: 330, width: 500, height: 170 }],
  edges: [{ id: "e1", fromNode: "n0", fromSide: "right", toNode: "c1", toSide: "left", label: "edge" }, { id: "e2", fromNode: "c1", fromSide: "right", toNode: "c2", toSide: "left", color: "3" }, { id: "e3", fromNode: "hex", fromSide: "right", toNode: "f", toSide: "left" }],
}));
// Graph: a hub, three linked notes, tags, an attachment and an unresolved link.
writeFileSync(path.join(vault, "G hub.md"), "# Hub\n\nLinks: [[G a]] [[G b]] [[G c]] [[G missing]]\n\nTags: #gtag #other\n\n![[half-transparent.png]]\n");
writeFileSync(path.join(vault, "G a.md"), "Note a links to [[G b]] and has #gtag\n");
writeFileSync(path.join(vault, "G b.md"), "Note b links to [[G c]] and has #other\n");
writeFileSync(path.join(vault, "G c.md"), "Note c links to [[G hub]]\n");

// ---- builds installed as themes
const THEMES = [];
for (const [label, repo] of [["final", baseRepo], ["trial", trialRepo]]) {
  for (const key of ["solarized-dark", "kanagawa-dragon"]) {
    const manifest = JSON.parse(readFileSync(path.join(repo, "dist", key, "manifest.json"), "utf8"));
    const name = `${manifest.name} [${label}]`;
    const dir = path.join(vault, ".obsidian/themes", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ...manifest, name }));
    cpSync(path.join(repo, "dist", key, "theme.css"), path.join(dir, "theme.css"));
    THEMES.push({ key, label, name, id: `${key}-${label}` });
  }
}

// ---- CDP client with screenshots
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
if (!page) throw new Error("no Obsidian page target");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const run = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (file) => {
  if (check) return;
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(path.join(outDir, file), Buffer.from(r.data, "base64"));
};

// One window size for every shot (the page's own window; macOS screen untouched).
const win = await send("Browser.getWindowForTarget", { targetId: page.id });
await send("Browser.setWindowBounds", { windowId: win.windowId, bounds: { windowState: "normal", ...SIZE } });
await sleep(1000);

const log = [];
const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const setTheme = (name) => run(`(async () => {
  await app.customCss.readThemes();
  for (let i = 0; i < 20; i++) {
    if (app.customCss.theme !== ${JSON.stringify(name)}) app.customCss.setTheme(${JSON.stringify(name)});
    await app.customCss.loadTheme();
    await new Promise((r) => setTimeout(r, 300));
    if (app.customCss.theme === ${JSON.stringify(name)} && app.customCss.styleEl.textContent.length > 0) break;
  }
  app.customCss.setTranslucency(false);
  await new Promise((r) => setTimeout(r, 600));
  return { theme: app.customCss.theme, css: app.customCss.styleEl.textContent.length, w: innerWidth, h: innerHeight };
})()`);

// Canvas states.
const canvasScene = (select) => run(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(app.vault.getAbstractFileByPath("UI Probe.canvas"), { active: true });
  await wait(2500);
  const c = leaf.view.canvas;
  c.deselectAll?.();
  const all = [...c.nodes.values()];
  c.zoomToFit?.() ?? c.zoomToBbox?.({ minX: -40, minY: -40, maxX: 1100, maxY: 520 });
  await wait(1200);
  const pick = ${JSON.stringify(select)};
  if (pick) { const t = pick.edge ? c.edges.get(pick.edge) : c.nodes.get(pick.node); if (t) { c.selectOnly(t); } }
  await wait(800);
  return { nodes: c.nodes.size, edges: c.edges.size, selected: [...(c.selection ?? [])].map((x) => x.id), zoom: c.zoom, hasZoomToFit: !!c.zoomToFit };
})()`);

// Graph: global graph beside the hub note (the hub is the active file, so it draws as the focused node).
const graphScene = () => run(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hubLeaf = app.workspace.getLeaf(false);
  await hubLeaf.openFile(app.vault.getAbstractFileByPath("G hub.md"), { active: true });
  await wait(500);
  let g = app.workspace.getLeavesOfType("graph")[0];
  if (!g) { app.commands.executeCommandById("graph:open"); await wait(1500); g = app.workspace.getLeavesOfType("graph")[0]; }
  const v = g.view, de = v.dataEngine;
  const opts = de.getOptions ? de.getOptions() : {};
  de.setOptions?.({ ...opts, showTags: true, showAttachments: true, hideUnresolved: false, showOrphans: true, search: "" });
  await wait(4500);
  const r = v.renderer;
  const kinds = {};
  for (const n of r.nodes ?? []) kinds[n.type] = (kinds[n.type] ?? 0) + 1;
  return { nodes: r.nodes?.length, kinds, links: r.links?.length, optionKeys: Object.keys(opts), colours: Object.keys(r.colors ?? {}).length, active: app.workspace.getActiveFile()?.path };
})()`);

for (const t of THEMES) {
  const set = await setTheme(t.name);
  if (set.theme !== t.name) throw new Error(`theme not applied: ${t.name}`);
  note({ condition: t.id, ...set });
  for (const [scene, select] of [["canvas-overview", null], ["canvas-select-plain", { node: "n0" }], ["canvas-select-coloured", { node: "c4" }], ["canvas-select-edge", { edge: "e1" }]]) {
    const info = await canvasScene(select);
    note({ condition: t.id, scene, ...info });
    await shot(`${t.id}-${scene}.png`);
  }
  const g = await graphScene();
  note({ condition: t.id, scene: "graph", ...g });
  await shot(`${t.id}-graph.png`);
}
ws.close();
writeFileSync(path.join(outDir, "capture-log.json"), JSON.stringify({ at: new Date().toISOString(), check, size: SIZE, log }, null, 1));

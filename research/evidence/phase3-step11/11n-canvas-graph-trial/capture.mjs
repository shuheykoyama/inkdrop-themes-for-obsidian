// Before / after screenshots of Canvas and Graph View for the trial (research/14 §6.171, §6.172), in an ISOLATED Obsidian
// started by capture-run.sh (tests/runtime/obsidian-isolated.sh, a copy of tests/fixtures/vault). Four conditions in
// one window and one vault: {Solarized Dark, Kanagawa Dragon} x {final build, trial build}. The two builds are installed
// side by side as themes with their own names, so only the theme changes between shots.
// Shots are taken with CDP Page.captureScreenshot of the Obsidian page (not the macOS screen).
//
// Every state is verified before it is shot (capture-lib.mjs); any problem stops the run with exit 1, and nothing is
// shot for a state that did not verify. At the end the four conditions must show the same state per scene
// (same nodes, edges, view, selection, graph nodes and links, window); a Graph's layout is a force simulation and may
// differ in position, so only the colours of its nodes and lines are compared by eye.
//
// usage: node capture.mjs <base-repo> <trial-repo> <vault> <out-dir> [--check]
//   --check: set up and verify every state but take no screenshot (it still drives the isolated Obsidian window).
// <out-dir> must not exist.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasProblems, graphProblems, incomparableScenes, isolatedVaultProblems, themeProblems } from "./capture-lib.mjs";

const [baseRepo, trialRepo, vault, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const check = process.argv.includes("--check");
if (!baseRepo || !trialRepo || !vault || !outDir) { console.error("usage: node capture.mjs <base-repo> <trial-repo> <vault> <out-dir> [--check]"); process.exit(2); }
if (existsSync(outDir)) { console.error(`${outDir} exists; refusing to overwrite`); process.exit(2); }
const PORT = 9333;
const SIZE = { width: 1200, height: 800 };
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// ---- connect first: nothing is written before the open vault is verified to be the isolated one
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
if (!page) { console.error("no Obsidian page target"); process.exit(2); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const run = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = [], rows = [], problems = [];
const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };
const fail = (where, list) => { if (list.length) { for (const p of list) problems.push(`${where}: ${p}`); console.error(`PROBLEM ${where}: ${list.join(" | ")}`); } return list.length === 0; };

try {
  const base = await run("app.vault.adapter.basePath");
  if (!fail("isolation", isolatedVaultProblems(vault, base))) throw new Error("the open vault is not the isolated test vault; nothing was written");
  mkdirSync(outDir, { recursive: true });

  // ---- test data (vault copy only)
  const node = (id, x, y, color, extra = {}) => ({ id, type: "text", text: `# ${id}\n${color ? "colour " + color : "no colour"} node with a line of text`, x, y, width: 230, height: 120, ...(color ? { color } : {}), ...extra });
  const canvas = {
    nodes: [node("n0", 0, 0), ...["1", "2", "3", "4", "5", "6"].map((c, i) => node("c" + c, 270 * (i + 1), 0, c)),
      node("hex", 0, 170, "#ff8800"), { id: "f", type: "file", file: "Other note.md", x: 270, y: 170, width: 230, height: 120 },
      { id: "g", type: "group", label: "Group", x: -20, y: 330, width: 560, height: 170 }, { id: "gc", type: "group", label: "Coloured group", color: "4", x: 560, y: 330, width: 500, height: 170 }],
    edges: [{ id: "e1", fromNode: "n0", fromSide: "right", toNode: "c1", toSide: "left", label: "edge" }, { id: "e2", fromNode: "c1", fromSide: "right", toNode: "c2", toSide: "left", color: "3" }, { id: "e3", fromNode: "hex", fromSide: "right", toNode: "f", toSide: "left" }],
  };
  writeFileSync(path.join(vault, "UI Probe.canvas"), JSON.stringify(canvas));
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
      const css = readFileSync(path.join(repo, "dist", key, "theme.css"), "utf8");
      writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ...manifest, name }));
      writeFileSync(path.join(dir, "theme.css"), css);
      THEMES.push({ key, label, name, id: `${key}-${label}`, sha: sha256(css) });
    }
  }
  for (const key of ["solarized-dark", "kanagawa-dragon"]) {
    const [a, b] = THEMES.filter((t) => t.key === key);
    if (a.sha === b.sha) fail("builds", [`${key}: the final and trial builds are the same file`]);
  }

  // ---- wait for the vault to see the new notes
  for (let i = 0; i < 40; i++) {
    const seen = await run(`!!app.vault.getAbstractFileByPath("G hub.md") && !!app.vault.getAbstractFileByPath("UI Probe.canvas") && !!app.metadataCache.resolvedLinks["G hub.md"] && !!app.metadataCache.unresolvedLinks["G hub.md"]`);
    if (seen) break;
    await sleep(500);
  }

  // One window size for every shot (the page's own window; the macOS screen is not captured).
  const win = await send("Browser.getWindowForTarget", { targetId: page.id });
  await send("Browser.setWindowBounds", { windowId: win.windowId, bounds: { windowState: "normal", ...SIZE } });
  await sleep(1000);
  const bounds = (await send("Browser.getWindowBounds", { windowId: win.windowId })).bounds;

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
    const css = app.customCss.styleEl.textContent;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(css));
    return { theme: app.customCss.theme, sha: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""), cssLength: css.length, innerWidth, innerHeight };
  })()`);

  // Canvas: open, fit, select, then report what is there. The fit uses the canvas' own method; without one it
  // computes a box around all the nodes from their data.
  const canvasScene = (select) => run(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath("UI Probe.canvas"), { active: true });
    await wait(2500);
    const c = leaf.view.canvas;
    for (const m of ["deselectAll", "selectOnly"]) if (typeof c[m] !== "function") throw new Error("canvas." + m + " is not a function in this Obsidian");
    const data = (o) => { if (typeof o.getData !== "function") throw new Error("getData is not a function on a canvas node or edge"); return o.getData(); };
    c.deselectAll();
    const nodeData = [...c.nodes.values()].map(data);
    if (typeof c.zoomToFit === "function") c.zoomToFit();
    else if (typeof c.zoomToBbox === "function") c.zoomToBbox({ minX: Math.min(...nodeData.map((d) => d.x)) - 40, minY: Math.min(...nodeData.map((d) => d.y)) - 40, maxX: Math.max(...nodeData.map((d) => d.x + d.width)) + 40, maxY: Math.max(...nodeData.map((d) => d.y + d.height)) + 40 });
    else throw new Error("the canvas has neither zoomToFit nor zoomToBbox");
    await wait(1200);
    const pick = ${JSON.stringify(select)};
    if (pick) { const t = pick.edge ? c.edges.get(pick.edge) : c.nodes.get(pick.node); if (!t) throw new Error("nothing to select: " + JSON.stringify(pick)); c.selectOnly(t); }
    await wait(800);
    const wrap = (c.wrapperEl ?? leaf.view.containerEl).getBoundingClientRect();
    const outside = [...c.nodes.values()].filter((n) => { const r = n.nodeEl.getBoundingClientRect(); return r.left < wrap.left - 1 || r.top < wrap.top - 1 || r.right > wrap.right + 1 || r.bottom > wrap.bottom + 1; }).map((n) => n.id);
    const selected = [...c.selection].map((x) => x.id);
    const domSelected = pick && !pick.edge ? c.nodes.get(pick.node).nodeEl.classList.contains("is-selected") : null;
    const edgeData = [...c.edges.values()].map(data);
    return { nodes: nodeData.map((d) => ({ id: d.id, type: d.type, color: d.color ?? null })), edges: edgeData.map((d) => ({ id: d.id, fromNode: d.fromNode, toNode: d.toNode, color: d.color ?? null })), outside, selected, domSelected,
      view: { zoom: Math.round(c.zoom * 1000) / 1000, tx: Math.round(c.tx), ty: Math.round(c.ty) }, wrap: [Math.round(wrap.width), Math.round(wrap.height)], innerWidth, innerHeight };
  })()`);

  // Graph: global graph with the hub open as the active file; the display options are set and read back; the
  // expected nodes come from the metadata cache.
  const GRAPH_OPTIONS = { showTags: true, showAttachments: true, hideUnresolved: false, showOrphans: true };
  const graphScene = () => run(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath("G hub.md"), { active: true });
    await wait(500);
    let g = app.workspace.getLeavesOfType("graph")[0];
    if (!g) { app.commands.executeCommandById("graph:open"); await wait(1500); g = app.workspace.getLeavesOfType("graph")[0]; }
    if (!g) throw new Error("graph:open did not open a graph view");
    const de = g.view.dataEngine;
    for (const m of ["getOptions", "setOptions"]) if (typeof de?.[m] !== "function") throw new Error("graph dataEngine." + m + " is not a function in this Obsidian");
    de.setOptions({ ...de.getOptions(), ...${JSON.stringify(GRAPH_OPTIONS)}, search: "" });
    const r = g.view.renderer;
    let last = -1;
    for (let i = 0; i < 40; i++) { await wait(500); const n = (r.nodes ?? []).length; if (n > 0 && n === last) break; last = n; }
    await wait(1500);
    const idOf = (x) => (typeof x === "object" && x ? x.id : x);
    const mc = app.metadataCache;
    const md = app.vault.getMarkdownFiles().map((f) => f.path);
    const attachments = new Set(), unresolved = new Set();
    for (const [src, t] of Object.entries(mc.resolvedLinks)) for (const k of Object.keys(t)) if (!k.endsWith(".md")) attachments.add(k);
    for (const t of Object.values(mc.unresolvedLinks)) for (const k of Object.keys(t)) unresolved.add(k);
    return {
      expected: { notes: md, tags: Object.keys(mc.getTags()), attachments: [...attachments], unresolved: [...unresolved],
        requiredLinks: [["G hub.md", "G a.md"], ["G hub.md", "G b.md"], ["G hub.md", "G c.md"], ["G hub.md", "G missing"], ["G hub.md", "half-transparent.png"], ["G a.md", "G b.md"], ["G b.md", "G c.md"], ["G c.md", "G hub.md"]] },
      nodes: (r.nodes ?? []).map((n) => ({ id: n.id, type: n.type })), links: (r.links ?? []).map((l) => ({ source: idOf(l.source), target: idOf(l.target) })),
      options: de.getOptions(), active: app.workspace.getActiveFile()?.path, colours: Object.keys(r.colors ?? {}), innerWidth, innerHeight };
  })()`);

  const shot = async (file) => {
    if (check) return;
    const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(path.join(outDir, file), Buffer.from(r.data, "base64"));
  };

  for (const t of THEMES) {
    const set = await setTheme(t.name);
    const sizeOk = fail(`${t.id} theme`, themeProblems({ theme: set.theme, wantedTheme: t.name, sha: set.sha, wantedSha: t.sha, width: bounds.width, height: bounds.height, wantedSize: SIZE }));
    note({ condition: t.id, themeName: t.name, cssSha256: set.sha, cssLength: set.cssLength, window: bounds, inner: [set.innerWidth, set.innerHeight] });
    if (!sizeOk) throw new Error(`${t.id}: theme or window not as expected`);
    rows.push({ condition: t.id, scene: "window", sig: { inner: [set.innerWidth, set.innerHeight] } });
    for (const [scene, select] of [["canvas-overview", null], ["canvas-select-plain", { node: "n0" }], ["canvas-select-coloured", { node: "c4" }], ["canvas-select-edge", { edge: "e1" }]]) {
      const c = await canvasScene(select);
      const wanted = select ? (select.node ?? select.edge) : null;
      const ok = fail(`${t.id} ${scene}`, canvasProblems({ expected: canvas, nodes: c.nodes, edges: c.edges, outside: c.outside, selected: c.selected, wanted }).concat(c.domSelected === false ? ["the selected node has no is-selected class"] : []));
      note({ condition: t.id, scene, nodes: c.nodes.length, edges: c.edges.length, selected: c.selected, view: c.view, wrap: c.wrap, inner: [c.innerWidth, c.innerHeight] });
      if (!ok) throw new Error(`${t.id} ${scene}: state not as expected; no shot taken`);
      rows.push({ condition: t.id, scene, sig: { nodes: c.nodes, edges: c.edges, selected: c.selected, view: c.view, wrap: c.wrap, inner: [c.innerWidth, c.innerHeight] } });
      await shot(`${t.id}-${scene}.png`);
    }
    const g = await graphScene();
    const gOk = fail(`${t.id} graph`, graphProblems({ expected: g.expected, nodes: g.nodes, links: g.links, options: g.options, wantedOptions: GRAPH_OPTIONS }).concat(g.active === "G hub.md" ? [] : [`active file is ${g.active}, wanted G hub.md`]));
    const kinds = {};
    for (const n of g.nodes) (kinds[n.type] ??= []).push(n.id);
    note({ condition: t.id, scene: "graph", nodes: g.nodes.length, links: g.links.length, types: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length])), options: g.options, active: g.active, colourKeys: g.colours });
    if (!gOk) { note({ condition: t.id, scene: "graph-nodes-for-diagnosis", nodes: g.nodes.slice(0, 60), links: g.links.slice(0, 60) }); throw new Error(`${t.id} graph: state not as expected; no shot taken`); }
    rows.push({ condition: t.id, scene: "graph", sig: { nodes: g.nodes.map((n) => `${n.id}|${n.type}`).sort(), links: g.links.map((l) => `${l.source}>${l.target}`).sort(), options: g.options, active: g.active, inner: [g.innerWidth, g.innerHeight] } });
    await shot(`${t.id}-graph.png`);
  }
  fail("comparability", incomparableScenes(rows));
} catch (e) {
  problems.push(String(e.message ?? e));
  console.error(String(e.stack ?? e));
} finally {
  try { ws.close(); } catch { /* the page may already be gone */ }
  if (existsSync(outDir)) writeFileSync(path.join(outDir, "capture-log.json"), JSON.stringify({ at: new Date().toISOString(), check, size: SIZE, problems, log }, null, 1));
}
if (problems.length) { console.error(`${problems.length} problem(s); the images, if any, are not a faithful before / after comparison`); process.exit(1); }
console.log(check ? "check passed: every state verified, no screenshot taken" : "all states verified and shot");

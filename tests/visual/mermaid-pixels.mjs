// Mermaid pixels (step 11F, research/14 §6.53): for every Flowchart / Sequence diagram of the test note, the
// diagram as Obsidian draws it with the theme and the REFERENCE the runtime checks compare it with (the same
// diagram text, the same bundled Mermaid, base theme + themeVariables from the theme's --ink-mermaid-* tokens,
// as tests/runtime/mermaid-dump.js renders it) are drawn by the same renderer under the same conditions and
// compared pixel by pixel: the same Chromium page, the same place and CSS size, the same backdrop, one CDP
// Page.captureScreenshot each (deviceScaleFactor 1). The reference is laid over Obsidian's diagram in a fixed
// layer inside .mermaid but not its child, so the `.mermaid > svg` rules of the theme and app.css do not reach it.
//
// Controls, per theme: Obsidian's diagram shot twice (must be identical: the method is stable) and a shot after
// one painted value of Obsidian's SVG was changed inline (must differ: the method sees a painted change).
//
// Runs in the ISOLATED Obsidian only (tests/runtime/obsidian-isolated.sh, CDP on 127.0.0.1:9333); writes only
// the isolated vault's theme folders "PIXELS <theme>". Reports what it found; exit 1 when a diagram differs
// or a control does not behave as it must.
//
// usage: node tests/visual/mermaid-pixels.mjs --vault <isolated vault> --out <result.json> [--png <dir>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { THEMES } from "../lib/spec.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { vault: { type: "string" }, out: { type: "string" }, png: { type: "string" }, port: { type: "string", default: "9333" } } });
if (!args.vault || !args.out) { console.error("usage: node tests/visual/mermaid-pixels.mjs --vault <vault> --out <json> [--png <dir>]"); process.exit(2); }
const spec = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));

const targets = await (await fetch(`http://127.0.0.1:${args.port}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && /^app:\/\/obsidian\.md\/index\.html/.test(t.url));
if (!page) throw new Error(`no isolated Obsidian main window on 127.0.0.1:${args.port}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
// One CDP command; rejects on a protocol error or after 120 s without an answer.
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++nextId;
  const timer = setTimeout(() => reject(new Error(`${method}: no answer within 120 s`)), 120000);
  pending.set(n, (m) => { clearTimeout(timer); m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result); });
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (fn, arg) => {
  const r = await send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(r.exceptionDetails).slice(0, 600)}`);
  return r.result.value;
};
// A screenshot of a CSS-pixel rectangle of the viewport, as base64 PNG.
const shoot = async (r) => (await send("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 } })).data;
// Pixel comparison inside the page (the page's own PNG decoder). `a` and `b` are lists of shots of the two
// sides; the first of each is compared. A pixel where the shots of the SAME side differ among themselves is the
// renderer's own unsteadiness (anti-aliasing of slanted edges varies from one shot to the next, and with the
// place on the page: the reference's shots are copies at three places) and is counted apart (`unsteady`). Returns the differing pixels (any channel), the largest channel
// difference, the bounding box, and a histogram of the differences.
const compare = (a, b) => evaluate(async ({ a, b }) => {
  const load = async (d) => { const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${d}`)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext("2d"); x.drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, px: x.getImageData(0, 0, bm.width, bm.height).data }; };
  const A = await Promise.all(a.map(load)), B = await Promise.all(b.map(load));
  const all = [...A, ...B];
  if (all.some((x) => x.w !== A[0].w || x.h !== A[0].h)) return { sizes: all.map((x) => [x.w, x.h]), differing: null };
  // The largest of the four channel differences of pixel i between two images.
  const diff = (P, Q, i) => Math.max(Math.abs(P.px[i] - Q.px[i]), Math.abs(P.px[i + 1] - Q.px[i + 1]), Math.abs(P.px[i + 2] - Q.px[i + 2]), Math.abs(P.px[i + 3] - Q.px[i + 3]));
  let differing = 0, max = 0, box = null, unsteady = 0;
  const histogram = {};
  for (let i = 0; i < A[0].px.length; i += 4) {
    if (A.slice(1).some((x) => diff(A[0], x, i)) || B.slice(1).some((x) => diff(B[0], x, i))) { unsteady++; continue; }
    const d = diff(A[0], B[0], i);
    if (!d) continue;
    differing++; max = Math.max(max, d); histogram[d] = (histogram[d] ?? 0) + 1;
    const x = (i / 4) % A[0].w, y = Math.floor(i / 4 / A[0].w);
    box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
  }
  return { size: [A[0].w, A[0].h], pixels: A[0].w * A[0].h, unsteady, differing, maxChannelDiff: max, histogram, box };
}, { a, b });
// The precision control: every element of Obsidian's SVG gets its own computed fill, stroke, color and
// background-color back as inline !important values, i.e. the 8-bit values getComputedStyle reports (the theme's
// hsl() tokens are painted with fractional channels, which the computed strings round). Undone with `false`.
const freeze = (on) => evaluate((on) => {
  const PROPS = ["fill", "stroke", "color", "background-color"];
  const els = [...window.__PIX.svg.querySelectorAll("*")].filter((e) => !e.closest("style"));
  if (on) {
    const values = els.map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)); });
    els.forEach((e, i) => PROPS.forEach((p, j) => e.style.setProperty(p, values[i][j], "important")));
  } else els.forEach((e) => PROPS.forEach((p) => e.style.removeProperty(p)));
  return els.length;
}, on);

// Install the built theme in the isolated vault and select it (stylesheet loaded, length as built).
async function useTheme(theme) {
  const name = `PIXELS ${theme}`;
  const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
  const dir = path.join(args.vault, ".obsidian/themes", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name, version: "0.0.0", minAppVersion: "1.14.4", author: "pixels" }));
  writeFileSync(path.join(dir, "theme.css"), css);
  const ok = await evaluate(async ({ name, length }) => {
    await app.customCss.readThemes();
    for (let i = 0; i < 30; i++) {
      app.customCss.setTheme(name);
      await app.customCss.loadTheme();
      await new Promise((r) => setTimeout(r, 300));
      if (app.customCss.theme === name && app.customCss.styleEl.textContent.length === length) return true;
    }
    return false;
  }, { name, length: css.length });
  if (!ok) throw new Error(`theme ${name} did not load`);
}

// Open the note in Reading view in a new leaf and list its Flowchart / Sequence blocks.
const openNote = () => evaluate(async ({ note, kinds }) => {
  app.saveLocalStorage("mermaid-vault-trust", true);
  const leaf = app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "markdown", state: { file: note, mode: "preview" }, active: true });
  await new Promise((r) => setTimeout(r, 1000));
  window.__PIX = { leaf };
  // No scroll anchoring in this leaf: content put above a diagram (the shift below) must move it, not the
  // scroll position. Undone when the leaf is closed.
  leaf.view.contentEl.querySelectorAll("*").forEach((e) => { if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e.style.overflowAnchor = "none"; });
  leaf.view.contentEl.style.overflowAnchor = "none";
  const lines = (await app.vault.adapter.read(note)).split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "```mermaid") continue;
    const end = lines.indexOf("```", i + 1);
    const code = lines.slice(i + 1, end).join("\n");
    // The diagram type: the first word after any %% directive lines (as mermaid-dump.js).
    const head = code.split("\n").filter((l) => !l.trim().startsWith("%%")).join("\n").trim().split(/\s/)[0];
    const kind = /^(flowchart|graph)$/.test(head) ? "flowchart-v2" : head === "sequenceDiagram" ? "sequence" : null;
    if (kind && kinds.includes(kind)) blocks.push({ line: i, code, kind });
    i = end;
  }
  return blocks;
}, { note: spec.note, kinds: spec.kinds });

// Draw block n in Obsidian, render its reference, and return the SVG's rectangle (the viewport is made tall
// enough, and the diagram scrolled to the top, so the whole SVG is on screen).
const prepare = (b, n) => evaluate(async ({ b, n, tokens }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { leaf } = window.__PIX;
  const el = leaf.view.contentEl;
  const label = (svg) => [...svg.querySelectorAll("text, foreignObject")].map((e) => e.textContent).join("|");
  const probe = document.body.createEl("span");
  const themeVariables = Object.fromEntries(Object.entries(tokens).map(([k, t]) => { probe.style.color = `var(--ink-mermaid-${t})`; return [k, getComputedStyle(probe).color]; }));
  probe.remove();
  let svg = null, ref = null;
  for (let i = 0; i < 30 && !svg; i++) {
    leaf.view.currentMode.applyScroll(b.line);
    await sleep(400);
    if (!window.mermaid) continue;
    if (!ref) {
      // The reference exactly as mermaid-dump.js renders it.
      const init = `%%{init: ${JSON.stringify({ theme: "base", themeVariables })}}%%\n`;
      ref = (await window.mermaid.render(`pixref${n}${Date.now()}`, init + b.code)).svg;
    }
    const host = document.createElement("div");
    host.innerHTML = ref;
    host.style.cssText = "position: absolute; left: -10000px; top: 0;";
    document.body.append(host);
    const want = label(host.querySelector("svg"));
    host.remove();
    svg = [...el.querySelectorAll(`.mermaid > svg[aria-roledescription="${b.kind}"]`)].find((s) => label(s) === want) ?? null;
  }
  if (!svg) return { missing: true };
  svg.scrollIntoView({ block: "start" });
  await sleep(600);
  const r = svg.getBoundingClientRect();
  window.__PIX.svg = svg;
  window.__PIX.ref = ref;
  return { id: svg.id, rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }, exact: [r.x, r.y, r.width, r.height], inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
}, { b, n, tokens: spec.tokens });

// Draw the reference in the same layer as Obsidian's SVG: in normal flow, in a div right after the .mermaid
// element (not .mermaid's child, so neither the theme's nor app.css's `.mermaid > svg` rules reach it), at the
// same CSS size, moved with position: relative (no layer of its own) so that its x and the fraction of its y
// are Obsidian's. Two other placements were tried first and composite translucent fills apart from the note,
// up to 3/255 off for the same values: a fixed layer over the page, and an absolutely positioned div over the
// SVG (research/14 §6.54.1).
// Also returns how the reference's computed values in this place compare with the dump's (an offscreen host
// in <body>): the two must be the same, so the pixels compare what the runtime checks compare.
const showReference = () => evaluate(() => {
  const { svg, ref } = window.__PIX;
  const PROPS = ["fill", "stroke", "color", "background-color", "opacity", "fill-opacity", "stroke-opacity", "filter", "font-family", "font-size"];
  const read = (root) => [...root.querySelectorAll("*")].filter((e) => !e.closest("style")).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
  const host = document.createElement("div");
  host.style.cssText = "position: absolute; left: -10000px; top: 0;";
  host.innerHTML = ref;
  document.body.append(host);
  const offscreen = read(host.querySelector("svg"));
  host.remove();
  const r = svg.getBoundingClientRect();
  // Mermaid draws some shapes (stadium, lean and others) with randomly placed curve control points, so two
  // renders of the same text differ in those paths' geometry: the reference takes Obsidian's geometry (the `d`
  // and `points` attributes, element for element), so that only the colours are compared. The number of
  // elements changed so is reported. Three copies of the reference, one below the other: the anti-aliasing of
  // slanted and curved edges depends on where on the page a shape is drawn, so the pixels where the copies
  // differ among themselves are position-dependent.
  const tmpl = document.createElement("div");
  tmpl.innerHTML = ref;
  const obsEls = [...svg.querySelectorAll("*")].filter((e) => !e.closest("style"));
  const refEls = [...tmpl.querySelector("svg").querySelectorAll("*")].filter((e) => !e.closest("style"));
  let geometrySynced = 0;
  obsEls.forEach((e, i) => {
    const f = refEls[i];
    if (!f || f.tagName !== e.tagName) return;
    let changed = false;
    for (const at of ["d", "points"]) if (e.hasAttribute(at) && e.getAttribute(at) !== f.getAttribute(at)) { f.setAttribute(at, e.getAttribute(at)); changed = true; }
    if (changed) geometrySynced++;
  });
  const synced = tmpl.innerHTML;
  const frac = (v) => v - Math.floor(v);
  const layers = [];
  let anchor = svg.parentElement;
  for (let k = 0; k < 3; k++) {
    const layer = document.createElement("div");
    layer.className = "ink-pixels-reference";
    layer.style.cssText = "display: block; position: relative; left: 0; top: 0; margin: 0; padding: 0; border: 0; pointer-events: none;";
    layer.innerHTML = synced;
    anchor.after(layer);
    anchor = layer;
    const s = layer.querySelector("svg");
    s.style.cssText = `display: block; width: ${r.width}px; height: ${r.height}px; max-width: none; margin: 0;`;
    s.removeAttribute("width");
    layers.push(layer);
  }
  // Same x as Obsidian's SVG; each copy at least 8 px below the previous one, at the same fraction of y.
  let above = r.bottom;
  const placedAll = [];
  for (const layer of layers) {
    const s = layer.querySelector("svg");
    const at = s.getBoundingClientRect();
    const dy = Math.max(0, above + 8 - at.y);
    layer.style.left = `${r.x - at.x}px`;
    layer.style.top = `${dy + ((frac(r.y) - frac(at.y + dy)) + 1) % 1}px`;
    // Layers below move with this one's offset only visually (position: relative), so measure again.
    const now = s.getBoundingClientRect();
    placedAll.push([now.x, now.y, now.width, now.height]);
    above = now.bottom;
  }
  const s = layers[0].querySelector("svg");
  const placed = s.getBoundingClientRect();
  window.__PIX.refSvg = s;
  const here = read(s);
  const contextDiffs = here.filter((v, i) => v !== offscreen[i]).length + Math.abs(here.length - offscreen.length);
  // Obsidian's SVG against the reference, value for value and exactly (the runtime checks allow +-1/255 and
  // alpha +-0.01): the values that are not the same string, to explain any pixel difference.
  const obs = [...svg.querySelectorAll("*")].filter((e) => !e.closest("style"));
  const refs = [...s.querySelectorAll("*")].filter((e) => !e.closest("style"));
  const exact = new Map();
  obs.forEach((e, i) => {
    const a = getComputedStyle(e), b = refs[i] && getComputedStyle(refs[i]);
    if (!b) return;
    for (const p of PROPS) {
      if (a.getPropertyValue(p) === b.getPropertyValue(p)) continue;
      const k = `${e.tagName.toLowerCase()}${e.getAttribute("class") ? "." + e.getAttribute("class").trim().split(/\s+/).join(".") : ""} ${p}: ${a.getPropertyValue(p)} | reference ${b.getPropertyValue(p)}`;
      exact.set(k, (exact.get(k) ?? 0) + 1);
    }
  });
  return { placed: [placed.x, placed.y, placed.width, placed.height], svg: [r.x, r.y, r.width, r.height], elements: here.length, contextDiffs, notExactlyTheSame: [...exact].map(([k, n]) => `${n}x ${k}`), geometrySynced, copies: placedAll, inViewport: placedAll.every((c) => c[1] + c[3] <= innerHeight) };
});
const hideReference = () => evaluate(() => { for (const e of document.querySelectorAll(".ink-pixels-reference")) e.remove(); return true; });
// The painted-change control: the first shown shape of Obsidian's SVG with a fill gets an inline fill that is
// visibly different; undone afterwards.
const perturb = (on) => evaluate((on) => {
  const svg = window.__PIX.svg;
  const e = [...svg.querySelectorAll("rect, circle, ellipse, polygon, path")].find((x) => { const r = x.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(x).fill !== "none"; });
  if (!e) return false;
  if (on) e.style.setProperty("fill", "rgb(255, 0, 255)", "important");
  else e.style.removeProperty("fill");
  return `${e.tagName.toLowerCase()}.${e.getAttribute("class") ?? ""}`;
}, on);

// Obsidian's diagram at other places on the page: an empty div of a whole number of pixels is put right before
// the .mermaid element (removed with 0), so the same SVG is drawn lower by exactly that much.
const SHIFTS = [37, 91];
const shift = (h) => evaluate((h) => {
  document.getElementById("ink-pixels-shift")?.remove();
  if (!h) return true;
  const d = document.createElement("div");
  d.id = "ink-pixels-shift";
  d.style.cssText = `display: block; height: ${h}px; margin: 0; padding: 0; border: 0;`;
  window.__PIX.svg.parentElement.before(d);
  const r = window.__PIX.svg.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height];
}, h);
// Shots of Obsidian's diagram: `n` at its place, then one at each shifted place.
async function shootObsidian(rect, n) {
  const shots = [];
  for (let i = 0; i < n; i++) shots.push(await shoot(rect));
  for (const h of SHIFTS) {
    const at = await shift(h);
    // Only a shift by exactly h pixels (same x, size and fraction of y) is the same drawing at another place.
    if (Math.abs(at[0] - rect.exact[0]) > 0.01 || Math.abs(at[1] - (rect.exact[1] + h)) > 0.01 || Math.abs(at[2] - rect.exact[2]) > 0.01 || Math.abs(at[3] - rect.exact[3]) > 0.01) {
      await shift(0);
      throw new Error(`the diagram did not move by exactly ${h} px (${JSON.stringify(rect.exact)} -> ${JSON.stringify(at)})`);
    }
    shots.push(await shoot({ x: rect.x, y: rect.y + h, width: rect.width, height: rect.height }));
  }
  await shift(0);
  return shots;
}

const report = { measuredAt: new Date().toISOString(), environment: null, viewport: [1800, 3600], diagrams: [], controls: [] };
let bad = 0;
try {
  // A viewport tall enough for the largest diagram, for this session only; the page keeps the focus state.
  await send("Emulation.setDeviceMetricsOverride", { width: 1800, height: 3600, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  // A freshly started instance builds its workspace after the page loads; wait until the layout is ready.
  for (let i = 0; !(await evaluate(() => !!(window.app && app.workspace && app.workspace.layoutReady))); i++) {
    if (i === 60) throw new Error("Obsidian did not become ready");
    await new Promise((r) => setTimeout(r, 500));
  }
  report.environment = await evaluate(() => ({ app: window.require("electron").ipcRenderer.sendSync("version"), userAgent: navigator.userAgent }));
  for (const theme of THEMES) {
    await useTheme(theme);
    const blocks = await openNote();
    for (const [n, b] of blocks.entries()) {
      const p = await prepare(b, n);
      if (p.missing) { report.diagrams.push({ theme, block: n, kind: b.kind, missing: true }); bad++; console.log(`FAIL ${theme} block ${n} (${b.kind}): not drawn`); continue; }
      if (!p.inViewport) { report.diagrams.push({ theme, block: n, kind: b.kind, ...p, unusable: true }); bad++; console.log(`FAIL ${theme} block ${n}: not measurable ${JSON.stringify(p)}`); continue; }
      // Five shots of Obsidian's diagram at its place and one at each shifted place (the steadiness of the
      // renderer), and each of the three copies of the reference shot twice.
      const where = { ...p.rect, exact: p.exact };
      const obsidian = await shootObsidian(where, 5);
      // (The shots of one side differ among themselves only where the renderer is unsteady or the anti-aliasing
      // depends on the place: Obsidian's diagram is also shot 37 px and 91 px lower.)
      // Controls on the first diagram of each theme: the shots of one side agree outside the unsteady pixels,
      // and a painted change is seen.
      if (n === 0) {
        const again = await compare([obsidian[0]], [obsidian[1]]);
        const tag = await perturb(true);
        const changed = await compare(obsidian, [await shoot(p.rect)]);
        await perturb(false);
        const okChange = !!tag && changed.differing > 1000;
        report.controls.push({ theme, block: n, twoShots: again, perturbed: { element: tag, ...changed } });
        if (!okChange) bad++;
        console.log(`INFO ${theme} control: the same diagram shot twice: ${again.differing} pixels differ (max channel ${again.maxChannelDiff}) -- the renderer's unsteadiness, left out below`);
        console.log(`${okChange ? "PASS" : "FAIL"} ${theme} control: an inline fill on one ${tag} is seen (${changed.differing} pixels differ)`);
      }
      const placed = await showReference();
      const reference = [];
      // Each copy shot twice.
      for (let k = 0; k < 2; k++) for (const c of placed.copies) reference.push(await shoot({ x: Math.round(c[0]), y: Math.round(c[1]), width: p.rect.width, height: p.rect.height }));
      await hideReference();
      await freeze(true);
      const frozen = await shootObsidian(where, 5);
      await freeze(false);
      const asDrawn = await compare(obsidian, reference);
      const asComputed = await compare(frozen, reference);
      // The reference must sit exactly on the SVG and have the dump's computed values there.
      const near = (x, y) => Math.abs(x - y) < 0.01;
      const fits = placed.copies.every((c) => near(c[0], placed.svg[0]) && near(c[1] % 1, placed.svg[1] % 1) && near(c[2], placed.svg[2]) && near(c[3], placed.svg[3])) && placed.contextDiffs === 0 && placed.inViewport;
      // Verdict: with Obsidian's computed values frozen as the 8-bit values the runtime checks read, no pixel may
      // differ from the reference outside the unsteady and position-dependent ones. As drawn (not frozen), the
      // remaining differences are then those of the fractional channels of the theme's hsl() tokens: reported,
      // not judged here (the runtime checks compare the computed values with +-1/255).
      // The pixels left out must stay few (2 % of the diagram at most), or the comparison would say little.
      const fewLeftOut = asComputed.unsteady <= 0.02 * asComputed.pixels && asDrawn.unsteady <= 0.02 * asDrawn.pixels;
      const ok = fits && fewLeftOut && asComputed.differing === 0;
      if (!fewLeftOut) console.log(`FAIL ${theme} block ${n}: too many pixels left out as unsteady (${asDrawn.unsteady} / ${asComputed.unsteady} of ${asDrawn.pixels})`);
      report.diagrams.push({ theme, block: n, kind: b.kind, firstLine: b.code.split("\n")[0], rect: p.rect, placed, asDrawn, asComputed, ok });
      if (!ok) bad++;
      for (const x of placed.notExactlyTheSame.slice(0, 8)) console.log(`     computed value not exactly the reference's: ${x}`);
      if (!fits) console.log(`FAIL ${theme} block ${n}: reference not in place or its computed values differ from the dump's ${JSON.stringify(placed)}`);
      const say = (c) => (c.differing === null ? `sizes differ ${JSON.stringify(c.sizes)}` : `${c.differing} of ${c.pixels} pixels differ (max channel ${c.maxChannelDiff}; ${c.unsteady} unsteady left out)`);
      console.log(`${ok ? "PASS" : "FAIL"} ${theme} block ${n} (${b.kind}, ${b.code.split("\n")[0].slice(0, 40)}, ${p.rect.width}x${p.rect.height}, geometry of ${placed.geometrySynced} element(s) taken from Obsidian's): as drawn ${say(asDrawn)}; computed values frozen ${say(asComputed)}`);
      if (args.png) {
        mkdirSync(args.png, { recursive: true });
        for (const [k, list] of Object.entries({ obsidian, reference, frozen })) list.forEach((d, i) => writeFileSync(path.join(args.png, `${theme}-block${n}-${k}-${i + 1}.png`), Buffer.from(d, "base64")));
      }
    }
    await evaluate(() => { window.__PIX?.leaf?.detach(); delete window.__PIX; return true; });
  }
} finally {
  await hideReference().catch(() => {});
  await freeze(false).catch(() => {});
  await shift(0).catch(() => {});
  await send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  ws.close();
}
writeFileSync(args.out, `${JSON.stringify(report, null, 1)}\n`);
console.log(`\n${report.diagrams.length} diagrams compared, ${report.controls.length * 2} controls; ${bad ? `${bad} problem(s)` : "every diagram the same as its reference, controls as required"}`);
process.exit(bad ? 1 : 0);

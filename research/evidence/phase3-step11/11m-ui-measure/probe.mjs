// Computed Style survey of the Obsidian-only UI (research/14 §6.169): Properties, Canvas, Bases, Graph View and the
// right dock panes (Search, Backlinks, Outline, Tags), in an ISOLATED Obsidian (tests/runtime/obsidian-isolated.sh,
// a copy of tests/fixtures/vault). For three conditions (no theme = Obsidian's own dark, Solarized Dark, Kanagawa
// Dragon; opaque) it records, per UI, the computed colours of every distinct element signature and the resolved
// values of the variables the UI reads. Nothing is screenshotted or judged here; analyse.mjs compares the three.
// The probe notes are written only into the vault copy.
//
// usage: node probe.mjs <repo> <vault> <out.json>
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [repo, vault, out] = process.argv.slice(2);
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const PORT = 9333;
const THEMES = [{ key: "none", name: "" }, ...["solarized-dark", "kanagawa-dragon"].map((key) => ({ key, name: JSON.parse(readFileSync(path.join(repo, "dist", key, "manifest.json"), "utf8")).name }))];

writeFileSync(path.join(vault, "UI Properties.md"), [
  "---", "title: Probe", "tags: [probe, alpha/beta]", "aliases: [PP]", "status: draft", "count: 3", "done: true", "due: 2026-11-02",
  'link: "[[Other note]]"', "list: [a, b]", "---", "# Properties probe", "", "## Second heading", "", "Body with [[Other note]] and #probe tag.", "",
].join("\n"));
writeFileSync(path.join(vault, "UI Backlink.md"), "Links back to [[UI Properties]] (probe).\n");
const node = (id, x, color, extra = {}) => ({ id, type: "text", text: `# Node ${id}\nplain text ${color ?? "no colour"}`, x, y: 0, width: 220, height: 110, ...(color ? { color } : {}), ...extra });
writeFileSync(path.join(vault, "UI Probe.canvas"), JSON.stringify({
  nodes: [node("n0", 0), ...["1", "2", "3", "4", "5", "6"].map((c, i) => node("c" + c, 260 * (i + 1), c)), node("hx", 0, "#ff8800", { y: 160 }),
    { id: "f", type: "file", file: "Other note.md", x: 260, y: 160, width: 220, height: 110 },
    { id: "g", type: "group", label: "Group", x: -20, y: 300, width: 520, height: 160 }],
  edges: [{ id: "e1", fromNode: "n0", fromSide: "right", toNode: "c1", toSide: "left", label: "edge" }, { id: "e2", fromNode: "c1", fromSide: "right", toNode: "c2", toSide: "left", color: "3" }],
}));
writeFileSync(path.join(vault, "UI Table.base"), "views:\n  - type: table\n    name: Table\n");
writeFileSync(path.join(vault, "UI Cards.base"), "views:\n  - type: cards\n    name: Cards\n");

for (const t of THEMES.filter((x) => x.name)) {
  const dir = path.join(vault, ".obsidian/themes", t.name);
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(repo, "dist", t.key, "theme.css"), path.join(dir, "theme.css"));
  cpSync(path.join(repo, "dist", t.key, "manifest.json"), path.join(dir, "manifest.json"));
}

// Shared helpers, injected into every page call.
const HELPERS = String.raw`
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:-99px;top:-99px;width:1px;height:1px";
  document.body.append(probe);
  const resolve = (name) => { probe.style.backgroundColor = ""; probe.style.backgroundColor = "var(" + name + ")"; return getComputedStyle(probe).backgroundColor; };
  const rawVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  const varNames = (re) => {
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      const scan = (list) => { for (const r of list) { if (r.style) for (const p of r.style) if (p.startsWith("--") && re.test(p)) names.add(p); if (r.cssRules) scan(r.cssRules); } };
      scan(rules);
    }
    return [...names].sort();
  };
  const PROPS = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "fill", "stroke", "box-shadow", "opacity", "border-top-width", "border-left-width"];
  const sig = (el) => el.tagName.toLowerCase() + [...el.classList].sort().map((c) => "." + c).join("");
  const sample = (root, max) => {
    const rows = new Map();
    const walk = (el, depth) => {
      if (rows.size >= max || depth > 40) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.display !== "none" && (r.width > 0 || r.height > 0 || el instanceof SVGElement)) {
        const v = PROPS.map((p) => cs.getPropertyValue(p));
        const s = sig(el) + "|" + (el.getAttribute("data-type") ?? el.getAttribute("type") ?? "");
        const key = s + "|" + v.join("|");
        if (!rows.has(key)) rows.set(key, { sig: s, v, text: (el.children.length ? "" : (el.textContent || "")).trim().slice(0, 24), n: 1 }); else rows.get(key).n++;
      }
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(root, 0);
    return { props: PROPS, rows: [...rows.values()], truncated: rows.size >= max };
  };
  const setTheme = async (name) => {
    await app.customCss.readThemes();
    for (let i = 0; i < 20; i++) {
      if (app.customCss.theme !== name) app.customCss.setTheme(name);
      await app.customCss.loadTheme();
      await wait(300);
      if (app.customCss.theme === name && (!name || app.customCss.styleEl.textContent.length > 0)) break;
    }
    app.customCss.setTranslucency(false);
    await wait(600);
    return app.customCss.theme === name;
  };
  const openFile = async (path) => {
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath(path), { active: true });
    return leaf;
  };
  const palette = () => {
    const css = app.customCss.styleEl.textContent || "";
    const names = [...new Set(css.match(/--ink-[a-z0-9-]+/g) ?? [])].sort();
    const out = {};
    for (const n of names) { const c = resolve(n); if (c && c !== "rgba(0, 0, 0, 0)") out[n] = c; }
    return out;
  };
`;

const UIS = {
  properties: String.raw`async () => {
    const leaf = await openFile("UI Properties.md");
    const res = {};
    for (const [mode, st] of [["live", { mode: "source", source: false }], ["reading", { mode: "preview" }]]) {
      await leaf.setViewState({ type: "markdown", state: { file: "UI Properties.md", ...st }, active: true });
      await wait(1500);
      const root = leaf.view.containerEl.querySelector(".metadata-container");
      res[mode] = root ? sample(root, 300) : null;
    }
    return res;
  }`,
  canvas: String.raw`async () => {
    const leaf = await openFile("UI Probe.canvas");
    await wait(3000);
    const root = leaf.view.containerEl;
    return { all: sample(root.querySelector(".canvas-wrapper") ?? root, 500) };
  }`,
  bases: String.raw`async () => {
    const res = {};
    for (const f of ["UI Table.base", "UI Cards.base"]) {
      const leaf = await openFile(f);
      await wait(3000);
      const root = leaf.view.containerEl;
      res[f] = { dom: root.querySelector(".bases-view") ? "bases-view" : "no bases-view", all: sample(root, 400) };
    }
    return res;
  }`,
  graph: String.raw`async () => {
    app.commands.executeCommandById("graph:open");
    await wait(4000);
    const leaf = app.workspace.getLeavesOfType("graph")[0];
    if (!leaf) return { error: "no graph leaf" };
    const v = leaf.view, r = v.renderer ?? v.dataEngine?.renderer ?? null;
    const colours = r?.colors ? JSON.parse(JSON.stringify(r.colors, (k, x) => (typeof x === "object" && x && "rgb" in x ? { rgb: x.rgb, a: x.a } : x))) : null;
    return { rendererKeys: r ? Object.keys(r).slice(0, 60) : null, colours, controls: sample(v.containerEl.querySelector(".graph-controls") ?? v.containerEl, 200) };
  }`,
  dock: String.raw`async () => {
    await openFile("UI Properties.md");
    app.workspace.rightSplit.expand();
    await wait(500);
    const res = {};
    for (const [type, state] of [["search", { query: "probe" }], ["backlink", {}], ["outline", {}], ["tag", {}]]) {
      const leaf = app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type, state, active: true });
      await wait(2500);
      const el = leaf.view.containerEl;
      res[type] = { rows: el ? sample(el, 300) : null };
      leaf.detach();
      await wait(300);
    }
    return res;
  }`,
};

const results = {};
for (const t of THEMES) {
  results[t.key] = { themeName: t.name };
  const set = await evaluate(PORT, `(async () => { ${HELPERS}; return setTheme(${JSON.stringify(t.name)}); })()`, 120000);
  if (!set) throw new Error(`theme not applied: ${t.key}`);
  const base = await evaluate(PORT, `(async () => { ${HELPERS}
    const names = varNames(/^--(canvas|graph|bases|metadata|color-|text-highlight|search|backlink|outline|tag|slider|nav-|background-|text-|interactive-|input|checkbox|pill|embed|file-)/);
    const vars = {};
    for (const n of names) vars[n] = { raw: rawVar(n).slice(0, 120), rgb: resolve(n) };
    return { body: document.body.className, vars, palette: palette(), cssLength: app.customCss.styleEl.textContent.length };
  })()`, 120000);
  results[t.key].base = base;
  for (const [ui, fn] of Object.entries(UIS)) {
    results[t.key][ui] = await evaluate(PORT, `(async () => { ${HELPERS}; return (${fn})(); })()`, 180000);
    console.log(t.key, ui, "done");
  }
}
writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 1));

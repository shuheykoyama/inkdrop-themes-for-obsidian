// C3 side-effect probe (research/14 §6.141): a copy of c1a/c1-probe.mjs with another probe note. In an ISOLATED
// Obsidian (tests/runtime/obsidian-isolated.sh), for each theme, note and view, scroll through the view and record
// the computed colours of every element (the Reading --code-normal marker pass of c1-probe.mjs is kept as is).
//
// usage: node c3-probe.mjs <repo> <vault> <out.json>
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [repo, vault, out] = process.argv.slice(2);
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const PORT = 9333;
const THEMES = ["solarized-dark", "kanagawa-dragon"];

// Probe note, only in the isolated vault copy (not in tests/fixtures).
writeFileSync(path.join(vault, "C3 probe.md"), [
  "# C3 probe", "", "```markdown", "- dash item", "* star item", "+ plus item", "1. ordered dot", "2) ordered paren",
  "- level 1", "  - level 2", "    - level 3", "- [ ] task item", "> quote", "**strong** `code` [link](https://example.com)", "```", "",
  "```md", "- md alias item", "10. ten", "```", "", "```js", "const list = [1, 2]; // - not a list", "```", "",
  "Normal list:", "", "- normal bullet", "  - nested normal", "1. normal ordered", "- [ ] normal task", "",
].join("\n"));
for (const theme of THEMES) {
  const manifest = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8"));
  const dir = path.join(vault, ".obsidian/themes", manifest.name);
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(repo, "dist", theme, "theme.css"), path.join(dir, "theme.css"));
  cpSync(path.join(repo, "dist", theme, "manifest.json"), path.join(dir, "manifest.json"));
}

const PAGE = String.raw`async (themeName, file, mode) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await app.customCss.readThemes();
  for (let i = 0; i < 20; i++) {
    if (app.customCss.theme !== themeName) app.customCss.setTheme(themeName);
    await app.customCss.loadTheme();
    await wait(300);
    if (app.customCss.theme === themeName && app.customCss.styleEl.textContent.length > 0) break;
  }
  app.customCss.setTranslucency(false);
  const leaf = app.workspace.getLeaf(false);
  const state = mode === "reading" ? { mode: "preview" } : { mode: "source", source: mode === "source" };
  await leaf.setViewState({ type: "markdown", state: { file, ...state }, active: true });
  await wait(1500);
  const view = leaf.view;
  if (mode !== "reading") view.editor.setCursor({ line: 0, ch: 0 });
  const root = view.containerEl;
  const scroller = mode === "reading" ? root.querySelector(".markdown-preview-view") : root.querySelector(".cm-scroller");
  const PROPS = ["color", "background-color", "border-top-color", "border-left-color", "text-decoration-color", "fill", "stroke", "display"];
  const sig = (el) => el.tagName.toLowerCase() + [...el.classList].filter((c) => !/^(is-|cm-active|mod-active)/.test(c)).sort().map((c) => "." + c).join("");
  // Blocks: Reading sections / editor lines and widgets (they come and go while scrolling); a block's key is its
  // kind and leading text, plus an occurrence count.
  const blocks = () => mode === "reading"
    ? [...root.querySelectorAll(".markdown-preview-sizer > div")]
    : [...root.querySelectorAll(".cm-content > *")];
  const keyOf = new Map();
  const collect = (into) => {
    const seen = new Map();
    const list = blocks().map((b) => ["view", b]);
    for (const p of document.querySelectorAll(".popover.hover-popover")) list.push(["popover", p]);
    for (const [where, b] of list) {
      const base = where + "|" + sig(b) + "|" + (b.textContent || "").slice(0, 60);
      const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
      const bk = base + "#" + n;
      const walk = (el, rel) => {
        const cs = getComputedStyle(el);
        into[bk + " > " + rel] = { v: PROPS.map((p) => cs.getPropertyValue(p)).join(" | "), inRendered: !!el.closest(".markdown-rendered"), text: el.children.length ? "" : (el.textContent || "").slice(0, 30) };
        [...el.children].forEach((c, i) => walk(c, rel + "/" + sig(c) + ":" + i));
      };
      walk(b, sig(b));
    }
  };
  const marker = document.createElement("style");
  marker.textContent = ".theme-dark .markdown-rendered { --code-normal: rgb(1, 2, 3) !important; }";
  const base = {}, marked = {};
  const pass = async () => {
    collect(base);
    document.head.append(marker); await wait(50);
    collect(marked);
    marker.remove(); await wait(50);
  };
  scroller.scrollTop = 0; await wait(500);
  for (let guard = 0; guard < 200; guard++) {
    await pass();
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) break;
    scroller.scrollTop += Math.floor(scroller.clientHeight * 0.7);
    await wait(400);
  }
  let popover = null;
  if (false) {
    scroller.scrollTop = scroller.scrollHeight; await wait(500);
    const a = [...root.querySelectorAll("a.internal-link")].find((x) => x.getAttribute("data-href") === "C1 embedded" && !x.closest(".markdown-embed"));
    if (a) {
      const r = a.getBoundingClientRect();
      for (let t = 0; t < 3 && !document.querySelector(".popover.hover-popover .markdown-rendered"); t++) {
        app.workspace.trigger("hover-link", { event: new MouseEvent("mouseover", { clientX: r.x + 2, clientY: r.y + 2 }), source: "preview", hoverParent: view, targetEl: a, linktext: "C1 embedded", sourcePath: file });
        await wait(2000);
      }
      popover = !!document.querySelector(".popover.hover-popover .markdown-rendered");
      await pass();
      document.querySelectorAll(".popover.hover-popover").forEach((p) => p.remove());
    }
  }
  const formulaEditors = document.querySelectorAll(".formula-editor").length;
  const editorsInRendered = [...document.querySelectorAll(".cm-inline-code, .cm-math, .formula-editor, .markdown-source-view")].filter((e) => e.parentElement?.closest(".markdown-rendered")).map(sig);
  return { theme: app.customCss.theme, cssLength: app.customCss.styleEl.textContent.length, base, marked, popover, formulaEditors, editorsInRendered };
}`;

const results = [];
for (const theme of THEMES) {
  const name = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8")).name;
  for (const file of ["C3 probe.md", "Code blocks.md", "Markdown elements.md"]) {
    for (const mode of ["reading", "live", "source"]) {
      const r = await evaluate(PORT, `(${PAGE})(${JSON.stringify(name)}, ${JSON.stringify(file)}, ${JSON.stringify(mode)})`, 600000);
      if (r.theme !== name) throw new Error(`theme not applied: ${r.theme}`);
      const reached = Object.keys(r.base).filter((k) => r.marked[k] && r.marked[k].v !== r.base[k].v);
      results.push({ theme, file, mode, elements: Object.keys(r.base).length, popover: r.popover, formulaEditors: r.formulaEditors, editorsInRendered: r.editorsInRendered, reached, base: r.base, marked: Object.fromEntries(reached.map((k) => [k, r.marked[k].v])) });
      console.log(`${theme} ${file} ${mode}: ${Object.keys(r.base).length} elements, ${reached.length} reached by the Reading --code-normal${r.popover === null ? "" : `, hover popover ${r.popover}`}, editors inside .markdown-rendered: ${r.editorsInRendered.length}`);
    }
  }
}
writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 1));

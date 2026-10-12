import { evaluate } from "../../../../tests/runtime/lib/cdp.mjs";
const view = process.argv[2] ?? "reading";
const page = async (view) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await app.customCss.readThemes(); app.customCss.setTheme("DEV solarized-dark (unnamed)"); await app.customCss.loadTheme(); await sleep(800);
  const leaf = app.workspace.getLeaf(false);
  const st = view === "reading" ? { mode: "preview" } : { mode: "source", source: view === "source" };
  await leaf.setViewState({ type: "markdown", state: { file: "Mermaid.md", ...st }, active: true });
  await sleep(2500);
  const root = leaf.view.contentEl;
  // Visit every diagram (Reading view renders sections near the viewport only; the editor draws lines near it).
  const lines = (await app.vault.adapter.read("Mermaid.md")).split("\n");
  const starts = lines.map((l, i) => (l === "```mermaid" ? i : -1)).filter((i) => i >= 0);
  const seen = new Map();
  for (const ln of starts) {
    if (view === "reading") leaf.view.currentMode.applyScroll(ln);
    else leaf.view.editor.scrollIntoView({ from: { line: ln, ch: 0 }, to: { line: ln + 12, ch: 0 } }, true);
    await sleep(1500);
    for (const svg of root.querySelectorAll(".mermaid > svg")) {
      const k = svg.getAttribute("aria-roledescription");
      if (!seen.has(k)) seen.set(k, dump(svg));
    }
  }
  const out = { count: seen.size, diagrams: [...seen.values()] };
  return out;
  function dump(svg) {
    const chain = []; for (let e = svg; e && e !== root; e = e.parentElement) chain.push(`${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${[...e.classList].join(".")} filter=${getComputedStyle(e).filter}`);
    const style = svg.querySelector("style");
    const kinds = {};
    for (const el of svg.querySelectorAll("*")) {
      const k = `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`.slice(0, 90);
      if (!kinds[k]) kinds[k] = { n: 0, inlineStyle: el.getAttribute("style")?.slice(0, 100), fillAttr: el.getAttribute("fill"), strokeAttr: el.getAttribute("stroke"), fill: getComputedStyle(el).fill, stroke: getComputedStyle(el).stroke, color: getComputedStyle(el).color };
      kinds[k].n++;
    }
    return { id: svg.id, ariaRole: svg.getAttribute("aria-roledescription"), cls: svg.getAttribute("class"), chain: chain.slice(0, 4), styleLen: style?.textContent.length, style: style?.textContent, kinds };
  }
};
console.log(JSON.stringify(await evaluate(9333, `(${page})(${JSON.stringify(view)})`), null, 1));

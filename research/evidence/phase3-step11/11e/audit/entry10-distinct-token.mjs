// Entry #10 experiment (isolated Obsidian only): make --ink-mermaid-title-color distinct (rgb(255, 0, 0)) so the
// cluster-label rule's own value can be told apart from the primary-text rule's, then compare the cluster label
// span / p / text colours with and without the !important of #10.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const R = path.resolve(import.meta.dirname, "../../../../..");
const { evaluate } = await import(`${R}/tests/runtime/lib/cdp.mjs`);
const { withoutImportant } = await import(`${R}/tests/quality/lib.mjs`);
const vault = process.argv[2];
const SEL = '.theme-dark .markdown-rendered .mermaid > svg[aria-roledescription="flowchart-v2"] .cluster-label :is(span, p)';
const TOKEN = "\n.theme-dark { --ink-mermaid-title-color: rgb(255, 0, 0); }\n";
const extra = readFileSync(`${R}/tests/quality/mermaid-svg-labels.md`, "utf8");
const note = path.join(vault, "Mermaid.md");
if (!readFileSync(note, "utf8").includes(extra)) writeFileSync(note, `${readFileSync(note, "utf8").trimEnd()}\n\n${extra}`);
async function load(css) {
  const dir = path.join(vault, ".obsidian/themes/AUDIT e10");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: "AUDIT e10", version: "0.0.0", minAppVersion: "1.14.4", author: "audit" }));
  writeFileSync(path.join(dir, "theme.css"), css);
  return evaluate(9333, `(async () => { await app.customCss.readThemes(); for (let i = 0; i < 30; i++) { app.customCss.setTheme("AUDIT e10"); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 300)); if (app.customCss.styleEl.textContent.length === ${css.length}) return true; } return false; })()`);
}
const probe = (mode) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  app.saveLocalStorage("mermaid-vault-trust", true);
  const leaf = app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "markdown", state: { file: "Mermaid.md", ${mode === "reading" ? 'mode: "preview"' : 'mode: "source", source: false'} }, active: true });
  await sleep(1000);
  const lines = (await app.vault.adapter.read("Mermaid.md")).split("\\n");
  const out = [];
  const seen = new Set();
  for (const [i, l] of lines.entries()) {
    if (l !== "\`\`\`mermaid") continue;
    if (${JSON.stringify(mode)} === "reading") leaf.view.currentMode.applyScroll(i); else leaf.view.editor.scrollIntoView({ from: { line: i, ch: 0 }, to: { line: i + 10, ch: 0 } }, true);
    await sleep(800);
    for (const svg of leaf.view.contentEl.querySelectorAll('.mermaid > svg[aria-roledescription="flowchart-v2"]')) {
      if (seen.has(svg.id)) continue; seen.add(svg.id);
      for (const e of svg.querySelectorAll(".cluster-label *")) {
        const cs = getComputedStyle(e);
        out.push({ el: e.tagName.toLowerCase() + (e.getAttribute("class") ? "." + e.getAttribute("class").split(" ").join(".") : ""), text: e.textContent.slice(0, 12), color: cs.color, fill: cs.fill });
      }
    }
  }
  leaf.detach();
  return out;
})()`;
const result = {};
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const css = readFileSync(`${R}/dist/${theme}/theme.css`, "utf8");
  for (const [label, v] of [["with", css + TOKEN], ["without", withoutImportant(css, SEL, "color") + TOKEN]]) {
    if (!(await load(v))) throw new Error("theme did not load");
    for (const mode of ["reading", "live"]) result[`${theme} ${label} ${mode}`] = await evaluate(9333, probe(mode));
  }
}
console.log(JSON.stringify(result, null, 1));

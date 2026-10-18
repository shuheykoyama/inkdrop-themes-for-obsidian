// Height of the first external link in Reading view of "Markdown elements.md" with two builds of the theme.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const [repo, vault, ...builds] = process.argv.slice(2);
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
for (let i = 0; i < 60 && !(await evaluate(9333, "(() => !!(window.app && app.workspace.layoutReady))()").catch(() => false)); i++) await new Promise((r) => setTimeout(r, 500));
for (const b of builds) {
  const [name, dist] = b.split("=");
  const css = readFileSync(path.join(dist, "solarized-dark/theme.css"), "utf8");
  const dir = path.join(vault, ".obsidian/themes", `H ${name}`); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: `H ${name}`, version: "0.0.0", minAppVersion: "1.14.4", author: "h" }));
  writeFileSync(path.join(dir, "theme.css"), css);
  const r = await evaluate(9333, `(async () => { await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(`H ${name}`)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 800));
    const leaf = app.workspace.getLeaf("tab"); await leaf.setViewState({ type: "markdown", state: { file: "Markdown elements.md", mode: "preview" }, active: true }); await new Promise((r) => setTimeout(r, 1500));
    const a = leaf.view.contentEl.querySelector(".markdown-preview-view a.external-link"); const h = a ? a.getBoundingClientRect() : null; const f = a ? getComputedStyle(a) : null; leaf.detach();
    return { theme: app.customCss.theme, size: h && [Math.round(h.width), Math.round(h.height)], exact: h && h.height, font: f && f.fontFamily.slice(0, 60), lineHeight: f && f.lineHeight }; })()`);
  console.log(name, JSON.stringify(r));
}

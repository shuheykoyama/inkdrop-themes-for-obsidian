// Phone emulation (390 x 844) in the isolated Obsidian (9333): Reading view of Mermaid.md, for each Mermaid SVG
// its drawn width against the content column, its own width / max-width settings and whether the block scrolls,
// with the built theme and with no theme (Obsidian's default), to tell a theme overflow from Obsidian's own.
import fs from "node:fs";
import path from "node:path";
const [repo, vault] = process.argv.slice(2);
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ready = async () => { for (let i = 0; i < 80; i++) { try { if (await evaluate(9333, "(() => !!(window.app && app.workspace.layoutReady))()", 5000)) return; } catch {} await sleep(500); } };
await ready();
const dir = path.join(vault, ".obsidian/themes/solarized-dark"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name: "solarized-dark", version: "0.0.0", minAppVersion: "1.14.4", author: "t" }));
fs.writeFileSync(path.join(dir, "theme.css"), fs.readFileSync(path.join(repo, "dist/solarized-dark/theme.css"), "utf8"));
await evaluate(9333, "(() => { electronWindow.setSize(390, 844); app.emulateMobile(true); return 1; })()");
await sleep(3000); await ready(); await sleep(1500);
for (const theme of ["solarized-dark", ""]) {
  const r = await evaluate(9333, `(async () => {
    await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(theme)}); await app.customCss.loadTheme(); await new Promise((r) => setTimeout(r, 800));
    app.saveLocalStorage("mermaid-vault-trust", true);
    const leaf = app.workspace.getLeaf("tab"); await leaf.setViewState({ type: "markdown", state: { file: "Mermaid.md", mode: "preview" }, active: true });
    const out = [];
    for (let i = 0; i < 12; i++) { leaf.view.currentMode.applyScroll(i * 25); await new Promise((r) => setTimeout(r, 500)); }
    leaf.view.currentMode.applyScroll(0); await new Promise((r) => setTimeout(r, 800));
    for (const svg of leaf.view.contentEl.querySelectorAll(".mermaid > svg")) {
      const m = svg.parentElement, sec = svg.closest(".markdown-preview-section") || leaf.view.contentEl;
      const cs = getComputedStyle(svg), ms = getComputedStyle(m);
      const r = svg.getBoundingClientRect(), mr = m.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      out.push({ kind: svg.getAttribute("aria-roledescription"), svgWidth: Math.round(r.width), mermaidBox: Math.round(mr.width), column: Math.round(sr.width), viewport: innerWidth,
        widthAttr: svg.getAttribute("width"), inlineMaxWidth: svg.style.maxWidth || null, cssMaxWidth: cs.maxWidth, mermaidOverflowX: ms.overflowX, scrolls: m.scrollWidth > m.clientWidth + 1, beyondViewport: Math.round(r.right - innerWidth) });
    }
    leaf.detach();
    return { theme: app.customCss.theme || "(default)", isPhone: document.body.classList.contains("is-phone"), out };
  })()`, 120000);
  console.log(JSON.stringify(r, null, 1));
}
await evaluate(9333, "(() => { app.emulateMobile(false); return 1; })()").catch(() => {});

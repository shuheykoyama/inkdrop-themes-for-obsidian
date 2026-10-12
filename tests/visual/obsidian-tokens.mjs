// V-12: the token structure of the fenced code blocks of a note in the isolated Obsidian (CDP 9333), in
// Source mode, Live Preview and Reading view, as JSON (the page side is tests/runtime/code-tokens.js; the
// runtime tests use the same dump). With a theme name (a folder in the vault's .obsidian/themes), that theme
// is selected for the dump and the previous one restored afterwards.
//
// usage: node tests/visual/obsidian-tokens.mjs <note path in the vault> [theme name]
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluate } from "../runtime/lib/cdp.mjs";

const [note, theme] = process.argv.slice(2);
const dump = readFileSync(path.join(import.meta.dirname, "../runtime/code-tokens.js"), "utf8");
const before = await evaluate(9333, "app.customCss.theme");
if (theme !== undefined) await evaluate(9333, `(async () => { await app.customCss.readThemes(); app.customCss.setTheme(${JSON.stringify(theme)}); await new Promise((r) => setTimeout(r, 1000)); return 1; })()`);
try {
  const out = await evaluate(9333, `window.__CODE = ${JSON.stringify({ note, vars: [] })};\n${dump}`);
  console.log(JSON.stringify(out.views, null, 1));
} finally {
  if (theme !== undefined) await evaluate(9333, `(() => { app.customCss.setTheme(${JSON.stringify(before)}); return 1; })()`);
}

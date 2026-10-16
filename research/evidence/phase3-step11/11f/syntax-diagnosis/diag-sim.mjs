// Simulates the Reading-view "code element not rendered" failure in an isolated instance (port 9333): hides
// one language's <code> elements from the dump's query, runs tests/runtime/code-tokens.js, prints the error.
import { readFileSync } from "node:fs";
import path from "node:path";
const repo = process.argv[2];
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const spec = JSON.parse(readFileSync(path.join(repo, "tests/spec/syntax.json"), "utf8"));
const dump = readFileSync(path.join(repo, "tests/runtime/code-tokens.js"), "utf8");
for (let i = 0; i < 60 && !(await evaluate(9333, "(() => !!(window.app && app.workspace.layoutReady))()").catch(() => false)); i++) await new Promise((r) => setTimeout(r, 500));
const hide = `(() => { const q = Element.prototype.querySelectorAll; window.__q = q;
  Element.prototype.querySelectorAll = function (s) { const r = q.call(this, s); return s === ".markdown-rendered pre > code" ? [...r].filter((c) => !c.classList.contains("language-js")) : r; }; return 1; })()`;
await evaluate(9333, hide);
try {
  const out = await evaluate(9333, `window.__CODE = ${JSON.stringify({ note: spec.note, vars: [] })};\n${dump}`, 600000);
  const errs = Object.entries(out.views).flatMap(([view, bs]) => bs.filter((b) => b.error).map((b) => ({ view, lang: b.lang, error: b.error })));
  console.log(JSON.stringify({ simulated: "language-js <code> hidden from the Reading-view query", errors: errs }, null, 1));
} finally { await evaluate(9333, "(() => { Element.prototype.querySelectorAll = window.__q; return 1; })()"); }

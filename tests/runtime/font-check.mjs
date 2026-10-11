// V-36: do the lint-quoted UI font names resolve to the same fonts as Inkdrop's unquoted declarations?
// Runs in the ISOLATED Obsidian (CDP on 127.0.0.1). It adds a temporary, invisible-to-the-user test
// container to the page (removed at the end), renders the same text with each font-family declaration,
// and asks Chromium which platform fonts it actually used (CSS.getPlatformFontsForNode), per text node.
//
// usage: node tests/runtime/font-check.mjs [--port 9333] [--out <result.json>]
// Exit status 1 if any quoted declaration resolves to different fonts (family names or glyph counts)
// than its unquoted original.
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({ options: { port: { type: "string", default: "9333" }, out: { type: "string" } } });

// Inkdrop's declarations as written (research/data, inkdropapp_css@add48d9 ui.css:10 and :16) and the palette's
// lint notation (src/palette/*.css). --ink-page-font refers to --ink-font-name, so both are expanded here.
const INKDROP_FONT_NAME = "-apple-system, BlinkMacSystemFont, Segoe UI, 'Lato'";
const OURS_FONT_NAME = "-apple-system, 'BlinkMacSystemFont', 'Segoe UI', 'Lato'";
const PAGE_TAIL_INKDROP = "'Helvetica Neue', Arial, Helvetica, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol";
const PAGE_TAIL_OURS = "'Helvetica Neue', 'Arial', 'Helvetica', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";
const CASES = [
  { id: "font-name", inkdrop: INKDROP_FONT_NAME, ours: OURS_FONT_NAME },
  { id: "page-font", inkdrop: `${INKDROP_FONT_NAME}, ${PAGE_TAIL_INKDROP}`, ours: `${OURS_FONT_NAME}, ${PAGE_TAIL_OURS}` },
  // Each family on its own, to see what a single quoted name resolves to (BlinkMacSystemFont in particular).
  { id: "only-BlinkMacSystemFont", inkdrop: "BlinkMacSystemFont, monospace", ours: "'BlinkMacSystemFont', monospace" },
  { id: "only-Segoe-UI", inkdrop: "Segoe UI, monospace", ours: "'Segoe UI', monospace" },
  { id: "only-Arial", inkdrop: "Arial, monospace", ours: "'Arial', monospace" },
  { id: "only-Helvetica", inkdrop: "Helvetica, monospace", ours: "'Helvetica', monospace" },
  { id: "only-Apple-Color-Emoji", inkdrop: "Apple Color Emoji, monospace", ours: "'Apple Color Emoji', monospace" },
];
// Latin, digits, punctuation, Japanese (fallback), emoji (fallback), symbols.
const SAMPLES = { latin: "Sphinx of black quartz, judge my vow 0123456789", japanese: "日本語のテキスト", emoji: "😀✅🚀", symbols: "→ ✓ ⌘ ⌥ ⇧" };

const targets = await (await fetch(`http://127.0.0.1:${args.port}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && t.url.startsWith("app://obsidian.md"));
if (!page) { console.error("no isolated Obsidian page"); process.exit(2); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const call = async (method, params) => { const m = await send(method, params); if (m.error) throw new Error(`${method}: ${JSON.stringify(m.error)}`); return m.result; };

await call("DOM.enable"); await call("CSS.enable");
// Build the test container: one <span> per case x variant x sample, in a fixed position off to the side.
const build = `(() => {
  document.getElementById("ink-font-check")?.remove();
  const box = document.createElement("div");
  box.id = "ink-font-check";
  box.style.cssText = "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;font-size:16px;white-space:nowrap";
  const cases = ${JSON.stringify(CASES)}, samples = ${JSON.stringify(SAMPLES)};
  for (const c of cases) for (const v of ["inkdrop", "ours"]) for (const [k, text] of Object.entries(samples)) {
    const s = document.createElement("span");
    s.id = "f-" + c.id + "-" + v + "-" + k;
    s.style.fontFamily = c[v];
    s.textContent = text;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  return [...box.children].map((s) => [s.id, getComputedStyle(s).fontFamily]);
})()`;
const built = await call("Runtime.evaluate", { expression: build, returnByValue: true });
const computed = Object.fromEntries(built.result.value);
const { root } = await call("DOM.getDocument", { depth: -1 });
const env = (await call("Runtime.evaluate", { expression: "navigator.userAgent", returnByValue: true })).result.value;

const fontsOf = async (domId) => {
  const { nodeId } = await call("DOM.querySelector", { nodeId: root.nodeId, selector: `#${domId}` });
  const { fonts } = await call("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map((f) => `${f.familyName}${f.postScriptName ? ` (${f.postScriptName})` : ""}${f.isCustomFont ? " [custom]" : ""} x${f.glyphCount}`);
};
const results = [];
let differ = 0;
for (const c of CASES) {
  for (const k of Object.keys(SAMPLES)) {
    const a = await fontsOf(`f-${c.id}-inkdrop-${k}`);
    const b = await fontsOf(`f-${c.id}-ours-${k}`);
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) differ++;
    results.push({ case: c.id, sample: k, same, inkdropDeclaration: c.inkdrop, oursDeclaration: c.ours,
      inkdropComputed: computed[`f-${c.id}-inkdrop-${k}`], oursComputed: computed[`f-${c.id}-ours-${k}`], inkdropFonts: a, oursFonts: b });
    console.log(`${same ? "SAME" : "DIFF"} ${c.id} ${k}: inkdrop [${a.join("; ")}] ours [${b.join("; ")}]`);
  }
}
await call("Runtime.evaluate", { expression: 'document.getElementById("ink-font-check")?.remove(); 1' });
ws.close();
if (args.out) writeFileSync(args.out, `${JSON.stringify({ measuredAt: new Date().toISOString(), userAgent: env, results }, null, 1)}\n`);
console.log(differ ? `\n${differ} case(s) resolve to different fonts` : `\nall ${results.length} cases resolve to the same fonts (${env.match(/Electron\/[\d.]+/)?.[0]})`);
process.exit(differ ? 1 : 0);

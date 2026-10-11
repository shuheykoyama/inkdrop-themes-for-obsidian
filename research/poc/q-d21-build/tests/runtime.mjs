// T3: apply the built CSS in the ISOLATED Obsidian 1.14.4 instance and check computed backgrounds
// (Computed Style only; not screen pixels). Requires tests/obsidian-isolated.sh start <work>.
//
// usage: node tests/runtime.mjs <vault_dir> <out_json> [methods=p1,p2,p3]
// For each method and theme: opaque -> translucent -> opaque, accent override, settings-modal leak
// check; for P1 also mobile emulation (app.emulateMobile, desktop only, not a device test).
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postcss from "postcss";

const root = path.resolve(import.meta.dirname, "..");
const cdpTool = path.resolve(root, "../../evidence/phase2-p0/tools/cdp.mjs");
const [vault, outJson, methodsArg] = process.argv.slice(2);
const methods = (methodsArg ?? "p1,p2,p3").split(",");
const themeFile = path.join(vault, ".obsidian/themes/P2B-Diagnostic/theme.css");
const tmp = mkdtempSync(path.join(os.tmpdir(), "q-d21-rt-"));
let failures = 0;
const results = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
  results.push({ name, ok, detail });
  if (!ok) failures++;
};

// Evaluate a JS snippet (prefix + file) in the isolated Obsidian window and return its JSON result.
function evalJs(prefix, file) {
  const f = path.join(tmp, "eval.js");
  writeFileSync(f, prefix + (file ? readFileSync(file, "utf8") : ""));
  const res = spawnSync("node", [cdpTool, "9333", "eval", f], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(res.stderr);
  return JSON.parse(res.stdout || "null");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Expected computed colour of an --ink-* token: resolve var() in the palette rule, hsl() -> rgb(a).
function palette(css) {
  const defs = new Map();
  postcss.parse(css).walkDecls((d) => { if (d.parent.selector === ".theme-dark" && !defs.has(d.prop)) defs.set(d.prop, d.value); });
  return defs;
}
function expected(defs, token) {
  let v = defs.get(token);
  for (let i = 0; i < 10; i++) v = v.replace(/var\((--[\w-]+)\)/g, (m, n) => defs.get(n) ?? m);
  const m = /hsl\(\s*(-?[\d.]+)deg ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+)%)?\s*\)/.exec(v);
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const f = (n) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return { rgb: [f(0), f(8), f(4)].map((x) => x * 255), a: m[4] === undefined ? 1 : Number(m[4]) / 100 };
}
// Compare a computed "rgb(...)"/"rgba(...)" string with an expected colour (+-1 per channel, alpha +-0.01).
function same(computed, exp) {
  const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/.exec(computed ?? "");
  if (!m) return false;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return [1, 2, 3].every((i) => Math.abs(Number(m[i]) - exp.rgb[i - 1]) <= 1) && Math.abs(a - exp.a) <= 0.01;
}
const TRANSPARENT = { rgb: [0, 0, 0], a: 0 };

const OPAQUE = {
  ribbon: "--ink-sidebar-background",
  "left tab strip": "--ink-note-list-bar-background",
  "left leaf": "--ink-note-list-bar-background",
  "right tab strip": "--ink-note-list-bar-background",
  "right leaf": "--ink-note-list-bar-background",
  "centre tab strip": "--ink-note-list-bar-background",
  "centre active tab": "--ink-editor-background",
  "view header": "--ink-editor-background",
  "centre editor": "--ink-editor-background",
  "status bar": "--ink-note-list-bar-background",
};
const TRANSLUCENT = {
  "app-container": null,
  ribbon: "--ink-sidebar-background-acrylic",
  "left tab strip": "--ink-note-list-bar-background-acrylic",
  "left leaf": null,
  "left leaf-content": "--ink-note-list-bar-background-acrylic",
  "right tab strip": "--ink-note-list-bar-background-acrylic",
  "right leaf": null,
  "right leaf-content": "--ink-note-list-bar-background-acrylic",
  "centre tab strip": "--ink-note-list-bar-background-acrylic",
  "centre active tab": "--ink-editor-background-acrylic",
  "centre leaf-content": null,
  "view header": "--ink-editor-background-acrylic",
  "centre editor": "--ink-editor-background-acrylic",
  "status bar": "--ink-note-list-bar-background-acrylic",
};
const runProbe = (translucent, settingsModal) =>
  evalJs(`window.__POC = { translucent: ${translucent}, settingsModal: ${settingsModal} };\n`, path.join(root, "tests/runtime/probe-poc.js"));

const record = {};
for (const method of methods) {
  for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
    const css = path.join(root, "dist", method, `${theme}.css`);
    copyFileSync(css, themeFile);
    const defs = palette(readFileSync(css, "utf8"));
    const tag = `${method} ${theme}`;

    const opaque1 = runProbe(false, true);
    const trans = runProbe(true, true);
    const opaque2 = runProbe(false, false);
    record[tag] = { opaque1, trans, opaque2 };

    check(`T3 ${tag} opaque: body has no is-translucent`, !opaque1.bodyClasses.includes("is-translucent"));
    for (const [region, token] of Object.entries(OPAQUE)) {
      check(`T3 ${tag} opaque ${region} = ${token}`, same(opaque1.regions[region], expected(defs, token)), opaque1.regions[region]);
    }
    check(`T3 ${tag} opaque accent-h = ${defs.get("--ink-accent-h")}`, opaque1.accentH === defs.get("--ink-accent-h"), opaque1.accentH);
    check(`T3 ${tag} translucent: body has is-translucent`, trans.bodyClasses.includes("is-translucent"));
    for (const [region, token] of Object.entries(TRANSLUCENT)) {
      const exp = token ? expected(defs, token) : TRANSPARENT;
      check(`T3 ${tag} translucent ${region} = ${token ?? "transparent"}`, same(trans.regions[region], exp), trans.regions[region]);
    }
    // Leak checks: scoped translucent rules must not reach body-level variables or modals.
    check(`T3 ${tag} translucent: body --background-primary unchanged`, trans.bodyBackgroundPrimary === opaque1.bodyBackgroundPrimary, trans.bodyBackgroundPrimary);
    check(`T3 ${tag} translucent: settings modal unchanged`, trans.regions["settings modal"] === opaque1.regions["settings modal"], `${opaque1.regions["settings modal"]} / ${trans.regions["settings modal"]}`);
    // Back to opaque: every region identical to the first opaque probe.
    const diff = Object.keys(opaque2.regions).filter((r) => opaque2.regions[r] !== opaque1.regions[r]);
    check(`T3 ${tag} translucent -> opaque restores every region`, diff.length === 0 && !opaque2.bodyClasses.includes("is-translucent"), diff.join(", "));

    // User accent setting (inline style on body) must win, and the theme value come back on reset.
    const accent = evalJs(`(async () => {
      app.vault.setConfig("accentColor", "#e06c75");
      await new Promise((r) => setTimeout(r, 400));
      const set = getComputedStyle(document.body).getPropertyValue("--accent-h").trim();
      app.vault.setConfig("accentColor", "");
      await new Promise((r) => setTimeout(r, 400));
      return { set, reset: getComputedStyle(document.body).getPropertyValue("--accent-h").trim(), inline: document.body.style.getPropertyValue("--accent-h") };
    })();`);
    check(`T3 ${tag} user accent overrides theme accent`, accent.set !== defs.get("--ink-accent-h"), `set ${accent.set}`);
    check(`T3 ${tag} accent reset returns to theme accent`, accent.reset === defs.get("--ink-accent-h"), `reset ${accent.reset}`);
  }
}

// Mobile emulation (P1 output only; the CSS is identical for P2 / P3 per the static tests).
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const css = path.join(root, "dist", "p1", `${theme}.css`);
  copyFileSync(css, themeFile);
  const defs = palette(readFileSync(css, "utf8"));
  evalJs("(() => { app.emulateMobile(true); return 1; })();");
  await sleep(6000);
  const mob = evalJs(`(async () => {
    await app.customCss.loadTheme();
    app.workspace.leftSplit.expand?.();
    await new Promise((r) => setTimeout(r, 1000));
    const bg = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
    return { isMobile: document.body.classList.contains("is-mobile"), tablet: document.body.classList.contains("is-tablet"),
      left: bg(".workspace-drawer.mod-left"), right: bg(".workspace-drawer.mod-right"), navbar: bg(".mobile-navbar") };
  })();`);
  record[`mobile ${theme}`] = mob;
  const nl = expected(defs, "--ink-note-list-bar-background");
  check(`T3 mobile-emulation ${theme} is-mobile`, mob.isMobile === true, `tablet=${mob.tablet}`);
  check(`T3 mobile-emulation ${theme} left drawer = note list`, same(mob.left, nl), mob.left);
  check(`T3 mobile-emulation ${theme} right drawer = note list`, same(mob.right, nl), mob.right);
  evalJs("(() => { app.emulateMobile(false); return 1; })();");
  await sleep(6000);
}

writeFileSync(outJson, JSON.stringify({ measuredAt: new Date().toISOString(), results, record }, null, 1));
console.log(failures ? `\n${failures} runtime check(s) FAILED` : "\nall runtime checks passed");
process.exit(failures ? 1 : 0);

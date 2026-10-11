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
    // A missing element (null) must FAIL: same() rejects null, and the modal must actually be found.
    const editor = expected(defs, "--ink-editor-background");
    for (const [phase, p] of [["opaque", opaque1], ["translucent", trans]]) {
      check(`T3 ${tag} ${phase}: settings modal element found`, p.settingsModal?.found === true, JSON.stringify({ sameDocument: p.settingsModal?.sameDocument }));
      for (const modal of ["settings modal", "quick switcher"]) {
        check(`T3 ${tag} ${phase}: ${modal} = --ink-editor-background (opaque)`, same(p.regions[modal], editor), p.regions[modal]);
      }
      check(`T3 ${tag} ${phase}: modals closed after probe`, p.modalsLeftOpen === 0, String(p.modalsLeftOpen));
    }
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
// app.emulateMobile(true) picks tablet or phone from the window size at reload, so the window is
// resized first (tablet 1024x800, phone 400x860) and restored afterwards. Desktop only, not a device
// test: .is-ios / .is-android rules and real safe areas are not exercised.
const winSize = evalJs("(() => electronWindow.getSize())();");
const floatingBefore = evalJs("(() => app.vault.getConfig('floatingNavigation'))();");
const MOBILE = [
  { form: "tablet", size: [1024, 800], floating: [true] },
  { form: "phone", size: [400, 860], floating: [true, false] },
];
for (const theme of ["solarized-dark", "kanagawa-dragon"]) {
  const css = path.join(root, "dist", "p1", `${theme}.css`);
  copyFileSync(css, themeFile);
  const defs = palette(readFileSync(css, "utf8"));
  const nl = expected(defs, "--ink-note-list-bar-background");
  for (const { form, size, floating } of MOBILE) {
    evalJs(`(() => { electronWindow.setSize(${size[0]}, ${size[1]}); app.emulateMobile(true); return 1; })();`);
    await sleep(7000);
    for (const fl of floating) {
      // Drawers are measured open; the navigation bar with its own rendered box (0x0 = not displayed).
      const mob = evalJs(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        await app.customCss.loadTheme();
        app.vault.setConfig("floatingNavigation", ${fl});
        app.updateFloatingNavigationDisplay();
        await sleep(500);
        const st = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const b = e.getBoundingClientRect();
          return { bg: c.backgroundColor, display: c.display, size: [Math.round(b.width), Math.round(b.height)] }; };
        const out = { classes: [...document.body.classList].filter((c) => /^is-(mobile|phone|tablet|floating-nav|ios|android)$/.test(c)), navbar: st(".mobile-navbar") };
        for (const side of ["left", "right"]) {
          const split = side === "left" ? app.workspace.leftSplit : app.workspace.rightSplit;
          split.expand(); await sleep(800);
          out[side] = st(".workspace-drawer.mod-" + side);
          split.collapse(); await sleep(800);
        }
        return out;
      })();`);
      const tag = `T3 mobile-emulation ${form}${form === "phone" ? (fl ? " floating-nav" : " non-floating-nav") : ""} ${theme}`;
      record[`mobile ${form} floating=${fl} ${theme}`] = mob;
      check(`${tag} is-mobile + is-${form}`, mob.classes.includes("is-mobile") && mob.classes.includes(`is-${form}`), mob.classes.join(" "));
      check(`${tag} left drawer = note list`, mob.left?.display !== "none" && same(mob.left?.bg, nl), JSON.stringify(mob.left));
      check(`${tag} right drawer = note list`, mob.right?.display !== "none" && same(mob.right?.bg, nl), JSON.stringify(mob.right));
      if (form === "tablet") {
        // Tablets have no bottom navigation bar; its colour is not observable here.
        check(`${tag} navbar not displayed`, mob.navbar !== null && mob.navbar.display === "none", JSON.stringify(mob.navbar));
      } else {
        const shown = mob.navbar !== null && mob.navbar.display !== "none" && mob.navbar.size[0] > 0 && mob.navbar.size[1] > 0;
        check(`${tag} navbar displayed`, shown, JSON.stringify(mob.navbar));
        check(`${tag} navbar = note list`, shown && same(mob.navbar.bg, nl), mob.navbar?.bg);
      }
    }
    evalJs(`(() => { app.vault.setConfig("floatingNavigation", ${JSON.stringify(floatingBefore)}); app.emulateMobile(false); return 1; })();`);
    await sleep(7000);
  }
}
evalJs(`(() => { electronWindow.setSize(${winSize[0]}, ${winSize[1]}); return 1; })();`);

writeFileSync(outJson, JSON.stringify({ measuredAt: new Date().toISOString(), results, record }, null, 1));
console.log(failures ? `\n${failures} runtime check(s) FAILED` : "\nall runtime checks passed");
process.exit(failures ? 1 : 0);

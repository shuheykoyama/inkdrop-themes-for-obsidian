// Runtime tests: apply dist/<theme>/theme.css in the ISOLATED Obsidian and judge the computed styles
// against the spec (research/14 §3.2). Computed Style only, not screen pixels.
//
// usage (after `bash tests/runtime/obsidian-isolated.sh start <work>` printed <vault>):
//   node tests/runtime/run.mjs --vault <vault> [--out <result.json>] [--port 9333]
//   node tests/runtime/run.mjs --vault <vault> --self-test [--out <result.json>]
//
// Judgement (never a "same as before" comparison):
//   expect match  -> PASS only if the element exists, is displayed (checkVisibility and a non-empty box),
//                    and its value equals the expected one: kind "color" (default) parses as a colour and
//                    matches within +-1/255 and alpha +-0.01; kind "text" (e.g. --accent-h) matches exactly.
//                    Missing, hidden, unreadable or unparseable -> FAIL with the reason.
//   expect absent -> PASS only if no element matches. expect hidden -> PASS only if it exists and is not displayed.
// Status values: PASS (desktop = the real macOS app), PASS (EMULATED) (tablet / phone via
// app.emulateMobile(true) on desktop; never counts as a device check, research/14 §2.3), FAIL, and for the
// syntax fidelity of code blocks DIFF (text whose colour differs from Inkdrop's, with the reason; never a
// PASS, tests/runtime/lib/syntax.mjs), and for the Mermaid kinds the theme does not colour UNSUPPORTED
// (Obsidian's own inverted rendering, checked to stay readable; never a PASS, tests/runtime/lib/mermaid.mjs).
// Platforms run in the order desktop, tablet, phone, phone-nonfloating; the window size and emulation are
// restored at the end. The isolated instance's own test vault is the only place settings change.
// --self-test runs tests/runtime/self-test-spec.json, whose cases declare the outcome the runner must
// produce (several must FAIL); the run passes only if every case gets its declared outcome.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { declarations } from "../lib/css.mjs";
import { checkErrors, loadChecks, loadRequirements, PLATFORMS, POINTER_STATES, runtimeSpecFiles, STATES, THEMES } from "../lib/spec.mjs";
import { escape, evaluate, holdFocus, pointer, typeText } from "./lib/cdp.mjs";
import { judge } from "./lib/checks.mjs";
import { judgeMermaid } from "./lib/mermaid.mjs";
import { judgeSyntax, syntaxVars } from "./lib/syntax.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { vault: { type: "string" }, out: { type: "string" }, port: { type: "string", default: "9333" }, "self-test": { type: "boolean", default: false } } });
if (!args.vault) { console.error("usage: node tests/runtime/run.mjs --vault <vault> [--out <json>] [--self-test]"); process.exit(2); }

// ---------- spec ----------
const selfTest = args["self-test"];
const specDir = path.join(repo, "tests/spec");
const checks = selfTest
  ? loadChecks([path.join(repo, "tests/runtime/self-test-spec.json")])
  : loadChecks(runtimeSpecFiles(specDir));
const reqIds = selfTest ? null : new Set(loadRequirements(specDir).map((r) => r.id));
const specErrors = checks.flatMap((c) => checkErrors(c, reqIds));
if (selfTest) for (const c of checks) if (!["PASS", "FAIL"].includes(c.selfTest)) specErrors.push(`${c.id}: selfTest must be PASS or FAIL`);
if (specErrors.length) { console.error(`invalid spec:\n  ${specErrors.join("\n  ")}`); process.exit(2); }

// ---------- build, so the measured CSS is the current source ----------
const built = spawnSync(process.execPath, [path.join(repo, "scripts/build.mjs")], { encoding: "utf8" });
if (built.status !== 0) { console.error(built.stderr); process.exit(1); }

// ---------- run ----------
const probe = readFileSync(path.join(repo, "tests/runtime/probe.js"), "utf8");
// Syntax colours of code blocks (step 8): after the states of each platform / theme / appearance, the code
// blocks of tests/spec/syntax.json's note are dumped (tests/runtime/code-tokens.js) and judged against the
// oracle and Inkdrop's token ranges (tests/runtime/lib/syntax.mjs).
const syntaxSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/syntax.json"), "utf8"));
const inkdropTokens = JSON.parse(readFileSync(path.join(repo, syntaxSpec.inkdrop), "utf8"));
const codeDump = readFileSync(path.join(repo, "tests/runtime/code-tokens.js"), "utf8");
async function syntaxPage() {
  progress("syntax dump");
  return evaluate(args.port, `window.__CODE = ${JSON.stringify({ note: syntaxSpec.note, vars: syntaxVars(syntaxSpec, inkdropTokens) })};\n${codeDump}`);
}
// Mermaid (Q-D12, step 9): every diagram of tests/spec/mermaid.json's note is dumped
// (tests/runtime/mermaid-dump.js) and judged against a reference rendering (tests/runtime/lib/mermaid.mjs).
const mermaidSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));
const mermaidDump = readFileSync(path.join(repo, "tests/runtime/mermaid-dump.js"), "utf8");
async function mermaidPage(view, opts = {}, spec = mermaidSpec) {
  progress("mermaid dump", view, JSON.stringify(opts));
  const input = { note: spec.note, view, tokens: spec.tokens, kinds: spec.kinds, unsupported: spec.unsupported, reference: "inkdrop", ...opts };
  return evaluate(args.port, `window.__MERMAID = ${JSON.stringify(input)};\n${mermaidDump}`);
}
// Obsidian's base colour scheme of the isolated vault ("obsidian" = dark, "moonstone" = light).
// It is a vault setting, which Obsidian 1.14.4's own config reload can put back (research/14 §6.25): written to
// disk at once and checked after the reload window, up to 3 times.
const setScheme = (scheme) => evaluate(args.port, `(async () => { for (let i = 0; i < 3; i++) { app.changeTheme(${JSON.stringify(scheme)}); await app.vault.saveConfig(); await new Promise((r) => setTimeout(r, 800)); if (document.body.classList.contains(${JSON.stringify(scheme === "moonstone" ? "theme-light" : "theme-dark")}) && app.vault.getConfig("theme") === ${JSON.stringify(scheme)}) return true; } return false; })()`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// INK_PROGRESS=1 prints each step to stderr with the time (to see where a run stops).
const progress = (...m) => { if (process.env.INK_PROGRESS) console.error(new Date().toISOString(), ...m); };
const results = [];
const environment = {};

// Wait until the window (re)loaded and the workspace layout is ready; reloads drop the CDP connection.
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { if (await evaluate(args.port, "(() => !!(window.app && app.workspace && app.workspace.layoutReady))()")) return; } catch { /* reloading */ }
    await sleep(500);
  }
  throw new Error("Obsidian did not become ready");
}
// Desktop or emulated tablet / phone. app.emulateMobile(true) picks tablet or phone from the window size at
// load, so the window is resized first and the page reloaded (research/13 §2.1.1).
const SIZES = { tablet: [1024, 800], phone: [400, 860], "phone-nonfloating": [400, 860] };
async function setPlatform(platform, original) {
  const emulated = await evaluate(args.port, "(() => document.body.classList.contains('emulate-mobile'))()");
  if (platform === "desktop") {
    if (emulated) { await evaluate(args.port, `(() => { electronWindow.setSize(${original[0]}, ${original[1]}); app.emulateMobile(false); return 1; })()`); await sleep(1500); await waitReady(); }
    return;
  }
  // Translucency is macOS-desktop only: turn it off before any mobile emulation (an opaque mobile check
  // must never run in a translucent window; the environment check below asserts it).
  await evaluate(args.port, "(() => { app.customCss.setTranslucency(false); return 1; })()");
  const [w, h] = SIZES[platform];
  const cur = await evaluate(args.port, "(() => electronWindow.getSize())()");
  const want = platform === "tablet" ? "is-tablet" : "is-phone";
  const ok = emulated && cur[0] === w && cur[1] === h && (await evaluate(args.port, `(() => document.body.classList.contains('${want}'))()`));
  if (ok) return;
  await evaluate(args.port, `(() => { electronWindow.setSize(${w}, ${h}); ${emulated ? "location.reload()" : "app.emulateMobile(true)"}; return 1; })()`);
  await sleep(1500);
  await waitReady();
}

// States that need a genuine pointer (research/14 §6.8): the probe prepares the state and the runner moves /
// clicks through CDP Input, waits until the overlay is really there, measures, then puts the pointer back on a
// neutral spot, presses Escape and waits for the overlay to close. interact() returns what it saw, which
// becomes runner.pointer-prepared (FAIL when the overlay never came).
const center = (sel) => evaluate(args.port, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
// Poll in the page (every 100 ms, up to `ms`) until `selector` matches; the time it took, or null.
const appeared = (selector, ms) => evaluate(args.port, `(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { if (document.querySelector(${JSON.stringify(selector)})) return Math.round(performance.now() - t0); await new Promise((r) => setTimeout(r, 100)); } return null; })()`);
// What lies under a point and whether the window has focus: recorded when an overlay did not come.
const under = (x, y) => evaluate(args.port, `(() => { const e = document.elementFromPoint(${x}, ${y}); return { under: e ? (e.className || e.tagName).toString().slice(0, 80) : null, focus: document.hasFocus(), visibility: document.visibilityState }; })()`);
// The overlay each pointer state must produce, and where the pointer goes. In the self-test state
// "self-test-pointer-missed" the pointer goes to the status bar, where no link preview can open.
const POINTER = {
  "popover-open": { target: ".workspace-leaf.mod-active .cm-hmd-internal-link, .workspace-leaf.mod-active .internal-link", modifiers: 4, overlay: ".popover.hover-popover" },
  "tooltip-open": { target: ".workspace-ribbon.mod-primary .side-dock-ribbon-action", overlay: ".tooltip" },
  "self-test-pointer-missed": { target: ".status-bar", modifiers: 4, overlay: ".popover.hover-popover" },
};
// Runner self-test: the states that take a prepared state away on purpose, and the runner check that must
// then FAIL (tests/runtime/self-test-spec.json; the probe does the taking away, research/14 §6.25).
const SELF_TEST_BREAKS = {
  "self-test-ed-gutter-lost": ["runner.ed-prepared", "runner.config-prepared"],
  "self-test-fold-lost": ["runner.ed-prepared"],
  "self-test-settings-search": ["runner.settings-prepared"],
  "self-test-pointer-missed": ["runner.pointer-prepared"],
};
let menuWarmedUp = false;
async function interact(state) {
  if (state === "menu-open") {
    // The first DOM menu of a session never marks a row as selected under the pointer (Obsidian behaviour,
    // independent of the theme: observed with and without retries); open and close one menu once first.
    if (!menuWarmedUp) {
      const f = await center(".workspace-split.mod-left-split .nav-file-title");
      if (f) { await pointer(args.port, { x: f[0], y: f[1], click: true, button: "right" }); await appeared(".menu", 3000); await escape(args.port); await sleep(400); }
      menuWarmedUp = true;
    }
    const file = await center(".workspace-split.mod-left-split .nav-file-title");
    if (file) await pointer(args.port, { x: file[0], y: file[1], click: true, button: "right" });
    const menuMs = file ? await appeared(".menu .menu-item:not(.is-label)", 3000) : null;
    const item = menuMs === null ? null : await center(".menu .menu-item:not(.is-label)");
    // Move onto the first row until it gets its "selected" class: the very first menu of a session ignored
    // the first pointer moves (later menus react at once). At most 4 attempts; the check itself still
    // fails if the row never becomes selected.
    let selected = false;
    for (let i = 0; item && i < 4 && !selected; i++) {
      await pointer(args.port, { x: item[0] - 2 + (i % 2) * 4, y: item[1] });
      selected = (await appeared(".menu .menu-item.selected", 400)) !== null;
    }
    return { overlay: ".menu .menu-item.selected", shown: selected, target: !!file, ms: menuMs };
  }
  if (state === "ed-suggest") {
    // The probe put the cursor at the end of the last line of "Editor chrome"; typing "[[" opens Obsidian's
    // link suggestions (a .suggestion-container on the body).
    await typeText(args.port, " [[Oth");
    const ms = await appeared(".suggestion-container", 3000);
    return { overlay: ".suggestion-container", shown: ms !== null, ms };
  }
  // Hover states. The overlay appeared about 0.3 s after the pointer arrived in 20 of 20 trials on each kind
  // (Electron 39.5.1, research/14 §6.25); wait up to 3 s for it. If it does not come, record what is under the
  // pointer and the window state, move away and come back, at most 3 times; every attempt is reported.
  const p = POINTER[state];
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    const at = await center(p.target);
    if (!at) { attempts.push({ target: false }); break; }
    await pointer(args.port, { x: at[0], y: at[1], modifiers: p.modifiers ?? 0 });
    const ms = await appeared(p.overlay, 3000);
    if (ms !== null) { attempts.push({ ms }); return { overlay: p.overlay, shown: true, attempts }; }
    attempts.push({ ms: null, ...(await under(at[0], at[1])) });
    const away = await center(".status-bar");
    if (away) await pointer(args.port, { x: away[0] - 40, y: away[1] });
    await sleep(500);
  }
  return { overlay: p.overlay, shown: false, attempts };
}
// Returns how many pointer overlays are still open after up to 4 s: a hover popover closes on its own a
// moment after the pointer leaves, and one left behind would colour the next state's measurements. The
// neutral spot is the status bar: the middle of the editor can lie under the popover, which keeps it open.
const OVERLAYS = ".popover.hover-popover, .menu, .tooltip";
async function releasePointer() {
  const spot = await center(".status-bar");
  if (spot) await pointer(args.port, { x: spot[0], y: spot[1] });
  await escape(args.port);
  let left = 0;
  for (let i = 0; i < 8; i++) {
    await sleep(500);
    left = await evaluate(args.port, `document.querySelectorAll(${JSON.stringify(OVERLAYS)}).length`);
    if (!left) break;
  }
  return left;
}

const original = await evaluate(args.port, "(() => electronWindow.getSize())()");
// The page keeps focus as far as it can tell for the whole run (CDP focus emulation, not the macOS focus);
// taken again after every platform switch, which reloads the page. runner.focus checks it at measuring time.
let releaseFocus = await holdFocus(args.port);
const refocus = async () => { releaseFocus(); releaseFocus = await holdFocus(args.port); };
const floatingBefore = await evaluate(args.port, "(() => app.vault.getConfig('floatingNavigation') ?? null)()");
for (const theme of THEMES) {
  const manifest = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8"));
  const themeDir = path.join(args.vault, ".obsidian/themes", manifest.name);
  mkdirSync(themeDir, { recursive: true });
  cpSync(path.join(repo, "dist", theme, "theme.css"), path.join(themeDir, "theme.css"));
  cpSync(path.join(repo, "dist", theme, "manifest.json"), path.join(themeDir, "manifest.json"));
}
try {
  for (const platform of PLATFORMS) {
    const forPlatform = checks.filter((c) => (c.platform ?? ["desktop"]).includes(platform));
    if (!forPlatform.length) continue;
    await setPlatform(platform, original);
    await refocus();
    for (const theme of THEMES) {
      const manifest = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8"));
      const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
      const defs = new Map(declarations(css).filter((d) => d.selector === ".theme-dark").map((d) => [d.prop, d.value]));
      // Desktop: opaque -> translucent -> opaque again; the second opaque pass proves the switch back restores
      // every opaque value. Mobile: opaque only.
      const passes = platform === "desktop" ? [["opaque", 1], ["translucent", 1], ["opaque", 2]] : [["opaque", 1]];
      for (const [appearance, pass] of passes) {
        for (const state of STATES) {
          // c.themes (optional): the check applies to these themes only (a value that differs by theme, e.g. the
          // gutter border, which Solarized Dark does not have).
          const todo = forPlatform.filter((c) => c.appearance.includes(appearance) && (c.state ?? "default") === state && (!c.themes || c.themes.includes(theme)));
          if (!todo.length) continue;
          const deferMeasure = POINTER_STATES.includes(state);
          const input = { theme: manifest.name, translucent: appearance === "translucent", platform, state, deferMeasure, checks: todo.map(({ id, selector, pseudo, scrollTo, document, property, kind }) => ({ id, selector, pseudo, scrollTo, document, property, kind })) };
          let overlaysLeft = 0;
          let interaction = null;
          progress("probe", platform, theme, appearance, pass, state);
          let page = await evaluate(args.port, `window.__INK = ${JSON.stringify(input)};\n${probe}`);
          if (deferMeasure) {
            interaction = await interact(state);
            page = await evaluate(args.port, "window.__INK_MEASURE()");
            overlaysLeft = await releasePointer();
          }
          environment.appVersion ??= page.appVersion;
          environment.electron ??= page.electron;
          const where = { theme, platform, appearance: pass === 2 ? "opaque (after translucent)" : appearance, state };
          const ok = platform === "desktop" ? "PASS" : "PASS (EMULATED)";
          // The theme must really be applied; otherwise every colour check would measure Obsidian's defaults.
          const applied = page.theme === manifest.name && page.themeCssLength === css.length;
          results.push({ id: "runner.theme-applied", ...where, status: applied ? ok : "FAIL", detail: `${page.theme}, ${page.themeCssLength} chars`, selfTest: selfTest ? "PASS" : undefined });
          const cls = page.bodyClasses;
          const envOk = platform === "desktop"
            ? !cls.includes("is-mobile") && cls.includes("is-translucent") === (appearance === "translucent")
            : cls.includes("is-mobile") && cls.includes(platform === "tablet" ? "is-tablet" : "is-phone") && cls.includes("is-floating-nav") === (platform !== "phone-nonfloating") && !cls.includes("is-translucent");
          results.push({ id: "runner.environment", ...where, status: envOk ? ok : "FAIL", detail: cls.filter((x) => /^(is-|emulate-)/.test(x)).join(" "), selfTest: selfTest ? (state === "self-test-translucent-leak" ? "FAIL" : "PASS") : undefined });
          // The runner's own checks that the state was really there. In the self-test, the states that take a
          // prepared state away on purpose must make the named check FAIL.
          const prep = (id) => (selfTest ? ((SELF_TEST_BREAKS[state] ?? []).includes(id) ? "FAIL" : "PASS") : undefined);
          if (deferMeasure) {
            results.push({ id: "runner.pointer-prepared", ...where, status: interaction?.shown ? ok : "FAIL", detail: JSON.stringify(interaction), selfTest: prep("runner.pointer-prepared") });
            results.push({ id: "runner.pointer-released", ...where, status: overlaysLeft === 0 ? ok : "FAIL", detail: `${overlaysLeft} overlay(s) still open`, selfTest: selfTest ? "PASS" : undefined });
          }
          results.push({ id: "runner.focus", ...where, status: page.focused ? ok : "FAIL", detail: `document.hasFocus() ${page.focused}`, selfTest: selfTest ? "PASS" : undefined });
          const cp = page.configPrepared;
          if (cp && Object.keys(cp.wanted).length) results.push({ id: "runner.config-prepared", ...where, status: cp.held ? ok : "FAIL", detail: JSON.stringify(cp), selfTest: prep("runner.config-prepared") });
          if (page.edPrepared) {
            const e = page.edPrepared;
            const prepared = e.leafFound && e.file === "Editor chrome" && e.gutters === e.want && e.folded !== false;
            results.push({ id: "runner.ed-prepared", ...where, status: prepared ? ok : "FAIL", detail: JSON.stringify(e), selfTest: prep("runner.ed-prepared") });
          }
          if (page.settingsPrepared) results.push({ id: "runner.settings-prepared", ...where, status: page.settingsPrepared.activeItemShown ? ok : "FAIL", detail: JSON.stringify(page.settingsPrepared), selfTest: prep("runner.settings-prepared") });
          results.push({ id: "runner.modals-closed", ...where, status: page.modalsLeftOpen === 0 ? ok : "FAIL", detail: `${page.modalsLeftOpen} open`, selfTest: selfTest ? "PASS" : undefined });
          for (const c of todo) {
            const [status, detail] = judge(c, page.results[c.id], defs);
            results.push({ id: c.id, requirement: c.requirement, ...where, status: status === "PASS" ? ok : status, detail, measured: page.results[c.id], selfTest: c.selfTest });
          }
        }
        if (!selfTest) {
          const where = { theme, platform, appearance: pass === 2 ? "opaque (after translucent)" : appearance, state: "syntax" };
          results.push(...judgeSyntax(syntaxSpec, inkdropTokens, await syntaxPage(), where, platform === "desktop" ? "PASS" : "PASS (EMULATED)"));
          const ok = platform === "desktop" ? "PASS" : "PASS (EMULATED)";
          const mwhere = { ...where, state: "mermaid" };
          for (const view of ["reading", "live", "source"]) results.push(...judgeMermaid(mermaidSpec, await mermaidPage(view), "dark", mwhere, ok));
          if (platform === "desktop" && appearance === "opaque" && pass === 1) {
            // Re-render in place (new SVGs, new random ids) must keep the colours.
            results.push(...judgeMermaid(mermaidSpec, await mermaidPage("reading", { rerender: true }), "dark", { ...where, state: "mermaid re-render" }, ok));
            // Light: the theme is dark-only, so Obsidian's light rendering (Mermaid's defaults, no filter) must stay.
            const light = await setScheme("moonstone");
            try {
              const lwhere = { ...where, state: "mermaid light" };
              results.push({ id: "runner.light-scheme", ...lwhere, status: light ? ok : "FAIL", detail: light ? "theme-light" : "light scheme not applied" });
              for (const view of ["reading", "live"]) results.push(...judgeMermaid(mermaidSpec, await mermaidPage(view, { reference: "default" }), "light", lwhere, ok));
            } finally {
              await setScheme("obsidian");
            }
          }
        }
      }
    }
  }
} finally {
  // Restore the isolated window: desktop, original size, opaque, dark, original floating-navigation setting.
  await setPlatform("desktop", original);
  await refocus();
  await setScheme("obsidian");
  await evaluate(args.port, `(() => { app.customCss.setTranslucency(false); app.vault.setConfig("floatingNavigation", ${JSON.stringify(floatingBefore)}); return 1; })()`);
}
// Syntax self-test (desktop, Solarized Dark, opaque): each case changes the page CSS or the oracle and
// declares whether the syntax judgement must still pass. A case FAILs when any implementation or class
// result FAILs; `only` requires that kind of result to be the one failing, `group` requires a group's class.
if (selfTest) {
  const sd = JSON.parse(readFileSync(path.join(repo, "dist", THEMES[0], "manifest.json"), "utf8")).name;
  // Select the theme as the probe does (repeat until it and its stylesheet stay put), and record whether it
  // took: a case run under the other theme could pass for the wrong reason.
  const applied = await evaluate(args.port, `(async () => {
    await app.customCss.readThemes();
    let last = -1;
    for (let i = 0; i < 20; i++) {
      if (app.customCss.theme !== ${JSON.stringify(sd)}) app.customCss.setTheme(${JSON.stringify(sd)});
      await app.customCss.loadTheme();
      await new Promise((r) => setTimeout(r, 300));
      const len = app.customCss.styleEl.textContent.length;
      if (app.customCss.theme === ${JSON.stringify(sd)} && len > 0 && len === last) break;
      last = len;
    }
    return app.customCss.theme === ${JSON.stringify(sd)} && document.body.classList.contains("theme-dark");
  })()`);
  results.push({ id: "syn.self-test.theme-applied", theme: THEMES[0], platform: "desktop", appearance: "opaque", state: "syntax self-test", status: applied ? "PASS" : "FAIL", detail: applied ? sd : "theme not applied", selfTest: "PASS" });
  const kdKeyword = "rgb(138, 147, 168)"; // Kanagawa Dragon's keyword colour (dragonViolet)
  const mutate = (fn) => { const s = structuredClone(syntaxSpec); fn(s); return s; };
  const editRule = (cls, v) => (s) => { s.editing.rules.find((r) => r.on.join() === `cm-hmd-codeblock,${cls}`).var = v; };
  const tagIsString = editRule("cm-tag", "string");
  const editCss = (sel, value) => `.theme-dark .markdown-source-view.mod-cm6 .cm-hmd-codeblock.${sel} { color: ${value} !important; }`;
  const cases = [
    { name: "positive control (theme and oracle as committed)", expect: "PASS" },
    { name: "other theme's colour on editing keywords", expect: "FAIL", css: `.theme-dark .markdown-source-view.mod-cm6 .cm-hmd-codeblock.cm-keyword { color: ${kdKeyword} !important; }` },
    { name: "Reading view function rule lost (code text colour)", expect: "FAIL", css: `.theme-dark .markdown-rendered code[class*="language-"] .token.function { color: var(--code-normal) !important; }` },
    { name: "comments not italic", expect: "FAIL", css: `.theme-dark .markdown-source-view.mod-cm6 .cm-hmd-codeblock.cm-comment { font-style: normal !important; }` },
    { name: "oracle expects another token for editing tags", expect: "FAIL", spec: mutate(tagIsString) },
    // Class choice (C), with the real groups of the test note: editing tags carry one Inkdrop colour (tag name);
    // editing atoms carry several (atom, bool and colour pink, YAML keys and Rust type names cyan, null in the
    // code text colour, character yellow, a variable grey) but no tag-name blue.
    { name: "one Inkdrop colour, theme and oracle both choose another (EXACT -> MISMATCH)", expect: "FAIL", spec: mutate(tagIsString), css: editCss("cm-tag:not(.cm-bracket)", "var(--ink-syntax-string-color)"), only: "classes" },
    { name: "several Inkdrop colours, theme and oracle choose another of them (CONFLICT)", expect: "PASS", spec: mutate(editRule("cm-atom", "property-name-definition")), css: editCss("cm-atom", "var(--ink-syntax-property-name-definition-color)"), group: { view: "source", sig: "cm-atom.cm-hmd-codeblock", class: "CONFLICT" } },
    { name: "several Inkdrop colours, theme and oracle choose none of them (DOMINATED)", expect: "FAIL", spec: mutate(editRule("cm-atom", "tag-name")), css: editCss("cm-atom", "var(--ink-syntax-tag-name-color)"), only: "classes" },
    { name: "class rule lost in the theme (definitions take the code text colour)", expect: "FAIL", css: editCss("cm-def", "inherit"), only: "impl" },
    { name: "class rule lost in the theme and the oracle alike", expect: "FAIL", spec: mutate((s) => { s.editing.rules = s.editing.rules.filter((r) => r.on.join() !== "cm-hmd-codeblock,cm-def"); }), css: editCss("cm-def", "inherit"), only: "classes" },
  ];
  for (const c of cases) {
    await evaluate(args.port, `(() => { document.getElementById("ink-syntax-self-test")?.remove(); ${c.css ? `document.head.createEl("style", { attr: { id: "ink-syntax-self-test" }, text: ${JSON.stringify(c.css)} });` : ""} return 1; })()`);
    const res = judgeSyntax(c.spec ?? syntaxSpec, inkdropTokens, await syntaxPage(), {}, "PASS");
    // `only`: the case must fail through that kind of result alone (the others must pass).
    const failed = res.filter((r) => r.status === "FAIL");
    if (c.only && failed.some((r) => !r.id.endsWith(`.${c.only}`))) failed.push({ id: "syn.self-test", detail: `a result other than .${c.only} failed` });
    if (c.group) {
      const g = res.find((r) => r.id === `syn.${c.group.view}.classes`)?.measured?.find((x) => x.sig === c.group.sig);
      if (g?.class !== c.group.class) failed.push({ id: "syn.self-test", detail: `group ${c.group.sig} is ${g?.class ?? "missing"}, not ${c.group.class}` });
    }
    results.push({ id: "syn.self-test", theme: THEMES[0], platform: "desktop", appearance: "opaque", state: c.name, status: failed.length ? "FAIL" : "PASS",
      detail: failed.length ? `${failed.length} FAIL: ${failed.slice(0, 2).map((r) => `${r.id} ${r.detail.slice(0, 120)}`).join(" | ")}` : `${res.length} results, none FAIL`, selfTest: c.expect });
  }
  await evaluate(args.port, `(() => { document.getElementById("ink-syntax-self-test")?.remove(); return 1; })()`);

  // Mermaid self-test (desktop, Solarized Dark, opaque, Reading view unless `view`): each case changes the page
  // CSS, Obsidian's SVG (inline styles), the spec or the colour scheme, and declares whether the Mermaid
  // judgement must still pass. A case FAILs when any result FAILs; `only` requires every failing result's id to
  // end with one of these suffixes. UNSUPPORTED counts as passing here (it is not a failure).
  const D = '.theme-dark .markdown-rendered .mermaid > svg[aria-roledescription="flowchart-v2"]';
  // The inline cases leave the user-styled node alone (its style attribute already sets fill).
  const mutateMermaid = (fn) => { const s = structuredClone(mermaidSpec); fn(s); return s; };
  const mcases = [
    { name: "positive control (theme and spec as committed)", expect: "PASS" },
    { name: "positive control, Live Preview", expect: "PASS", view: "live" },
    { name: "positive control, light scheme (Mermaid's defaults)", expect: "PASS", scheme: "light" },
    { name: "inversion filter not lifted", expect: "FAIL", css: ".theme-dark .markdown-rendered .mermaid > svg { filter: invert(1) hue-rotate(180deg) saturate(1.25) !important; }", only: [".filter"] },
    { name: "wrong token on node shapes", expect: "FAIL", css: `${D} g.node rect.label-container { fill: var(--ink-mermaid-cluster-background-color) !important; }`, only: [".colours"] },
    { name: "spec maps mainBkg to another token", expect: "FAIL", spec: mutateMermaid((s) => { s.tokens.mainBkg = "cluster-background-color"; s.tokens.nodeBkg = "cluster-background-color"; }), only: [".colours"] },
    { name: "missing elements (clusters not drawn)", expect: "FAIL", css: ".theme-dark .markdown-rendered .mermaid g.cluster { display: none !important; }", only: [".elements"] },
    { name: "Mermaid inline style without !important loses to the theme", expect: "PASS", inline: [{ selector: 'g.node rect.label-container:not([style*="fill"])', property: "fill", value: "rgb(51, 51, 51)" }] },
    { name: "theme loses to an inline style with !important", expect: "FAIL", inline: [{ selector: 'g.node rect.label-container:not([style*="fill"])', property: "fill", value: "rgb(51, 51, 51)", priority: "important" }], only: [".colours"] },
    { name: "user linkStyle overridden by the theme", expect: "FAIL", css: `${D} path.flowchart-link { stroke: var(--ink-mermaid-line-color) !important; }`, only: [".colours"] },
    { name: "light scheme leak (rule without .theme-dark)", expect: "FAIL", scheme: "light", css: '.markdown-rendered .mermaid > svg[aria-roledescription="flowchart-v2"] g.node rect.label-container { fill: var(--ink-mermaid-node-background-color) !important; }', only: [".colours"] },
    { name: "filter lifted on every kind (unsupported kinds lose their inversion)", expect: "FAIL", css: ".theme-dark .markdown-rendered .mermaid > svg { filter: none !important; }", only: [".unsupported"] },
    { name: "leak into a non-Mermaid image", expect: "FAIL", css: ".theme-dark .markdown-rendered img { filter: hue-rotate(90deg) !important; }", only: [".others"] },
    // Painted properties per element type (research/14 §6.54): a change that paints differently FAILs, a change
    // of a property the element does not paint does not. The SVG-label block (htmlLabels: false) has SVG text
    // and an edge-label rect; the other flowcharts have HTML labels in foreignObject.
    { name: "SVG label text fill changed (painted)", expect: "FAIL", inline: [{ selector: "g.edgeLabel text", property: "fill", value: "rgb(255, 0, 255)", priority: "important" }], only: [".colours"] },
    { name: "SVG label text color changed, fill explicit (not painted)", expect: "PASS", inline: [{ selector: "g.edgeLabel text", property: "color", value: "rgb(255, 0, 255)", priority: "important" }] },
    { name: "SVG label text fill: currentColor with another color (painted through color)", expect: "FAIL", inline: [{ selector: "g.edgeLabel text", property: "fill", value: "currentColor", priority: "important" }, { selector: "g.edgeLabel text", property: "color", value: "rgb(255, 0, 255)", priority: "important" }], only: [".colours"] },
    { name: "SVG edge-label rect opacity changed (painted)", expect: "FAIL", inline: [{ selector: "g.edgeLabel rect.background", property: "opacity", value: "1", priority: "important" }], only: [".colours"] },
    { name: "SVG edge-label rect background-color changed (not painted)", expect: "PASS", inline: [{ selector: "g.edgeLabel rect.background", property: "background-color", value: "rgb(255, 0, 255)", priority: "important" }] },
    { name: "not-rendered rect given a size (rendered on one side only, with the theme's stroke)", expect: "FAIL", inline: [{ selector: "g.cluster-label rect.background", property: "width", value: "40px", priority: "important" }, { selector: "g.cluster-label rect.background", property: "height", value: "10px", priority: "important" }], only: [".colours"] },
    { name: "HTML label text colour changed (painted)", expect: "FAIL", inline: [{ selector: "foreignObject span.nodeLabel", property: "color", value: "rgb(255, 0, 255)", priority: "important" }], only: [".colours"] },
    { name: "HTML edge-label background changed (painted)", expect: "FAIL", inline: [{ selector: "foreignObject span.edgeLabel", property: "background-color", value: "rgb(255, 0, 255)", priority: "important" }], only: [".colours"] },
    { name: "filter on node shapes (painted)", expect: "FAIL", inline: [{ selector: 'g.node rect.label-container:not([style*="fill"])', property: "filter", value: "blur(1px)", priority: "important" }], only: [".colours"] },
    { name: "edge stroke-opacity changed (painted)", expect: "FAIL", inline: [{ selector: 'path.flowchart-link:not([style*="stroke:"])', property: "stroke-opacity", value: "0.3", priority: "important" }], only: [".colours"] },
  ];
  for (const c of mcases) {
    await evaluate(args.port, `(() => { document.getElementById("ink-mermaid-self-test")?.remove(); ${c.css ? `document.head.createEl("style", { attr: { id: "ink-mermaid-self-test" }, text: ${JSON.stringify(c.css)} });` : ""} return 1; })()`);
    const light = c.scheme === "light";
    let res;
    try {
      if (light && !(await setScheme("moonstone"))) res = [{ id: "runner.light-scheme", status: "FAIL", detail: "light scheme not applied" }];
      else res = judgeMermaid(c.spec ?? mermaidSpec, await mermaidPage(c.view ?? "reading", { inline: c.inline, ...(light ? { reference: "default" } : {}) }, c.spec ?? mermaidSpec), light ? "light" : "dark", {}, "PASS");
    } finally {
      if (light) await setScheme("obsidian");
    }
    const failed = res.filter((r) => r.status === "FAIL");
    if (c.only && failed.some((r) => !c.only.some((x) => r.id.endsWith(x)))) failed.push({ id: "mm.self-test", detail: `a result other than ${c.only.join(" / ")} failed: ${failed.filter((r) => !c.only.some((x) => r.id.endsWith(x))).map((r) => r.id).join(", ")}` });
    results.push({ id: "mm.self-test", theme: THEMES[0], platform: "desktop", appearance: "opaque", state: c.name, status: failed.length ? "FAIL" : "PASS",
      detail: failed.length ? `${failed.length} FAIL: ${failed.slice(0, 2).map((r) => `${r.id} ${r.detail.slice(0, 120)}`).join(" | ")}` : `${res.length} results, none FAIL`, selfTest: c.expect });
  }
  await evaluate(args.port, `(() => { document.getElementById("ink-mermaid-self-test")?.remove(); return 1; })()`);
}

// The restore itself is checked: desktop, original size, not translucent, original floating-navigation setting.
{
  const st = await evaluate(args.port, "(() => ({ cls: [...document.body.classList], size: electronWindow.getSize(), floating: app.vault.getConfig('floatingNavigation') ?? null }))()");
  const restored = !st.cls.includes("emulate-mobile") && !st.cls.includes("is-mobile") && !st.cls.includes("is-translucent")
    && st.size[0] === original[0] && st.size[1] === original[1] && st.floating === floatingBefore;
  results.push({ id: "runner.restore", theme: "-", platform: "desktop", appearance: "-", state: "-", status: restored ? "PASS" : "FAIL",
    detail: `size ${st.size} (was ${original}), floating ${st.floating}, ${st.cls.filter((x) => /^(is-mobile|is-translucent|emulate-mobile)$/.test(x)).join(" ") || "no mobile / translucent classes"}`, selfTest: selfTest ? "PASS" : undefined });
}

// ---------- report ----------
let bad = 0;
for (const r of results) {
  const line = `${r.status} ${r.id} [${r.theme}, ${r.platform}, ${r.appearance}, ${r.state}] -- ${r.detail}`;
  if (selfTest) {
    const ok = r.status.replace(" (EMULATED)", "") === r.selfTest;
    console.log(`${ok ? "OK  " : "BAD "} expected ${r.selfTest}: ${line}`);
    if (!ok) bad++;
  } else {
    console.log(line);
    // DIFF (syntax fidelity) is reported, never counted as PASS, and does not fail the run: the class check
    // (syn.<view>.classes) fails when a class gets a colour Inkdrop never gives its text.
    // UNSUPPORTED (Mermaid kinds the theme does not colour) likewise: reported, never PASS, not a failure.
    if (!r.status.startsWith("PASS") && r.status !== "DIFF" && r.status !== "UNSUPPORTED") bad++;
  }
}
if (args.out) writeFileSync(args.out, `${JSON.stringify({ measuredAt: new Date().toISOString(), environment, selfTest, results }, null, 1)}\n`);
console.log(selfTest
  ? (bad ? `\n${bad} self-test case(s) did NOT produce the declared outcome` : `\nall ${results.length} self-test results produced the declared outcome`)
  : (bad ? `\n${bad} runtime check(s) FAILED` : `\nall ${results.length} runtime checks passed or are reported as DIFF / UNSUPPORTED (${results.filter((r) => r.status === "PASS (EMULATED)").length} PASS (EMULATED), ${results.filter((r) => r.status === "DIFF").length} DIFF, ${results.filter((r) => r.status === "UNSUPPORTED").length} UNSUPPORTED; Obsidian ${environment.appVersion}, Electron ${environment.electron})`));
process.exit(bad ? 1 : 0);

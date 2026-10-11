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
// app.emulateMobile(true) on desktop; never counts as a device check, research/14 §2.3), FAIL.
// Platforms run in the order desktop, tablet, phone, phone-nonfloating; the window size and emulation are
// restored at the end. The isolated instance's own test vault is the only place settings change.
// --self-test runs tests/runtime/self-test-spec.json, whose cases declare the outcome the runner must
// produce (several must FAIL); the run passes only if every case gets its declared outcome.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { declarations, hslToRgb, parseComputedColor, sameColor, substitute } from "../lib/css.mjs";
import { checkErrors, loadChecks, loadRequirements, PLATFORMS, runtimeSpecFiles } from "../lib/spec.mjs";
import { evaluate } from "./lib/cdp.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { vault: { type: "string" }, out: { type: "string" }, port: { type: "string", default: "9333" }, "self-test": { type: "boolean", default: false } } });
if (!args.vault) { console.error("usage: node tests/runtime/run.mjs --vault <vault> [--out <json>] [--self-test]"); process.exit(2); }
const THEMES = ["solarized-dark", "kanagawa-dragon"];

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

// Expected colour of a check in one theme: a palette token resolved through the theme's own
// declarations, or a literal value. null if it cannot be resolved (which makes the check FAIL).
const TRANSPARENT = { rgb: [0, 0, 0], a: 0 };
function expectedColor(c, defs) {
  if (c.value !== undefined) return c.value === "transparent" ? TRANSPARENT : parseComputedColor(c.value);
  if (!defs.has(c.token)) return null;
  const v = substitute(defs.get(c.token), defs);
  return v === "transparent" ? TRANSPARENT : hslToRgb(v);
}

function judge(c, m, defs) {
  const expect = c.expect ?? "match";
  if (!m) return ["FAIL", "no measurement returned"];
  if (expect === "absent") return m.found ? ["FAIL", `expected absent (${c.reason}), found ${m.count}`] : ["PASS", `absent: ${c.reason}`];
  if (expect === "hidden") {
    if (!m.found) return ["FAIL", `expected hidden (${c.reason}), element not found`];
    return m.displayed ? ["FAIL", `expected hidden (${c.reason}), element is displayed ${m.size}`] : ["PASS", `hidden: ${c.reason}`];
  }
  if (!m.found) return ["FAIL", `element not found${m.error ? ` (${m.error})` : ""}`];
  if (!m.displayed) return ["FAIL", `element not displayed (size ${JSON.stringify(m.size)})`];
  if ((c.kind ?? "color") === "text") {
    const exp = c.value !== undefined ? c.value : defs.has(c.token) ? substitute(defs.get(c.token), defs) : null;
    if (exp === null) return ["FAIL", `expected value unresolved (${c.token})`];
    if (m.value === null) return ["FAIL", "value not readable"];
    return m.value === exp ? ["PASS", m.value] : ["FAIL", `${JSON.stringify(m.value)} != ${JSON.stringify(exp)}`];
  }
  const got = parseComputedColor(m.value);
  if (!got) return ["FAIL", `value not a colour: ${JSON.stringify(m.value)}`];
  const exp = expectedColor(c, defs);
  if (!exp) return ["FAIL", `expected colour unresolved (${c.token ?? c.value})`];
  return sameColor(got, exp) ? ["PASS", m.value] : ["FAIL", `${m.value} != rgba(${exp.rgb.map((x) => x.toFixed(1))}, ${exp.a})`];
}

// ---------- run ----------
const probe = readFileSync(path.join(repo, "tests/runtime/probe.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const [w, h] = SIZES[platform];
  const cur = await evaluate(args.port, "(() => electronWindow.getSize())()");
  const want = platform === "tablet" ? "is-tablet" : "is-phone";
  const ok = emulated && cur[0] === w && cur[1] === h && (await evaluate(args.port, `(() => document.body.classList.contains('${want}'))()`));
  if (ok) return;
  await evaluate(args.port, `(() => { electronWindow.setSize(${w}, ${h}); ${emulated ? "location.reload()" : "app.emulateMobile(true)"}; return 1; })()`);
  await sleep(1500);
  await waitReady();
}

const original = await evaluate(args.port, "(() => electronWindow.getSize())()");
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
    for (const theme of THEMES) {
      const manifest = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8"));
      const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
      const defs = new Map(declarations(css).filter((d) => d.selector === ".theme-dark").map((d) => [d.prop, d.value]));
      for (const appearance of ["opaque", "translucent"]) {
        for (const state of ["default", "user-accent", "left-drawer-open", "right-drawer-open"]) {
          const todo = forPlatform.filter((c) => c.appearance.includes(appearance) && (c.state ?? "default") === state);
          if (!todo.length) continue;
          const input = { theme: manifest.name, translucent: appearance === "translucent", platform, state, checks: todo.map(({ id, selector, document, property }) => ({ id, selector, document, property })) };
          const page = await evaluate(args.port, `window.__INK = ${JSON.stringify(input)};\n${probe}`);
          environment.appVersion ??= page.appVersion;
          environment.electron ??= page.electron;
          const where = { theme, platform, appearance, state };
          const pass = platform === "desktop" ? "PASS" : "PASS (EMULATED)";
          // The theme must really be applied; otherwise every colour check would measure Obsidian's defaults.
          const applied = page.theme === manifest.name && page.themeCssLength === css.length;
          results.push({ id: "runner.theme-applied", ...where, status: applied ? pass : "FAIL", detail: `${page.theme}, ${page.themeCssLength} chars`, selfTest: selfTest ? "PASS" : undefined });
          const cls = page.bodyClasses;
          const envOk = platform === "desktop"
            ? !cls.includes("is-mobile") && cls.includes("is-translucent") === (appearance === "translucent")
            : cls.includes("is-mobile") && cls.includes(platform === "tablet" ? "is-tablet" : "is-phone") && cls.includes("is-floating-nav") === (platform !== "phone-nonfloating");
          results.push({ id: "runner.environment", ...where, status: envOk ? pass : "FAIL", detail: cls.filter((x) => /^(is-|emulate-)/.test(x)).join(" "), selfTest: selfTest ? "PASS" : undefined });
          for (const c of todo) {
            const [status, detail] = judge(c, page.results[c.id], defs);
            results.push({ id: c.id, requirement: c.requirement, ...where, status: status === "PASS" ? pass : status, detail, measured: page.results[c.id], selfTest: c.selfTest });
          }
        }
      }
    }
  }
} finally {
  // Restore the isolated window: desktop, original size, opaque, original floating-navigation setting.
  await setPlatform("desktop", original);
  await evaluate(args.port, `(() => { app.customCss.setTranslucency(false); app.vault.setConfig("floatingNavigation", ${JSON.stringify(floatingBefore)}); return 1; })()`);
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
    if (!r.status.startsWith("PASS")) bad++;
  }
}
if (args.out) writeFileSync(args.out, `${JSON.stringify({ measuredAt: new Date().toISOString(), environment, selfTest, results }, null, 1)}\n`);
console.log(selfTest
  ? (bad ? `\n${bad} self-test case(s) did NOT produce the declared outcome` : `\nall ${results.length} self-test results produced the declared outcome`)
  : (bad ? `\n${bad} runtime check(s) FAILED` : `\nall ${results.length} runtime checks passed (${results.filter((r) => r.status === "PASS (EMULATED)").length} of them EMULATED; Obsidian ${environment.appVersion}, Electron ${environment.electron})`));
process.exit(bad ? 1 : 0);

// Runtime tests: apply dist/<theme>/theme.css in the ISOLATED Obsidian and judge the computed styles
// against the spec (research/14 §3.2). Computed Style only, not screen pixels.
//
// usage (after `bash tests/runtime/obsidian-isolated.sh start <work>` printed <vault>):
//   node tests/runtime/run.mjs --vault <vault> [--out <result.json>] [--port 9333]
//   node tests/runtime/run.mjs --vault <vault> --self-test [--out <result.json>]
//
// Judgement (never a "same as before" comparison):
//   expect match  -> PASS only if the element exists, is displayed (checkVisibility and a non-empty box),
//                    its value parses as a colour and equals the expected colour (+-1/255, alpha +-0.01).
//                    Missing, hidden, unreadable or unparseable -> FAIL with the reason.
//   expect absent -> PASS only if no element matches. expect hidden -> PASS only if it exists and is not displayed.
// Status values: PASS / FAIL. (PASS (EMULATED), UNVERIFIED and N/A are added with the mobile checks, step 3.)
// --self-test runs tests/runtime/self-test-spec.json, whose cases declare the outcome the runner must
// produce (several must FAIL); the run passes only if every case gets its declared outcome.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { declarations, hslToRgb, parseComputedColor, sameColor, substitute } from "../lib/css.mjs";
import { checkErrors, loadChecks, loadRequirements, runtimeSpecFiles } from "../lib/spec.mjs";
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
  const got = parseComputedColor(m.value);
  if (!got) return ["FAIL", `value not a colour: ${JSON.stringify(m.value)}`];
  const exp = expectedColor(c, defs);
  if (!exp) return ["FAIL", `expected colour unresolved (${c.token ?? c.value})`];
  return sameColor(got, exp) ? ["PASS", m.value] : ["FAIL", `${m.value} != rgba(${exp.rgb.map((x) => x.toFixed(1))}, ${exp.a})`];
}

// ---------- run ----------
const probe = readFileSync(path.join(repo, "tests/runtime/probe.js"), "utf8");
const results = [];
let environment = null;
for (const theme of THEMES) {
  const manifest = JSON.parse(readFileSync(path.join(repo, "dist", theme, "manifest.json"), "utf8"));
  const themeDir = path.join(args.vault, ".obsidian/themes", manifest.name);
  mkdirSync(themeDir, { recursive: true });
  cpSync(path.join(repo, "dist", theme, "theme.css"), path.join(themeDir, "theme.css"));
  cpSync(path.join(repo, "dist", theme, "manifest.json"), path.join(themeDir, "manifest.json"));
  const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
  const defs = new Map(declarations(css).filter((d) => d.selector === ".theme-dark").map((d) => [d.prop, d.value]));

  for (const appearance of ["opaque", "translucent"]) {
    const todo = checks.filter((c) => c.appearance.includes(appearance));
    if (!todo.length) continue;
    const input = { theme: manifest.name, translucent: appearance === "translucent", checks: todo.map(({ id, selector, document, property }) => ({ id, selector, document, property })) };
    const page = await evaluate(args.port, `window.__INK = ${JSON.stringify(input)};\n${probe}`);
    environment ??= { appVersion: page.appVersion };
    // The theme must really be applied; otherwise every colour check would be measuring Obsidian's defaults.
    const applied = page.theme === manifest.name && page.themeCssLength === css.length;
    results.push({ id: `runner.theme-applied`, theme, appearance, status: applied ? "PASS" : "FAIL", detail: `${page.theme}, ${page.themeCssLength} chars`, selfTest: selfTest ? "PASS" : undefined });
    const translucentOk = page.bodyClasses.includes("is-translucent") === (appearance === "translucent");
    results.push({ id: `runner.appearance`, theme, appearance, status: translucentOk ? "PASS" : "FAIL", detail: `is-translucent=${page.bodyClasses.includes("is-translucent")}`, selfTest: selfTest ? "PASS" : undefined });
    for (const c of todo) {
      const [status, detail] = judge(c, page.results[c.id], defs);
      results.push({ id: c.id, requirement: c.requirement, theme, appearance, status, detail, measured: page.results[c.id], selfTest: c.selfTest });
    }
  }
}
await evaluate(args.port, "(() => { app.customCss.setTranslucency(false); return 1; })()");

// ---------- report ----------
let bad = 0;
for (const r of results) {
  const line = `${r.status} ${r.id} [${r.theme}, ${r.appearance}] -- ${r.detail}`;
  if (selfTest) {
    const ok = r.status === r.selfTest;
    console.log(`${ok ? "OK  " : "BAD "} expected ${r.selfTest}: ${line}`);
    if (!ok) bad++;
  } else {
    console.log(line);
    if (r.status !== "PASS") bad++;
  }
}
if (args.out) writeFileSync(args.out, `${JSON.stringify({ measuredAt: new Date().toISOString(), environment, selfTest, results }, null, 1)}\n`);
console.log(selfTest
  ? (bad ? `\n${bad} self-test case(s) did NOT produce the declared outcome` : `\nall ${results.length} self-test results produced the declared outcome`)
  : (bad ? `\n${bad} runtime check(s) FAILED` : `\nall ${results.length} runtime checks passed (Obsidian ${environment?.appVersion})`));
process.exit(bad ? 1 : 0);

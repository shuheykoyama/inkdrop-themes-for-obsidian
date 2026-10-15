// Judges a device run (step 10, research/14 §6.23): the results file the ink-device-check plugin wrote on an
// iOS / Android device (tests/device/build-kit.mjs), with the desktop runner's own judgement code
// (tests/runtime/lib/checks.mjs, syntax.mjs, mermaid.mjs) and the same spec.
//
// usage: node tests/device/judge.mjs <results-*.json> [--out <report.json>] [--label "<device, OS, app>"]
//
// Status values: PASS (measured on the real device), FAIL, DIFF (syntax fidelity, as on desktop), UNSUPPORTED
// (Mermaid kinds the theme does not colour), and for the desktop checks measured on the device as candidates
// (job.extra): N/A (the element does not exist or is not displayed on a phone, so the check does not apply there). A device PASS
// is never derived from emulation: everything here was measured on the device that wrote the file.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { declarations } from "../lib/css.mjs";
import { loadChecks, runtimeSpecFiles } from "../lib/spec.mjs";
import { judge } from "../runtime/lib/checks.mjs";
import { judgeMermaid } from "../runtime/lib/mermaid.mjs";
import { judgeSyntax } from "../runtime/lib/syntax.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" }, label: { type: "string" } } });
if (!positionals[0]) { console.error("usage: node tests/device/judge.mjs <results-*.json> [--out <report.json>] [--label <text>]"); process.exit(2); }
const run = JSON.parse(readFileSync(positionals[0], "utf8"));
const env = run.environment;
const checks = new Map(loadChecks(runtimeSpecFiles(path.join(repo, "tests/spec"))).map((c) => [c.id, c]));
const syntaxSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/syntax.json"), "utf8"));
const inkdropTokens = JSON.parse(readFileSync(path.join(repo, syntaxSpec.inkdrop), "utf8"));
const mermaidSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));
const defsOf = new Map();
const defs = (theme) => {
  if (!defsOf.has(theme)) {
    const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
    defsOf.set(theme, { css, defs: new Map(declarations(css).filter((d) => d.selector === ".theme-dark").map((d) => [d.prop, d.value])) });
  }
  return defsOf.get(theme);
};

const results = [];
const device = env.platform.isTablet ? "tablet" : "phone";
for (const rec of run.results) {
  const job = rec.job;
  const where = { theme: job.theme, platform: job.kind === "probe" ? job.platform : device, appearance: "opaque", state: job.kind === "probe" ? job.state : job.kind === "syntax" ? "syntax" : `mermaid${job.scheme === "light" ? " light" : ""}${job.rerender ? " re-render" : ""}` };
  if (rec.error || !rec.page) { results.push({ id: `device.${job.kind}`, ...where, status: "FAIL", detail: `no measurement: ${(rec.error ?? "empty").slice(0, 300)}` }); continue; }
  const { css, defs: d } = defs(job.theme);
  if (job.kind === "probe") {
    const page = rec.page;
    // The theme must be the built one (same stylesheet length as dist/ when the kit was built).
    const applied = page.theme === job.themeName && page.themeCssLength === job.cssLength && job.cssLength === css.length;
    results.push({ id: "device.theme-applied", ...where, status: applied ? "PASS" : "FAIL", detail: `${page.theme}, ${page.themeCssLength} chars (kit ${job.cssLength}, dist ${css.length})` });
    // A real phone / tablet: Obsidian's mobile classes, no desktop emulation, no translucency, the navigation
    // setting as the job asked.
    const cls = page.bodyClasses;
    const envOk = cls.includes("is-mobile") && !cls.includes("emulate-mobile") && !cls.includes("is-translucent") && cls.includes(device === "tablet" ? "is-tablet" : "is-phone")
      && (device === "tablet" || cls.includes("is-floating-nav") === (job.platform !== "phone-nonfloating"));
    results.push({ id: "device.environment", ...where, status: envOk ? "PASS" : "FAIL", detail: cls.filter((x) => /^(is-|emulate-)/.test(x)).join(" ") });
    if (page.edPrepared) {
      const e = page.edPrepared;
      // As the desktop runner's runner.ed-prepared: a fold that did not happen fails here (kits before the
      // re-review of step 10 did not record `folded`, so it is undefined there and not a failure).
      results.push({ id: "device.ed-prepared", ...where, status: e.leafFound && e.file === "Editor chrome" && e.gutters === e.want && e.folded !== false ? "PASS" : "FAIL", detail: JSON.stringify(e) });
    }
    for (const id of job.checkIds) {
      const c = checks.get(id);
      const m = page.results[id];
      const [status, detail] = judge(c, m, d);
      // A desktop check whose element a phone does not have or does not display (e.g. the view header title):
      // not applicable, not a failure.
      const na = job.extra && status === "FAIL" && m && (!m.found || !m.displayed);
      results.push({ id, requirement: c.requirement, ...where, extra: job.extra || undefined, status: na ? "N/A" : status, detail: na ? `not on a ${device}: ${detail}` : detail, measured: m });
    }
  } else if (job.kind === "syntax") {
    results.push(...judgeSyntax(syntaxSpec, inkdropTokens, rec.page, where, "PASS"));
  } else {
    if (job.scheme === "light") results.push({ id: "device.light-scheme", ...where, status: rec.lightApplied ? "PASS" : "FAIL", detail: rec.lightApplied ? "theme-light" : "light scheme not applied" });
    results.push(...judgeMermaid(mermaidSpec, rec.page, job.scheme, where, "PASS"));
  }
}

// ---------- report ----------
const count = (f) => results.filter(f).length;
let bad = 0;
for (const r of results) {
  if (!["PASS", "DIFF", "UNSUPPORTED", "N/A"].includes(r.status)) bad++;
  if (r.status !== "PASS" && r.status !== "DIFF") console.log(`${r.status} ${r.id} [${r.theme}, ${r.platform}, ${r.state}]${r.extra ? " (desktop check)" : ""} -- ${String(r.detail).slice(0, 220)}`);
}
const label = args.label ?? `${env.userAgent}`;
const summary = `${results.length} results on ${label}: PASS ${count((r) => r.status === "PASS")}, FAIL ${count((r) => r.status === "FAIL")}, DIFF ${count((r) => r.status === "DIFF")}, UNSUPPORTED ${count((r) => r.status === "UNSUPPORTED")}, N/A ${count((r) => r.status === "N/A")} (desktop checks measured on the device: ${count((r) => r.extra)})`;
console.log(`\n${summary}`);
if (args.out) writeFileSync(args.out, `${JSON.stringify({ judgedAt: new Date().toISOString(), source: path.basename(positionals[0]), label, environment: env, startedAt: run.startedAt, finishedAt: run.finishedAt, summary, results }, null, 1)}\n`);
process.exit(bad ? 1 : 0);

// Release-condition judgement (step 11A, research/14 §6.30.3 and §2.3): which mandatory requirements are met,
// per unit = requirement x theme x OS x device class x Obsidian version, computed from the result files only
// (desktop runtime results, device reports) and the specs. Nothing here is written by hand except the
// inputs list (tests/release/inputs.json: which result files count, which targets are BLOCKED and why).
//
// usage: node tests/release/gate.mjs [--inputs tests/release/inputs.json] [--out report.json]
//   prints a summary; the report holds every unit with its checks, methods and evidence (file, version,
//   time, commit). Exit 0 when the judgement was computed (met or not), 1 on malformed inputs.
//
// Unit states (worst first; a unit takes the worst state of its parts and keeps the parts):
//   FAIL          a check failed, or the preparation of its state failed (runner.* / device.* checks)
//   NO RESULT     a check the spec expects for this unit has no result (never left blank)
//   BLOCKED       the target cannot be run (no device / no build); declared with a reason in the inputs
//   UNVERIFIED    the requirement is recorded as UNVERIFIED (reason + risk) in requirements.json
//   EMULATED ONLY a phone / tablet target has only desktop-emulation results (PASS (EMULATED)); not a device PASS
//   DIFF          a fidelity difference (syntax); judged, not a failure, not a PASS
//   UNSUPPORTED   a diagram kind the theme does not colour (Mermaid); judged, not a PASS
//   N/A           a check of the unit could not be measured there ("not applicable" at measurement time)
//   PASS          measured on the real target (macOS desktop app, or the device) and as expected
// A unit counts for the release only when EVERY part of it counts: a PASS, or a DIFF / UNSUPPORTED that the
// requirement accepts (`accepts` in requirements.json, with the decision it rests on). One part that does not
// count (an unaccepted DIFF, an N/A, a FAIL, ...) keeps the whole unit out, whatever its other parts are.
// Not applicable by the spec (a check whose platforms / themes / appearances exclude the unit) is different:
// such a check is not part of the unit at all and is listed in `excludedBySpec`; it never hides a measurement.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadChecks, loadRequirements, runtimeSpecFiles, THEMES } from "../lib/spec.mjs";

export const ORDER = ["FAIL", "NO RESULT", "BLOCKED", "UNVERIFIED", "EMULATED ONLY", "DIFF", "UNSUPPORTED", "N/A", "PASS"];
const worst = (states) => states.reduce((w, s) => (ORDER.indexOf(s) < ORDER.indexOf(w) ? s : w), "PASS");
// Spec platforms of a device class (the kit measures the phone with and without the floating navigation).
const SPEC_PLATFORMS = { desktop: ["desktop"], phone: ["phone", "phone-nonfloating"], tablet: ["tablet"] };
// "1.14.4" -> comparable; a missing version sorts below everything.
const cmpVersion = (a, b) => {
  const pa = String(a ?? "0").split(".").map(Number), pb = String(b ?? "0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

// One result file as a run: where it ran (OS, device class, Obsidian version) and its results.
// Desktop runtime files: OS from the inputs (the runner runs on macOS only), the version from the file.
// Device reports: OS, device class and version from the environment the kit recorded on the device; whether
// the report is accepted as a device run is decided by deviceRunProblem() below.
function readRun(entry, repo, commitOf) {
  const file = path.join(repo, entry.file);
  if (!existsSync(file)) throw new Error(`inputs: ${entry.file} does not exist`);
  const data = JSON.parse(readFileSync(file, "utf8"));
  const source = { file: entry.file, label: entry.label ?? entry.file, kind: entry.kind, commit: commitOf(entry.file) };
  if (entry.kind === "desktop-runtime") {
    if (!["macOS", "Windows", "Linux"].includes(entry.os)) throw new Error(`inputs: ${entry.file}: a desktop run needs os macOS / Windows / Linux`);
    if (data.selfTest) throw new Error(`inputs: ${entry.file} is a self-test run`);
    // The window frame the run measured (tests/runtime/run.mjs records it; files before step 11F ran Hidden).
    return { ...source, os: entry.os, appVersion: data.environment?.appVersion, electron: data.environment?.electron, frame: data.environment?.frame ?? "hidden", at: data.measuredAt,
      method: "Computed Style in the isolated desktop Obsidian (CDP, tests/runtime/run.mjs)", results: data.results };
  }
  if (entry.kind === "device-report") {
    const p = data.environment?.platform ?? {};
    const os = p.isIosApp ? "iOS" : p.isAndroidApp ? "Android" : null;
    return { ...source, os, device: p.isTablet ? "tablet" : "phone", platformFlags: p, appVersion: data.environment?.apiVersion, at: data.judgedAt,
      method: "Computed Style on the device (ink-device-check kit, judged by tests/device/judge.mjs)", results: data.results };
  }
  throw new Error(`inputs: ${entry.file}: unknown kind ${entry.kind}`);
}

// Why a device report is not accepted as a device run, or null. Every probe state of the report (each theme x
// platform x state that has results, other than the syntax and Mermaid jobs, which have no state of their own)
// needs a device.environment check, and every one must PASS and agree with the environment the kit recorded:
// one OS and one device class in the flags, the body classes of that OS and class, no desktop emulation, and
// result platforms of that class. No environment check at all, one missing, one failed or one that disagrees
// rejects the whole report (e.g. the kit's dry run on the Mac, where device.environment fails on purpose).
export function deviceRunProblem(run) {
  const f = run.platformFlags ?? {};
  if (!!f.isIosApp === !!f.isAndroidApp) return "the environment is not exactly one of an iOS / Android app";
  if (!!f.isPhone === !!f.isTablet || !f.isMobile) return "the environment is not exactly one of a phone / tablet";
  const env = run.results.filter((r) => r.id === "device.environment");
  if (!env.length) return "no device.environment check";
  const failed = env.filter((r) => r.status !== "PASS");
  if (failed.length) return `${failed.length} device.environment checks did not pass (not a device run)`;
  const osClass = f.isIosApp ? "is-ios" : "is-android";
  const devClass = f.isTablet ? "is-tablet" : "is-phone";
  const wrong = env.filter((r) => { const c = String(r.detail ?? "").split(/\s+/); return !c.includes("is-mobile") || !c.includes(osClass) || !c.includes(devClass) || c.includes("emulate-mobile"); });
  if (wrong.length) return `${wrong.length} device.environment checks disagree with the recorded environment (${osClass} ${devClass}): ${wrong[0].detail}`;
  const platforms = SPEC_PLATFORMS[f.isTablet ? "tablet" : "phone"];
  const off = run.results.filter((r) => !platforms.includes(r.platform));
  if (off.length) return `${off.length} results are for platform ${off[0].platform}, not a ${f.isTablet ? "tablet" : "phone"} (e.g. the kit's phone jobs on a tablet)`;
  const key = (r) => [r.theme, r.platform, r.state].join("|");
  const envKeys = new Set(env.map(key));
  const missing = [...new Set(run.results.filter((r) => !/^(syntax|mermaid)/.test(r.state)).map(key))].filter((k) => !envKeys.has(k));
  if (missing.length) return `no device.environment check for ${missing.length} probe states (e.g. ${missing[0]})`;
  return null;
}

// The judgement. `config`: { requirements, checks, inputs, runs } (runs as readRun returns them), so that the
// self-test can pass synthetic data.
export function judgeRelease({ requirements, checks, inputs, runs }) {
  const minVersion = inputs.minAppVersion;
  const units = [];
  const notes = [];
  for (const run of runs) {
    run.rejected = run.kind === "device-report" ? deviceRunProblem(run) : null;
    if (run.rejected) notes.push(`rejected ${run.file}: ${run.rejected}`);
  }
  // Preparation failures: runner.* / device.* checks carry no requirement; a failure in one (theme, platform,
  // appearance, state) of one run makes every requirement check of that state FAIL.
  const prepKey = (run, r) => [run.file, r.theme, r.platform, r.appearance, r.state].join("|");
  const prepFailed = new Map();
  for (const run of runs) for (const r of run.results) {
    if (r.requirement || !/^(runner|device)\./.test(r.id) || r.id === "device.environment") continue;
    if (r.status === "FAIL") prepFailed.set(prepKey(run, r), r.id);
  }
  for (const req of requirements.filter((r) => r.mandatory)) {
    const reqChecks = checks.filter((c) => c.requirement === req.id);
    for (const target of inputs.targets) {
      if (!req.platforms.includes(target.device)) continue; // not a unit: the requirement does not apply there
      for (const theme of THEMES) {
        const base = { requirement: req.id, qd: req.qd, theme, os: target.os, device: target.device, gated: target.gated };
        if (req.unverified) { units.push({ ...base, appVersion: null, state: "UNVERIFIED", parts: [{ state: "UNVERIFIED", why: req.unverified.reason }] }); continue; }
        // Results of real runs on this target: desktop results of a desktop run of this OS, or the results of a
        // device run of this OS and device class. Extra (desktop-candidate) device results never count.
        const real = runs.filter((run) => !run.rejected && run.os === target.os && (run.kind === "desktop-runtime" ? target.device === "desktop" : run.device === target.device));
        const byVersion = new Map();
        for (const run of real) {
          const rs = run.results.filter((r) => r.requirement === req.id && r.theme === theme && !r.extra && SPEC_PLATFORMS[target.device].includes(r.platform));
          if (!byVersion.has(run.appVersion)) byVersion.set(run.appVersion, []);
          byVersion.get(run.appVersion).push({ run, rs });
        }
        // Recorded verifications that are not runtime checks (native captures, real full screen), with a scope.
        for (const v of req.verifiedBy ?? []) {
          const s = v.scope;
          if (!s || s.os !== target.os || s.device !== target.device || !s.themes.includes(theme)) continue;
          if (!byVersion.has(s.appVersion)) byVersion.set(s.appVersion, []);
          byVersion.get(s.appVersion).push({ recorded: v });
        }
        if (!byVersion.size) {
          // Nothing real: BLOCKED when declared, EMULATED ONLY when desktop emulation measured it, else NO RESULT.
          const emulated = target.device !== "desktop" && runs.some((run) => run.kind === "desktop-runtime" && run.results.some((r) => r.requirement === req.id && r.theme === theme && SPEC_PLATFORMS[target.device].includes(r.platform) && r.status === "PASS (EMULATED)"));
          // A target outside the release (Windows, Linux: Q-D10) without results is UNVERIFIED, as §2.3 records it.
          const state = target.blocked ? "BLOCKED" : !target.gated ? "UNVERIFIED" : emulated ? "EMULATED ONLY" : "NO RESULT";
          units.push({ ...base, appVersion: null, state, parts: [{ state, why: target.blocked?.reason ?? (!target.gated ? target.note : emulated ? "only desktop emulation (PASS (EMULATED)) measured this" : "no result on this target") }] });
          continue;
        }
        for (const [appVersion, sources] of byVersion) {
          const parts = [];
          const evidence = [];
          const excluded = new Set();
          for (const src of sources) {
            if (src.recorded) {
              // The record's own status decides (S6 checks it); anything but PASS / FAIL / UNVERIFIED is not a PASS.
              const st = ["PASS", "FAIL", "UNVERIFIED"].includes(src.recorded.status) ? src.recorded.status : "UNVERIFIED";
              parts.push({ state: st, check: null, method: src.recorded.method, why: st === src.recorded.status ? src.recorded.result : `recorded status ${JSON.stringify(src.recorded.status)} is not PASS / FAIL / UNVERIFIED` });
              evidence.push({ file: src.recorded.evidence, kind: "recorded verification", appVersion, at: src.recorded.scope.date ?? null, commit: null });
              continue;
            }
            const { run, rs } = src;
            evidence.push({ file: run.file, label: run.label, kind: run.kind, appVersion, electron: run.electron ?? null, at: run.at, commit: run.commit });
            // Every spec check of this requirement that applies here must have a result (desktop: any appearance;
            // device: the kit measures the opaque checks).
            // A check made for a window frame (c.frame, default Hidden) applies only to a run with that frame: the
            // custom-frame checks to the custom-frame run (research/14 §6.54), the others to the Hidden runs.
            const applies = (c) => (!c.themes || c.themes.includes(theme)) && (c.platform ?? ["desktop"]).some((p) => SPEC_PLATFORMS[target.device].includes(p)) && (run.kind === "desktop-runtime" || c.appearance.includes("opaque"))
              && (c.frame ?? "hidden") === (run.kind === "desktop-runtime" ? run.frame ?? "hidden" : "hidden");
            const expected = reqChecks.filter(applies);
            for (const c of reqChecks.filter((x) => !applies(x))) excluded.add(c.id);
            for (const c of expected) if (!rs.some((r) => r.id === c.id)) parts.push({ state: "NO RESULT", check: c.id, why: `no result in ${run.file}` });
            // A result of a check made for another frame than the run's is not counted (a Hidden run cannot stand
            // in for the custom-frame run).
            const runFrame = run.kind === "desktop-runtime" ? run.frame ?? "hidden" : "hidden";
            for (const r of rs.filter((x) => { const c = reqChecks.find((y) => y.id === x.id); return !c || (c.frame ?? "hidden") === runFrame; })) {
              const prep = prepFailed.get(prepKey(run, r));
              const s = prep ? "FAIL" : r.status === "PASS (EMULATED)" ? "EMULATED ONLY" : r.status;
              if (!ORDER.includes(s)) throw new Error(`${run.file}: unknown status ${r.status} (${r.id})`);
              parts.push({ state: s, check: r.id, appearance: r.appearance, view: r.state, method: run.method, run: run.label, ...(prep ? { why: `preparation failed: ${prep}` } : {}) });
            }
          }
          // A requirement without spec checks (syntax, Mermaid, recorded verifications) needs some result here.
          if (!parts.length) parts.push({ state: "NO RESULT", check: null, why: "no result for this requirement at this version" });
          // The worst part is the unit's state; an N/A part is a check that could not be measured here and is
          // never outweighed by the PASS of another check.
          const state = worst(parts.map((p) => p.state));
          units.push({ ...base, appVersion, state, evidence, parts, excludedBySpec: [...excluded].filter((id) => !parts.some((p) => p.check === id)) });
        }
      }
    }
  }
  // Does a unit count for the release? Only when every part counts: PASS, or a DIFF / UNSUPPORTED that the
  // requirement accepts (requirements.json `accepts`). The accepted states used are listed on the unit.
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  for (const u of units) {
    const accepts = reqById.get(u.requirement).accepts ?? {};
    const partCounts = (p) => p.state === "PASS" || (["DIFF", "UNSUPPORTED"].includes(p.state) && typeof accepts[p.state] === "string" && !!accepts[p.state].trim());
    u.counts = u.parts.length > 0 && u.parts.every(partCounts);
    u.notCounting = [...new Set(u.parts.filter((p) => !partCounts(p)).map((p) => p.state))];
    const used = [...new Set(u.parts.filter((p) => p.state !== "PASS" && partCounts(p)).map((p) => p.state))];
    if (used.length) u.accepted = Object.fromEntries(used.map((s) => [s, accepts[s]]));
    u.versionOk = u.appVersion !== null && cmpVersion(u.appVersion, minVersion) >= 0;
  }
  // Per gated target: every mandatory requirement x theme needs a counting unit at a version >= the minimum,
  // and, where the latest public version is known, a counting unit at that version.
  const targets = inputs.targets.map((t) => {
    const mine = units.filter((u) => u.os === t.os && u.device === t.device);
    const keys = [...new Set(mine.map((u) => `${u.requirement}|${u.theme}`))];
    const latest = inputs.latestPublic?.[t.os]?.version ?? null;
    const missing = [];
    for (const k of t.gated ? keys : []) {
      const us = mine.filter((u) => `${u.requirement}|${u.theme}` === k);
      if (!us.some((u) => u.counts && u.versionOk)) missing.push({ unit: k, reason: `no counting unit at >= ${minVersion}`, states: us.map((u) => `${u.state}${u.appVersion ? ` @${u.appVersion}` : ""}`) });
      else if (latest && !us.some((u) => u.counts && u.appVersion === latest)) missing.push({ unit: k, reason: `not verified on the latest public version ${latest}`, states: us.map((u) => `${u.state}${u.appVersion ? ` @${u.appVersion}` : ""}`) });
    }
    const states = Object.fromEntries(ORDER.map((s) => [s, mine.filter((u) => u.state === s).length]).filter(([, n]) => n));
    return { os: t.os, device: t.device, gated: t.gated, blocked: t.blocked ?? null, note: t.note ?? null, units: mine.length, states, met: t.gated ? missing.length === 0 && keys.length > 0 : null, missing };
  });
  const met = targets.filter((t) => t.gated).every((t) => t.met);
  return { minAppVersion: minVersion, latestPublic: inputs.latestPublic ?? {}, met, targets, notes, units };
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = path.resolve(import.meta.dirname, "..", "..");
  const { values: args } = parseArgs({ options: { inputs: { type: "string" }, out: { type: "string" } } });
  const inputsFile = path.resolve(args.inputs ?? path.join(repo, "tests/release/inputs.json"));
  const inputs = JSON.parse(readFileSync(inputsFile, "utf8"));
  // The minimum version must be the one the manifests ship (Q-D20).
  for (const t of THEMES) {
    const m = JSON.parse(readFileSync(path.join(repo, "src/manifests", `${t}.json`), "utf8")).minAppVersion;
    if (m !== inputs.minAppVersion) { console.error(`inputs: minAppVersion ${inputs.minAppVersion} but src/manifests/${t}.json has ${m}`); process.exit(1); }
  }
  // The commit that last changed an evidence file (its provenance); "uncommitted" when it has local changes.
  const commitOf = (file) => {
    if (file.startsWith("..") || path.isAbsolute(file)) return "outside the repository";
    try {
      const dirty = execFileSync("git", ["status", "--porcelain", "--", file], { cwd: repo, encoding: "utf8" }).trim();
      if (dirty) return "uncommitted";
      return execFileSync("git", ["log", "-1", "--format=%h", "--", file], { cwd: repo, encoding: "utf8" }).trim() || "uncommitted";
    } catch { return null; }
  };
  let report;
  try {
    const runs = inputs.runs.map((e) => readRun(e, repo, commitOf));
    report = judgeRelease({ requirements: loadRequirements(path.join(repo, "tests/spec")), checks: loadChecks(runtimeSpecFiles(path.join(repo, "tests/spec"))), inputs, runs });
  } catch (e) { console.error(String(e.message ?? e)); process.exit(1); }
  console.log(`release conditions (research/14 §2.3): ${report.met ? "MET" : "NOT MET"}; minimum Obsidian ${report.minAppVersion}`);
  for (const n of report.notes) console.log(`note: ${n}`);
  for (const t of report.targets) {
    console.log(`\n${t.os} ${t.device}${t.gated ? "" : " (not gated: Q-D10)"}: ${t.met === null ? "-" : t.met ? "met" : "NOT met"}; ${t.units} units ${JSON.stringify(t.states)}${t.blocked ? `; BLOCKED: ${t.blocked.reason}` : ""}${t.note ? `; ${t.note}` : ""}`);
    const byReason = new Map();
    for (const m of t.missing) { const k = `${m.reason}: ${m.states.join(", ")}`; byReason.set(k, [...(byReason.get(k) ?? []), m.unit]); }
    for (const [k, us] of byReason) console.log(`  ${us.length} x ${k}${us.length <= 6 ? `  [${us.join("; ")}]` : ""}`);
  }
  if (args.out) writeFileSync(args.out, `${JSON.stringify({ judgedAt: new Date().toISOString(), inputs: path.relative(repo, inputsFile), ...report }, null, 1)}\n`);
}

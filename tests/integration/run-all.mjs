// Integrated regression (step 11B, research/14 §6.30.3): every test of the project from one entry point, each
// result in one evidence folder, compared with the previous final results. macOS only (the isolated Obsidian).
// Nothing outside the isolated instances and <out_dir> is touched: no user vault, no Inkdrop, no device, no
// macOS display setting. Long run (about 2 hours): keep the Mac awake (research/14 §6.25).
//
// usage: node tests/integration/run-all.mjs <out_dir> [--only <step,...>] [--baseline-39 <json>] [--baseline-43 <json>]
//   <out_dir> must not exist yet. Steps, in order:
//     static      build, static tests, static / release / visual self-tests, clean-room build
//     kit-build   tests/device/kit-self-test.mjs build (kit builder never changes what is there; judge.mjs)
//     e39         Electron 39.5.1: runtime run 1, runner self-test, runtime run 2 (a fresh instance for each run)
//     e43         Electron 43.7.7 (current installer copy): the same, with the LaunchServices check around it
//     kit         tests/device/kit-self-test.mjs plugin and dry-run (the kit on the Mac, mobile emulation)
//     compare     each runtime run against the baseline and run 1 against run 2 (counts, states per check)
//     gate        tests/release/gate.mjs on this run's results (run 1 of each Electron + the device report);
//                 also checks that the kit's dry-run report is rejected as a device run
//   Exit 1 when a step fails or a comparison finds a difference in state; NOT MET of the release is not a failure.
//
// The kit's dry run on the Mac is not a device: its device.environment checks FAIL by design (52) and are
// reported apart ("expected in emulation"); any other FAIL of the dry run is a regression.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { deviceRunProblem } from "../release/gate.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { only: { type: "string" }, "baseline-39": { type: "string" }, "baseline-43": { type: "string" } } });
if (positionals.length !== 1) { console.error("usage: node tests/integration/run-all.mjs <out_dir> [--only static,kit-build,e39,e43,kit,compare,gate]"); process.exit(2); }
const out = path.resolve(positionals[0]);
const STEPS = ["static", "kit-build", "e39", "e43", "kit", "compare", "gate"];
const only = args.only ? args.only.split(",") : STEPS;
for (const s of only) if (!STEPS.includes(s)) { console.error(`unknown step ${s}`); process.exit(2); }
// The previous final results (step 10 re-review, research/14 §6.25) for the comparison.
const BASELINE = {
  "39.5.1": args["baseline-39"] ?? "research/evidence/phase3-step10/rereview/final/runtime-electron-39.5.1.json",
  "43.7.7": args["baseline-43"] ?? "research/evidence/phase3-step10/rereview/final/runtime-electron-43.7.7.json",
};
const CURRENT_APP = path.join(process.env.HOME, ".cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app");
// A new folder for every run; only the read-only steps (compare, gate) may be run again on an existing one.
if (only.every((s) => ["compare", "gate"].includes(s)) && existsSync(out)) console.log(`re-using ${out} for ${only.join(", ")}`);
else mkdirSync(out, { recursive: false });
const summary = { startedAt: new Date().toISOString(), commit: git(["rev-parse", "--short", "HEAD"]), dirty: git(["status", "--porcelain", "--", "src", "tests", "scripts"]) !== "", steps: [], comparisons: [], problems: [] };
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);
function git(a) { return spawnSync("git", a, { cwd: repo, encoding: "utf8" }).stdout.trim(); }

// Runs one command with its output in <out>/<name>.txt; records the exit status and the last line.
function step(name, cmd, cmdArgs, opts = {}) {
  log(`start ${name}`);
  const t0 = Date.now();
  const r = spawnSync(cmd, cmdArgs, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 30, env: { ...process.env, ...(opts.env ?? {}) } });
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  writeFileSync(path.join(out, `${name}.txt`), text);
  const last = text.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
  const ok = opts.okStatus ? opts.okStatus.includes(r.status) : r.status === 0;
  summary.steps.push({ name, ok, status: r.status, seconds: Math.round((Date.now() - t0) / 1000), last: last.slice(0, 300) });
  log(`${ok ? "ok  " : "FAIL"} ${name} (exit ${r.status}, ${Math.round((Date.now() - t0) / 1000)} s) ${last.slice(0, 160)}`);
  if (!ok) summary.problems.push(`${name}: exit ${r.status}: ${last.slice(0, 200)}`);
  return { ok, text, status: r.status };
}

// One isolated instance per runtime run (a fresh user data dir and vault copy), stopped afterwards.
function isolated(name, env, fn) {
  const work = path.join(out, `${name}-work`);
  const started = step(`${name}-start`, "bash", ["tests/runtime/obsidian-isolated.sh", "start", work], { env });
  if (!started.ok) return;
  const vault = started.text.trim().split("\n").slice(-1)[0];
  try { fn(vault); } finally { step(`${name}-stop`, "bash", ["tests/runtime/obsidian-isolated.sh", "stop", work]); }
}

function electron(label, env) {
  const tag = `e${label.split(".")[0]}`;
  for (const run of ["run1", "self-test", "run2"]) {
    isolated(`${tag}-${run}`, env, (vault) => {
      const file = path.join(out, `runtime-electron-${label}-${run}.json`);
      step(`${tag}-${run}`, process.execPath, ["tests/runtime/run.mjs", "--vault", vault, "--out", file, ...(run === "self-test" ? ["--self-test"] : [])], { env: { ...env, INK_PROGRESS: "1" } });
    });
  }
}

if (only.includes("static")) {
  step("build", "npm", ["run", "-s", "build"]);
  step("static", "npm", ["run", "-s", "test:static"]);
  step("static-self", "npm", ["run", "-s", "test:static-self"]);
  step("release-self", "npm", ["run", "-s", "test:release-self"]);
  step("visual-self", "python3", ["-I", "tests/visual/self-test.py"]);
  step("clean-room", "bash", ["tests/clean-room.sh"]);
}
if (only.includes("kit-build")) step("kit-build", process.execPath, ["tests/device/kit-self-test.mjs", "build", path.join(out, "kit-build-work")]);
if (only.includes("e39")) electron("39.5.1", {});
if (only.includes("e43")) {
  if (!existsSync(CURRENT_APP)) summary.problems.push(`e43: ${CURRENT_APP} missing (bash tests/runtime/current-installer.sh prepare)`);
  else {
    const before = step("e43-installer-check-before", "bash", ["tests/runtime/current-installer.sh", "check"]);
    electron("43.7.7", { OBSIDIAN_APP: CURRENT_APP, OBSIDIAN_ASAR: "none" });
    step("e43-installer-restore", "bash", ["tests/runtime/current-installer.sh", "restore"]);
    const after = step("e43-installer-check-after", "bash", ["tests/runtime/current-installer.sh", "check"]);
    // The obsidian:// handler must be what it was before (the user's /Applications/Obsidian.app).
    const handler = (t) => t.split("\n").filter((l) => /obsidian|Obsidian/.test(l) && !/^path:/.test(l)).join("\n");
    if (handler(before.text) !== handler(after.text)) summary.problems.push("e43: the obsidian:// handler changed (see e43-installer-check-*.txt)");
  }
}
if (only.includes("kit")) {
  step("kit-plugin", process.execPath, ["tests/device/kit-self-test.mjs", "plugin", path.join(out, "kit-plugin-work")]);
  step("kit-dry-run", process.execPath, ["tests/device/kit-self-test.mjs", "dry-run", path.join(out, "kit-dry-run-work")]);
}

// ---------- comparisons ----------
const readJson = (f) => JSON.parse(readFileSync(path.isAbsolute(f) ? f : path.join(repo, f), "utf8"));
// Results by check key; a key can repeat (the runner measures the opaque checks again after translucency).
const keyed = (results) => {
  const m = new Map();
  for (const r of results) { const k = [r.id, r.theme, r.platform, r.appearance, r.state].join("|"); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};
const breakdown = (results) => Object.fromEntries(Object.entries(results.reduce((o, r) => ((o[r.status] = (o[r.status] ?? 0) + 1), o), {})).sort());
function compare(name, a, b, labelA, labelB) {
  const ka = keyed(a), kb = keyed(b);
  const keys = [...new Set([...ka.keys(), ...kb.keys()])];
  const onlyA = keys.filter((k) => !kb.has(k)), onlyB = keys.filter((k) => !ka.has(k));
  const stateDiff = keys.filter((k) => ka.has(k) && kb.has(k) && JSON.stringify(ka.get(k).map((r) => r.status).sort()) !== JSON.stringify(kb.get(k).map((r) => r.status).sort()));
  // Measured values (detail) that differ while the state is the same: recorded, not a failure.
  const detailDiff = keys.filter((k) => ka.has(k) && kb.has(k) && !stateDiff.includes(k) && JSON.stringify(ka.get(k).map((r) => r.detail).sort()) !== JSON.stringify(kb.get(k).map((r) => r.detail).sort()));
  const c = { name, a: labelA, b: labelB, count: [a.length, b.length], breakdown: [breakdown(a), breakdown(b)], onlyA: onlyA.length, onlyB: onlyB.length, stateDiff: stateDiff.length, detailDiff: detailDiff.length,
    samples: { onlyA: onlyA.slice(0, 10), onlyB: onlyB.slice(0, 10), stateDiff: stateDiff.slice(0, 10), detailDiff: detailDiff.slice(0, 20) } };
  c.same = a.length === b.length && !onlyA.length && !onlyB.length && !stateDiff.length && JSON.stringify(c.breakdown[0]) === JSON.stringify(c.breakdown[1]);
  summary.comparisons.push(c);
  log(`${c.same ? "same" : "DIFFERENT"} ${name}: ${a.length} / ${b.length} results, ${stateDiff.length} state differences, ${onlyA.length}+${onlyB.length} keys on one side only, ${detailDiff.length} detail differences`);
  if (!c.same) summary.problems.push(`compare ${name}: not the same (see summary.json)`);
}
if (only.includes("compare")) {
  // The spec of the runtime checks must be the one the baseline ran (counts are compared only then).
  const specChanged = git(["diff", "--stat", "f7dd00a", "HEAD", "--", "tests/spec/runtime", "tests/spec/syntax.json", "tests/spec/mermaid.json", "tests/runtime", "tests/fixtures", "src"]).split("\n").filter((l) => l.includes("|") && !/src\/manifests\//.test(l));
  summary.specSinceBaseline = specChanged.length ? specChanged : "unchanged (runtime checks, syntax, Mermaid, runner, fixtures, CSS sources; only src/manifests changed: minAppVersion, not measured)";
  if (specChanged.length) summary.problems.push(`the measured spec or sources changed since the baseline (f7dd00a); compare the unchanged checks only: ${specChanged.join("; ")}`);
  for (const label of ["39.5.1", "43.7.7"]) {
    const f = (run) => path.join(out, `runtime-electron-${label}-${run}.json`);
    if (!existsSync(f("run1"))) continue;
    const r1 = readJson(f("run1")).results;
    compare(`E${label} run 1 vs baseline`, readJson(BASELINE[label]).results, r1, BASELINE[label], "run 1");
    if (existsSync(f("run2"))) compare(`E${label} run 1 vs run 2`, r1, readJson(f("run2")).results, "run 1", "run 2");
    // The runner's self-test judges itself (exit 1 unless every result has the declared outcome).
    if (existsSync(f("self-test"))) summary.comparisons.push({ name: `E${label} self-test`, count: readJson(f("self-test")).results.length, step: summary.steps.find((x) => x.name === `e${label.split(".")[0]}-self-test`) ?? "not run in this invocation" });
  }
  // The kit's dry run: device.environment FAILs are expected in emulation; any other FAIL is a regression.
  const dry = path.join(out, "kit-dry-run-work", "report-emulated.json");
  if (existsSync(dry)) {
    const rep = readJson(dry);
    const fails = rep.results.filter((r) => r.status === "FAIL");
    const expected = fails.filter((r) => r.id === "device.environment");
    const regression = fails.filter((r) => r.id !== "device.environment");
    summary.dryRun = { results: rep.results.length, breakdown: breakdown(rep.results), failExpectedInEmulation: expected.length, failRegression: regression.length, regression: regression.slice(0, 10).map((r) => `${r.id} ${r.theme} ${r.state}`) };
    log(`kit dry run: ${rep.results.length} results, FAIL ${fails.length} = ${expected.length} device.environment (expected in emulation) + ${regression.length} other (regression)`);
    if (regression.length) summary.problems.push(`kit dry run: ${regression.length} FAILs other than device.environment`);
    if (expected.length === 0) summary.problems.push("kit dry run: no device.environment FAIL although it ran in emulation");
  }
}

// ---------- the release judgement on this run's results ----------
if (only.includes("gate")) {
  const inputs = readJson("tests/release/inputs.json");
  const mine = ["39.5.1", "43.7.7"].map((l) => path.join(out, `runtime-electron-${l}-run1.json`)).filter(existsSync);
  if (mine.length === 2) {
    const runs = [
      ...mine.map((f, i) => ({ kind: "desktop-runtime", os: "macOS", label: `this run, Electron ${["39.5.1", "43.7.7"][i]} run 1`, file: path.relative(repo, f) })),
      ...inputs.runs.filter((r) => r.kind === "device-report"),
    ];
    const file = path.join(out, "release-inputs.json");
    writeFileSync(file, `${JSON.stringify({ ...inputs, _comment: `step 11B: this run's desktop results in place of the saved ones; ${inputs._comment}`, runs }, null, 1)}\n`);
    const g = step("gate", process.execPath, ["tests/release/gate.mjs", "--inputs", file, "--out", path.join(out, "release-gate.json")]);
    if (g.ok) {
      // The same judgement as the saved one (step 11A) unit by unit.
      const a = readJson("research/evidence/phase3-step11/11a/release-gate.json"), b = readJson(path.join(out, "release-gate.json"));
      const k = (u) => [u.requirement, u.theme, u.os, u.device, u.appVersion].join("|");
      const m = new Map(a.units.map((u) => [k(u), u]));
      const diff = b.units.filter((u) => !m.has(k(u)) || m.get(k(u)).state !== u.state || m.get(k(u)).counts !== u.counts).map(k);
      summary.gate = { met: b.met, units: b.units.length, savedUnits: a.units.length, differentFromSaved: diff.length, samples: diff.slice(0, 10) };
      log(`release judgement: ${b.met ? "MET" : "NOT MET"} (not a test failure); ${diff.length} units differ from the saved judgement`);
      if (diff.length || a.units.length !== b.units.length) summary.problems.push(`gate: ${diff.length} units differ from the saved judgement`);
    }
  } else summary.problems.push("gate: needs run 1 of both Electrons");
  // The dry-run report must not be accepted as a device run.
  const dry = path.join(out, "kit-dry-run-work", "report-emulated.json");
  if (existsSync(dry)) {
    const rep = readJson(dry);
    const p = rep.environment?.platform ?? {};
    const why = deviceRunProblem({ platformFlags: p, results: rep.results });
    summary.dryRunRejected = why;
    log(`kit dry run as a device report: ${why ? `rejected (${why})` : "ACCEPTED"}`);
    if (!why) summary.problems.push("the kit's dry-run report was accepted as a device run");
  }
}

summary.finishedAt = new Date().toISOString();
writeFileSync(path.join(out, "summary.json"), `${JSON.stringify(summary, null, 1)}\n`);
log(summary.problems.length ? `${summary.problems.length} problems:\n  ${summary.problems.join("\n  ")}` : "integrated regression: no problem");
process.exit(summary.problems.length ? 1 : 0);

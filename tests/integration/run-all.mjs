// Integrated regression (step 11B, research/14 §6.30.3): every test of the project from one entry point, each
// result in one evidence folder, compared with the previous final results. macOS only (the isolated Obsidian).
// Nothing outside the isolated instances and <out_dir> is touched: no user vault, no Inkdrop, no device, no
// macOS display setting. Long run (about 2 hours): keep the Mac awake (research/14 §6.25).
//
// usage: node tests/integration/run-all.mjs <out_dir> [--only <step,...>] [--baseline-39 <json>] [--baseline-43 <json>]
//        [--obsidian <version> --e43 <electron>]   another public release (11C, research/14 §6.123): the e39 runs load
//        its app asar and the e43 runs use its installer copy, both prepared by OBSIDIAN_VERSION=<version>
//        tests/runtime/current-installer.sh prepare; --e43 names the Electron of that installer in the file names
//   <out_dir> must not exist yet (its parent must) and must not be inside an Obsidian vault; it is never emptied.
//   Only `--only compare,gate` may re-use an existing output of this script (it carries .run-all-output.json).
//   Steps, in order:
//     static      build, static tests, static / release / visual self-tests, clean-room build
//     kit-build   tests/device/kit-self-test.mjs build (kit builder never changes what is there; judge.mjs)
//     e39         Electron 39.5.1: runtime run 1, runner self-test, runtime run 2 (a fresh isolated instance each),
//                 and the custom-frame run (an instance started with OBSIDIAN_FRAME=custom: the title-bar checks)
//     e43         Electron 43.7.7 (current installer copy): the same, with the LaunchServices check around it
//     kit         tests/device/kit-self-test.mjs plugin, dry-run and dry-run-tablet (the kit on the Mac, mobile
//                 emulation: phone, then tablet)
//     compare     each result file on its own (no FAIL; self-tests as declared), each runtime run against the
//                 baseline and run 1 against run 2 (keys, repetitions, states, unexpected states)
//     gate        tests/release/gate.mjs on this run's results (run 1 and the custom-frame run of each Electron +
//                 the device report);
//                 also checks that the kit's dry-run report is rejected as a device run
//   Every child runs in its own process group with a timeout; a timeout, a signal or a failed start is a failed
//   step. SIGINT / SIGTERM / SIGHUP stop the running child's group and every isolated Obsidian started here,
//   and leave summary.json with complete: false. Exit 0 only for a complete run without problems; NOT MET of
//   the release is a result, not a failure. A missing result file of a requested step is a problem.
//
// The kit's dry run on the Mac is not a device: its device.environment checks FAIL by design (52) and are
// reported apart ("expected in emulation"); any other FAIL of the dry run is a regression.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { deviceRunProblem } from "../release/gate.mjs";
import { classifyDryRun, compareResults, createRunner, prepareOut, runProblems, stopIsolated } from "./lib.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { only: { type: "string" }, "baseline-39": { type: "string" }, "baseline-43": { type: "string" }, obsidian: { type: "string" }, e43: { type: "string" } } });
if (positionals.length !== 1) { console.error("usage: node tests/integration/run-all.mjs <out_dir> [--only static,kit-build,e39,e43,kit,compare,gate]"); process.exit(2); }
const out = path.resolve(positionals[0]);
const STEPS = ["static", "kit-build", "e39", "e43", "kit", "compare", "gate"];
const only = args.only ? args.only.split(",") : STEPS;
for (const s of only) if (!STEPS.includes(s)) { console.error(`unknown step ${s}`); process.exit(2); }
// The previous final results (step 10 re-review, research/14 §6.25) for the comparison.
const VERSION = args.obsidian ?? "1.14.4";
const E43 = args.e43 ?? "43.7.7";
const BASELINE = {
  "39.5.1": args["baseline-39"] ?? "research/evidence/phase3-step10/rereview/final/runtime-electron-39.5.1.json",
  [E43]: args["baseline-43"] ?? "research/evidence/phase3-step10/rereview/final/runtime-electron-43.7.7.json",
};
const CACHE = path.join(process.env.HOME, `.cache/inkdrop-themes-for-obsidian/obsidian-${VERSION}`);
const CURRENT_APP = path.join(CACHE, "Obsidian.app");
// The e39 runs: /Applications/Obsidian.app with the user's 1.14.4 asar by default, or the release's own asar.
const E39_ENV = args.obsidian ? { OBSIDIAN_ASAR: path.join(CACHE, `obsidian-${VERSION}.asar`) } : {};
process.env.OBSIDIAN_VERSION = VERSION; // current-installer.sh check / restore act on this version's copy
const MIN = 60 * 1000;
try { prepareOut(out, { reuse: only.every((s) => ["compare", "gate"].includes(s)) }); }
catch (e) { console.error(`run-all: refusing: ${e.message}`); process.exit(2); }

function git(a) { return spawnSync("git", a, { cwd: repo, encoding: "utf8" }).stdout.trim(); }
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);
const summary = { startedAt: new Date().toISOString(), only, commit: git(["rev-parse", "--short", "HEAD"]), dirty: git(["status", "--porcelain", "--", "src", "tests", "scripts"]) !== "", complete: false, interrupted: null, steps: [], comparisons: [], problems: [] };
const writeSummary = () => { summary.finishedAt = new Date().toISOString(); writeFileSync(path.join(out, "summary.json"), `${JSON.stringify(summary, null, 1)}\n`); };
const runner = createRunner(out, summary, { log });
const step = (name, cmd, cmdArgs, opts = {}) => runner.step(name, cmd, cmdArgs, { cwd: repo, ...opts });

// ---------- interruption ----------
// The isolated instances that are running now (their work folders), stopped on an interruption.
const running = new Set();
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    summary.interrupted = sig;
    log(`${sig}: stopping ${runner.current?.name ?? "nothing running"} and ${running.size} isolated Obsidian`);
    runner.current?.killGroup();
    for (const work of running) stopIsolated(repo, work);
    summary.problems.push(`interrupted by ${sig}`);
    writeSummary();
    process.exit(130);
  });
}

// One isolated instance per runtime run (a fresh user data dir and vault copy), stopped afterwards.
async function isolated(name, env, fn) {
  const work = path.join(out, `${name}-work`);
  running.add(work);
  try {
    const started = await step(`${name}-start`, "bash", ["tests/runtime/obsidian-isolated.sh", "start", work], { env, timeoutMs: 3 * MIN });
    if (!started.ok) return;
    await fn(started.text.trim().split("\n").slice(-1)[0]);
  } finally {
    if (existsSync(path.join(work, "obsidian.pid"))) await step(`${name}-stop`, "bash", ["tests/runtime/obsidian-isolated.sh", "stop", work], { timeoutMs: 3 * MIN });
    running.delete(work);
  }
}
const runFile = (label, run) => path.join(out, `runtime-electron-${label}-${run}.json`);
async function electron(label, env) {
  const tag = `e${label.split(".")[0]}`;
  for (const run of ["run1", "self-test", "run2", "frame"]) {
    const runEnv = run === "frame" ? { ...env, OBSIDIAN_FRAME: "custom" } : env;
    await isolated(`${tag}-${run}`, runEnv, (vault) => step(`${tag}-${run}`, process.execPath, ["tests/runtime/run.mjs", "--vault", vault, "--out", runFile(label, run), ...(run === "self-test" ? ["--self-test"] : [])], { env: { ...runEnv, INK_PROGRESS: "1" }, timeoutMs: 90 * MIN }));
  }
}

if (only.includes("static")) {
  await step("build", "npm", ["run", "-s", "build"]);
  await step("static", "npm", ["run", "-s", "test:static"]);
  await step("static-self", "npm", ["run", "-s", "test:static-self"]);
  await step("release-self", "npm", ["run", "-s", "test:release-self"]);
  await step("integration-self", process.execPath, ["tests/integration/self-test.mjs"]);
  await step("compat-self", "npm", ["run", "-s", "test:compat-self"]);
  await step("quality-self", "npm", ["run", "-s", "test:quality-self"]);
  await step("mermaid-judge-self", "npm", ["run", "-s", "test:mermaid-judge-self"]);
  await step("visual-self", "python3", ["-I", "tests/visual/self-test.py"]);
  await step("clean-room", "bash", ["tests/clean-room.sh"]);
}
if (only.includes("kit-build")) await step("kit-build", process.execPath, ["tests/device/kit-self-test.mjs", "build", path.join(out, "kit-build-work")]);
if (only.includes("e39")) await electron("39.5.1", E39_ENV);
if (only.includes("e43")) {
  if (!existsSync(CURRENT_APP)) summary.problems.push(`e43: ${CURRENT_APP} missing (bash tests/runtime/current-installer.sh prepare)`);
  else {
    const before = await step("e43-installer-check-before", "bash", ["tests/runtime/current-installer.sh", "check"], { timeoutMs: 5 * MIN });
    try { await electron(E43, { OBSIDIAN_APP: CURRENT_APP, OBSIDIAN_ASAR: "none" }); }
    finally {
      await step("e43-installer-restore", "bash", ["tests/runtime/current-installer.sh", "restore"], { timeoutMs: 5 * MIN });
      const after = await step("e43-installer-check-after", "bash", ["tests/runtime/current-installer.sh", "check"], { timeoutMs: 5 * MIN });
      // The obsidian:// handler must be what it was before (the user's /Applications/Obsidian.app).
      const handler = (t) => t.split("\n").filter((l) => /obsidian|Obsidian/.test(l) && !/^path:/.test(l)).join("\n");
      if (!before.ok || !after.ok || handler(before.text) !== handler(after.text)) summary.problems.push("e43: the obsidian:// handler could not be confirmed unchanged (see e43-installer-check-*.txt)");
    }
  }
}
if (only.includes("kit")) {
  await step("kit-plugin", process.execPath, ["tests/device/kit-self-test.mjs", "plugin", path.join(out, "kit-plugin-work")], { timeoutMs: 30 * MIN });
  await step("kit-dry-run", process.execPath, ["tests/device/kit-self-test.mjs", "dry-run", path.join(out, "kit-dry-run-work")], { timeoutMs: 90 * MIN });
  await step("kit-dry-run-tablet", process.execPath, ["tests/device/kit-self-test.mjs", "dry-run-tablet", path.join(out, "kit-dry-run-tablet-work")], { timeoutMs: 90 * MIN });
}

// ---------- comparisons ----------
const readJson = (f) => JSON.parse(readFileSync(path.isAbsolute(f) ? f : path.join(repo, f), "utf8"));
// A result file a requested step must have left; missing or unreadable is a problem, never skipped quietly.
const need = (file, what) => {
  if (!existsSync(file)) { summary.problems.push(`${what}: missing ${path.relative(out, file)}`); return null; }
  try { return readJson(file); } catch (e) { summary.problems.push(`${what}: unreadable ${path.relative(out, file)}: ${e.message}`); return null; }
};
function compare(name, a, b, labelA, labelB) {
  const c = { name, a: labelA, b: labelB, ...compareResults(a, b) };
  summary.comparisons.push(c);
  log(`${c.same ? "same" : "DIFFERENT"} ${name}: ${c.count.join(" / ")} results, ${c.stateDiff} state differences, ${c.onlyA}+${c.onlyB} keys on one side only, ${c.repeatDiff} repetition differences, ${c.unexpected} unexpected states, ${c.detailDiff} detail differences`);
  if (!c.same) summary.problems.push(`compare ${name}: not the same (see summary.json)`);
}
if (only.includes("compare")) {
  // Counts are compared only while the measured spec and sources are those of the baseline.
  const specChanged = git(["diff", "--stat", "f7dd00a", "HEAD", "--", "tests/spec/runtime", "tests/spec/syntax.json", "tests/spec/mermaid.json", "tests/runtime", "tests/fixtures", "src"]).split("\n").filter((l) => l.includes("|") && !/src\/manifests\//.test(l));
  summary.specSinceBaseline = specChanged.length ? specChanged : "unchanged (runtime checks, syntax, Mermaid, runner, fixtures, CSS sources; only src/manifests changed: minAppVersion, not measured)";
  if (specChanged.length) summary.problems.push(`the measured spec or sources changed since the baseline (f7dd00a); compare the unchanged checks only: ${specChanged.join("; ")}`);
  for (const label of ["39.5.1", E43]) {
    const files = Object.fromEntries(["run1", "run2", "self-test", "frame"].map((run) => [run, need(runFile(label, run), `E${label} ${run}`)]));
    for (const [run, data] of Object.entries(files)) if (data) for (const p of runProblems(data, { selfTest: run === "self-test" })) summary.problems.push(`E${label} ${run}: ${p}`);
    if (files["self-test"]) summary.comparisons.push({ name: `E${label} self-test`, count: files["self-test"].results.length, problems: runProblems(files["self-test"], { selfTest: true }) });
    if (files.run1) compare(`E${label} run 1 vs baseline`, readJson(BASELINE[label]).results, files.run1.results, BASELINE[label], "run 1");
    if (files.run1 && files.run2) compare(`E${label} run 1 vs run 2`, files.run1.results, files.run2.results, "run 1", "run 2");
  }
  const rep = need(path.join(out, "kit-dry-run-work", "report-emulated.json"), "kit dry run");
  if (rep) {
    const { problems, ...dry } = classifyDryRun(rep.results);
    summary.dryRun = dry;
    summary.problems.push(...problems);
    log(`kit dry run: ${dry.results} results, FAIL ${dry.failExpectedInEmulation + dry.failRegression} = ${dry.failExpectedInEmulation} device.environment (expected in emulation) + ${dry.failRegression} other (regression)`);
  }
}

// ---------- the release judgement on this run's results ----------
if (only.includes("gate")) {
  const inputs = readJson("tests/release/inputs.json");
  const mine = ["39.5.1", E43].flatMap((l) => [["run 1", runFile(l, "run1")], ["custom-frame run", runFile(l, "frame")]].map(([what, f]) => ({ l, what, f })));
  if (mine.every((m) => existsSync(m.f))) {
    const runs = [
      ...mine.map((m) => ({ kind: "desktop-runtime", os: "macOS", label: `this run, Electron ${m.l} ${m.what}`, file: path.relative(repo, m.f) })),
      ...inputs.runs.filter((r) => r.kind === "device-report"),
    ];
    const file = path.join(out, "release-inputs.json");
    writeFileSync(file, `${JSON.stringify({ ...inputs, _comment: `step 11B: this run's desktop results in place of the saved ones; ${inputs._comment}`, runs }, null, 1)}\n`);
    const g = await step("gate", process.execPath, ["tests/release/gate.mjs", "--inputs", file, "--out", path.join(out, "release-gate.json")], { timeoutMs: 5 * MIN });
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
  const rep = need(path.join(out, "kit-dry-run-work", "report-emulated.json"), "gate: kit dry run");
  if (rep) {
    const why = deviceRunProblem({ platformFlags: rep.environment?.platform ?? {}, results: rep.results });
    summary.dryRunRejected = why;
    log(`kit dry run as a device report: ${why ? `rejected (${why})` : "ACCEPTED"}`);
    if (!why) summary.problems.push("the kit's dry-run report was accepted as a device run");
  }
}

summary.complete = true;
writeSummary();
log(summary.problems.length ? `${summary.problems.length} problems:\n  ${summary.problems.join("\n  ")}` : "integrated regression: no problem");
process.exit(summary.problems.length ? 1 : 0);

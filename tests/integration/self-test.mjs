// Negative tests of the integrated regression (tests/integration/run-all.mjs and lib.mjs, step 11B): the output
// folder never takes over an existing folder, a failed / timed-out / interrupted child is never a success and
// leaves no process behind, and the comparison of two runs finds every missing, repeated or changed check.
// Node only (no Obsidian); runs in CI.
//
// usage: node tests/integration/self-test.mjs
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyDryRun, compareResults, createRunner, MARKER, prepareOut, runProblems } from "./lib.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const tmp = mkdtempSync(path.join(os.tmpdir(), "ink-integration-self-"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} integration self-test: ${name}${ok || !detail ? "" : ` -- ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Every file and folder under dir with size, mtime and hash (compared before and after).
const snapshot = (dir) => {
  const o = {};
  const visit = (rel) => { const p = path.join(dir, rel); const st = lstatSync(p); if (st.isDirectory()) { o[rel || "."] = `dir ${st.mtimeMs}`; for (const e of readdirSync(p)) visit(rel ? `${rel}/${e}` : e); } else o[rel] = `${st.size} ${st.mtimeMs} ${createHash("sha256").update(readFileSync(p)).digest("hex")}`; };
  visit("");
  return JSON.stringify(o);
};
const throws = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ---------- 1. the output folder ----------
{
  const fresh = path.join(tmp, "fresh");
  check("a new folder is created with its marker", throws(() => prepareOut(fresh, { reuse: false })) === null && existsSync(path.join(fresh, MARKER)));
  const deep = path.join(tmp, "missing-parent", "out");
  check("a missing parent is an error, nothing is created", /ENOENT/.test(throws(() => prepareOut(deep, { reuse: false })) ?? "") && !existsSync(path.join(tmp, "missing-parent")));
  const user = path.join(tmp, "user-folder");
  mkdirSync(path.join(user, "notes"), { recursive: true });
  writeFileSync(path.join(user, "notes", "a.md"), "keep me\n");
  writeFileSync(path.join(user, "summary.json"), "{\"mine\": true}\n");
  let before = snapshot(user);
  check("an existing folder is refused for a full run, nothing changes", /already exists/.test(throws(() => prepareOut(user, { reuse: false })) ?? "") && snapshot(user) === before);
  check("re-use is refused for a folder run-all.mjs did not make, nothing changes", /not an output of run-all/.test(throws(() => prepareOut(user, { reuse: true })) ?? "") && snapshot(user) === before);
  check("re-use is allowed for an output of run-all.mjs", throws(() => prepareOut(fresh, { reuse: true })) === null);
  const vault = path.join(tmp, "a-vault");
  mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
  before = snapshot(vault);
  check("a folder inside an Obsidian vault is refused, nothing is created", /Obsidian vault/.test(throws(() => prepareOut(path.join(vault, "out"), { reuse: false })) ?? "") && snapshot(vault) === before);
  // The script itself: refuses before writing anything (exit 2) for an existing folder, for re-use without marker.
  const cli = (...a) => spawnSync(process.execPath, [path.join(repo, "tests/integration/run-all.mjs"), ...a], { encoding: "utf8", timeout: 60000 });
  before = snapshot(user);
  let r = cli(user);
  check("run-all.mjs on an existing folder: exit 2, nothing written", r.status === 2 && /refusing/.test(r.stderr) && snapshot(user) === before, r.stderr);
  r = cli(user, "--only", "compare,gate");
  check("run-all.mjs --only compare,gate on a foreign folder: exit 2, summary.json not overwritten", r.status === 2 && snapshot(user) === before && readFileSync(path.join(user, "summary.json"), "utf8").includes("mine"), r.stderr);
  // Re-use of an output that lacks result files: every missing file is a problem, exit 1.
  r = cli(fresh, "--only", "compare");
  const s = JSON.parse(readFileSync(path.join(fresh, "summary.json"), "utf8"));
  check("compare without the runs' files: each missing file is a problem, exit 1", r.status === 1 && s.complete === true && ["E39.5.1 run1", "E39.5.1 run2", "E39.5.1 self-test", "E43.7.7 run1", "kit dry run"].every((w) => s.problems.some((p) => p.startsWith(`${w}: missing`))), s.problems);
}

// ---------- 2. child processes ----------
{
  const out = path.join(tmp, "runner");
  mkdirSync(out);
  const summary = { steps: [], problems: [] };
  const run = createRunner(out, summary);
  let x = await run.step("exit-0", process.execPath, ["-e", "console.log('done')"]);
  check("exit 0 is ok, output kept", x.ok && readFileSync(path.join(out, "exit-0.txt"), "utf8").includes("done"));
  x = await run.step("exit-3", process.execPath, ["-e", "process.exit(3)"]);
  check("exit 3 is a failed step and a problem", !x.ok && x.status === 3 && summary.problems.some((p) => p.startsWith("exit-3: exit 3")));
  x = await run.step("no-such-command", "/nonexistent/command", []);
  check("a command that cannot start is a failed step", !x.ok && !!x.error && summary.problems.some((p) => p.startsWith("no-such-command: could not start")));
  x = await run.step("killed", process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"]);
  check("a child killed by a signal is a failed step", !x.ok && x.signal === "SIGTERM");
  // A child that starts a grandchild and hangs: the timeout stops both (the whole process group).
  const pidFile = path.join(out, "grandchild.pid");
  const t0 = Date.now();
  x = await run.step("hangs", "sh", ["-c", `sleep 60 & echo $! > '${pidFile}'; sleep 60`], { timeoutMs: 800, graceMs: 500 });
  await sleep(800);
  const gpid = Number(readFileSync(pidFile, "utf8"));
  check("a timeout is a failed step and stops the child and its grandchild", !x.ok && x.timedOut && Date.now() - t0 < 10000 && !alive(gpid) && summary.problems.some((p) => /hangs: timed out/.test(p)), { gpid, alive: alive(gpid) });
  // A child that ignores SIGTERM: SIGKILL after the grace time.
  x = await run.step("ignores-term", process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { timeoutMs: 500, graceMs: 500 });
  check("a child that ignores SIGTERM is killed after the grace time", !x.ok && x.timedOut && x.signal === "SIGKILL");
}

// ---------- 3. interrupting run-all.mjs ----------
{
  // A real run (kit-build only) interrupted with SIGTERM: exit 130, summary complete: false, the running child's
  // group stopped (no process with this output folder in its command line is left).
  const out = path.join(tmp, "interrupted");
  const child = spawn(process.execPath, [path.join(repo, "tests/integration/run-all.mjs"), out, "--only", "kit-build"], { stdio: "ignore" });
  const done = new Promise((r) => child.on("close", (status, signal) => r({ status, signal })));
  for (let i = 0; i < 100 && !existsSync(path.join(out, "kit-build.txt")); i++) await sleep(100);
  await sleep(500);
  child.kill("SIGTERM");
  const { status } = await done;
  await sleep(1500);
  const s = existsSync(path.join(out, "summary.json")) ? JSON.parse(readFileSync(path.join(out, "summary.json"), "utf8")) : null;
  const left = spawnSync("pgrep", ["-f", out], { encoding: "utf8" }).stdout.trim();
  check("SIGTERM: exit 130, summary.json says complete: false and interrupted, no process left", status === 130 && s?.complete === false && s?.interrupted === "SIGTERM" && s.problems.includes("interrupted by SIGTERM") && left === "", { status, s: s && { complete: s.complete, interrupted: s.interrupted }, left });
}

// ---------- 4. comparing runs ----------
{
  const r = (id, theme, platform, appearance, state, status, detail = "d") => ({ id, theme, platform, appearance, state, status, detail });
  const base = () => [
    r("a", "solarized-dark", "desktop", "opaque", "default", "PASS"), r("a", "kanagawa-dragon", "desktop", "opaque", "default", "PASS"),
    r("a", "solarized-dark", "desktop", "opaque (after translucent)", "default", "PASS"), r("b", "solarized-dark", "phone", "opaque", "default", "PASS (EMULATED)"),
    r("c", "solarized-dark", "desktop", "opaque", "md-live", "DIFF"), r("d", "kanagawa-dragon", "desktop", "opaque", "ed-fold", "UNSUPPORTED"),
    r("e", "solarized-dark", "desktop", "opaque", "default", "PASS"), r("e", "solarized-dark", "desktop", "opaque", "default", "PASS"),
  ];
  const same = (b) => compareResults(base(), b);
  check("identical runs are the same", same(base()).same);
  check("the same results in another order are the same", same([...base()].reverse()).same);
  let c = same(base().slice(1));
  check("a missing check is found (key on one side only)", !c.same && c.onlyA === 1);
  c = same([...base(), r("f", "solarized-dark", "desktop", "opaque", "default", "PASS")]);
  check("an extra check is found", !c.same && c.onlyB === 1);
  c = same(base().filter((x, i) => i !== 7));
  check("a lost repetition of a key is found", !c.same && c.repeatDiff === 1);
  c = same([...base(), r("e", "solarized-dark", "desktop", "opaque", "default", "PASS")]);
  check("an extra repetition of a key is found", !c.same && c.repeatDiff === 1);
  c = same(base().map((x, i) => (i === 4 ? { ...x, status: "PASS" } : x)));
  check("a changed state is found", !c.same && c.stateDiff === 1);
  // Same statuses overall, but on other themes / platforms / states: the keys keep them apart.
  const swapTheme = base().map((x, i) => (i === 0 ? { ...x, status: "FAIL" } : x));
  const swapThemeB = base().map((x, i) => (i === 1 ? { ...x, status: "FAIL" } : x));
  c = compareResults(swapTheme, swapThemeB);
  check("a state that moved to the other theme is found (same totals)", !c.same && c.stateDiff === 2 && JSON.stringify(c.breakdown[0]) === JSON.stringify(c.breakdown[1]));
  c = same(base().map((x, i) => (i === 3 ? { ...x, platform: "tablet" } : x)));
  check("a result on another platform is a different check", !c.same && c.onlyA === 1 && c.onlyB === 1);
  c = same(base().map((x, i) => (i === 4 ? { ...x, state: "md-reading" } : x)));
  check("a result in another view state is a different check", !c.same && c.onlyA === 1 && c.onlyB === 1);
  c = same(base().map((x, i) => (i === 2 ? { ...x, appearance: "translucent" } : x)));
  check("a result of another appearance is a different check", !c.same && c.onlyA === 1 && c.onlyB === 1);
  c = compareResults(base().map((x, i) => (i === 0 ? { ...x, status: "ERROR" } : x)), base().map((x, i) => (i === 0 ? { ...x, status: "ERROR" } : x)));
  check("an unexpected state is found even when both runs have it", !c.same && c.unexpected === 2);
  c = same(base().map((x, i) => (i === 0 ? { ...x, detail: "other" } : x)));
  check("a changed measured value alone is recorded, not a state difference", c.same && c.detailDiff === 1);
  c = same(base().map((x, i) => (i === 0 ? { ...x, theme: undefined } : x)));
  check("a result without a theme does not match one with a theme", !c.same && c.onlyA === 1 && c.onlyB === 1);
  // FAIL in both runs: the comparison says "same"; the file check says FAIL.
  const failing = base().map((x, i) => (i === 0 ? { ...x, status: "FAIL" } : x));
  check("a FAIL in both runs is the same state but a problem of the file", compareResults(failing, failing).same && runProblems({ selfTest: false, results: failing }, { selfTest: false }).some((p) => /1 FAIL/.test(p)));
  check("a good run file has no problem", runProblems({ selfTest: false, results: base() }, { selfTest: false }).length === 0);
  check("an empty run file is a problem", runProblems({ selfTest: false, results: [] }, { selfTest: false })[0] === "no results");
  check("a self-test file where a run was expected is a problem", runProblems({ selfTest: true, results: base() }, { selfTest: false }).some((p) => /self-test run where/.test(p)));
  const st = [{ ...base()[0], selfTest: "PASS" }, { ...base()[1], status: "FAIL", selfTest: "FAIL" }, { ...base()[3], selfTest: "PASS" }];
  check("a self-test file with every declared outcome has no problem", runProblems({ selfTest: true, results: st }, { selfTest: true }).length === 0);
  check("a self-test result without its declared outcome is a problem", runProblems({ selfTest: true, results: [...st, { ...base()[4], status: "PASS", selfTest: "FAIL" }] }, { selfTest: true }).some((p) => /without their declared outcome/.test(p)));
  // The kit's dry run on the Mac.
  const env = (status) => ({ id: "device.environment", theme: "solarized-dark", platform: "phone", state: "default", status });
  check("dry run: device.environment FAILs only -> no problem", classifyDryRun([env("FAIL"), env("FAIL"), r("x", "s", "phone", "opaque", "default", "PASS")]).problems.length === 0);
  check("dry run: another FAIL is a regression", classifyDryRun([env("FAIL"), r("x", "s", "phone", "opaque", "default", "FAIL")]).problems.some((p) => /1 FAILs other than device.environment/.test(p)));
  check("dry run: no device.environment FAIL means the emulation did not take", classifyDryRun([env("PASS")]).problems.some((p) => /no device.environment FAIL/.test(p)));
}

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} of ${results.length} integration self-test cases FAILED` : `\nall ${results.length} integration self-test cases behaved as expected`);
process.exit(failed ? 1 : 0);

// Shared parts of the integrated regression (tests/integration/run-all.mjs, step 11B), kept apart so that
// tests/integration/self-test.mjs can test them: where the output may go, how a child process is run (timeout,
// interruption, its whole process group), and how two runs of results are compared.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MARKER = ".run-all-output.json";
const MARKER_KIND = "inkdrop-themes-for-obsidian integrated regression output";

// ---------- the output folder ----------
// A new folder (its parent must exist; never created recursively, never emptied), outside any Obsidian vault.
// Re-using one is allowed only for the read-only steps and only for a folder this script made (its marker).
// Returns null, or throws with the reason; nothing is written when it throws.
export function prepareOut(out, { reuse }) {
  // The vault check runs on the path as given AND on its real path: the deepest part that exists is resolved
  // (symbolic links, including a link at `out` itself), so a link that leads into a vault is refused too.
  const vaultAbove = (start) => {
    for (let d = start; ; d = path.dirname(d)) {
      if (existsSync(path.join(d, ".obsidian"))) return d;
      if (path.dirname(d) === d) return null;
    }
  };
  let existing = out;
  while (!existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
  const real = path.join(realpathSync(existing), path.relative(existing, out));
  for (const p of [out, real]) {
    const v = vaultAbove(p);
    if (v) throw new Error(`${p === out ? out : `${out} (really ${real})`} is inside an Obsidian vault (${v} has .obsidian); choose an output folder outside any vault`);
  }
  let exists = false;
  try { lstatSync(out); exists = true; } catch {}
  if (reuse && exists) {
    let m = null;
    try { m = JSON.parse(readFileSync(path.join(out, MARKER), "utf8")); } catch {}
    if (m?.kind !== MARKER_KIND) throw new Error(`${out} exists but is not an output of run-all.mjs (no ${MARKER}); nothing was written`);
    return;
  }
  if (exists) throw new Error(`${out} already exists; give a new folder (only --only compare,gate may re-use an output of run-all.mjs)`);
  mkdirSync(out); // not recursive: a missing parent is an error, not a reason to create a tree
  writeFileSync(path.join(out, MARKER), `${JSON.stringify({ kind: MARKER_KIND, createdAt: new Date().toISOString() })}\n`);
}

// ---------- child processes ----------
// Stopping a process group: SIGTERM to the whole group, wait until it is empty or `graceMs` has passed, then
// SIGKILL to the whole group whatever happened (a member that ignores SIGTERM, a parent that died on SIGTERM
// while its child ignores it), then wait for it to empty. `groupGone` is true once no member is left (ESRCH).
const groupGone = (pgid) => { try { process.kill(-pgid, 0); return false; } catch (e) { return e.code === "ESRCH"; } };
const signalGroup = (pgid, sig) => { try { process.kill(-pgid, sig); } catch {} };
// Synchronous form, for a signal handler that exits right after (no timer would fire). A zombie of the direct
// child keeps the group "present" while the event loop is blocked, so each wait is bounded.
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export function terminateGroupSync(pgid, graceMs) {
  signalGroup(pgid, "SIGTERM");
  for (let t = 0; t < graceMs && !groupGone(pgid); t += 100) pause(100);
  signalGroup(pgid, "SIGKILL");
  for (let t = 0; t < 3000 && !groupGone(pgid); t += 100) pause(100);
}
export async function terminateGroup(pgid, graceMs) {
  signalGroup(pgid, "SIGTERM");
  for (let t = 0; t < graceMs && !groupGone(pgid); t += 100) await new Promise((r) => setTimeout(r, 100));
  signalGroup(pgid, "SIGKILL");
  for (let t = 0; t < 5000 && !groupGone(pgid); t += 100) await new Promise((r) => setTimeout(r, 100));
  return groupGone(pgid);
}

// Runs one command in its own process group with its output in <out>/<name>.txt. A timeout stops the whole
// group (terminateGroup) before the step returns, so no grandchild is left behind; an interruption does the same
// synchronously (run.current.killGroup). ok only for exit 0 without a signal, a timeout or a spawn error.
// A step that ends normally keeps its group (obsidian-isolated.sh start leaves Obsidian running on purpose).
export function createRunner(out, summary, { log = () => {} } = {}) {
  const run = { current: null };
  run.step = (name, cmd, args, { env = {}, cwd, timeoutMs = 30 * 60 * 1000, graceMs = 10000, okStatus = [0] } = {}) => new Promise((resolve) => {
    log(`start ${name}`);
    const t0 = Date.now();
    const file = path.join(out, `${name}.txt`);
    const fd = openSync(file, "w");
    let timedOut = false;
    let spawnError = null;
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", fd, fd], detached: true });
    run.current = { child, name, killGroup: () => (child.pid ? terminateGroupSync(child.pid, graceMs) : undefined) };
    let stopped = Promise.resolve(true);
    const timer = setTimeout(() => { timedOut = true; stopped = child.pid ? terminateGroup(child.pid, graceMs) : Promise.resolve(true); }, timeoutMs);
    child.on("error", (e) => { spawnError = String(e.message ?? e); });
    child.on("close", async (status, signal) => {
      clearTimeout(timer);
      // After a timeout, the step returns only once its whole group is gone (or reports that it is not).
      const groupStopped = await stopped;
      closeSync(fd);
      run.current = null;
      const text = readFileSync(file, "utf8");
      const last = text.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
      const ok = !timedOut && !spawnError && signal === null && okStatus.includes(status);
      const why = timedOut ? `timed out after ${Math.round(timeoutMs / 1000)} s${groupStopped ? "" : "; its process group could not be emptied"}` : spawnError ? `could not start: ${spawnError}` : signal ? `killed by ${signal}` : `exit ${status}`;
      const rec = { name, ok, status, signal, timedOut, groupStopped, error: spawnError, seconds: Math.round((Date.now() - t0) / 1000), last: last.slice(0, 300) };
      summary.steps.push(rec);
      log(`${ok ? "ok  " : "FAIL"} ${name} (${why}, ${rec.seconds} s) ${last.slice(0, 160)}`);
      if (!ok) summary.problems.push(`${name}: ${why}: ${last.slice(0, 200)}`);
      resolve({ ...rec, text });
    });
  });
  return run;
}

// ---------- comparisons ----------
// A check is identified by id, theme, platform, appearance and state. A key can repeat (the runner measures
// the opaque checks again after translucency); repeated keys are compared as multisets, so a lost or extra
// repetition is a difference too.
export const resultKey = (r) => [r.id, r.theme, r.platform, r.appearance, r.state].map((x) => (x === undefined ? "?" : x)).join("|");
const keyed = (results) => {
  const m = new Map();
  for (const r of results) { const k = resultKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};
export const breakdown = (results) => Object.fromEntries(Object.entries(results.reduce((o, r) => ((o[r.status] = (o[r.status] ?? 0) + 1), o), {})).sort());
// Statuses a runtime run may contain without failing (research/14 §3.2); anything else is unexpected.
export const RUN_STATUSES = ["PASS", "PASS (EMULATED)", "DIFF", "UNSUPPORTED", "FAIL"];
export function compareResults(a, b) {
  const ka = keyed(a), kb = keyed(b);
  const keys = [...new Set([...ka.keys(), ...kb.keys()])];
  const statuses = (m, k) => JSON.stringify(m.get(k).map((r) => r.status).sort());
  const details = (m, k) => JSON.stringify(m.get(k).map((r) => JSON.stringify(r.detail ?? null)).sort());
  const onlyA = keys.filter((k) => !kb.has(k)), onlyB = keys.filter((k) => !ka.has(k));
  const both = keys.filter((k) => ka.has(k) && kb.has(k));
  const repeatDiff = both.filter((k) => ka.get(k).length !== kb.get(k).length);
  const stateDiff = both.filter((k) => statuses(ka, k) !== statuses(kb, k));
  const detailDiff = both.filter((k) => !stateDiff.includes(k) && details(ka, k) !== details(kb, k));
  const unexpected = [...a, ...b].filter((r) => !RUN_STATUSES.includes(r.status)).map((r) => `${resultKey(r)}: ${r.status}`);
  const c = { count: [a.length, b.length], breakdown: [breakdown(a), breakdown(b)], onlyA: onlyA.length, onlyB: onlyB.length, repeatDiff: repeatDiff.length, stateDiff: stateDiff.length, detailDiff: detailDiff.length, unexpected: unexpected.length,
    samples: { onlyA: onlyA.slice(0, 10), onlyB: onlyB.slice(0, 10), repeatDiff: repeatDiff.slice(0, 10), stateDiff: stateDiff.slice(0, 10), detailDiff: detailDiff.slice(0, 20), unexpected: unexpected.slice(0, 10) } };
  c.same = a.length === b.length && !onlyA.length && !onlyB.length && !repeatDiff.length && !stateDiff.length && !unexpected.length && JSON.stringify(c.breakdown[0]) === JSON.stringify(c.breakdown[1]);
  return c;
}
// Problems of one runtime result file on its own: not a run of the expected kind, a FAIL, an unexpected status.
// Self-test files: every result must have its declared outcome (as tests/runtime/run.mjs judges it).
export function runProblems(data, { selfTest }) {
  const p = [];
  if (!data || !Array.isArray(data.results) || !data.results.length) return ["no results"];
  if (!!data.selfTest !== selfTest) p.push(selfTest ? "not a self-test run" : "a self-test run where a runtime run was expected");
  if (selfTest) {
    const bad = data.results.filter((r) => !["PASS", "FAIL"].includes(r.selfTest) || r.status.replace(" (EMULATED)", "") !== r.selfTest);
    if (bad.length) p.push(`${bad.length} self-test results without their declared outcome (e.g. ${resultKey(bad[0])}: ${bad[0].status}, declared ${bad[0].selfTest})`);
  } else {
    const fails = data.results.filter((r) => r.status === "FAIL");
    const odd = data.results.filter((r) => !RUN_STATUSES.includes(r.status));
    if (fails.length) p.push(`${fails.length} FAIL (e.g. ${resultKey(fails[0])})`);
    if (odd.length) p.push(`${odd.length} results with an unexpected status (e.g. ${odd[0].status})`);
  }
  return p;
}
// The kit's dry run on the Mac: device.environment FAILs are expected there (not a device); any other FAIL is a
// regression, and no device.environment FAIL at all means the emulation did not take.
export function classifyDryRun(results) {
  const fails = results.filter((r) => r.status === "FAIL");
  const expected = fails.filter((r) => r.id === "device.environment");
  const regression = fails.filter((r) => r.id !== "device.environment");
  const problems = [];
  if (regression.length) problems.push(`kit dry run: ${regression.length} FAILs other than device.environment`);
  if (!expected.length) problems.push("kit dry run: no device.environment FAIL although it ran in emulation");
  return { results: results.length, breakdown: breakdown(results), failExpectedInEmulation: expected.length, failRegression: regression.length, regression: regression.slice(0, 10).map(resultKey), problems };
}

// Stops an isolated Obsidian started in `work` (used when a run is interrupted).
export function stopIsolated(repo, work) {
  if (!existsSync(path.join(work, "obsidian.pid"))) return null;
  return spawnSync("bash", [path.join(repo, "tests/runtime/obsidian-isolated.sh"), "stop", work], { encoding: "utf8" });
}

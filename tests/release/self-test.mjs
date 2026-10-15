// Negative tests of the release judgement (tests/release/gate.mjs, step 11A): a judgement that can count a
// missing device run, an emulated PASS, a missing check or a mixed state as met proves nothing. Each case
// builds a small synthetic set of requirements, checks and runs, changes one thing, and checks the outcome.
//
// usage: node tests/release/self-test.mjs
import { judgeRelease } from "./gate.mjs";

const THEMES = ["solarized-dark", "kanagawa-dragon"];
// Two mandatory requirements: one desktop-only with a spec check, one on every device class with a spec check;
// one non-mandatory (never a unit).
const requirements = () => [
  { id: "r.desk", qd: "Q-D1", description: "desktop role", platforms: ["desktop"], mandatory: true },
  { id: "r.all", qd: "Q-D1", description: "role everywhere", platforms: ["desktop", "phone", "tablet"], mandatory: true },
  { id: "r.optional", qd: "Q-D1", description: "not mandatory", platforms: ["desktop"], mandatory: false },
];
const checks = () => [
  { id: "c.desk", requirement: "r.desk", appearance: ["opaque", "translucent"] },
  { id: "c.all.desktop", requirement: "r.all", appearance: ["opaque"] },
  { id: "c.all.mobile", requirement: "r.all", appearance: ["opaque"], platform: ["phone", "phone-nonfloating", "tablet"] },
];
const res = (id, requirement, theme, platform, status, extra = {}) => ({ id, requirement, theme, platform, appearance: "opaque", state: "default", status, ...extra });
const desktopRun = (over = {}) => ({
  file: "desktop.json", label: "desktop", kind: "desktop-runtime", os: "macOS", appVersion: "1.14.4", electron: "43.7.7", at: "t", commit: "abc",
  method: "m", results: THEMES.flatMap((t) => [
    res("c.desk", "r.desk", t, "desktop", "PASS"), res("c.all.desktop", "r.all", t, "desktop", "PASS"),
    res("c.all.mobile", "r.all", t, "phone", "PASS (EMULATED)"), res("c.all.mobile", "r.all", t, "tablet", "PASS (EMULATED)"),
    res("runner.theme-applied", undefined, t, "desktop", "PASS"),
  ]), ...over,
});
const deviceRun = (os, device, over = {}) => ({
  file: `${os}-${device}.json`, label: `${os} ${device}`, kind: "device-report", os, device, appVersion: "1.14.5", at: "t", commit: "abc", method: "m", rejected: null,
  results: THEMES.flatMap((t) => [res("c.all.mobile", "r.all", t, "phone", "PASS"), res("device.theme-applied", undefined, t, "phone", "PASS")]), ...over,
});
const allRuns = () => [desktopRun(), deviceRun("iOS", "phone"), deviceRun("iOS", "tablet"), deviceRun("Android", "phone"), deviceRun("Android", "tablet")];
const inputs = (over = {}) => ({
  minAppVersion: "1.14.4", latestPublic: { macOS: { version: "1.14.4" } },
  targets: [
    { os: "macOS", device: "desktop", gated: true }, { os: "iOS", device: "phone", gated: true }, { os: "iOS", device: "tablet", gated: true },
    { os: "Android", device: "phone", gated: true }, { os: "Android", device: "tablet", gated: true },
    { os: "Windows", device: "desktop", gated: false, note: "not guaranteed" },
  ], ...over,
});
// The runs without any result of r.desk (for the cases where only a recorded verification covers it).
const withoutDesk = () => allRuns().map((x) => ({ ...x, results: x.results.filter((y) => y.requirement !== "r.desk") }));
const unit = (r, req, theme, os, device) => r.units.filter((u) => u.requirement === req && u.theme === theme && u.os === os && u.device === device);
const target = (r, os, device) => r.targets.find((t) => t.os === os && t.device === device);
const tablet = (results) => results.map((x) => ({ ...x, platform: x.platform === "phone" ? "tablet" : x.platform }));

const CASES = [
  { name: "positive control: everything measured on every gated target -> met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().map((x) => (x.device === "tablet" ? { ...x, results: tablet(x.results) } : x)) }),
    expect: (r) => r.met && r.units.every((u) => u.state === "PASS" || u.os === "Windows") && target(r, "Windows", "desktop").met === null },
  { name: "the non-mandatory requirement makes no unit", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
    expect: (r) => !r.units.some((u) => u.requirement === "r.optional") },
  { name: "device run removed -> EMULATED ONLY (desktop emulation only), never PASS, not met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().filter((x) => !(x.os === "iOS" && x.device === "phone")) }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "EMULATED ONLY" && !target(r, "iOS", "phone").met },
  { name: "no device run and no emulation -> NO RESULT", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.filter((x) => x.platform === "desktop") })] }),
    expect: (r) => !r.met && unit(r, "r.all", "kanagawa-dragon", "Android", "phone")[0].state === "NO RESULT" },
  { name: "declared BLOCKED target -> BLOCKED, not met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs({ targets: inputs().targets.map((t) => (t.os === "Android" ? { ...t, blocked: { reason: "no device" } } : t)) }), runs: allRuns().filter((x) => x.os !== "Android") }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "Android", "tablet")[0].state === "BLOCKED" },
  { name: "a device report whose device.environment failed (desktop dry run) is rejected", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [...allRuns().filter((x) => !(x.os === "iOS" && x.device === "phone")), deviceRun("iOS", "phone", { rejected: "52 device.environment checks failed (not a device run)" })] }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "EMULATED ONLY" && r.notes.some((n) => /rejected/.test(n)) },
  { name: "a check's result missing -> NO RESULT", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.filter((x) => !(x.id === "c.desk" && x.theme === "kanagawa-dragon")) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "NO RESULT" && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "PASS" },
  { name: "a FAIL among PASSes -> FAIL", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: [...desktopRun().results, res("c.desk", "r.desk", "solarized-dark", "desktop", "FAIL", { appearance: "translucent" })] }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "FAIL" },
  { name: "a failed preparation (runner.*) makes the state's PASS a FAIL", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "runner.theme-applied" && x.theme === "solarized-dark" ? { ...x, status: "FAIL" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "FAIL" && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "PASS" },
  { name: "DIFF without an accepted decision -> DIFF, does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "DIFF" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "DIFF" && !unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].counts },
  { name: "DIFF with an accepted decision counts (and says which)", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, accepts: { DIFF: "decision X" } } : q)), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "DIFF" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return u.state === "DIFF" && u.counts && u.accepted === "decision X"; } },
  { name: "UNSUPPORTED without an accepted decision does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "UNSUPPORTED" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "UNSUPPORTED" },
  { name: "only N/A results -> N/A, does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "N/A" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "N/A" },
  { name: "extra (desktop-candidate) device results never count for a phone", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun(), deviceRun("iOS", "phone", { results: deviceRun("iOS", "phone").results.map((x) => ({ ...x, extra: true })) }), ...allRuns().slice(2)] }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "NO RESULT" },
  { name: "a version below the minimum does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ appVersion: "1.14.3" }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].appVersion === "1.14.3" && !unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].versionOk },
  { name: "two versions stay apart; the latest public one must be among the counting units", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs({ latestPublic: { macOS: { version: "1.14.6" } } }), runs: [desktopRun(), desktopRun({ file: "d2.json", appVersion: "1.14.5" }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop").length === 2 && target(r, "macOS", "desktop").missing.every((m) => /latest public version 1\.14\.6/.test(m.reason)) },
  { name: "an UNVERIFIED requirement -> UNVERIFIED, not met", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, unverified: { reason: "x", risk: "y" } } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: allRuns() }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "UNVERIFIED" },
  { name: "a recorded verification counts only for its scope (one theme)", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, verifiedBy: [{ method: "native capture", evidence: "e", result: "PASS", scope: { os: "macOS", device: "desktop", themes: ["kanagawa-dragon"], appVersion: "1.14.4" } }] } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "PASS" && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "NO RESULT" },
  { name: "a recorded verification without a scope does not count", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, verifiedBy: [{ method: "see notes", evidence: "e", result: "see notes" }] } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "NO RESULT" },
  { name: "an ungated target (Windows) without results is UNVERIFIED and does not decide the verdict", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().map((x) => (x.device === "tablet" ? { ...x, results: tablet(x.results) } : x)) }),
    expect: (r) => r.met && unit(r, "r.desk", "solarized-dark", "Windows", "desktop")[0].state === "UNVERIFIED" },
  { name: "every unit keeps its evidence (file, version, commit) and its checks", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
    expect: (r) => r.units.filter((u) => u.state === "PASS").every((u) => u.evidence.length && u.evidence.every((e) => e.file && e.appVersion && e.commit) && u.parts.every((p) => p.check && p.method)) },
];

let failures = 0;
for (const c of CASES) {
  let ok;
  let detail = "";
  try { const r = c.run(); ok = !!c.expect(r); if (!ok) detail = JSON.stringify({ met: r.met, units: r.units.filter((u) => u.os !== "Windows").map((u) => `${u.requirement}|${u.theme}|${u.os}|${u.device}|${u.appVersion}:${u.state}`) }).slice(0, 600); }
  catch (e) { ok = false; detail = String(e.stack ?? e).slice(0, 400); }
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} release self-test: ${c.name}${detail ? ` -- ${detail}` : ""}`);
}
console.log(failures ? `\n${failures} of ${CASES.length} release self-test cases FAILED` : `\nall ${CASES.length} release self-test cases behaved as expected`);
process.exit(failures ? 1 : 0);

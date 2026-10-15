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
// A device report as the kit writes it: one probe state per theme with its device.environment check (body
// classes of the device) and the environment flags; results on the platform of the device class.
const deviceRun = (os, device, over = {}) => {
  const platform = device === "tablet" ? "tablet" : "phone";
  const classes = `is-mobile ${os === "iOS" ? "is-ios" : "is-android"} is-${device}`;
  return {
    file: `${os}-${device}.json`, label: `${os} ${device}`, kind: "device-report", os, device, appVersion: "1.14.5", at: "t", commit: "abc", method: "m",
    platformFlags: { isMobile: true, isPhone: device === "phone", isTablet: device === "tablet", isIosApp: os === "iOS", isAndroidApp: os === "Android" },
    results: THEMES.flatMap((t) => [res("c.all.mobile", "r.all", t, platform, "PASS"), res("device.theme-applied", undefined, t, platform, "PASS"), res("device.environment", undefined, t, platform, "PASS", { detail: classes })]), ...over,
  };
};
const allRuns = () => [desktopRun(), deviceRun("iOS", "phone"), deviceRun("iOS", "tablet"), deviceRun("Android", "phone"), deviceRun("Android", "tablet")];
const withDesk = (results) => [desktopRun({ results }), ...allRuns().slice(1)];
const deskWith = (f) => desktopRun().results.map((x) => (x.id === "c.desk" ? f(x) : x));
const reqsAccepting = (accepts) => requirements().map((q) => (q.id === "r.desk" ? { ...q, accepts } : q));
// The iOS phone report changed by f; the judgement must reject it (a note) and never count the iOS phone.
const rejectsPhone = (f) => () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().map((x) => (x.os === "iOS" && x.device === "phone" ? f(x) : x)) });
const phoneRejected = (re) => (r) => !r.met && r.notes.some((n) => re.test(n)) && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "EMULATED ONLY";
const inputs = (over = {}) => ({
  minAppVersion: "1.14.4", latestPublic: { macOS: { version: "1.14.4" } },
  targets: [
    { os: "macOS", device: "desktop", gated: true }, { os: "iOS", device: "phone", gated: true }, { os: "iOS", device: "tablet", gated: true },
    { os: "Android", device: "phone", gated: true }, { os: "Android", device: "tablet", gated: true },
    { os: "Windows", device: "desktop", gated: false, note: "not guaranteed" },
  ], ...over,
});
// r.desk verified only by a record for Kanagawa Dragon, with the given status and result text.
const recorded = (status, result = "recorded") => requirements().map((q) => (q.id === "r.desk" ? { ...q, verifiedBy: [{ method: "native capture", evidence: "e", result, ...(status === undefined ? {} : { status }), scope: { os: "macOS", device: "desktop", themes: ["kanagawa-dragon"], appVersion: "1.14.4" } }] } : q));
// The runs without any result of r.desk (for the cases where only a recorded verification covers it).
const withoutDesk = () => allRuns().map((x) => ({ ...x, results: x.results.filter((y) => y.requirement !== "r.desk") }));
const unit = (r, req, theme, os, device) => r.units.filter((u) => u.requirement === req && u.theme === theme && u.os === os && u.device === device);
const target = (r, os, device) => r.targets.find((t) => t.os === os && t.device === device);

const CASES = [
  { name: "positive control: everything measured on every gated target -> met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
    expect: (r) => r.met && r.units.every((u) => u.state === "PASS" || u.os === "Windows") && target(r, "Windows", "desktop").met === null },
  { name: "the non-mandatory requirement makes no unit", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
    expect: (r) => !r.units.some((u) => u.requirement === "r.optional") },
  { name: "device run removed -> EMULATED ONLY (desktop emulation only), never PASS, not met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().filter((x) => !(x.os === "iOS" && x.device === "phone")) }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "EMULATED ONLY" && !target(r, "iOS", "phone").met },
  { name: "no device run and no emulation -> NO RESULT", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.filter((x) => x.platform === "desktop") })] }),
    expect: (r) => !r.met && unit(r, "r.all", "kanagawa-dragon", "Android", "phone")[0].state === "NO RESULT" },
  { name: "declared BLOCKED target -> BLOCKED, not met", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs({ targets: inputs().targets.map((t) => (t.os === "Android" ? { ...t, blocked: { reason: "no device" } } : t)) }), runs: allRuns().filter((x) => x.os !== "Android") }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "Android", "tablet")[0].state === "BLOCKED" },
  // --- device reports: accepted only with every environment check present, passing and consistent ---
  { name: "device report: device.environment FAIL (the kit's dry run on the Mac) is rejected", run: rejectsPhone((x) => ({ ...x, results: x.results.map((y) => (y.id === "device.environment" ? { ...y, status: "FAIL", detail: "is-frameless emulate-mobile is-phone is-mobile" } : y)) })),
    expect: phoneRejected(/device\.environment checks did not pass/) },
  { name: "device report: no device.environment check at all is rejected", run: rejectsPhone((x) => ({ ...x, results: x.results.filter((y) => y.id !== "device.environment") })),
    expect: phoneRejected(/no device\.environment check/) },
  { name: "device report: the environment check of one probe state missing is rejected", run: rejectsPhone((x) => ({ ...x, results: x.results.filter((y) => !(y.id === "device.environment" && y.theme === "kanagawa-dragon")) })),
    expect: phoneRejected(/no device\.environment check for 1 probe states/) },
  { name: "device report: environment check passes but shows emulation is rejected", run: rejectsPhone((x) => ({ ...x, results: x.results.map((y) => (y.id === "device.environment" ? { ...y, detail: `${y.detail} emulate-mobile` } : y)) })),
    expect: phoneRejected(/disagree with the recorded environment/) },
  { name: "device report: flags say tablet, body classes say phone is rejected", run: rejectsPhone((x) => ({ ...x, platformFlags: { ...x.platformFlags, isPhone: false, isTablet: true } })),
    expect: (r) => !r.met && r.notes.some((n) => /disagree with the recorded environment|not a tablet/.test(n)) },
  { name: "device report: flags say iOS, body classes say Android is rejected", run: rejectsPhone((x) => ({ ...x, results: x.results.map((y) => (y.id === "device.environment" ? { ...y, detail: "is-mobile is-android is-phone" } : y)) })),
    expect: phoneRejected(/disagree with the recorded environment \(is-ios is-phone\)/) },
  { name: "device report: both iOS and Android flags is rejected", run: rejectsPhone((x) => ({ ...x, platformFlags: { ...x.platformFlags, isAndroidApp: true } })),
    expect: (r) => !r.met && r.notes.some((n) => /not exactly one of an iOS \/ Android app/.test(n)) },
  { name: "device report: phone jobs measured on a tablet are rejected", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns().map((x) => (x.os === "iOS" && x.device === "tablet" ? { ...x, results: x.results.map((y) => ({ ...y, platform: "phone" })) } : x)) }),
    expect: (r) => !r.met && r.notes.some((n) => /platform phone, not a tablet/.test(n)) },
  { name: "device report: the accepted control (as the kit writes it) is not rejected", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
    expect: (r) => r.notes.length === 0 && unit(r, "r.all", "kanagawa-dragon", "Android", "tablet")[0].state === "PASS" },
  { name: "a check's result missing -> NO RESULT", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.filter((x) => !(x.id === "c.desk" && x.theme === "kanagawa-dragon")) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "NO RESULT" && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "PASS" },
  { name: "a FAIL among PASSes -> FAIL", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: [...desktopRun().results, res("c.desk", "r.desk", "solarized-dark", "desktop", "FAIL", { appearance: "translucent" })] }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "FAIL" },
  { name: "a failed preparation (runner.*) makes the state's PASS a FAIL", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "runner.theme-applied" && x.theme === "solarized-dark" ? { ...x, status: "FAIL" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "FAIL" && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "PASS" },
  { name: "DIFF without an accepted decision -> DIFF, does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "DIFF" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "DIFF" && !unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].counts },
  { name: "DIFF with an accepted decision counts (and says which)", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, accepts: { DIFF: "decision X" } } : q)), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "DIFF" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return u.state === "DIFF" && u.counts && u.accepted.DIFF === "decision X"; } },
  { name: "UNSUPPORTED without an accepted decision does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "UNSUPPORTED" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "UNSUPPORTED" },
  { name: "only N/A results -> N/A, does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ results: desktopRun().results.map((x) => (x.id === "c.desk" ? { ...x, status: "N/A" } : x)) }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "N/A" },
  { name: "PASS + N/A -> N/A, the PASS of another check does not cover it", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: withDesk([...desktopRun().results, res("c.desk", "r.desk", "solarized-dark", "desktop", "N/A", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return !r.met && u.state === "N/A" && !u.counts && u.notCounting.includes("N/A"); } },
  { name: "a check excluded by the spec is listed apart, not as N/A", run: () => judgeRelease({ requirements: requirements(), checks: [...checks(), { id: "c.desk.kd", requirement: "r.desk", appearance: ["opaque"], themes: ["kanagawa-dragon"] }], inputs: inputs(), runs: withDesk([...desktopRun().results, res("c.desk.kd", "r.desk", "kanagawa-dragon", "desktop", "PASS")]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return u.state === "PASS" && u.counts && u.excludedBySpec.includes("c.desk.kd"); } },
  // --- accepted states are judged per part, never from the unit's state alone ---
  { name: "PASS + DIFF, DIFF not accepted -> does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: withDesk([...desktopRun().results, res("c.desk", "r.desk", "solarized-dark", "desktop", "DIFF", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return !r.met && u.state === "DIFF" && !u.counts; } },
  { name: "PASS + DIFF, DIFF accepted -> counts", run: () => judgeRelease({ requirements: reqsAccepting({ DIFF: "decision D" }), checks: checks(), inputs: inputs(), runs: withDesk([...desktopRun().results, res("c.desk", "r.desk", "solarized-dark", "desktop", "DIFF", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return u.counts && u.accepted.DIFF === "decision D"; } },
  { name: "DIFF + UNSUPPORTED, only DIFF accepted -> does not count", run: () => judgeRelease({ requirements: reqsAccepting({ DIFF: "decision D" }), checks: checks(), inputs: inputs(), runs: withDesk([...deskWith((x) => ({ ...x, status: "DIFF" })), res("c.desk", "r.desk", "solarized-dark", "desktop", "UNSUPPORTED", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return !r.met && !u.counts && u.notCounting.join() === "UNSUPPORTED"; } },
  { name: "DIFF + UNSUPPORTED, both accepted -> counts", run: () => judgeRelease({ requirements: reqsAccepting({ DIFF: "decision D", UNSUPPORTED: "decision U" }), checks: checks(), inputs: inputs(), runs: withDesk([...deskWith((x) => ({ ...x, status: "DIFF" })), res("c.desk", "r.desk", "solarized-dark", "desktop", "UNSUPPORTED", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return u.counts && u.accepted.DIFF === "decision D" && u.accepted.UNSUPPORTED === "decision U"; } },
  { name: "FAIL + accepted DIFF -> FAIL, does not count", run: () => judgeRelease({ requirements: reqsAccepting({ DIFF: "decision D" }), checks: checks(), inputs: inputs(), runs: withDesk([...deskWith((x) => ({ ...x, status: "DIFF" })), res("c.desk", "r.desk", "solarized-dark", "desktop", "FAIL", { appearance: "translucent" })]) }),
    expect: (r) => { const u = unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0]; return !r.met && u.state === "FAIL" && !u.counts; } },
  { name: "extra (desktop-candidate) device results never count for a phone", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun(), deviceRun("iOS", "phone", { results: deviceRun("iOS", "phone").results.map((x) => ({ ...x, extra: true })) }), ...allRuns().slice(2)] }),
    expect: (r) => !r.met && unit(r, "r.all", "solarized-dark", "iOS", "phone")[0].state === "NO RESULT" },
  { name: "a version below the minimum does not count", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: [desktopRun({ appVersion: "1.14.3" }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].appVersion === "1.14.3" && !unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].versionOk },
  { name: "two versions stay apart; the latest public one must be among the counting units", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs({ latestPublic: { macOS: { version: "1.14.6" } } }), runs: [desktopRun(), desktopRun({ file: "d2.json", appVersion: "1.14.5" }), ...allRuns().slice(1)] }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop").length === 2 && target(r, "macOS", "desktop").missing.every((m) => /latest public version 1\.14\.6/.test(m.reason)) },
  { name: "an UNVERIFIED requirement -> UNVERIFIED, not met", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, unverified: { reason: "x", risk: "y" } } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: allRuns() }),
    expect: (r) => !r.met && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "UNVERIFIED" },
  { name: "a recorded verification counts only for its scope (one theme)", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, verifiedBy: [{ method: "native capture", evidence: "e", result: "PASS", status: "PASS", scope: { os: "macOS", device: "desktop", themes: ["kanagawa-dragon"], appVersion: "1.14.4" } }] } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => !r.met && unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "PASS" && unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "NO RESULT" },
  { name: "a recorded verification with status FAIL -> FAIL", run: () => judgeRelease({ requirements: recorded("FAIL"), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "FAIL" },
  { name: "a recorded verification with status UNVERIFIED -> UNVERIFIED", run: () => judgeRelease({ requirements: recorded("UNVERIFIED"), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0].state === "UNVERIFIED" },
  { name: "a recorded verification with an invalid status (OK) is not a PASS", run: () => judgeRelease({ requirements: recorded("OK"), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => { const u = unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0]; return u.state === "UNVERIFIED" && !u.counts; } },
  { name: "a recorded verification without a status is not a PASS, whatever its result text says", run: () => judgeRelease({ requirements: recorded(undefined, "PASS on every theme"), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => { const u = unit(r, "r.desk", "kanagawa-dragon", "macOS", "desktop")[0]; return u.state === "UNVERIFIED" && !u.counts; } },
  { name: "a recorded verification without a scope does not count", run: () => judgeRelease({ requirements: requirements().map((q) => (q.id === "r.desk" ? { ...q, verifiedBy: [{ method: "see notes", evidence: "e", result: "see notes" }] } : q)), checks: checks().filter((c) => c.requirement !== "r.desk"), inputs: inputs(), runs: withoutDesk() }),
    expect: (r) => unit(r, "r.desk", "solarized-dark", "macOS", "desktop")[0].state === "NO RESULT" },
  { name: "an ungated target (Windows) without results is UNVERIFIED and does not decide the verdict", run: () => judgeRelease({ requirements: requirements(), checks: checks(), inputs: inputs(), runs: allRuns() }),
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

// Step 11G G6 (research/14 §6.95): the stop rules of the isolated Inkdrop, as pure functions so the self-test
// (tests/visual/g6-self-test.py) can exercise every branch without Inkdrop.
import path from "node:path";

const inside = (p, dir) => p === dir || p.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);

// Why the instance on 9334 cannot be taken as isolated (empty: isolated). report is g6-isolation.js's result;
// data is the isolated user data directory; prod the user's; listener the PID listening on 9334; started the
// PID tests/runtime/inkdrop-isolated.sh started; othersBefore / othersNow the other Inkdrop main PIDs.
export function isolationProblems({ report, data, prod, listener, started, othersBefore, othersNow }) {
  const out = [];
  if (!report) return ["no report from the instance on 9334"];
  if (listener !== started) out.push(`port 9334 is held by pid ${listener}, not by the started instance (${started})`);
  if (report.pid !== null && report.pid !== started) out.push(`the page belongs to pid ${report.pid}, not ${started}`);
  if (report.env !== data) out.push("INKDROP_USER_DATA_PATH of the instance is not the isolated directory");
  const reported = Object.entries(report.paths ?? {}).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])).filter(([, v]) => typeof v === "string" && v.startsWith("/"));
  if (!reported.some(([k]) => k === "userData")) out.push("the instance did not report its userData path");
  if (!reported.some(([k]) => k === "configFile" || k === "configDir")) out.push("the instance did not report its config path");
  for (const [k, v] of reported) {
    if (inside(v, prod)) out.push(`${k} is in the user's profile`);
    // Packages may also come from the app bundle itself; everything else must be under the isolated directory.
    else if (!inside(v, data) && !(k === "packageDirs" && v.includes(".app/Contents/Resources"))) out.push(`${k} is outside the isolated directory`);
  }
  if (JSON.stringify(othersBefore) !== JSON.stringify(othersNow)) out.push("the user's Inkdrop processes changed");
  return out;
}

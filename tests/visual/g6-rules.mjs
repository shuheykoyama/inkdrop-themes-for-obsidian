// Step 11G G6 (research/14 §6.95, §6.97): the stop rules of the isolated Inkdrop, as pure functions so the
// self-test (tests/visual/g6-self-test.py) can exercise every branch without Inkdrop. Fail closed: anything
// required that is missing, empty or not an absolute path is a problem, never a pass.
import path from "node:path";

const inside = (p, dir) => p === dir || p.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
const isPath = (v) => typeof v === "string" && v.length > 1 && path.isAbsolute(v) && path.normalize(v) === v.replace(/\/+$/, "");

// Why the instance on 9334 cannot be taken as isolated (empty: isolated). All paths must already be normalised
// (real paths where they exist, tests/visual/g6-run.mjs). report is g6-isolation.js's result; openFiles the
// files the started process tree has open (lsof); data the isolated user data directory; prod the user's;
// listener the PID listening on 9334; started the PID tests/runtime/inkdrop-isolated.sh started;
// othersBefore / othersNow the other Inkdrop main PIDs.
export function isolationProblems({ report, openFiles, data, prod, listener, started, othersBefore, othersNow }) {
  const out = [];
  if (!Number.isInteger(started) || started <= 0) out.push("the started PID is unknown");
  if (!Number.isInteger(listener) || listener !== started) out.push(`port 9334 is held by pid ${listener}, not by the started instance (${started})`);
  if (!isPath(data) || !isPath(prod)) out.push("the isolated or the user's directory is not a usable path");
  if (!report || typeof report !== "object") return [...out, "no report from the instance on 9334"];
  if (report.pid !== started) out.push(`the page belongs to pid ${report.pid}, not ${started}`);
  if (report.env !== data) out.push("INKDROP_USER_DATA_PATH of the instance is not the isolated directory");
  const p = report.paths ?? {};
  // Every reported value must be an absolute path (or absent); a value that is there but not a path fails.
  const entries = Object.entries(p).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])).filter(([, v]) => v !== null && v !== undefined);
  for (const [k, v] of entries) if (!isPath(v)) out.push(`${k} is not an absolute path`);
  const good = entries.filter(([, v]) => isPath(v));
  for (const [k, v] of good) {
    if (isPath(prod) && inside(v, prod)) out.push(`${k} is in the user's profile`);
    // Packages may also come from the app bundle itself; everything else must be under the isolated directory.
    else if (isPath(data) && !inside(v, data) && !(k === "packageDirs" && /\.app\/Contents\/Resources\//.test(v))) out.push(`${k} is outside the isolated directory`);
  }
  const has = (...keys) => good.some(([k, v]) => keys.includes(k) && isPath(data) && inside(v, data));
  if (!has("userData")) out.push("the userData path is not confirmed in the isolated directory");
  if (!has("configFile", "configDir")) out.push("the config location is not confirmed in the isolated directory");
  if (!has("packageDirs")) out.push("the packages location is not confirmed in the isolated directory");
  // The database: a path the app reports, or a file the started processes have open under <data>/db.
  const files = Array.isArray(openFiles) ? openFiles.filter(isPath) : [];
  if (!Array.isArray(openFiles)) out.push("the open files of the started process are unknown");
  if (!has("db") && !(isPath(data) && files.some((f) => inside(f, path.join(data, "db"))))) out.push("the database location is not confirmed in the isolated directory");
  if (isPath(prod)) for (const f of files) if (inside(f, prod)) { out.push("the started process has a file of the user's profile open"); break; }
  if (!Array.isArray(othersBefore) || !Array.isArray(othersNow) || JSON.stringify(othersBefore) !== JSON.stringify(othersNow)) out.push("the user's Inkdrop processes changed or are unknown");
  return out;
}

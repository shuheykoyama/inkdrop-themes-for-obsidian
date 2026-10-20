// Step 11G G5 (research/14 §6.73): native captures of the custom-frame title bar, translucent and opaque, with
// the current build and the build before the title bar fix (the negative control), both themes: 8 conditions,
// each its own image and records. Phase B only (after the user said they can stop working): it starts the
// isolated E43 instance with OBSIDIAN_FRAME=custom, takes the 8 captures with tests/visual/capture-obsidian.sh
// (CAPTURE_INKDROP=off: Inkdrop is never touched), reads the sampling regions after each capture
// (tests/visual/g5-regions.js), stops the instance and prints SCREEN RELEASED, then restores LaunchServices.
// It stops before the next capture when a condition is not as expected (frame, window size, computed title bar).
// SCREEN RELEASED is printed only when its own instance is confirmed stopped and port 9333 closed
// (tests/visual/g5-finish.mjs); the exit status tells a complete run (0) from incomplete captures (1), a screen
// not confirmed released (3) and LaunchServices not restored (4).
//
// usage: node tests/visual/g5-capture.mjs --themes <dir> --out <new dir> --tmp <dir> [--plan]
//   <dir>/<build>/<theme>/{theme.css,manifest.json} for build after / before (made in phase A; each manifest
//   names the theme "G5 <build> <theme>" so the two builds never share a theme folder in the vault)
//   --plan  print the 8 conditions, their environment and files, and do nothing else (self-test)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { finish } from "./g5-finish.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { themes: { type: "string" }, out: { type: "string" }, tmp: { type: "string" }, plan: { type: "boolean" } } });
if (!args.themes || !args.out || !args.tmp) { console.error("usage: node tests/visual/g5-capture.mjs --themes <dir> --out <new dir> --tmp <dir> [--plan]"); process.exit(2); }
const BUILDS = ["after", "before"];
const THEMES = ["solarized-dark", "kanagawa-dragon"];
const MODES = ["translucent", "opaque"];
// The computed title bar the runtime checks measured (11F re-review, research/14 §6.56.1): a capture whose
// computed value differs is not the expected state, and the run stops there.
const EXPECTED = {
  after: { "solarized-dark": { translucent: "rgba(0, 33, 41, 0.7)", opaque: "rgb(0, 45, 56)" }, "kanagawa-dragon": { translucent: "rgba(24, 22, 22, 0.7)", opaque: "rgb(24, 22, 22)" } },
  before: { "solarized-dark": { translucent: "rgba(0, 0, 0, 0)", opaque: "rgb(0, 45, 56)" }, "kanagawa-dragon": { translucent: "rgba(0, 0, 0, 0)", opaque: "rgb(24, 22, 22)" } },
};
const conditions = BUILDS.flatMap((build) => THEMES.flatMap((theme) => MODES.map((mode) => {
  const themeDir = path.join(args.themes, build, theme);
  const outDir = path.join(args.out, build);
  const name = `obsidian-${theme}-${mode}-gray-active-${build}`;
  return { build, theme, mode, themeDir, outDir, name, image: path.join(outDir, "screenshots", `${name}.png`),
    env: { CAPTURE_INKDROP: "off", CAPTURE_THEME_DIR: themeDir, CAPTURE_TAG: build } };
})));
if (args.plan) { console.log(JSON.stringify(conditions, null, 1)); process.exit(0); }
if (existsSync(args.out)) { console.error(`${args.out} exists; G5 never writes over earlier captures`); process.exit(2); }

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const run = (cmd, a, env = {}) => spawnSync(cmd, a, { cwd: repo, encoding: "utf8", env: { ...process.env, ...env }, timeout: 180000 });
const log = (...m) => console.log(new Date().toISOString(), ...m);
const { evaluate } = await import(path.join(repo, "tests/runtime/lib/cdp.mjs"));
const E43 = { OBSIDIAN_APP: path.join(process.env.HOME, ".cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app"), OBSIDIAN_ASAR: "none", OBSIDIAN_FRAME: "custom" };
const regionsScript = readFileSync(path.join(repo, "tests/visual/g5-regions.js"), "utf8");
mkdirSync(args.out, { recursive: true });
const work = path.join(args.tmp, "g5-instance");
const summary = { startedAt: new Date().toISOString(), commit: run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim(), dirty: !!run("git", ["status", "--porcelain"]).stdout.trim(), captures: [], stoppedEarly: null };
writeFileSync(path.join(args.out, "ls-before.txt"), run("bash", ["tests/runtime/current-installer.sh", "check"]).stdout);
let started = false;
try {
  mkdirSync(work, { recursive: true });
  const st = run("bash", ["tests/runtime/obsidian-isolated.sh", "start", work], E43);
  if (st.status !== 0) throw new Error(`isolated instance did not start: ${st.stderr.slice(-300)}`);
  started = true;
  const vault = st.stdout.trim().split("\n").pop();
  for (let i = 0; i < 80 && !(await evaluate(9333, "(() => !!(window.app && app.workspace.layoutReady))()", 5000).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 500));
  log("instance ready");
  for (const c of conditions) {
    const cap = run("bash", ["tests/visual/capture-obsidian.sh", c.theme, c.mode, "gray", "active", vault, c.outDir, args.tmp], c.env);
    const rec = { build: c.build, theme: c.theme, mode: c.mode, exit: cap.status, stdout: cap.stdout.trim().split("\n").slice(-2) };
    if (cap.status !== 0 || !existsSync(c.image)) { rec.error = `capture failed: ${cap.stderr.slice(-300)}`; summary.captures.push(rec); summary.stoppedEarly = `${c.name}: capture failed`; break; }
    const measured = JSON.parse(readFileSync(path.join(c.outDir, "measurements", `${c.name}.json`), "utf8"));
    const geo = await evaluate(9333, `window.__G5 = { inset: 4, minWidth: 20, minHeight: 10, trafficLights: 90 };\n${regionsScript}`, 30000);
    const css = path.join(c.themeDir, "theme.css");
    Object.assign(rec, {
      image: path.relative(args.out, c.image), imageSha256: sha(c.image),
      themeName: JSON.parse(readFileSync(path.join(c.themeDir, "manifest.json"), "utf8")).name, cssSha256: sha(css),
      sourceCommit: readFileSync(path.join(c.themeDir, "SOURCE"), "utf8").trim(),
      app: (await evaluate(9333, "(() => window.require('electron').ipcRenderer.sendSync('version'))()")), electron: measured.setup?.electron ?? null,
      frame: geo.frame, translucent: measured.setup?.isTranslucent ?? null, classes: geo.classes,
      window: geo.window, focusedAfterShot: measured.afterShot?.focused ?? null, capturedAt: measured.capture?.capturedAt,
      regions: geo.regions, expectedTitlebar: EXPECTED[c.build][c.theme][c.mode],
    });
    writeFileSync(path.join(c.outDir, "measurements", `${c.name}.g5.json`), `${JSON.stringify(rec, null, 1)}\n`);
    summary.captures.push({ ...rec, regions: undefined });
    log(`${c.name}: titlebar ${geo.regions.titlebar.background} (expected ${rec.expectedTitlebar}), frame ${geo.frame}, window ${geo.window.innerWidth}x${geo.window.innerHeight}, focused ${rec.focusedAfterShot}`);
    const wrong = geo.frame !== "custom" ? "the frame is not custom" : geo.window.innerWidth !== 1200 || geo.window.innerHeight !== 700 ? "the window is not 1200 x 700" : geo.regions.titlebar.background !== rec.expectedTitlebar ? "the computed title bar is not the expected one" : null;
    if (wrong) { summary.stoppedEarly = `${c.name}: ${wrong}`; break; }
  }
} catch (e) {
  summary.stoppedEarly = String(e?.message ?? e);
} finally {
  // Only the instance this run started (its pid file in `work`); the backdrop window of a capture closes with
  // capture-obsidian.sh. Then whether it is really gone: its process, and the CDP port.
  // A pid file in `work` is this run's instance even when its start did not finish.
  const pidFile = path.join(work, "obsidian.pid");
  const ours = started || existsSync(pidFile);
  const stop = ours ? run("bash", ["tests/runtime/obsidian-isolated.sh", "stop", work]) : null;
  const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, "utf8").trim()) : null;
  let pidAlive = null;
  if (pid) { try { process.kill(pid, 0); pidAlive = true; } catch { pidAlive = false; } } else if (!ours) pidAlive = false;
  const portOpen = await fetch("http://127.0.0.1:9333/json/version", { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
  // The screen is reported before LaunchServices is restored (it takes up to a minute and uses no screen).
  const early = finish({ started: ours, stopStatus: stop?.status ?? null, pidAlive, portOpen });
  if (early.released) summary.screenReleasedAt = new Date().toISOString();
  console.log(early.screenLine, early.released ? summary.screenReleasedAt : "");
  const restore = run("bash", ["tests/runtime/current-installer.sh", "restore"]);
  const after = run("bash", ["tests/runtime/current-installer.sh", "check"]).stdout;
  writeFileSync(path.join(args.out, "ls-after.txt"), after);
  const f = finish({ started: ours, stopStatus: stop?.status ?? null, pidAlive, portOpen, restoreStatus: restore.status, lsSame: after === readFileSync(path.join(args.out, "ls-before.txt"), "utf8"), captures: summary.captures.length, total: conditions.length, stoppedEarly: summary.stoppedEarly });
  Object.assign(summary, { stop: stop && { status: stop.status, out: stop.stdout.trim().slice(-200) }, pidAlive, portOpen, restoreStatus: restore.status, ...f, finishedAt: new Date().toISOString() });
  writeFileSync(path.join(args.out, "g5-run.json"), `${JSON.stringify(summary, null, 1)}\n`);
  console.log(f.restoreLine);
  console.log(f.captureLine);
  process.exitCode = f.exitCode;
}

// Negative tests of the device kit's safety (research/14 §6.27). Needs macOS (ditto, unzip); `plugin` and
// `dry-run` also need the isolated Obsidian of the runtime tests (same app, asar and flags as
// tests/runtime/obsidian-isolated.sh, with the vault folder named as the case needs; CDP on 127.0.0.1:9335).
// No device is touched: the cable driver is pointed at the isolated Obsidian, and `pymobiledevice3` is a stand-in
// that only records that it was called.
//
// usage: node tests/device/kit-self-test.mjs build   <work_dir>   build-kit.mjs never changes what is there; judge.mjs fails a missed fold
//        node tests/device/kit-self-test.mjs plugin  <work_dir>   the plugin and cable.mjs refuse other vaults
//        node tests/device/kit-self-test.mjs dry-run <work_dir>   the kit in its own vault, mobile emulation (phone)
//        node tests/device/kit-self-test.mjs dry-run-tablet <work_dir>   the same, tablet emulation (the tablet jobs)
// <work_dir> must not exist yet; everything the test makes stays in it (nothing is deleted).
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluate, holdFocus } from "../runtime/lib/cdp.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const [mode, workArg] = process.argv.slice(2);
if (!["build", "plugin", "dry-run", "dry-run-tablet"].includes(mode) || !workArg) { console.error("usage: node tests/device/kit-self-test.mjs build|plugin|dry-run|dry-run-tablet <work_dir>"); process.exit(2); }
const work = path.resolve(workArg);
mkdirSync(work); // fails when it exists
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`); };

// Every file, folder and link under dir with its size, mtime and hash: compared before and after a refusal.
function snapshot(dir) {
  const out = {};
  const visit = (rel) => {
    const p = path.join(dir, rel);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) out[rel] = `link ${readlinkSync(p)} ${st.mtimeMs}`;
    else if (st.isDirectory()) { out[rel || "."] = `dir ${st.mtimeMs}`; for (const e of readdirSync(p)) visit(rel ? `${rel}/${e}` : e); }
    else out[rel] = `file ${st.size} ${st.mtimeMs} ${createHash("sha256").update(readFileSync(p)).digest("hex")}`;
  };
  visit("");
  return out;
}
const sameSnapshot = (a, b) => {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const diff = keys.filter((k) => a[k] !== b[k]);
  return { same: diff.length === 0, diff: diff.slice(0, 5) };
};
const buildKit = (out, ...flags) => spawnSync(process.execPath, [path.join(repo, "tests/device/build-kit.mjs"), out, ...flags], { encoding: "utf8" });
const markerOf = (vault) => JSON.parse(readFileSync(path.join(vault, ".obsidian/inkdrop-device-kit.json"), "utf8"));
const finish = () => {
  const failed = results.filter((r) => !r.ok);
  writeFileSync(path.join(work, "kit-self-test.json"), `${JSON.stringify({ mode, results }, null, 1)}\n`);
  console.log(failed.length ? `${failed.length} of ${results.length} kit self-test checks FAILED` : `all ${results.length} kit self-test checks PASS`);
  process.exit(failed.length ? 1 : 0);
};

// A build that must be refused: exit 1, the reason on stderr, and nothing under root changed.
function refusedBuild(id, root, out, flags, reason) {
  const before = snapshot(root);
  const r = buildKit(out, ...flags);
  const after = snapshot(root);
  const s = sameSnapshot(before, after);
  check(`${id}.refused`, r.status === 1 && reason.test(r.stderr), { status: r.status, stderr: r.stderr.trim().split("\n")[0].slice(0, 300) });
  check(`${id}.unchanged`, s.same, s.same ? `${Object.keys(before).length} entries` : { changed: s.diff });
}

if (mode === "build") {
  // 1. A new output folder: the kit, its zip and a marker that lists every other file with its hash.
  const fresh = path.join(work, "fresh");
  let r = buildKit(fresh);
  const vault = path.join(fresh, "InkdropThemeTest");
  check("build.fresh", r.status === 0 && existsSync(vault) && existsSync(`${vault}.zip`), r.stderr.trim().slice(0, 300) || r.stdout.trim().split("\n").slice(-1)[0]);
  const m = markerOf(vault);
  const main = readFileSync(path.join(vault, ".obsidian/plugins/ink-device-check/main.js"), "utf8");
  const hashesOk = Object.entries(m.files).every(([f, h]) => createHash("sha256").update(readFileSync(path.join(vault, f))).digest("hex") === h);
  check("build.marker", m.kind === "inkdrop-themes-for-obsidian device kit" && m.vault === "InkdropThemeTest" && hashesOk && main.includes(JSON.stringify(m.kitId)) && !main.includes("@KIT_ID@"), { kitId: m.kitId, files: Object.keys(m.files).length });
  const zipMarker = JSON.parse(execFileSync("unzip", ["-p", `${vault}.zip`, "InkdropThemeTest/.obsidian/inkdrop-device-kit.json"], { encoding: "utf8" }));
  check("build.zip-marker", zipMarker.kitId === m.kitId);
  check("build.no-staging-left", readdirSync(fresh).sort().join(",") === "InkdropThemeTest,InkdropThemeTest.zip", readdirSync(fresh));

  // 2. The same folder again without --replace.
  refusedBuild("build.again-without-replace", fresh, fresh, [], /already exist; pass --replace/);

  // 3. --replace on an unchanged kit of ours: replaced, with a new kit id.
  r = buildKit(fresh, "--replace");
  const m2 = markerOf(vault);
  check("build.replace-unchanged-kit", r.status === 0 && m2.kitId !== m.kitId && readdirSync(fresh).length === 2, { status: r.status, kitIds: [m.kitId, m2.kitId], stderr: r.stderr.trim().slice(0, 200) });

  // 4. An existing folder of the same name that is not a kit (a user's notes): refused with and without --replace.
  const notes = path.join(work, "notes");
  mkdirSync(path.join(notes, "InkdropThemeTest", "Daily"), { recursive: true });
  writeFileSync(path.join(notes, "InkdropThemeTest", "Daily", "2026-10-15.md"), "# a note\n");
  writeFileSync(path.join(notes, "InkdropThemeTest", "Ideas.md"), "keep me\n");
  refusedBuild("build.unidentified-folder", notes, notes, [], /already exist/);
  refusedBuild("build.unidentified-folder-replace", notes, notes, ["--replace"], /has no kit marker/);

  // 5. A kit that has collected results on a device (a file the marker does not list).
  const used = path.join(work, "used");
  buildKit(used);
  mkdirSync(path.join(used, "InkdropThemeTest", "device-results"));
  writeFileSync(path.join(used, "InkdropThemeTest", "device-results", "results-2026-10-15.json"), "{}\n");
  refusedBuild("build.kit-with-results-replace", used, used, ["--replace"], /not part of the kit/);

  // 6. A kit whose plugin was edited after the build.
  const edited = path.join(work, "edited");
  buildKit(edited);
  writeFileSync(path.join(edited, "InkdropThemeTest", ".obsidian/plugins/ink-device-check/main.js"), "// edited\n", { flag: "a" });
  refusedBuild("build.kit-edited-replace", edited, edited, ["--replace"], /changed since the build/);

  // 7. An empty folder the marker does not account for.
  const emptyDir = path.join(work, "empty-dir");
  buildKit(emptyDir);
  mkdirSync(path.join(emptyDir, "InkdropThemeTest", "Inbox"));
  refusedBuild("build.kit-extra-folder-replace", emptyDir, emptyDir, ["--replace"], /folders that are not part of the kit/);

  // 8. A marker of another kind (the right file name only).
  const fake = path.join(work, "fake-marker");
  mkdirSync(path.join(fake, "InkdropThemeTest", ".obsidian"), { recursive: true });
  writeFileSync(path.join(fake, "InkdropThemeTest", ".obsidian", "inkdrop-device-kit.json"), `${JSON.stringify({ kind: "something else", vault: "InkdropThemeTest", kitId: "x", files: {} })}\n`);
  writeFileSync(path.join(fake, "InkdropThemeTest", "Note.md"), "keep me\n");
  refusedBuild("build.fake-marker-replace", fake, fake, ["--replace"], /is not a .* marker/);

  // 9. A zip of the same name that is not a kit zip (no folder next to it).
  const zips = path.join(work, "zips");
  mkdirSync(zips);
  writeFileSync(path.join(zips, "InkdropThemeTest.zip"), "not a zip\n");
  refusedBuild("build.unidentified-zip", zips, zips, [], /already exist/);
  refusedBuild("build.unidentified-zip-replace", zips, zips, ["--replace"], /cannot be read as a zip/);
  const otherZip = path.join(work, "other-zip");
  mkdirSync(path.join(otherZip, "src", "InkdropThemeTest"), { recursive: true });
  writeFileSync(path.join(otherZip, "src", "InkdropThemeTest", "Note.md"), "keep me\n");
  execFileSync("ditto", ["-c", "-k", "--keepParent", "--norsrc", path.join(otherZip, "src", "InkdropThemeTest"), path.join(otherZip, "InkdropThemeTest.zip")]);
  refusedBuild("build.other-zip-replace", otherZip, otherZip, ["--replace"], /has no kit marker/);

  // 10. A kit zip with an entry added after the build (the folder next to it is an unchanged kit).
  const zipExtra = path.join(work, "zip-extra");
  buildKit(zipExtra);
  mkdirSync(path.join(work, "zip-extra-add", "InkdropThemeTest"), { recursive: true });
  writeFileSync(path.join(work, "zip-extra-add", "InkdropThemeTest", "added.md"), "added\n");
  execFileSync("zip", ["-q", path.join(zipExtra, "InkdropThemeTest.zip"), "InkdropThemeTest/added.md"], { cwd: path.join(work, "zip-extra-add") });
  refusedBuild("build.kit-zip-extra-entry-replace", zipExtra, zipExtra, ["--replace"], /entries that are not part of the kit/);

  // 11. A symbolic link of the same name (pointing at notes outside the output folder).
  const linked = path.join(work, "linked");
  mkdirSync(path.join(work, "link-target"));
  writeFileSync(path.join(work, "link-target", "Note.md"), "keep me\n");
  mkdirSync(linked);
  symlinkSync(path.join(work, "link-target"), path.join(linked, "InkdropThemeTest"));
  refusedBuild("build.symlink-replace", work, linked, ["--replace"], /is not a folder/);

  // 12. An output folder inside an Obsidian vault: nothing is created there.
  const inVault = path.join(work, "a-vault");
  mkdirSync(path.join(inVault, ".obsidian"), { recursive: true });
  writeFileSync(path.join(inVault, "Note.md"), "keep me\n");
  refusedBuild("build.inside-a-vault", inVault, path.join(inVault, "kits", "k1"), [], /is an Obsidian vault/);

  // 13. judge.mjs: a fold that did not happen fails device.ed-prepared, as runner.ed-prepared does on the desktop
  // (a kit from before the fold was recorded has no `folded` and still passes).
  const css = readFileSync(path.join(repo, "dist/solarized-dark/theme.css"), "utf8");
  for (const [id, folded, want] of [["not-folded", false, "FAIL"], ["folded", true, "PASS"], ["not-recorded", undefined, "PASS"]]) {
    const file = path.join(work, `judge-${id}.json`);
    const page = { theme: "SD", themeCssLength: css.length, bodyClasses: ["is-mobile", "is-phone", "is-floating-nav"], results: {}, edPrepared: { leafFound: true, file: "Editor chrome", source: true, gutters: true, want: true, folded } };
    writeFileSync(file, JSON.stringify({ environment: { userAgent: "kit-self-test", platform: { isTablet: false } }, results: [{ job: { kind: "probe", theme: "solarized-dark", themeName: "SD", cssLength: css.length, platform: "phone", state: "ed-fold", checkIds: [] }, page }] }));
    const out = path.join(work, `judge-${id}-report.json`);
    spawnSync(process.execPath, [path.join(repo, "tests/device/judge.mjs"), file, "--out", out], { encoding: "utf8" });
    const got = JSON.parse(readFileSync(out, "utf8")).results.find((r) => r.id === "device.ed-prepared")?.status;
    check(`judge.ed-prepared-${id}`, got === want, { folded, got, want });
  }
  finish();
}

// ---------- the isolated Obsidian ----------
const PORT = 9335;
const APP = process.env.OBSIDIAN_APP ?? "/Applications/Obsidian.app";
const ASAR = process.env.OBSIDIAN_ASAR ?? path.join(process.env.HOME, "Library/Application Support/obsidian/obsidian-1.14.4.asar");
async function launch(dir, vault) {
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`); throw new Error(`port ${PORT} is already in use`); } catch (e) { if (/already in use/.test(e.message)) throw e; }
  mkdirSync(path.join(dir, "userdata"), { recursive: true });
  if (ASAR !== "none") cpSync(ASAR, path.join(dir, "userdata", path.basename(ASAR)));
  writeFileSync(path.join(dir, "userdata", "obsidian.json"), JSON.stringify({ vaults: { inkkittest0001: { path: vault, ts: 0, open: true } } }));
  const child = spawn(path.join(APP, "Contents/MacOS/Obsidian"), [`--user-data-dir=${path.join(dir, "userdata")}`, `--remote-debugging-port=${PORT}`, "--remote-debugging-address=127.0.0.1", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try { if (await evaluate(PORT, "(() => !!(window.app && app.workspace.layoutReady))()", 5000)) break; } catch {}
  }
  // Restricted mode off and the kit's plugin on, as on the device (writes the vault's plugin settings once, before any snapshot).
  await evaluate(PORT, `(async () => { await app.plugins.setEnable(true); await app.plugins.loadManifests(); await app.plugins.enablePluginAndSave("ink-device-check"); return 1; })()`);
  await sleep(5000);
  return {
    async stop() {
      for (const sig of ["SIGTERM", "SIGTERM", "SIGKILL"]) {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill(sig);
        for (let i = 0; i < 15 && child.exitCode === null && child.signalCode === null; i++) await sleep(1000);
      }
    },
  };
}
const kitDir = path.join(work, "kit");
const built = buildKit(kitDir);
if (built.status !== 0) { console.error(built.stderr); process.exit(1); }
const kitVault = path.join(kitDir, "InkdropThemeTest");

if (mode === "plugin") {
  // A stand-in for pymobiledevice3 that only records its arguments (no device is ever contacted).
  const bin = path.join(work, "bin");
  mkdirSync(bin);
  const calls = path.join(work, "pymobiledevice3-calls.txt");
  writeFileSync(path.join(bin, "pymobiledevice3"), `#!/bin/sh\necho "$@" >> '${calls}'\n: > "$7"\n`);
  chmodSync(path.join(bin, "pymobiledevice3"), 0o755);
  const cable = (...a) => spawnSync(process.execPath, [path.join(repo, "tests/device/cable.mjs"), String(PORT), ...a], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, timeout: 120000 });
  const calledTimes = () => (existsSync(calls) ? readFileSync(calls, "utf8").split("\n").filter(Boolean).length : 0);
  const marker = ".obsidian/inkdrop-device-kit.json";
  const CASES = [
    { id: "test-vault", name: "InkdropThemeTest", reason: null, cable: null },
    { id: "other-name", name: "OtherVault", reason: /the open vault is "OtherVault", not InkdropThemeTest/, cable: /"OtherVault", not InkdropThemeTest/ },
    { id: "no-marker", name: "InkdropThemeTest", edit: (v) => unlinkSync(path.join(v, marker)), reason: /has no kit marker/, cable: /has no kit marker/ },
    { id: "marker-not-json", name: "InkdropThemeTest", edit: (v) => writeFileSync(path.join(v, marker), "{ not json"), reason: /is not JSON/, cable: /not JSON/ },
    { id: "marker-other-kind", name: "InkdropThemeTest", edit: (v) => writeFileSync(path.join(v, marker), JSON.stringify({ ...markerOf(v), kind: "my notes" })), reason: /is not a device kit marker/, cable: /is not a device kit marker/ },
    { id: "marker-other-kit", name: "InkdropThemeTest", edit: (v) => writeFileSync(path.join(v, marker), JSON.stringify({ ...markerOf(v), kitId: "00000000-0000-4000-8000-000000000000" })), reason: /belongs to another kit/, cable: /belongs to another kit/ },
  ];
  // The page's state a refused command must leave as it was. The body class is-focused is left out: Obsidian sets
  // it from the window's OS focus (electronWindow focus events in app.js), which other windows take at any time.
  const STATE = `(() => ({ config: JSON.stringify(app.vault.config), theme: app.customCss.theme, layout: JSON.stringify(app.workspace.getLayout()), body: [...document.body.classList].filter((k) => k !== "is-focused").join(" "), active: app.workspace.getActiveFile()?.path ?? null }))()`;
  for (const c of CASES) {
    const dir = path.join(work, c.id);
    const vault = path.join(dir, c.name);
    mkdirSync(dir);
    cpSync(kitVault, vault, { recursive: true });
    c.edit?.(vault);
    const app = await launch(dir, vault);
    try {
      const own = await evaluate(PORT, `app.plugins.plugins["ink-device-check"].notTheKitVault()`);
      if (!c.reason) {
        check(`plugin.${c.id}.accepted`, own === null, own);
        const r = cable("probe");
        check(`cable.${c.id}.probe`, r.status === 0 && /InkdropThemeTest/.test(r.stdout), (r.stderr || r.stdout).trim().slice(0, 200));
        const n = calledTimes();
        const s = cable("shot", "127.0.0.1", "1", path.join(dir, "shot.png"));
        check(`cable.${c.id}.shot-taken`, s.status === 0 && calledTimes() === n + 1, (s.stderr || s.stdout).trim().slice(0, 200));
        continue;
      }
      // The plugin's own check, then both entry points called directly and through the command palette's commands.
      check(`plugin.${c.id}.reason`, c.reason.test(own ?? ""), own);
      const diskBefore = snapshot(vault);
      const pageBefore = await evaluate(PORT, STATE);
      const direct = await evaluate(PORT, `(async () => { const p = app.plugins.plugins["ink-device-check"]; return [await p.runChecks(), await p.runTour()]; })()`);
      await evaluate(PORT, `(() => { app.commands.executeCommandById("ink-device-check:run-checks"); app.commands.executeCommandById("ink-device-check:screenshot-tour"); return 1; })()`);
      await sleep(3000);
      const after = await evaluate(PORT, `(() => ({ refused: app.plugins.plugins["ink-device-check"].refused, busy: !!app.plugins.plugins["ink-device-check"].busy, notices: [...document.querySelectorAll(".notice")].map((n) => n.textContent) }))()`);
      const pageAfter = await evaluate(PORT, STATE);
      const diskAfter = snapshot(vault);
      check(`plugin.${c.id}.refused`, direct.every((d) => c.reason.test(d ?? "")) && c.reason.test(after.refused?.why ?? "") && !after.busy, { direct, refused: after.refused?.what });
      check(`plugin.${c.id}.diagnosis-shown`, after.notices.filter((t) => /refused: /.test(t) && c.reason.test(t)).length >= 2, after.notices.map((t) => t.slice(0, 120)));
      const ds = sameSnapshot(diskBefore, diskAfter);
      check(`plugin.${c.id}.no-file-written`, ds.same && !existsSync(path.join(vault, "device-results")), ds.same ? `${Object.keys(diskBefore).length} entries` : ds.diff);
      const changed = Object.keys(pageBefore).filter((k) => pageBefore[k] !== pageAfter[k]);
      const diff = (a, b) => { const x = a.split(" "), y = b.split(" "); return { removed: x.filter((k) => !y.includes(k)), added: y.filter((k) => !x.includes(k)) }; };
      check(`plugin.${c.id}.no-setting-or-workspace-change`, changed.length === 0, changed.length ? Object.fromEntries(changed.map((k) => [k, k === "body" ? diff(pageBefore[k], pageAfter[k]) : [pageBefore[k].slice(0, 200), pageAfter[k].slice(0, 200)]])) : "config, theme, layout, body classes, active file");
      // The cable driver: every command stops at its own vault check (or at the plugin's refusal).
      const n = calledTimes();
      for (const [cmd, ...a] of [["probe"], ["checks", path.join(dir, "out")], ["tour", "127.0.0.1", "1", path.join(dir, "tour")], ["pull", path.join(dir, "pull")], ["shot", "127.0.0.1", "1", path.join(dir, "shot.png")]]) {
        const r = cable(cmd, ...a);
        const want = c.cable ?? (["checks", "tour"].includes(cmd) ? c.pluginReason : null);
        check(`cable.${c.id}.${cmd}-stopped`, r.status !== 0 && c.cable.test(r.stderr), r.stderr.trim().split("\n").find((l) => /^Error: /.test(l))?.slice(0, 300));
      }
      check(`cable.${c.id}.no-screenshot`, calledTimes() === n, { calls: calledTimes() - n });
      const ds2 = sameSnapshot(diskBefore, snapshot(vault));
      check(`cable.${c.id}.no-file-written`, ds2.same, ds2.same ? "" : ds2.diff);
    } finally { await app.stop(); }
  }
  finish();
}

if (mode === "dry-run" || mode === "dry-run-tablet") {
  // The kit as a device gets it: its own vault folder InkdropThemeTest, mobile emulation (phone, or tablet with
  // the tablet's window size), the CDP focus held as on a device. device.environment FAILs (52 on the phone) are
  // expected: this is not a device.
  const tablet = mode === "dry-run-tablet";
  const dir = path.join(work, "dry");
  const vault = path.join(dir, "InkdropThemeTest");
  mkdirSync(dir);
  cpSync(kitVault, vault, { recursive: true });
  const app = await launch(dir, vault);
  let release = await holdFocus(PORT);
  try {
    await evaluate(PORT, `(() => { electronWindow.setSize(${tablet ? "1024, 800" : "400, 860"}); app.emulateMobile(true); return 1; })()`);
    await sleep(3000);
    for (let i = 0; i < 60; i++) { try { if (await evaluate(PORT, "(() => !!(window.app && app.workspace.layoutReady))()", 5000)) break; } catch {} await sleep(1000); }
    release(); release = await holdFocus(PORT);
    // The emulation's reload comes back with the plugin disabled; enable it again in this window.
    await evaluate(PORT, `(async () => { if (!app.plugins.plugins["ink-device-check"]) { await app.plugins.setEnable(true); await app.plugins.loadManifests(); await app.plugins.enablePluginAndSave("ink-device-check"); } return 1; })()`);
    check(tablet ? "dry.emulated-tablet" : "dry.emulated-phone", await evaluate(PORT, `document.body.classList.contains("${tablet ? "is-tablet" : "is-phone"}") && app.isMobile`));
    check("dry.accepted", (await evaluate(PORT, `app.plugins.plugins["ink-device-check"].notTheKitVault()`)) === null);
    for (const [id, want] of [["run-checks", "results-"], ["screenshot-tour", "tour-"]]) {
      const ret = await evaluate(PORT, `app.plugins.plugins["ink-device-check"].${id === "run-checks" ? "runChecks" : "runTour"}()`, 3600000);
      const files = readdirSync(path.join(vault, "device-results")).filter((f) => f.startsWith(want));
      check(`dry.${id}`, ret === undefined && files.length === 1, { ret, files });
      for (const f of files) cpSync(path.join(vault, "device-results", f), path.join(work, f));
    }
  } finally { release(); await app.stop(); }
  const res = readdirSync(work).find((f) => f.startsWith("results-"));
  const judged = spawnSync(process.execPath, [path.join(repo, "tests/device/judge.mjs"), path.join(work, res), "--out", path.join(work, "report-emulated.json"), "--label", `Mac, isolated Obsidian 1.14.4, mobile emulation (${tablet ? "tablet" : "phone"})`], { encoding: "utf8" });
  writeFileSync(path.join(work, "judge.txt"), judged.stdout);
  const report = JSON.parse(readFileSync(path.join(work, "report-emulated.json"), "utf8"));
  const list = report.results ?? report;
  const fails = list.filter((r) => r.status === "FAIL");
  const raw = JSON.parse(readFileSync(path.join(work, res), "utf8"));
  if (!tablet) check("dry.judged", raw.device === "phone" && list.length === 916 && fails.every((r) => r.id === "device.environment" || /^device\.environment/.test(r.id)) && fails.length === 52, { device: raw.device, total: list.length, fail: fails.length, other: fails.filter((r) => !/^device\.environment/.test(r.id)).map((r) => r.id).slice(0, 5) });
  else {
    // The tablet run: only the tablet jobs and the jobs for any device ran, every result is on the tablet, the
    // only failures are the environment checks (one per probe state: not a real device), and the release
    // judgement does not take it as a device run.
    const probes = raw.results.filter((r) => r.job.kind === "probe");
    check("dry.tablet-jobs", raw.device === "tablet" && raw.results.length > 0 && raw.results.every((r) => r.job.device === "tablet" || r.job.device === "any") && probes.length > 0 && probes.every((r) => r.job.platform === "tablet" && !r.job.extra),
      { device: raw.device, jobs: raw.results.length, probes: probes.length, other: raw.results.filter((r) => !["tablet", "any"].includes(r.job.device)).map((r) => `${r.job.kind} ${r.job.platform}`).slice(0, 5) });
    check("dry.tablet-judged", list.length > 0 && list.every((r) => r.platform === "tablet") && fails.every((r) => r.id === "device.environment") && fails.length === probes.length,
      { total: list.length, fail: fails.length, probes: probes.length, platforms: [...new Set(list.map((r) => r.platform))], other: fails.filter((r) => r.id !== "device.environment").map((r) => r.id).slice(0, 5) });
    const { deviceRunProblem } = await import("../release/gate.mjs");
    const flags = raw.environment.platform;
    const why = deviceRunProblem({ platformFlags: flags, results: list });
    check("dry.tablet-not-a-device-run", !!why, why);
    const tour = JSON.parse(readFileSync(path.join(work, readdirSync(work).find((f) => f.startsWith("tour-"))), "utf8"));
    check("dry.tablet-tour", tour.device === "tablet" && tour.steps.length > 0 && tour.steps.every((x) => /tablet,/.test(x.label) && !x.error), { device: tour.device, steps: tour.steps.length, errors: tour.steps.filter((x) => x.error).map((x) => x.label).slice(0, 3) });
  }
  // Every open-drawer step of the tour records where the drawer header and body show only their background
  // (tests/device/drawer-geometry.js), for the qd1.mobile-drawer-header pixel check.
  {
    const tour = JSON.parse(readFileSync(path.join(work, readdirSync(work).find((f) => f.startsWith("tour-"))), "utf8"));
    const drawerSteps = tour.steps.filter((x) => /drawer|sidebar/.test(x.label));
    const geo = drawerSteps.map((x) => ({ label: x.label, drawers: (x.measured?.drawerGeometry?.drawers ?? []).map((d) => ({ side: d.side, header: !!d.headerArea, body: !!d.bodyArea })) }));
    check("dry.drawer-geometry", drawerSteps.length === 4 && geo.every((g) => g.drawers.length === 1 && g.drawers[0].header && g.drawers[0].body), geo);
  }
  finish();
}

// Device kit (step 10, research/14 §6.23): a test vault for an iOS / Android device with no remote inspector.
// The vault carries both built themes and a small plugin of our own ("ink-device-check", no network access),
// which runs the same page-side scripts as the desktop runner (tests/runtime/probe.js, code-tokens.js,
// mermaid-dump.js) on the device and writes what it measured to device-results/ in the vault. Judging happens
// on the Mac (tests/device/judge.mjs) with the desktop runner's own judgement code.
//
// usage: node tests/device/build-kit.mjs <out_dir> [--replace]
//   -> <out_dir>/InkdropThemeTest/ (the vault) and <out_dir>/InkdropThemeTest.zip
// The vault's config folder is the standard `.obsidian` (the vault is a test vault of its own; Obsidian only
// accepts config folder names that start with a dot). iOS's Files app hides it, but unzipping keeps it.
//
// Safety (research/14 §6.27):
// - The kit carries a marker, `.obsidian/inkdrop-device-kit.json`: a random kit id, which the plugin also
//   carries, and the SHA-256 of every other file of the kit. The plugin runs nothing unless the open vault is
//   named InkdropThemeTest AND has this marker with its own kit id, so neither a vault of the same name nor a
//   vault the plugin folder was copied into is ever driven.
// - Nothing that is already there is overwritten or deleted by default: an existing InkdropThemeTest/ or
//   InkdropThemeTest.zip in <out_dir> stops the build. `--replace` replaces them only when they are an
//   unchanged kit of ours (every file listed in its marker with the same hash, nothing else, the zip's entries
//   likewise); anything else (results written on a device, notes, another vault) stops it. The old kit's files
//   are then removed one by one (no recursive delete). <out_dir> must not be inside an Obsidian vault.
// - The new kit is built in a fresh staging folder in <out_dir> first and moved into place at the end.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadChecks, POINTER_STATES, runtimeSpecFiles, THEMES } from "../lib/spec.mjs";
import { syntaxVars } from "../runtime/lib/syntax.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const replace = args.includes("--replace");
const outArg = args.filter((a) => a !== "--replace");
if (outArg.length !== 1 || outArg[0].startsWith("-")) { console.error("usage: node tests/device/build-kit.mjs <out_dir> [--replace]"); process.exit(2); }
const out = path.resolve(outArg[0]);
const CONFIG = ".obsidian";
const VAULT_NAME = "InkdropThemeTest";
const MARKER = "inkdrop-device-kit.json"; // in the config folder, outside the plugin's own folder
const MARKER_KIND = "inkdrop-themes-for-obsidian device kit";
const vault = path.join(out, VAULT_NAME);
const zip = path.join(out, `${VAULT_NAME}.zip`);
const refuse = (why) => { console.error(`build-kit: refusing: ${why}\nnothing was changed in ${out}`); process.exit(1); };

// ---------- what is already there ----------
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
// Every file and folder under dir, as paths relative to dir with "/" (symbolic links are reported, not followed).
function walk(dir, rel = "") {
  const found = { files: [], dirs: [], other: [] };
  for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { found.dirs.push(r); const sub = walk(dir, r); for (const k of Object.keys(found)) found[k].push(...sub[k]); }
    else if (e.isFile()) found.files.push(r);
    else found.other.push(r);
  }
  return found;
}
const parseMarker = (text, where) => {
  let m;
  try { m = JSON.parse(text); } catch { return { why: `${where}: the marker is not JSON` }; }
  if (m?.kind !== MARKER_KIND || m.vault !== VAULT_NAME || typeof m.kitId !== "string" || !m.files || typeof m.files !== "object") return { why: `${where}: the marker is not a device kit marker of this repository` };
  return { marker: m };
};
// Why the existing vault folder is not an unchanged kit of ours (null when it is one).
function vaultNotOurs() {
  if (lstatSync(vault).isSymbolicLink() || !lstatSync(vault).isDirectory()) return `${vault} is not a folder`;
  const markerPath = path.join(vault, CONFIG, MARKER);
  if (!existsSync(markerPath)) return `${vault} has no kit marker (${CONFIG}/${MARKER}); it is not a kit made here`;
  const { marker, why } = parseMarker(readFileSync(markerPath, "utf8"), vault);
  if (why) return why;
  const found = walk(vault);
  if (found.other.length) return `${vault} holds links or other non-files: ${found.other.slice(0, 5).join(", ")}`;
  const listed = new Set([...Object.keys(marker.files), `${CONFIG}/${MARKER}`]);
  const extra = found.files.filter((f) => !listed.has(f));
  if (extra.length) return `${vault} holds files that are not part of the kit (for example results written on a device): ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? ` and ${extra.length - 5} more` : ""}`;
  const missing = Object.keys(marker.files).filter((f) => !found.files.includes(f));
  if (missing.length) return `${vault} lacks kit files: ${missing.slice(0, 5).join(", ")}`;
  const changed = Object.entries(marker.files).filter(([f, h]) => sha256(readFileSync(path.join(vault, f))) !== h).map(([f]) => f);
  if (changed.length) return `${vault} has kit files changed since the build: ${changed.slice(0, 5).join(", ")}`;
  const needed = new Set([...listed].flatMap((f) => f.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))));
  const emptyDirs = found.dirs.filter((d) => !needed.has(d));
  if (emptyDirs.length) return `${vault} holds folders that are not part of the kit: ${emptyDirs.slice(0, 5).join(", ")}`;
  return null;
}
// Why the existing zip is not an unchanged kit zip of ours (null when it is one).
function zipNotOurs() {
  if (lstatSync(zip).isSymbolicLink() || !lstatSync(zip).isFile()) return `${zip} is not a file`;
  const list = spawnSync("unzip", ["-Z1", zip], { encoding: "utf8" });
  if (list.status !== 0) return `${zip} cannot be read as a zip (${(list.stderr || "").trim().slice(0, 200)})`;
  const entries = list.stdout.split("\n").filter(Boolean);
  const markerEntry = `${VAULT_NAME}/${CONFIG}/${MARKER}`;
  if (!entries.includes(markerEntry)) return `${zip} has no kit marker; it is not a kit made here`;
  const read = (entry) => execFileSync("unzip", ["-p", zip, entry], { maxBuffer: 1 << 28 });
  const { marker, why } = parseMarker(read(markerEntry).toString("utf8"), zip);
  if (why) return why;
  const files = entries.filter((e) => !e.endsWith("/"));
  const extra = files.filter((e) => e !== markerEntry && !(e.startsWith(`${VAULT_NAME}/`) && e.slice(VAULT_NAME.length + 1) in marker.files));
  if (extra.length) return `${zip} holds entries that are not part of the kit: ${extra.slice(0, 5).join(", ")}`;
  const changed = Object.entries(marker.files).filter(([f, h]) => !files.includes(`${VAULT_NAME}/${f}`) || sha256(read(`${VAULT_NAME}/${f}`)) !== h).map(([f]) => f);
  if (changed.length) return `${zip} has kit files missing or changed: ${changed.slice(0, 5).join(", ")}`;
  return null;
}
function checkExisting() {
  for (let d = out; ; d = path.dirname(d)) {
    if (existsSync(path.join(d, ".obsidian"))) refuse(`${d} is an Obsidian vault (it has .obsidian); choose an output folder outside any vault`);
    if (path.dirname(d) === d) break;
  }
  if (existsSync(out) && !statSync(out).isDirectory()) refuse(`${out} is not a folder`);
  // lstat, not exists: a dangling symbolic link is "there" as well.
  const present = [vault, zip].filter((p) => { try { lstatSync(p); return true; } catch { return false; } });
  if (!present.length) return;
  if (!replace) refuse(`${present.join(" and ")} already ${present.length > 1 ? "exist" : "exists"}; pass --replace to replace an unchanged kit made here, or choose a new output folder`);
  const why = (present.includes(vault) ? vaultNotOurs() : null) ?? (present.includes(zip) ? zipNotOurs() : null);
  if (why) refuse(`${why}; move it away yourself if it is no longer needed`);
}
checkExisting();

const built = spawnSync(process.execPath, [path.join(repo, "scripts/build.mjs")], { encoding: "utf8" });
if (built.status !== 0) { console.error(built.stderr); process.exit(1); }

// ---------- jobs ----------
const pick = ({ id, selector, pseudo, scrollTo, document, property, kind }) => ({ id, selector, pseudo, scrollTo, document, property, kind });
const checks = loadChecks(runtimeSpecFiles(path.join(repo, "tests/spec")));
const forPlatform = (p) => checks.filter((c) => (c.platform ?? ["desktop"]).includes(p) && c.appearance.includes("opaque"));
// Desktop-only checks of states that exist on a phone as well (Markdown views, editor chrome, user settings,
// the quick switcher): measured on the device as candidates for the mobile spec, reported apart (`extra`).
// Desktop checks a decided mobile look replaces (step 10): the quick switcher keeps app.css's 90% on mobile.
const SUPERSEDED = new Map([["leak.quick-switcher.opaque", "mobile.prompt.background"]]);
const EXTRA_STATES = (s) => (s.startsWith("md-") || s.startsWith("ed-") || ["user-accent", "user-font", "quick-switcher-open"].includes(s)) && !POINTER_STATES.includes(s);
const themes = THEMES.map((t) => {
  const manifest = JSON.parse(readFileSync(path.join(repo, "dist", t, "manifest.json"), "utf8"));
  return { key: t, name: manifest.name, cssLength: readFileSync(path.join(repo, "dist", t, "theme.css"), "utf8").length };
});
// Every job names the device class it is for (`device`): the plugin runs the phone jobs on a phone and the
// tablet jobs on a tablet (Platform.isTablet), the syntax and Mermaid jobs ("any") on both. Results of the
// other class's jobs would be on the wrong platform, which the release judgement rejects (research/14 §6.35).
const jobs = [];
for (const th of themes) {
  for (const platform of ["phone", "phone-nonfloating", "tablet"]) {
    const list = forPlatform(platform).filter((c) => !c.themes || c.themes.includes(th.key));
    for (const state of [...new Set(list.map((c) => c.state ?? "default"))]) {
      jobs.push({ kind: "probe", device: platform === "tablet" ? "tablet" : "phone", theme: th.key, themeName: th.name, cssLength: th.cssLength, platform, state, extra: false, checks: list.filter((c) => (c.state ?? "default") === state).map(pick) });
    }
  }
  const mobileIds = new Set(forPlatform("phone").map((c) => c.id));
  const extra = checks.filter((c) => (c.platform ?? ["desktop"]).includes("desktop") && c.appearance.includes("opaque") && EXTRA_STATES(c.state ?? "default") && !mobileIds.has(c.id) && !SUPERSEDED.has(c.id) && (!c.themes || c.themes.includes(th.key)));
  for (const state of [...new Set(extra.map((c) => c.state))]) {
    jobs.push({ kind: "probe", device: "phone", theme: th.key, themeName: th.name, cssLength: th.cssLength, platform: "phone", state, extra: true, checks: extra.filter((c) => c.state === state).map(pick) });
  }
  const syntaxSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/syntax.json"), "utf8"));
  const inkdropTokens = JSON.parse(readFileSync(path.join(repo, syntaxSpec.inkdrop), "utf8"));
  jobs.push({ kind: "syntax", device: "any", theme: th.key, themeName: th.name, input: { note: syntaxSpec.note, vars: syntaxVars(syntaxSpec, inkdropTokens) } });
  const m = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));
  const base = { note: m.note, tokens: m.tokens, kinds: m.kinds, unsupported: m.unsupported, reference: "inkdrop" };
  for (const view of ["reading", "live", "source"]) jobs.push({ kind: "mermaid", device: "any", theme: th.key, themeName: th.name, scheme: "dark", input: { ...base, view } });
  jobs.push({ kind: "mermaid", device: "any", theme: th.key, themeName: th.name, scheme: "dark", rerender: true, input: { ...base, view: "reading", rerender: true } });
  for (const view of ["reading", "live"]) jobs.push({ kind: "mermaid", device: "any", theme: th.key, themeName: th.name, scheme: "light", input: { ...base, view, reference: "default" } });
}

// ---------- screenshot tour ----------
// Each step prepares a state, shows its name for 3 s, then leaves `wait` seconds for a screenshot (the
// notice is gone by then) and restores. The tour log records the start time of each step, so the screenshots'
// own timestamps tell which step they show.
// The phone tour; a tablet gets the steps of its own below (no navigation-bar or keyboard steps: a tablet has
// no bottom navigation bar, and the keyboard step needs a person's tap).
const tour = [];
for (const th of themes) {
  const s = (label, step) => tour.push({ device: "phone", theme: th.key, themeName: th.name, label: `${th.key} ${label}`, wait: 9, ...step });
  s("phone, floating navigation", { platform: "phone", state: "default" });
  s("phone, navigation not floating", { platform: "phone-nonfloating", state: "default" });
  s("left drawer", { platform: "phone", state: "left-drawer-open" });
  s("right drawer", { platform: "phone", state: "right-drawer-open" });
  s("Markdown, Live Preview", { platform: "phone", state: "md-live" });
  s("Markdown, Live Preview, table and callout", { platform: "phone", state: "md-live", scroll: "| Head A" });
  s("Markdown, Reading view", { platform: "phone", state: "md-reading" });
  s("Markdown, Reading view, table and callout", { platform: "phone", state: "md-reading", scroll: "| Head A" });
  s("Markdown, Source mode", { platform: "phone", state: "md-source" });
  s("editor, Live Preview, line numbers", { platform: "phone", state: "ed-live" });
  s("editor, Source mode, no line numbers", { platform: "phone", state: "ed-source-no-lines" });
  s("editor, keyboard: tap a line of text now", { platform: "phone", state: "ed-live", wait: 20, keyboard: true });
  s("code blocks, Reading view", { platform: "phone", state: "default", open: { file: "Code blocks.md", mode: "preview" } });
  s("code blocks, Live Preview", { platform: "phone", state: "default", open: { file: "Code blocks.md", mode: "source", source: false } });
  s("Mermaid flowchart, Reading view", { platform: "phone", state: "default", open: { file: "Mermaid.md", mode: "preview", scroll: "## Flowchart" } });
  s("Mermaid sequence, Reading view", { platform: "phone", state: "default", open: { file: "Mermaid.md", mode: "preview", scroll: "## Sequence" } });
  s("Mermaid other kinds and image, Reading view", { platform: "phone", state: "default", open: { file: "Mermaid.md", mode: "preview", scroll: "## Class" } });
  s("quick switcher", { platform: "phone", state: "quick-switcher-open" });
  s("accent colour of the user", { platform: "phone", state: "user-accent" });
  const t = (label, step) => tour.push({ device: "tablet", theme: th.key, themeName: th.name, label: `${th.key} tablet, ${label}`, wait: 9, platform: "tablet", ...step });
  t("default", { state: "default" });
  t("left sidebar", { state: "left-drawer-open" });
  t("right sidebar", { state: "right-drawer-open" });
  t("Markdown, Live Preview", { state: "md-live" });
  t("Markdown, Reading view", { state: "md-reading" });
  t("editor, Live Preview, line numbers", { state: "ed-live" });
  t("code blocks, Reading view", { state: "default", open: { file: "Code blocks.md", mode: "preview" } });
  t("Mermaid flowchart, Reading view", { state: "default", open: { file: "Mermaid.md", mode: "preview", scroll: "## Flowchart" } });
  t("quick switcher", { state: "quick-switcher-open" });
}

// ---------- the plugin ----------
// The page-side scripts are IIFEs that read their input from a window global; each becomes a function that
// sets the global and returns the IIFE's promise (no eval on the device).
const asFunction = (file, global) => {
  const src = readFileSync(path.join(repo, file), "utf8");
  const at = src.indexOf("(async () =>");
  if (at < 0) throw new Error(`${file}: no IIFE`);
  return `async (input) => {\n  window.${global} = input;\n  return ${src.slice(at).trim().replace(/;$/, "")};\n}`;
};
const main = `// ink-device-check: generated by tests/device/build-kit.mjs (inkdrop-themes-for-obsidian). Test vault only.
// Runs the theme's runtime checks on this device and writes the measurements to device-results/. No network.
const { Plugin, Notice, Platform, apiVersion } = require("obsidian");
const JOBS = ${JSON.stringify(jobs)};
const TOUR = ${JSON.stringify(tour)};
const SCRIPTS = {
  probe: ${asFunction("tests/runtime/probe.js", "__INK")},
  syntax: ${asFunction("tests/runtime/code-tokens.js", "__CODE")},
  mermaid: ${asFunction("tests/runtime/mermaid-dump.js", "__MERMAID")},
  drawer: ${asFunction("tests/device/drawer-geometry.js", "__DRAWER")},
};
// The vault this plugin may drive: its name and the marker build-kit.mjs put in the config folder.
const KIT = ${JSON.stringify({ vault: VAULT_NAME, marker: MARKER, kind: MARKER_KIND, kitId: "@KIT_ID@" })};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

module.exports = class InkDeviceCheck extends Plugin {
  onload() {
    this.addCommand({ id: "run-checks", name: "Run checks (writes device-results/)", callback: () => this.runChecks() });
    this.addCommand({ id: "screenshot-tour", name: "Screenshot tour", callback: () => this.runTour() });
  }

  // Why this vault must not be driven, or null when it is the kit's own test vault: the name must be
  // InkdropThemeTest and the config folder must hold the kit's marker with this plugin's kit id (a vault of
  // the same name, or one the plugin folder was copied into, has no such marker). Reads only.
  // The drawer geometry now (tests/device/drawer-geometry.js), for the cable driver to read right before and
  // right after each drawer screenshot; null when this is not the kit's vault.
  async drawerGeometry() {
    if (await this.refuse("drawer geometry")) return null;
    return SCRIPTS.drawer({ inset: 4 });
  }

  async notTheKitVault() {
    const name = this.app.vault.getName();
    if (name !== KIT.vault) return 'the open vault is "' + name + '", not ' + KIT.vault;
    const file = this.app.vault.configDir + "/" + KIT.marker;
    let text;
    try { text = await this.app.vault.adapter.read(file); } catch (e) { return "this vault has no kit marker " + file + " (" + e + ")"; }
    let m;
    try { m = JSON.parse(text); } catch { return "the kit marker " + file + " is not JSON"; }
    if (m?.kind !== KIT.kind || m.vault !== KIT.vault) return "the kit marker " + file + " is not a device kit marker of this repository";
    if (m.kitId !== KIT.kitId) return "the kit marker belongs to another kit (" + m.kitId + "; this plugin is " + KIT.kitId + ")";
    return null;
  }

  // The entry check of every command, before any setting, file or workspace is touched. On a refusal it says
  // why (a notice and the console) and keeps it in this.refused for the cable driver; it writes nothing.
  async refuse(what) {
    const why = await this.notTheKitVault().catch((e) => "the vault check failed: " + e);
    if (!why) return null;
    this.refused = { what, why, at: new Date().toISOString() };
    console.error("ink-device-check: " + what + " refused: " + why);
    new Notice("Inkdrop device check: " + what + " refused: " + why, 15000);
    return why;
  }

  async selectTheme(name) {
    await this.app.customCss.readThemes();
    let last = -1;
    for (let i = 0; i < 20; i++) {
      if (this.app.customCss.theme !== name) this.app.customCss.setTheme(name);
      await this.app.customCss.loadTheme();
      await sleep(300);
      const len = this.app.customCss.styleEl.textContent.length;
      if (this.app.customCss.theme === name && len > 0 && len === last) break;
      last = len;
    }
  }

  environment() {
    const cs = getComputedStyle(document.body);
    return {
      apiVersion, userAgent: navigator.userAgent,
      platform: { isMobile: Platform.isMobile, isPhone: Platform.isPhone, isTablet: Platform.isTablet, isIosApp: Platform.isIosApp, isAndroidApp: Platform.isAndroidApp },
      screen: [screen.width, screen.height], inner: [innerWidth, innerHeight], devicePixelRatio,
      safeArea: Object.fromEntries(["top", "right", "bottom", "left"].map((s) => [s, cs.getPropertyValue("--safe-area-inset-" + s).trim()])),
      bodyClasses: [...document.body.classList],
    };
  }

  async write(name, data) {
    if (!(await this.app.vault.adapter.exists("device-results"))) await this.app.vault.adapter.mkdir("device-results");
    const file = "device-results/" + name + "-" + stamp() + ".json";
    await this.app.vault.adapter.write(file, JSON.stringify(data, null, 1));
    return file;
  }

  async keepSettings(fn) {
    const v = this.app.vault;
    const before = { floatingNavigation: v.getConfig("floatingNavigation"), theme: this.app.customCss.theme, scheme: v.getConfig("theme") };
    try { return await fn(); } finally {
      v.setConfig("floatingNavigation", before.floatingNavigation);
      await v.saveConfig();
      this.app.updateFloatingNavigationDisplay?.();
      if (before.scheme) await this.setScheme(before.scheme);
      if (before.theme !== undefined) await this.selectTheme(before.theme);
    }
  }

  // Obsidian's base colour scheme ("obsidian" = dark, "moonstone" = light) is a vault setting, which Obsidian
  // 1.14.4's own config reload can put back to the value on disk about 1.5 s later (research/14 §6.25): write it
  // to disk at once and check it held after that window, up to 3 times. Returns whether it holds.
  async setScheme(scheme) {
    const want = scheme === "moonstone" ? "theme-light" : "theme-dark";
    for (let i = 0; i < 3; i++) {
      this.app.changeTheme(scheme);
      await this.app.vault.saveConfig();
      await sleep(800);
      if (document.body.classList.contains(want) && this.app.vault.getConfig("theme") === scheme) return true;
    }
    return false;
  }

  async runChecks() {
    if (this.busy) return "busy";
    const refused = await this.refuse("Run checks");
    if (refused) return refused;
    this.busy = true;
    const startedAt = new Date().toISOString();
    const results = [];
    // Only the jobs of this device class (and those for any device).
    const device = Platform.isTablet ? "tablet" : "phone";
    const jobs = JOBS.filter((j) => j.device === "any" || j.device === device);
    try {
      await this.keepSettings(async () => {
        for (const [i, job] of jobs.entries()) {
          new Notice("Inkdrop checks " + (i + 1) + "/" + jobs.length + ": " + job.kind + " " + job.theme + " " + (job.state ?? job.input?.view ?? ""), 1500);
          const rec = { job: { ...job, checks: undefined, input: undefined, checkIds: job.checks?.map((c) => c.id) }, startedAt: new Date().toISOString() };
          try {
            if (job.kind === "probe") {
              rec.page = await SCRIPTS.probe({ theme: job.themeName, translucent: false, platform: job.platform, state: job.state, deferMeasure: false, checks: job.checks, appVersion: apiVersion });
            } else {
              await this.selectTheme(job.themeName);
              if (job.kind === "syntax") rec.page = await SCRIPTS.syntax(job.input);
              else {
                if (job.scheme === "light") rec.lightApplied = await this.setScheme("moonstone");
                try {
                  rec.page = await SCRIPTS.mermaid(job.input);
                  // The light scheme must still be there after the diagrams were read.
                  if (job.scheme === "light") rec.lightApplied = rec.lightApplied && document.body.classList.contains("theme-light");
                } finally { if (job.scheme === "light") await this.setScheme("obsidian"); }
              }
              rec.theme = this.app.customCss.theme;
              rec.themeCssLength = this.app.customCss.styleEl.textContent.length;
            }
          } catch (e) { rec.error = String(e?.stack ?? e); }
          results.push(rec);
        }
      });
      const file = await this.write("results", { kind: "ink-device-check results", device, startedAt, finishedAt: new Date().toISOString(), environment: this.environment(), results });
      new Notice("Inkdrop checks done: " + file, 10000);
    } catch (e) {
      new Notice("Inkdrop checks failed: " + e, 10000);
    } finally { this.busy = false; }
  }

  async runTour() {
    if (this.busy) return "busy";
    const refused = await this.refuse("Screenshot tour");
    if (refused) return refused;
    this.busy = true;
    const log = [];
    const device = Platform.isTablet ? "tablet" : "phone";
    const steps = TOUR.filter((x) => x.device === device);
    try {
      await this.keepSettings(async () => {
        for (const [i, step] of steps.entries()) {
          const rec = { n: i + 1, label: step.label, startedAt: new Date().toISOString() };
          try {
            await SCRIPTS.probe({ theme: step.themeName, translucent: false, platform: step.platform, state: step.state, deferMeasure: true, checks: [], appVersion: apiVersion });
            const leaf = this.app.workspace.getMostRecentLeaf();
            if (step.open) {
              await leaf.setViewState({ type: "markdown", state: { file: step.open.file, mode: step.open.mode, source: step.open.source }, active: true });
              await sleep(800);
            }
            const scroll = step.open?.scroll ?? step.scroll;
            if (scroll) {
              const v = this.app.workspace.getActiveViewOfType(require("obsidian").MarkdownView);
              const line = v ? v.editor.getValue().split("\\n").findIndex((l) => l.includes(scroll)) : -1;
              for (let k = 0; k < 6 && v && line >= 0; k++) {
                if (v.getMode() === "preview") v.previewMode.applyScroll(line); else v.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line: line + 8, ch: 0 } }, true);
                await sleep(400);
              }
            }
            new Notice((i + 1) + "/" + steps.length + " " + step.label, 3000);
            await sleep(3500);
            rec.shootFrom = new Date().toISOString();
            // An open drawer: where its header and body show nothing but their background, at the start and at
            // the end of the hold (the screenshot is taken in between), for the qd1.mobile-drawer-header pixel
            // check (tests/device/drawer-header.py requires the two to be the same).
            const drawerStep = /drawer-open$/.test(step.state);
            const drawerStart = drawerStep ? await SCRIPTS.drawer({ inset: 4 }) : null;
            const drawerStartAt = drawerStep ? new Date().toISOString() : null;
            await sleep(step.wait * 1000);
            const nav = document.querySelector(".mobile-navbar");
            const ncs = nav ? getComputedStyle(nav) : null;
            rec.measured = {
              bodyClasses: [...document.body.classList],
              navbar: ncs ? { backgroundColor: ncs.backgroundColor, backdropFilter: ncs.backdropFilter || ncs.webkitBackdropFilter, boxShadow: ncs.boxShadow, rect: (() => { const r = nav.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })(), raisedBackground: ncs.getPropertyValue("--raised-background").trim() } : null,
              visualViewport: window.visualViewport ? [Math.round(visualViewport.width), Math.round(visualViewport.height), Math.round(visualViewport.offsetTop)] : null,
              activeElement: document.activeElement ? document.activeElement.className.toString().slice(0, 80) : null,
            };
            if (drawerStep) {
              rec.measured.drawerGeometryStart = drawerStart;
              rec.measured.drawerGeometryStartAt = drawerStartAt;
              rec.measured.drawerGeometry = await SCRIPTS.drawer({ inset: 4 });
              rec.measured.drawerGeometryAt = new Date().toISOString();
            }
            rec.shootUntil = new Date().toISOString();
            if (step.open) await leaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
          } catch (e) { rec.error = String(e?.stack ?? e); }
          finally {
            try { if (window.__INK_MEASURE) { await window.__INK_MEASURE(); window.__INK_MEASURE = undefined; } } catch (e) { rec.restoreError = String(e); }
          }
          log.push(rec);
        }
      });
      const file = await this.write("tour", { kind: "ink-device-check tour", device, environment: this.environment(), steps: log });
      new Notice("Screenshot tour done: " + file, 10000);
    } catch (e) {
      new Notice("Screenshot tour failed: " + e, 10000);
    } finally { this.busy = false; }
  }
};
`;

// ---------- the vault ----------
// Built in a fresh staging folder (mkdir without `recursive` fails if it exists), moved into place at the end.
mkdirSync(out, { recursive: true });
const staging = path.join(out, `.${VAULT_NAME}.staging-${process.pid}-${Date.now()}`);
mkdirSync(staging);
const newVault = path.join(staging, VAULT_NAME);
const newZip = path.join(staging, `${VAULT_NAME}.zip`);
const kitId = randomUUID();
cpSync(path.join(repo, "tests/fixtures/vault"), newVault, { recursive: true, filter: (src) => !src.includes(`${path.sep}.obsidian`) });
const config = path.join(newVault, CONFIG);
cpSync(path.join(repo, "tests/fixtures/vault/.obsidian"), config, { recursive: true });
for (const th of themes) {
  const dir = path.join(config, "themes", th.name);
  mkdirSync(dir, { recursive: true });
  for (const f of ["theme.css", "manifest.json"]) cpSync(path.join(repo, "dist", th.key, f), path.join(dir, f));
}
const pdir = path.join(config, "plugins", "ink-device-check");
mkdirSync(pdir, { recursive: true });
writeFileSync(path.join(pdir, "manifest.json"), `${JSON.stringify({ id: "ink-device-check", name: "Inkdrop theme device check (test vault only)", version: "0.0.1", minAppVersion: "1.14.0", description: "Measures the theme's runtime checks on this device and writes them to device-results/.", author: "inkdrop-themes-for-obsidian", isDesktopOnly: false }, null, 2)}\n`);
writeFileSync(path.join(pdir, "main.js"), main.replace('"@KIT_ID@"', JSON.stringify(kitId)));
writeFileSync(path.join(config, "community-plugins.json"), `${JSON.stringify(["ink-device-check"])}\n`);
// The marker: the kit id and the hash of every other file, so that --replace can tell an unchanged kit.
const files = Object.fromEntries(walk(newVault).files.sort().map((f) => [f, sha256(readFileSync(path.join(newVault, f)))]));
writeFileSync(path.join(config, MARKER), `${JSON.stringify({ kind: MARKER_KIND, vault: VAULT_NAME, kitId, builtAt: new Date().toISOString(), files }, null, 1)}\n`);
execFileSync("ditto", ["-c", "-k", "--keepParent", "--norsrc", newVault, newZip]);

// ---------- into place ----------
// Checked again right before anything is removed (the build took a while); the old kit's files go one by one,
// then its folders deepest first with a plain rmdir, which fails on anything left over.
checkExisting();
if (existsSync(vault)) {
  // Only the files the old marker lists (and the marker): a file that appeared since the check stays, and the
  // rmdir of its folder then fails instead of removing it.
  const listed = [...Object.keys(JSON.parse(readFileSync(path.join(vault, CONFIG, MARKER), "utf8")).files), `${CONFIG}/${MARKER}`];
  const dirs = [...new Set(listed.flatMap((f) => f.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))))];
  for (const f of listed) unlinkSync(path.join(vault, f));
  for (const d of dirs.sort((a, b) => b.split("/").length - a.split("/").length)) rmdirSync(path.join(vault, d));
  rmdirSync(vault);
}
renameSync(newVault, vault);
renameSync(newZip, zip);
rmdirSync(staging);
const per = (d) => jobs.filter((j) => j.device === d || j.device === "any");
console.log(`vault ${vault}\nzip ${zip}\nkit id ${kitId}\njobs ${jobs.length} (probe ${jobs.filter((j) => j.kind === "probe").length}, extra ${jobs.filter((j) => j.extra).length}), checks ${jobs.reduce((n, j) => n + (j.checks?.length ?? 0), 0)}; on a phone ${per("phone").length} jobs, on a tablet ${per("tablet").length}; tour steps phone ${tour.filter((x) => x.device === "phone").length}, tablet ${tour.filter((x) => x.device === "tablet").length}`);

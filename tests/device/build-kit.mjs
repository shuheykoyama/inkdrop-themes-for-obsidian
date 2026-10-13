// Device kit (step 10, research/14 §6.23): a test vault for an iOS / Android device with no remote inspector.
// The vault carries both built themes and a small plugin of our own ("ink-device-check", no network access),
// which runs the same page-side scripts as the desktop runner (tests/runtime/probe.js, code-tokens.js,
// mermaid-dump.js) on the device and writes what it measured to device-results/ in the vault. Judging happens
// on the Mac (tests/device/judge.mjs) with the desktop runner's own judgement code.
//
// usage: node tests/device/build-kit.mjs <out_dir>
//   -> <out_dir>/InkdropThemeTest/ (the vault) and <out_dir>/InkdropThemeTest.zip
// The vault's config folder is the standard `.obsidian` (the vault is a test vault of its own; Obsidian only
// accepts config folder names that start with a dot). iOS's Files app hides it, but unzipping keeps it.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadChecks, POINTER_STATES, runtimeSpecFiles, THEMES } from "../lib/spec.mjs";
import { syntaxVars } from "../runtime/lib/syntax.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const out = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) { console.error("usage: node tests/device/build-kit.mjs <out_dir>"); process.exit(2); }
const CONFIG = ".obsidian";
const vault = path.join(out, "InkdropThemeTest");

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
const jobs = [];
for (const th of themes) {
  for (const platform of ["phone", "phone-nonfloating"]) {
    const list = forPlatform(platform).filter((c) => !c.themes || c.themes.includes(th.key));
    for (const state of [...new Set(list.map((c) => c.state ?? "default"))]) {
      jobs.push({ kind: "probe", theme: th.key, themeName: th.name, cssLength: th.cssLength, platform, state, extra: false, checks: list.filter((c) => (c.state ?? "default") === state).map(pick) });
    }
  }
  const mobileIds = new Set(forPlatform("phone").map((c) => c.id));
  const extra = checks.filter((c) => (c.platform ?? ["desktop"]).includes("desktop") && c.appearance.includes("opaque") && EXTRA_STATES(c.state ?? "default") && !mobileIds.has(c.id) && !SUPERSEDED.has(c.id) && (!c.themes || c.themes.includes(th.key)));
  for (const state of [...new Set(extra.map((c) => c.state))]) {
    jobs.push({ kind: "probe", theme: th.key, themeName: th.name, cssLength: th.cssLength, platform: "phone", state, extra: true, checks: extra.filter((c) => c.state === state).map(pick) });
  }
  const syntaxSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/syntax.json"), "utf8"));
  const inkdropTokens = JSON.parse(readFileSync(path.join(repo, syntaxSpec.inkdrop), "utf8"));
  jobs.push({ kind: "syntax", theme: th.key, themeName: th.name, input: { note: syntaxSpec.note, vars: syntaxVars(syntaxSpec, inkdropTokens) } });
  const m = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));
  const base = { note: m.note, tokens: m.tokens, kinds: m.kinds, unsupported: m.unsupported, reference: "inkdrop" };
  for (const view of ["reading", "live", "source"]) jobs.push({ kind: "mermaid", theme: th.key, themeName: th.name, scheme: "dark", input: { ...base, view } });
  jobs.push({ kind: "mermaid", theme: th.key, themeName: th.name, scheme: "dark", rerender: true, input: { ...base, view: "reading", rerender: true } });
  for (const view of ["reading", "live"]) jobs.push({ kind: "mermaid", theme: th.key, themeName: th.name, scheme: "light", input: { ...base, view, reference: "default" } });
}

// ---------- screenshot tour ----------
// Each step prepares a state, shows its name for 3 s, then leaves `wait` seconds for a screenshot (the
// notice is gone by then) and restores. The tour log records the start time of each step, so the screenshots'
// own timestamps tell which step they show.
const tour = [];
for (const th of themes) {
  const s = (label, step) => tour.push({ theme: th.key, themeName: th.name, label: `${th.key} ${label}`, wait: 9, ...step });
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
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

module.exports = class InkDeviceCheck extends Plugin {
  onload() {
    this.addCommand({ id: "run-checks", name: "Run checks (writes device-results/)", callback: () => this.runChecks() });
    this.addCommand({ id: "screenshot-tour", name: "Screenshot tour", callback: () => this.runTour() });
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
      this.app.updateFloatingNavigationDisplay?.();
      if (before.scheme) this.app.changeTheme(before.scheme);
      if (before.theme !== undefined) await this.selectTheme(before.theme);
    }
  }

  async runChecks() {
    if (this.busy) return;
    this.busy = true;
    const startedAt = new Date().toISOString();
    const results = [];
    try {
      await this.keepSettings(async () => {
        for (const [i, job] of JOBS.entries()) {
          new Notice("Inkdrop checks " + (i + 1) + "/" + JOBS.length + ": " + job.kind + " " + job.theme + " " + (job.state ?? job.input?.view ?? ""), 1500);
          const rec = { job: { ...job, checks: undefined, input: undefined, checkIds: job.checks?.map((c) => c.id) }, startedAt: new Date().toISOString() };
          try {
            if (job.kind === "probe") {
              rec.page = await SCRIPTS.probe({ theme: job.themeName, translucent: false, platform: job.platform, state: job.state, deferMeasure: false, checks: job.checks, appVersion: apiVersion });
            } else {
              await this.selectTheme(job.themeName);
              if (job.kind === "syntax") rec.page = await SCRIPTS.syntax(job.input);
              else {
                if (job.scheme === "light") { this.app.changeTheme("moonstone"); await sleep(800); rec.lightApplied = document.body.classList.contains("theme-light"); }
                try { rec.page = await SCRIPTS.mermaid(job.input); } finally { if (job.scheme === "light") { this.app.changeTheme("obsidian"); await sleep(800); } }
              }
              rec.theme = this.app.customCss.theme;
              rec.themeCssLength = this.app.customCss.styleEl.textContent.length;
            }
          } catch (e) { rec.error = String(e?.stack ?? e); }
          results.push(rec);
        }
      });
      const file = await this.write("results", { kind: "ink-device-check results", startedAt, finishedAt: new Date().toISOString(), environment: this.environment(), results });
      new Notice("Inkdrop checks done: " + file, 10000);
    } catch (e) {
      new Notice("Inkdrop checks failed: " + e, 10000);
    } finally { this.busy = false; }
  }

  async runTour() {
    if (this.busy) return;
    this.busy = true;
    const log = [];
    try {
      await this.keepSettings(async () => {
        for (const [i, step] of TOUR.entries()) {
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
            new Notice((i + 1) + "/" + TOUR.length + " " + step.label, 3000);
            await sleep(3500);
            rec.shootFrom = new Date().toISOString();
            await sleep(step.wait * 1000);
            const nav = document.querySelector(".mobile-navbar");
            const ncs = nav ? getComputedStyle(nav) : null;
            rec.measured = {
              bodyClasses: [...document.body.classList],
              navbar: ncs ? { backgroundColor: ncs.backgroundColor, backdropFilter: ncs.backdropFilter || ncs.webkitBackdropFilter, boxShadow: ncs.boxShadow, rect: (() => { const r = nav.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })(), raisedBackground: ncs.getPropertyValue("--raised-background").trim() } : null,
              visualViewport: window.visualViewport ? [Math.round(visualViewport.width), Math.round(visualViewport.height), Math.round(visualViewport.offsetTop)] : null,
              activeElement: document.activeElement ? document.activeElement.className.toString().slice(0, 80) : null,
            };
            rec.shootUntil = new Date().toISOString();
            if (step.open) await leaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
          } catch (e) { rec.error = String(e?.stack ?? e); }
          finally {
            try { if (window.__INK_MEASURE) { await window.__INK_MEASURE(); window.__INK_MEASURE = undefined; } } catch (e) { rec.restoreError = String(e); }
          }
          log.push(rec);
        }
      });
      const file = await this.write("tour", { kind: "ink-device-check tour", environment: this.environment(), steps: log });
      new Notice("Screenshot tour done: " + file, 10000);
    } catch (e) {
      new Notice("Screenshot tour failed: " + e, 10000);
    } finally { this.busy = false; }
  }
};
`;

// ---------- the vault ----------
rmSync(vault, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(repo, "tests/fixtures/vault"), vault, { recursive: true, filter: (src) => !src.includes(`${path.sep}.obsidian`) });
const config = path.join(vault, CONFIG);
cpSync(path.join(repo, "tests/fixtures/vault/.obsidian"), config, { recursive: true });
for (const th of themes) {
  const dir = path.join(config, "themes", th.name);
  mkdirSync(dir, { recursive: true });
  for (const f of ["theme.css", "manifest.json"]) cpSync(path.join(repo, "dist", th.key, f), path.join(dir, f));
}
const pdir = path.join(config, "plugins", "ink-device-check");
mkdirSync(pdir, { recursive: true });
writeFileSync(path.join(pdir, "manifest.json"), `${JSON.stringify({ id: "ink-device-check", name: "Inkdrop theme device check (test vault only)", version: "0.0.1", minAppVersion: "1.14.0", description: "Measures the theme's runtime checks on this device and writes them to device-results/.", author: "inkdrop-themes-for-obsidian", isDesktopOnly: false }, null, 2)}\n`);
writeFileSync(path.join(pdir, "main.js"), main);
writeFileSync(path.join(config, "community-plugins.json"), `${JSON.stringify(["ink-device-check"])}\n`);
const zip = path.join(out, "InkdropThemeTest.zip");
rmSync(zip, { force: true });
execFileSync("ditto", ["-c", "-k", "--keepParent", "--norsrc", vault, zip]);
console.log(`vault ${vault}\nzip ${zip}\njobs ${jobs.length} (probe ${jobs.filter((j) => j.kind === "probe").length}, extra ${jobs.filter((j) => j.extra).length}), checks ${jobs.reduce((n, j) => n + (j.checks?.length ?? 0), 0)}, tour steps ${tour.length}`);

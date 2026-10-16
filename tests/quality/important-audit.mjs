// Step 11E: the !important removal experiment (research/14 §6.30.3 11E). For every declaration-no-important
// entry of tests/static/lint-allowlist.json and both themes, the built theme with ONLY that !important removed
// is loaded into the ISOLATED Obsidian and measured with the runtime tests' own code:
//   - Mermaid entries (svg selectors): tests/runtime/mermaid-dump.js in Reading view and Live Preview, judged by
//     tests/runtime/lib/mermaid.mjs (the mm.* checks), and every element's fill / stroke / color /
//     background-color compared with the unmodified theme's dump;
//   - the other entries (translucent strips): tests/runtime/probe.js with every desktop check of
//     tests/spec/runtime/desktop.json measured while translucent in the default state, judged by
//     tests/runtime/lib/checks.mjs, plus the entry's own selector and property read on its element.
// A value that changes means the !important is needed in that state; the failing checks show whether the
// runtime tests notice. tests/quality/lib.mjs#verdict turns that into 必要 / 冗長 / 検証不足.
// The fixture note draws its flowchart labels as HTML; the rules for SVG text labels (htmlLabels: false) match
// nothing there, so tests/quality/mermaid-svg-labels.md is appended to the isolated vault's copy of the note
// for this experiment only. The unmodified theme already FAILs mm.*.flowchart-v2.colours on that block (in
// properties SVG does not paint); such baseline FAILs are recorded, and an entry counts only the FAILs that
// are new or changed against them.
//
// usage: node tests/quality/important-audit.mjs --vault <isolated vault> --out <result.json>
// Requires the isolated instance on 127.0.0.1:9333 (tests/runtime/obsidian-isolated.sh) and a current build
// (npm run build). Only the isolated vault's theme folder "AUDIT <theme>" and its copy of the Mermaid note are
// written; the window is put back to opaque at the end.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { declarations } from "../lib/css.mjs";
import { loadChecks, runtimeSpecFiles, THEMES } from "../lib/spec.mjs";
import { evaluate, holdFocus } from "../runtime/lib/cdp.mjs";
import { judge } from "../runtime/lib/checks.mjs";
import { judgeMermaid } from "../runtime/lib/mermaid.mjs";
import { verdict, withoutImportant } from "./lib.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { vault: { type: "string" }, out: { type: "string" }, port: { type: "string", default: "9333" } } });
if (!args.vault || !args.out) { console.error("usage: node tests/quality/important-audit.mjs --vault <vault> --out <json>"); process.exit(2); }
const port = args.port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const entries = JSON.parse(readFileSync(path.join(repo, "tests/static/lint-allowlist.json"), "utf8")).warnings.filter((w) => w.rule === "declaration-no-important");
const mermaidSpec = JSON.parse(readFileSync(path.join(repo, "tests/spec/mermaid.json"), "utf8"));
const mermaidDump = readFileSync(path.join(repo, "tests/runtime/mermaid-dump.js"), "utf8");
const probe = readFileSync(path.join(repo, "tests/runtime/probe.js"), "utf8");
const translucentChecks = loadChecks(runtimeSpecFiles(path.join(repo, "tests/spec")))
  .filter((c) => (c.platform ?? ["desktop"]).includes("desktop") && c.appearance.includes("translucent") && (c.state ?? "default") === "default");
const isMermaid = (e) => e.selector.includes(".mermaid > svg");

// Install `css` as the isolated vault's theme "AUDIT <theme>" and wait until Obsidian has loaded exactly it.
async function load(theme, css) {
  const name = `AUDIT ${theme}`;
  const dir = path.join(args.vault, ".obsidian/themes", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name, version: "0.0.0", minAppVersion: "1.14.4", author: "audit" }));
  writeFileSync(path.join(dir, "theme.css"), css);
  const ok = await evaluate(port, `(async () => {
    await app.customCss.readThemes();
    for (let i = 0; i < 30; i++) {
      app.customCss.setTheme(${JSON.stringify(name)});
      await app.customCss.loadTheme();
      await new Promise((r) => setTimeout(r, 300));
      if (app.customCss.theme === ${JSON.stringify(name)} && app.customCss.styleEl.textContent.length === ${css.length}) return true;
    }
    return false;
  })()`);
  if (!ok) throw new Error(`theme ${name} (${css.length} chars) did not load`);
  return name;
}

const mermaidPage = (view) => evaluate(port, `window.__MERMAID = ${JSON.stringify({ note: mermaidSpec.note, view, tokens: mermaidSpec.tokens, kinds: mermaidSpec.kinds, unsupported: mermaidSpec.unsupported, reference: "inkdrop" })};\n${mermaidDump}`);
// Mermaid: the mm.* results that FAIL and the elements whose colours differ from the unmodified theme's dump.
async function measureMermaid() {
  const out = {};
  for (const view of ["reading", "live"]) {
    const page = await mermaidPage(view);
    out[view] = { page, results: judgeMermaid(mermaidSpec, page, "dark", { view }, "PASS") };
  }
  return out;
}
function mermaidDiff(base, variant) {
  const changed = [];
  for (const view of Object.keys(base)) {
    base[view].page.diagrams.forEach((d, i) => {
      const v = variant[view].page.diagrams[i];
      (d.actual ?? []).forEach((el, j) => {
        const w = v?.actual?.[j];
        for (const p of ["fill", "stroke", "color", "background-color"]) if (!w || w[p] !== el[p]) changed.push({ view, block: d.block, kind: d.kind, element: `${el.tag}${el.cls ? "." + el.cls.split(" ").join(".") : ""}`, property: p, with: el[p], without: w?.[p] ?? null });
      });
    });
  }
  return changed;
}

// Translucent: every translucent default-state check plus the entry's own declaration, through the probe.
async function measureTranslucent(themeName, css, entry) {
  const own = entry && { id: "audit.own", selector: entry.selector.replace(/::before$/, ""), pseudo: entry.selector.endsWith("::before") ? "::before" : undefined, document: "main", property: entry.property };
  const checks = [...translucentChecks.map(({ id, selector, pseudo, scrollTo, document, property, kind }) => ({ id, selector, pseudo, scrollTo, document, property, kind })), ...(own ? [own] : [])];
  const page = await evaluate(port, `window.__INK = ${JSON.stringify({ theme: themeName, translucent: true, platform: "desktop", state: "default", deferMeasure: false, checks })};\n${probe}`);
  if (!page.bodyClasses.includes("is-translucent")) throw new Error("the window is not translucent");
  const defs = new Map(declarations(css).filter((d) => d.selector === ".theme-dark").map((d) => [d.prop, d.value]));
  const results = translucentChecks.map((c) => ({ id: c.id, status: judge(c, page.results[c.id], defs)[0] }));
  return { results, own: own ? page.results["audit.own"] : null };
}

// Append the SVG-label block to the isolated vault's copy of the note (once), and wait until Obsidian reads it.
const extra = readFileSync(path.join(repo, "tests/quality/mermaid-svg-labels.md"), "utf8");
const notePath = path.join(args.vault, mermaidSpec.note);
const note = readFileSync(notePath, "utf8");
if (!note.includes(extra)) writeFileSync(notePath, `${note.trimEnd()}\n\n${extra}`);
const noteLength = readFileSync(notePath, "utf8").length;
if (!(await evaluate(port, `(async () => { for (let i = 0; i < 50; i++) { if ((await app.vault.cachedRead(app.vault.getAbstractFileByPath(${JSON.stringify(mermaidSpec.note)}))).length === ${noteLength}) return true; await new Promise((r) => setTimeout(r, 200)); } return false; })()`))) throw new Error("Obsidian did not pick up the appended Mermaid block");

// A FAIL result as "id: detail", so a FAIL that is already there at baseline counts only when its detail changes.
const failKey = (r) => `${r.id} [${r.view ?? ""}]: ${r.detail ?? ""}`;
const release = await holdFocus(port);
const report = { obsidian: null, electron: null, measuredAt: new Date().toISOString(), extraMermaid: "tests/quality/mermaid-svg-labels.md", baselineFailing: {}, entries: [] };
try {
  for (const theme of THEMES) {
    const css = readFileSync(path.join(repo, "dist", theme, "theme.css"), "utf8");
    // Baselines: the unmodified theme, measured the same way.
    let name = await load(theme, css);
    const env = await evaluate(port, "(() => ({ app: window.require('electron').ipcRenderer.sendSync('version'), electron: (/Electron\\/([\\d.]+)/.exec(navigator.userAgent) || [])[1] }))()");
    report.obsidian = env.app; report.electron = env.electron;
    const baseMermaid = await measureMermaid();
    // Mermaid baseline FAILs come from the appended block (see the header) and are recorded; a translucent
    // baseline FAIL means the experiment cannot tell anything, so it stops.
    const baseFails = Object.values(baseMermaid).flatMap((v) => v.results).filter((r) => r.status === "FAIL").map(failKey);
    report.baselineFailing[theme] = baseFails;
    for (const f of baseFails) console.log(`${theme.padEnd(16)} baseline FAIL (recorded): ${f.slice(0, 300)}`);
    const baseTrans = await measureTranslucent(name, css, null);
    const baseTransFails = baseTrans.results.filter((r) => r.status === "FAIL").map((r) => r.id);
    if (baseTransFails.length) throw new Error(`${theme}: the unmodified theme does not pass: ${baseTransFails.join(", ")}`);
    for (const entry of entries) {
      const variant = withoutImportant(css, entry.selector, entry.property);
      // The entry's own declaration on the unmodified theme (translucent entries), read before the variant loads.
      const ownBase = isMermaid(entry) ? null : (await measureTranslucent(await load(theme, css), css, entry)).own;
      name = await load(theme, variant);
      const row = { theme, selector: entry.selector, property: entry.property, overrides: entry.overrides };
      if (isMermaid(entry)) {
        const m = await measureMermaid();
        row.changed = mermaidDiff(baseMermaid, m);
        row.failing = Object.values(m).flatMap((v) => v.results).filter((r) => r.status === "FAIL" && !baseFails.includes(failKey(r))).map((r) => r.id);
        // Measured: Reading view and Live Preview on the desktop, opaque. Where the rule also applies but the
        // experiment did not look: the mobile emulation (the runner measures Mermaid there too), hover previews,
        // Canvas cards, PDF export.
        row.measured = ["desktop opaque: Reading view", "desktop opaque: Live Preview"];
        row.unmeasured = ["tablet / phone (the runner's emulation measures it; not in this experiment)", "hover preview, Canvas, PDF export (no runtime check)"];
      } else {
        const own = await measureTranslucent(name, variant, entry);
        row.changed = JSON.stringify(own.own) === JSON.stringify(ownBase) ? [] : [{ state: "desktop translucent, active window", property: entry.property, with: ownBase, without: own.own }];
        row.failing = own.results.filter((r) => r.status === "FAIL").map((r) => r.id);
        row.measured = ["desktop translucent, active window, default state"];
        row.unmeasured = ["translucent, inactive window (no runtime check; V-38 only)", "popout windows"];
      }
      Object.assign(row, verdict({ changed: row.changed.length > 0, failing: row.failing, unmeasured: row.unmeasured }));
      report.entries.push(row);
      console.log(`${theme.padEnd(16)} ${row.verdict}${row.coverageGap ? " (no check notices)" : ""}  changed ${row.changed.length}  failing ${row.failing.length}  ${entry.selector.slice(0, 90)} { ${entry.property} }`);
    }
  }
} finally {
  await evaluate(port, "(() => { app.customCss.setTranslucency(false); return 1; })()");
  release();
}
writeFileSync(args.out, `${JSON.stringify(report, null, 1)}\n`);
const counts = report.entries.reduce((o, r) => ((o[r.verdict] = (o[r.verdict] ?? 0) + 1), o), {});
console.log(`\n${report.entries.length} entry x theme results: ${JSON.stringify(counts)}`);

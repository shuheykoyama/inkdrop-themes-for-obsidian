// Negative tests of the static tests (research/14 §3.2: a test that cannot fail proves nothing).
// Each case copies the project inputs (src/, tests/spec/, the lint allow-list, the research/data CSVs)
// to a temporary root, applies one mutation, runs tests/static/run.mjs --root <tmp>, and checks that the
// expected check FAILs (or, for the positive controls, that everything passes).
//
// usage: node tests/static/self-test.mjs
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..", "..");
const MEASURED_DIR = "research/evidence/phase2-p0/measurements";
const MEASURED = ["inkdrop-sd-1-default.json", "inkdrop-kd-1-default.json"];
const DATA = ["inkdrop-solarized-dark-tokens.csv", "inkdrop-kanagawa-dragon-tokens.csv", "obsidian-css-variables-1.14.4.csv", "mapping-candidates.csv"];

// Replace exactly one occurrence of `from` in a file of the temporary root (fails loudly if absent,
// so a case cannot silently stop mutating anything when the sources change).
const edit = (root, rel, from, to) => {
  const f = path.join(root, rel);
  const s = readFileSync(f, "utf8");
  if (!s.includes(from)) throw new Error(`mutation target not found in ${rel}: ${from}`);
  writeFileSync(f, s.replace(from, to));
};
// Adds entries to the copied allow-list (the real entries stay, so only the case's own entry is under test).
const setAllowlist = (root, warnings) => {
  const f = path.join(root, "tests/static/lint-allowlist.json");
  const current = JSON.parse(readFileSync(f, "utf8")).warnings;
  writeFileSync(f, JSON.stringify({ warnings: [...current, ...warnings] }, null, 2));
};
const appendTo = (root, rel, text) => writeFileSync(path.join(root, rel), readFileSync(path.join(root, rel), "utf8") + text);

const IMPORTANT_RULE = "\n.theme-dark .status-bar {\n  background-color: var(--ink-note-list-bar-background) !important;\n}\n";
const IMPORTANT_ENTRY = {
  rule: "declaration-no-important", theme: "*", selector: ".theme-dark .status-bar", property: "background-color",
  overrides: "self-test only", reason: "self-test positive control",
};

const CASES = [
  { name: "baseline (no mutation) passes", mutate: () => {}, pass: true },
  // --- S1: values, references and notation (RV1-A) ---
  { name: "palette value changed (KD dragonBlack3 lightness 11% -> 12%)", fail: /^FAIL S1 kanagawa-dragon \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "--kanagawa-dragon-black3: 45deg 7% 11%;", "--kanagawa-dragon-black3: 45deg 7% 12%;") },
  { name: "alpha changed (SD active line 50% -> 40%)", fail: /^FAIL S1 solarized-dark \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "hsl( var(--hsl-neutral-800) / 50% ); /* inkdropapp_solarized-dark@4337f6e styles/syntax.css:13", "hsl( var(--hsl-neutral-800) / 40% ); /* inkdropapp_solarized-dark@4337f6e styles/syntax.css:13") },
  { name: "Inkdrop hsl() converted to HEX (SD editor background)", fail: /^FAIL S1 solarized-dark colour notation as Inkdrop declared it/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-editor-background: var(--ink-color-neutral-900);", "--ink-editor-background: #002129;") },
  { name: "Inkdrop rgb() converted to hsl() (SD transparent white)", fail: /^FAIL S1 solarized-dark colour notation as Inkdrop declared it/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-transparent-white: rgb(255 255 255 / 8%);", "--ink-transparent-white: hsl(0deg 0% 100% / 8%);") },
  { name: "lint-notation value changed (8% -> 9%)", fail: /^FAIL S1 solarized-dark \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-transparent-white: rgb(255 255 255 / 8%);", "--ink-transparent-white: rgb(255 255 255 / 9%);") },
  { name: "reference changed to another token with the same resolved colour", fail: /^FAIL S1 solarized-dark \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-editor-background: var(--ink-color-neutral-900);", "--ink-editor-background: var(--ink-editor-background-color);") },
  { name: "palette value flattened (reference replaced by its resolved hsl())", fail: /^FAIL S1 solarized-dark \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-sidebar-background: var(--ink-color-neutral-700);", "--ink-sidebar-background: hsl(var(--hsl-neutral-700));") },
  { name: "KD value replaced by SD's (theme mixing)", fail: /^FAIL S1 kanagawa-dragon \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "--ink-editor-background: hsl(var(--kanagawa-dragon-black3));", "--ink-editor-background: hsl(var(--hsl-neutral-900));") },
  { name: "acrylic value changed (KD sidebar 50% -> 60%)", fail: /^FAIL S1 kanagawa-dragon \d+ declarations = Inkdrop's declaration/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "--ink-sidebar-background-acrylic: hsl(var(--kanagawa-dragon-black1) / 50%);", "--ink-sidebar-background-acrylic: hsl(var(--kanagawa-dragon-black1) / 60%);") },
  { name: "acrylic token removed", fail: /^FAIL S1 kanagawa-dragon all \d+ theme acrylic overrides present/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "  --ink-sidebar-background-acrylic: hsl(var(--kanagawa-dragon-black1) / 50%); /* inkdropapp_kanagawa@f9c14a5 packages/dragon/styles/ui.css:559 | acrylic */\n", "") },
  { name: "required token removed (Q-D23 active line)", fail: /^FAIL S1 solarized-dark all \d+ required tokens present/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "  --ink-editor-active-line-background-color: hsl( var(--hsl-neutral-800) / 50% ); /* inkdropapp_solarized-dark@4337f6e styles/syntax.css:13 */\n", "") },
  { name: "referenced token removed (dangling var())", fail: /^FAIL S3 solarized-dark every var\(\) reference to a palette name is defined/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "  --ink-transparent-white: rgb(255 255 255 / 8%); /* inkdropapp_css@add48d9 ui.css:265 | notation (official lint) */\n", "") },
  { name: "wrong source line", fail: /^FAIL S1 kanagawa-dragon source comments/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "styles/ui.css:230 */", "styles/ui.css:231 */") },
  { name: "light-dark() marker missing", fail: /^FAIL S1 solarized-dark source comments/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "markdown.css:28 | light-dark(): dark branch */", "markdown.css:28 */") },
  { name: "notation marker on a value that was not rewritten", fail: /^FAIL S1 solarized-dark source comments/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "styles/ui.css:126 */", "styles/ui.css:126 | notation (official lint) */") },
  { name: "Inkdrop's legacy rgba() kept without the lint notation", fail: /^FAIL S5 solarized-dark stylelint errors = 0/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-transparent-white: rgb(255 255 255 / 8%); /* inkdropapp_css@add48d9 ui.css:265 | notation (official lint) */", "--ink-transparent-white: rgba(255, 255, 255, 0.08); /* inkdropapp_css@add48d9 ui.css:265 */") },
  // --- step 3: derived accent, Inkdrop measurements, spec fields ---
  { name: "derived accent hue differs from the primary colour", fail: /^FAIL S1 solarized-dark derived accent h\/s\/l/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-derived-accent-h: 205;", "--ink-derived-accent-h: 206;") },
  { name: "derived entry with an unknown derivation", fail: /^FAIL S1 kanagawa-dragon shorthand-derived colours/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "  --ink-derived-accent-l: 62%;", "  --ink-derived-extra: 1; /* derived: test */\n  --ink-derived-accent-l: 62%;") },
  { name: "derived entry without the derived marker", fail: /^FAIL S1 kanagawa-dragon derived entries are each marked/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "/* derived: border color of --ink-sidebar-border-right */", "/* border color */") },
  { name: "shorthand-derived colour differs from its shorthand", fail: /^FAIL S1 solarized-dark shorthand-derived colours/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-derived-note-list-bar-border-color: hsl(var(--hsl-neutral-700));", "--ink-derived-note-list-bar-border-color: hsl(var(--hsl-neutral-800));") },
  { name: "Inkdrop measured background differs (S7)", fail: /^FAIL S7 kanagawa-dragon --ink-sidebar-background = Inkdrop sidebar/m,
    mutate: (r) => edit(r, `${MEASURED_DIR}/inkdrop-kd-1-default.json`, '"backgroundColor": "rgb(17, 17, 14)"', '"backgroundColor": "rgb(17, 17, 15)"') },
  { name: "Inkdrop measured region missing (S7)", fail: /^FAIL S7 solarized-dark --ink-note-list-bar-background = Inkdrop note-list background \(missing\)/m,
    mutate: (r) => edit(r, `${MEASURED_DIR}/inkdrop-sd-1-default.json`, '"note-list":', '"note-list-renamed":') },
  { name: "translucent check on an emulated platform", fail: /^FAIL S6 runtime checks are well formed -- .*translucent exists on desktop/m,
    mutate: (r) => edit(r, "tests/spec/runtime/mobile.json", '"platform": ["tablet", "phone"],\n      "appearance": ["opaque"]', '"platform": ["tablet", "phone"],\n      "appearance": ["opaque", "translucent"]') },
  { name: "unknown platform", fail: /^FAIL S6 runtime checks are well formed -- .*platform must list/m,
    mutate: (r) => edit(r, "tests/spec/runtime/mobile.json", '"platform": ["phone", "phone-nonfloating"],', '"platform": ["watch"],') },
  // --- step 4: translucent ---
  { name: "!important removed from the tab-strip override (would lose to app.css)", fail: /^FAIL S5 solarized-dark no stale allow-list entries/m,
    mutate: (r) => edit(r, "src/common/platform/translucent.css", "background-color: var(--ink-note-list-bar-background-acrylic) !important;", "background-color: var(--ink-note-list-bar-background-acrylic);") },
  { name: "translucent rule without the fullscreen exclusion", fail: /^FAIL S4 src\/common\/platform\/translucent\.css every !important is allow-listed/m,
    mutate: (r) => edit(r, "src/common/platform/translucent.css", ".theme-dark.is-translucent:not(.is-fullscreen) .workspace-ribbon.mod-primary {", ".theme-dark.is-translucent .workspace-ribbon.mod-primary {") },
  { name: "acrylic colour written as a literal in translucent.css", fail: /^FAIL S4 src\/common\/platform\/translucent\.css no colour literals/m,
    mutate: (r) => edit(r, "src/common/platform/translucent.css", "--background-primary: var(--ink-editor-background-acrylic);", "--background-primary: hsl(192deg 100% 8% / 90%);") },
  { name: "translucent rule outside the translucent scope", fail: /^FAIL S4 src\/common\/platform\/translucent\.css every selector is inside its platform scope -- \.workspace-split\.mod-root/m,
    mutate: (r) => edit(r, "src/common/platform/translucent.css", ".theme-dark.is-translucent:not(.is-fullscreen) .workspace-split.mod-root {", ".workspace-split.mod-root {") },
  { name: "mobile rule outside the mobile scope", fail: /^FAIL S4 src\/common\/platform\/mobile\.css every selector is inside its platform scope/m,
    mutate: (r) => edit(r, "src/common/platform/mobile.css", ".theme-dark.is-mobile .workspace-drawer {", ".theme-dark .workspace-drawer {") },
  { name: "Markdown rule outside .theme-dark", fail: /^FAIL S4 src\/common\/components\/markdown\.css every selector is under \.theme-dark -- \.callout$/m,
    mutate: (r) => edit(r, "src/common/components/markdown.css", ".theme-dark .callout {", ".callout {") },
  { name: "verifiedBy without evidence", fail: /^FAIL S6 every requirement is covered .*verifiedBy needs method, evidence and result/m,
    mutate: (r) => edit(r, "tests/spec/requirements.json", '"evidence": "research/evidence/phase3-v38/measurements/obsidian-real-fullscreen.json"', '"evidence": ""') },
  { name: "missing source file", fail: /^FAIL S2 build run a exits 0/m,
    mutate: (r) => rmSync(path.join(r, "src/common/mapping/workspace.css")) },
  { name: "colour literal outside the palette", fail: /^FAIL S4 src\/common\/mapping\/workspace\.css no colour literals/m,
    mutate: (r) => edit(r, "src/common/mapping/workspace.css", "var(--ink-sidebar-background)", "#073541") },
  { name: "CSS nesting in a common file", fail: /^FAIL S4 src\/common\/mapping\/workspace\.css no CSS nesting/m,
    mutate: (r) => appendTo(r, "src/common/mapping/workspace.css", "\n.theme-dark {\n  .status-bar {\n    color: var(--ink-editor-background);\n  }\n}\n") },
  { name: "unlisted !important", fail: /^FAIL S4 src\/common\/mapping\/workspace\.css every !important is allow-listed/m,
    mutate: (r) => appendTo(r, "src/common/mapping/workspace.css", IMPORTANT_RULE) },
  { name: "unlisted stylelint warning (!important) fails S5", fail: /^FAIL S5 solarized-dark every stylelint warning is allow-listed/m,
    mutate: (r) => appendTo(r, "src/common/mapping/workspace.css", IMPORTANT_RULE) },
  { name: "stylelint error (custom-property-pattern) fails S5", fail: /^FAIL S5 kanagawa-dragon stylelint errors = 0 -- custom-property-pattern/m,
    mutate: (r) => appendTo(r, "src/common/mapping/workspace.css", "\n.theme-dark {\n  --inkCamelCase: var(--ink-editor-background);\n}\n") },
  { name: "allow-listed warning passes (positive control)", pass: true,
    mutate: (r) => { appendTo(r, "src/common/mapping/workspace.css", IMPORTANT_RULE); setAllowlist(r, [IMPORTANT_ENTRY]); } },
  { name: "stale allow-list entry", fail: /^FAIL S5 solarized-dark no stale allow-list entries/m,
    mutate: (r) => setAllowlist(r, [IMPORTANT_ENTRY]) },
  { name: "allow-listed !important without the overridden app.css rule", fail: /^FAIL S4 allow-list !important/m,
    mutate: (r) => { appendTo(r, "src/common/mapping/workspace.css", IMPORTANT_RULE); setAllowlist(r, [{ ...IMPORTANT_ENTRY, overrides: "" }]); } },
  { name: "SD palette uses a Kanagawa variable", fail: /^FAIL S3 solarized-dark no variable of the other theme/m,
    mutate: (r) => appendTo(r, "src/common/mapping/workspace.css", "\n.theme-dark {\n  --text-faint: var(--kanagawa-dragon-black1);\n}\n") },
  { name: "reference to an undefined --ink-* token", fail: /^FAIL S3 solarized-dark every var\(\) reference to a palette name is defined/m,
    mutate: (r) => edit(r, "src/common/mapping/workspace.css", "var(--ink-editor-background)", "var(--ink-editor-backgruond)") },
  { name: "check expects absence without a reason", fail: /^FAIL S6 runtime checks are well formed/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"token": "--ink-sidebar-background"', '"expect": "absent"') },
  { name: "requirement without a check and not UNVERIFIED", fail: /^FAIL S6 every requirement is covered/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"requirement": "qd1.status-bar-background"', '"requirement": "qd1.ribbon-background"') },
  { name: "check names an undefined token", fail: /^FAIL S6 solarized-dark every token named by a check is defined/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"token": "--ink-note-list-bar-background"', '"token": "--ink-note-list-background"') },
  { name: "check names an unknown pseudo-element", fail: /^FAIL S6 runtime checks are well formed/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"pseudo": "::before"', '"pseudo": ":before"') },
];

let failures = 0;
for (const c of CASES) {
  const root = mkdtempSync(path.join(os.tmpdir(), "ink-self-"));
  try {
    cpSync(path.join(repo, "src"), path.join(root, "src"), { recursive: true });
    cpSync(path.join(repo, "tests/spec"), path.join(root, "tests/spec"), { recursive: true });
    mkdirSync(path.join(root, "tests/static"), { recursive: true });
    cpSync(path.join(repo, "tests/static/lint-allowlist.json"), path.join(root, "tests/static/lint-allowlist.json"));
    mkdirSync(path.join(root, "research/data"), { recursive: true });
    for (const f of DATA) cpSync(path.join(repo, "research/data", f), path.join(root, "research/data", f));
    mkdirSync(path.join(root, MEASURED_DIR), { recursive: true });
    for (const f of MEASURED) cpSync(path.join(repo, MEASURED_DIR, f), path.join(root, MEASURED_DIR, f));
    c.mutate(root);
    const res = spawnSync(process.execPath, [path.join(repo, "tests/static/run.mjs"), "--root", root], { encoding: "utf8" });
    const ok = c.pass ? res.status === 0 : res.status !== 0 && c.fail.test(res.stdout);
    const fails = res.stdout.split("\n").filter((l) => l.startsWith("FAIL")).map((l) => l.slice(0, 120));
    console.log(`${ok ? "PASS" : "FAIL"} self-test: ${c.name}${ok ? "" : ` -- exit ${res.status}; ${fails.join(" | ") || "no FAIL lines"}`}`);
    if (!ok) failures++;
  } catch (e) {
    console.log(`FAIL self-test: ${c.name} -- ${e.message}`);
    failures++;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(failures ? `\n${failures} self-test case(s) FAILED` : `\nall ${CASES.length} self-test cases behaved as expected`);
process.exit(failures ? 1 : 0);

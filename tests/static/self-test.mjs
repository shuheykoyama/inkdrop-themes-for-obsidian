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
const DATA = ["inkdrop-solarized-dark-tokens.csv", "inkdrop-kanagawa-dragon-tokens.csv", "obsidian-css-variables-1.14.4.csv"];

// Replace exactly one occurrence of `from` in a file of the temporary root (fails loudly if absent,
// so a case cannot silently stop mutating anything when the sources change).
const edit = (root, rel, from, to) => {
  const f = path.join(root, rel);
  const s = readFileSync(f, "utf8");
  if (!s.includes(from)) throw new Error(`mutation target not found in ${rel}: ${from}`);
  writeFileSync(f, s.replace(from, to));
};
const setAllowlist = (root, warnings) =>
  writeFileSync(path.join(root, "tests/static/lint-allowlist.json"), JSON.stringify({ warnings }, null, 2));
const appendTo = (root, rel, text) => writeFileSync(path.join(root, rel), readFileSync(path.join(root, rel), "utf8") + text);

const IMPORTANT_RULE = "\n.theme-dark .status-bar {\n  background-color: var(--ink-note-list-bar-background) !important;\n}\n";
const IMPORTANT_ENTRY = {
  rule: "declaration-no-important", theme: "*", selector: ".theme-dark .status-bar", property: "background-color",
  overrides: "self-test only", reason: "self-test positive control",
};

const CASES = [
  { name: "baseline (no mutation) passes", mutate: () => {}, pass: true },
  { name: "palette value changed (KD dragonBlack3 lightness 11% -> 12%)", fail: /^FAIL S1 kanagawa-dragon --kanagawa-dragon-black3 = /m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "45deg 7% 11%", "45deg 7% 12%") },
  { name: "palette colour converted to HEX (SD editor background)", fail: /^FAIL S1 solarized-dark --ink-editor-background = Inkdrop/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-editor-background: var(--ink-color-neutral-900);", "--ink-editor-background: #002129;") },
  { name: "palette value flattened (reference replaced by its resolved hsl())", fail: /^FAIL S1 solarized-dark --ink-sidebar-background = Inkdrop/m,
    mutate: (r) => edit(r, "src/palette/solarized-dark.css", "--ink-sidebar-background: var(--ink-color-neutral-700);", "--ink-sidebar-background: hsl(var(--hsl-neutral-700));") },
  { name: "wrong source comment", fail: /^FAIL S1 kanagawa-dragon --ink-editor-background source comment/m,
    mutate: (r) => edit(r, "src/palette/kanagawa-dragon.css", "styles/ui.css:230", "styles/ui.css:231") },
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
  { name: "reference to an undefined --ink-* token", fail: /^FAIL S3 solarized-dark every var\(--ink-\*\) is defined/m,
    mutate: (r) => edit(r, "src/common/mapping/workspace.css", "var(--ink-editor-background)", "var(--ink-editor-backgruond)") },
  { name: "check expects absence without a reason", fail: /^FAIL S6 runtime checks are well formed/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"token": "--ink-sidebar-background"', '"expect": "absent"') },
  { name: "requirement without a check and not UNVERIFIED", fail: /^FAIL S6 every requirement is covered/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"requirement": "qd1.status-bar-background"', '"requirement": "qd1.ribbon-background"') },
  { name: "check names an undefined token", fail: /^FAIL S6 solarized-dark every token named by a check is defined/m,
    mutate: (r) => edit(r, "tests/spec/runtime/desktop.json", '"token": "--ink-note-list-bar-background"', '"token": "--ink-note-list-background"') },
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

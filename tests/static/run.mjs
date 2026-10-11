// Static tests S1-S6 (research/14 §3.1). Node only; run in CI on every push.
//   S1 value fidelity: palette vs research/data (Inkdrop's primary data), outputs keep the declarations
//   S2 build reproducibility and output hygiene (deterministic, parses, no @import / @charset / empty rules,
//      missing source -> non-zero exit)
//   S3 references: every var(--ink-*) is defined; no variable of the other theme; no clash with Obsidian names
//   S4 layer rules: colour literals only in the palette, no nesting, every !important allow-listed
//   S5 official lint (stylelint-config-obsidianmd): 0 errors, warnings == allow-list
//   S6 spec: requirement / check files are well formed and every requirement is covered or UNVERIFIED
//
// usage: node tests/static/run.mjs [--root <dir>]
//   --root: project root holding src/, tests/spec/, tests/static/lint-allowlist.json and research/data
//           (default: this repository). tests/static/self-test.mjs points it at mutated copies.
// Prints one PASS / FAIL line per check; exit status 1 if any check fails.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import postcss from "postcss";
import stylelint from "stylelint";
import { darkBranch, declarations, hexToRgb, hslToRgb, isTriplet, norm, paletteName, readCsv, sameColor, substitute } from "../lib/css.mjs";
import { checkErrors, loadChecks, loadRequirements, requirementErrors, runtimeSpecFiles } from "../lib/spec.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const { values: args } = parseArgs({ options: { root: { type: "string" } } });
const root = path.resolve(args.root ?? repo);
const THEMES = {
  "solarized-dark": { csv: "inkdrop-solarized-dark-tokens.csv", foreign: /--kanagawa-/ },
  // KD may legitimately use Inkdrop's base --hsl-* triplets (Q-D9), so no name pattern marks SD values in
  // KD; mixing is caught by S1 instead (every KD palette value must equal KD's own primary data).
  "kanagawa-dragon": { csv: "inkdrop-kanagawa-dragon-tokens.csv", foreign: null },
};

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
  if (!ok) failures++;
};
const build = (src, out) => spawnSync(process.execPath, [path.join(repo, "scripts/build.mjs"), "--src", src, "--out", out], { encoding: "utf8" });
const filesUnder = (dir) => readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => statSync(f).isFile() && f.endsWith(".css"));

const tmp = mkdtempSync(path.join(os.tmpdir(), "ink-static-"));
try {
  // ---------- S2: two builds, byte-identical ----------
  const outputs = {};
  for (const run of ["a", "b"]) {
    const res = build(path.join(root, "src"), path.join(tmp, run));
    check(`S2 build run ${run} exits 0`, res.status === 0, res.status === 0 ? "" : (res.stderr || res.stdout).trim().slice(0, 400));
  }
  for (const t of Object.keys(THEMES)) {
    const read = (run) => { const f = path.join(tmp, run, t, "theme.css"); return existsSync(f) ? readFileSync(f, "utf8") : null; };
    const a = read("a"), b = read("b");
    check(`S2 ${t} deterministic (two builds byte-identical)`, a !== null && a === b);
    outputs[t] = a ?? "";
    check(`S2 ${t} manifest.json written`, existsSync(path.join(tmp, "a", t, "manifest.json")));
  }

  // ---------- S2: output hygiene ----------
  for (const [t, css] of Object.entries(outputs)) {
    let parsed;
    try { parsed = postcss.parse(css); } catch (e) { parsed = e; }
    const ok = !(parsed instanceof Error);
    check(`S2 ${t} output parses as CSS`, ok, ok ? "" : parsed.message);
    let imports = 0;
    const empty = [];
    if (ok) {
      parsed.walkAtRules("import", () => { imports++; });
      parsed.walkRules((r) => { if (!r.nodes.some((n) => n.type === "decl" || n.type === "rule")) empty.push(r.selector); });
    }
    check(`S2 ${t} no @import rule left`, ok && imports === 0, `${imports}`);
    check(`S2 ${t} no @charset / BOM`, !/@charset/.test(css) && css.charCodeAt(0) !== 0xfeff);
    check(`S2 ${t} no empty / comment-only rules`, ok && empty.length === 0, empty.join(" | "));
  }

  // ---------- S2: a missing source file fails the build, naming the file ----------
  const broken = path.join(tmp, "broken-src");
  cpSync(path.join(root, "src"), broken, { recursive: true });
  rmSync(path.join(broken, "common/mapping/workspace.css"));
  const res = build(broken, path.join(tmp, "broken-out"));
  check("S2 missing source -> non-zero exit", res.status !== 0, `status ${res.status}`);
  check("S2 missing source -> error names the file", /workspace\.css/.test(res.stderr), res.stderr.trim().split("\n")[0] ?? "");

  // ---------- S1: palette vs Inkdrop's primary data ----------
  for (const [theme, info] of Object.entries(THEMES)) {
    const rows = readCsv(path.join(root, "research/data", info.csv));
    // A token can have a base row and a theme row; the theme's declaration is the one Inkdrop applies.
    const byToken = new Map();
    for (const r of rows) if (!byToken.has(r.token) || r.source === "theme") byToken.set(r.token, r);
    // Our palette name -> CSV row, by the naming rule of research/14 §1.5.
    const byPaletteName = new Map([...byToken.values()].map((r) => [paletteName(r.token, r.raw_value), r]));
    // Rename the var() references of an Inkdrop value to our palette names.
    const rename = (v) => v.replace(/var\((--[\w-]+)\)/g, (m, n) => (byToken.has(n) ? `var(${paletteName(n, byToken.get(n).raw_value)})` : m));
    // Inkdrop's definitions under our names (dark branch), to resolve both sides to the same form.
    const inkDefs = new Map([...byToken.values()].map((r) => [paletteName(r.token, r.raw_value), rename(darkBranch(r.raw_value))]));

    const palettePath = path.join(root, "src/palette", `${theme}.css`);
    const palette = declarations(readFileSync(palettePath, "utf8"));
    const defs = new Map(palette.map((d) => [d.prop, d.value]));
    check(`S1 ${theme} palette is not empty`, palette.length > 0);
    for (const d of palette) {
      const acrylic = d.prop.endsWith("-acrylic");
      const row = byPaletteName.get(acrylic ? d.prop.replace(/-acrylic$/, "") : d.prop);
      if (!row) { check(`S1 ${theme} ${d.prop} is an Inkdrop token`, false, "no CSV row under the naming rule"); continue; }
      let expected, source;
      if (acrylic) {
        // Theme's own acrylic override: ":root:has(body.acrylic-window) @<path>:<line> = <value>" in the notes.
        const m = /:root:has\(body\.acrylic-window\) @((?:styles|packages\/dragon\/styles)\/ui\.css:\d+) = ([^|;]+)/.exec(row.notes);
        expected = m && rename(norm(m[2]));
        source = m && `${row["file:line"].split(" ")[0]} ${m[1]}`;
      } else {
        expected = rename(darkBranch(row.raw_value));
        source = row["file:line"];
      }
      // Written as declared (after renaming the references): no conversion, no flattening.
      check(`S1 ${theme} ${d.prop} = Inkdrop ${row.token}${acrylic ? " (acrylic)" : ""} as declared`, expected !== null && d.value === expected, `${d.value} vs ${expected}`);
      check(`S1 ${theme} ${d.prop} source comment = ${source}`, d.comment === source, `${d.comment}`);
      if (isTriplet(row.raw_value)) continue;
      // Resolved value equal on both sides, and equal to the CSV's 8-bit value within 1/255.
      const ours = substitute(d.value, defs);
      const theirs = substitute(expected ?? "", inkDefs);
      check(`S1 ${theme} ${d.prop} resolves like Inkdrop`, ours === theirs, `${ours} vs ${theirs}`);
      if (!acrylic && /^#[0-9a-f]{6,8}$/i.test(row.resolved_value)) {
        check(`S1 ${theme} ${d.prop} = ${row.resolved_value} (+-1/255)`, sameColor(hslToRgb(ours), hexToRgb(row.resolved_value)), ours);
      }
    }
    // The output carries every palette declaration unchanged and no converted colour.
    const out = declarations(outputs[theme]);
    const missing = palette.filter((p) => !out.some((d) => d.selector === p.selector && d.prop === p.prop && d.value === p.value));
    check(`S1 ${theme} output keeps every palette declaration verbatim`, outputs[theme] !== "" && missing.length === 0, missing.map((x) => x.prop).join(", "));
    const converted = out.filter((d) => /#[0-9a-f]{3,8}\b/i.test(d.value) || /\b(?:rgba?|hwb|lab|lch|oklab|oklch|color)\(/.test(d.value));
    check(`S1 ${theme} no HEX / rgb() / other colour functions in output`, converted.length === 0, converted.map((d) => `${d.prop}: ${d.value}`).join("; "));
  }

  // ---------- S3: references ----------
  const obsidianVars = new Set(readCsv(path.join(root, "research/data/obsidian-css-variables-1.14.4.csv")).map((r) => r.variable));
  for (const [theme, info] of Object.entries(THEMES)) {
    const decls = declarations(outputs[theme]);
    const defined = new Set(decls.map((d) => d.prop));
    const undefinedRefs = [...new Set(decls.flatMap((d) => [...d.value.matchAll(/var\((--ink-[\w-]+)\)/g)].map((m) => m[1])))].filter((n) => !defined.has(n));
    check(`S3 ${theme} every var(--ink-*) is defined`, undefinedRefs.length === 0, undefinedRefs.join(", "));
    if (info.foreign) check(`S3 ${theme} no variable of the other theme`, outputs[theme] !== "" && !info.foreign.test(outputs[theme]));
    const inkDefs = decls.filter((d) => d.prop.startsWith("--ink-"));
    const dup = inkDefs.filter((d, i) => inkDefs.findIndex((x) => x.prop === d.prop) !== i);
    check(`S3 ${theme} each --ink-* token defined once`, dup.length === 0, dup.map((d) => d.prop).join(", "));
    const palette = declarations(readFileSync(path.join(root, "src/palette", `${theme}.css`), "utf8"));
    const clash = palette.filter((d) => obsidianVars.has(d.prop));
    check(`S3 ${theme} palette names do not clash with Obsidian 1.14.4 variables`, clash.length === 0, clash.map((d) => d.prop).join(", "));
  }

  // ---------- S4: layer rules on the sources ----------
  const allowlist = JSON.parse(readFileSync(path.join(root, "tests/static/lint-allowlist.json"), "utf8")).warnings;
  const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
  const nonPalette = filesUnder(path.join(root, "src")).filter((f) => !f.startsWith(path.join(root, "src/palette") + path.sep));
  for (const f of nonPalette) {
    const rel = path.relative(root, f);
    const tree = postcss.parse(readFileSync(f, "utf8"));
    const lits = [], nested = [], important = [];
    tree.walkDecls((d) => {
      if (literal.test(d.value)) lits.push(`${d.prop}: ${d.value}`);
      if (d.important && !allowlist.some((a) => a.rule === "declaration-no-important" && a.selector === norm(d.parent.selector) && a.property === d.prop)) important.push(`${d.parent.selector} { ${d.prop} }`);
    });
    tree.walkRules((r) => { if (r.parent?.type === "rule") nested.push(r.selector); });
    if (rel.startsWith(`src${path.sep}themes${path.sep}`) && !rel.slice(11).includes(path.sep)) {
      // Theme entries: @import only.
      const other = tree.nodes.filter((n) => n.type !== "comment" && !(n.type === "atrule" && n.name === "import"));
      check(`S4 ${rel} entry holds only @import rules`, other.length === 0, other.map((n) => n.type).join(", "));
    }
    check(`S4 ${rel} no colour literals outside the palette`, lits.length === 0, lits.join("; "));
    check(`S4 ${rel} no CSS nesting`, nested.length === 0, nested.join(", "));
    check(`S4 ${rel} every !important is allow-listed`, important.length === 0, important.join("; "));
  }
  for (const a of allowlist.filter((x) => x.rule === "declaration-no-important")) {
    check(`S4 allow-list !important ${a.selector} { ${a.property} } names the app.css rule it overrides`, typeof a.overrides === "string" && a.overrides.trim() !== "");
  }

  // ---------- S5: official lint on the outputs ----------
  for (const [theme, css] of Object.entries(outputs)) {
    const result = await stylelint.lint({ code: css, codeFilename: path.join(tmp, "a", theme, "theme.css"), configFile: path.join(repo, ".stylelintrc.json"), configBasedir: repo });
    const r = result.results[0];
    const decls = postcss.parse(css);
    // Selector / property of the declaration a warning points at (null if it is not a declaration).
    const at = (line, column) => {
      let hit = null;
      decls.walkDecls((d) => { if (d.source.start.line === line && d.source.start.column <= column && (d.source.end.line > line || d.source.end.column >= column)) hit = d; });
      if (hit) return { selector: norm(hit.parent.selector ?? ""), property: hit.prop };
      // Warnings on a selector (e.g. :has()) point at the rule: matched by allow-list entries with property null.
      decls.walkRules((rule) => { if (!hit && rule.source.start.line === line) hit = rule; });
      return hit && { selector: norm(hit.selector), property: null };
    };
    const errors = r.warnings.filter((w) => w.severity === "error");
    const warnings = r.warnings.filter((w) => w.severity === "warning");
    check(`S5 ${theme} stylelint ran without invalid options or parse errors`, !r.invalidOptionWarnings?.length && !r.parseErrors?.length, JSON.stringify([...(r.invalidOptionWarnings ?? []), ...(r.parseErrors ?? [])]).slice(0, 300));
    check(`S5 ${theme} stylelint errors = 0`, errors.length === 0, errors.map((w) => `${w.rule} L${w.line}: ${w.text}`).join(" | "));
    const unlisted = warnings.filter((w) => {
      const loc = at(w.line, w.column);
      return !allowlist.some((a) => a.rule === w.rule && (a.theme === "*" || a.theme === theme) && loc && a.selector === loc.selector && a.property === loc.property);
    });
    check(`S5 ${theme} every stylelint warning is allow-listed with a reason`, unlisted.length === 0, unlisted.map((w) => `${w.rule} L${w.line}`).join(" | "));
    const listed = allowlist.filter((a) => a.theme === "*" || a.theme === theme);
    const stale = listed.filter((a) => !warnings.some((w) => { const loc = at(w.line, w.column); return w.rule === a.rule && loc && a.selector === loc.selector && a.property === loc.property; }));
    check(`S5 ${theme} no stale allow-list entries`, stale.length === 0, stale.map((a) => `${a.rule} ${a.selector} { ${a.property} }`).join(" | "));
  }
  check("S5 every allow-list entry has a reason", allowlist.every((a) => typeof a.reason === "string" && a.reason.trim()));

  // ---------- S6: specs ----------
  const specDir = path.join(root, "tests/spec");
  const requirements = loadRequirements(specDir);
  const checks = loadChecks(runtimeSpecFiles(specDir));
  const ids = new Set(requirements.map((r) => r.id));
  const structural = checks.flatMap((c) => checkErrors(c, ids));
  check("S6 runtime checks are well formed", structural.length === 0, structural.join(" | "));
  const reqErrors = requirementErrors(requirements, checks);
  check("S6 every requirement is covered by a check or recorded as UNVERIFIED (reason + risk)", reqErrors.length === 0, reqErrors.join(" | "));
  // Tokens named by checks must exist in both palettes' outputs (a typo would otherwise only show at runtime).
  for (const [theme, css] of Object.entries(outputs)) {
    const defined = new Set(declarations(css).map((d) => d.prop));
    const unknown = checks.filter((c) => c.token && !defined.has(c.token)).map((c) => `${c.id}: ${c.token}`);
    check(`S6 ${theme} every token named by a check is defined`, unknown.length === 0, unknown.join(" | "));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);

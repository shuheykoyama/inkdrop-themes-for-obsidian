// Static tests S1-S7 (research/14 §3.1). Node only; run in CI on every push.
//   S1 value fidelity: palette vs research/data (Inkdrop's primary data), outputs keep the declarations
//   S2 build reproducibility and output hygiene (deterministic, parses, no @import / @charset / empty rules,
//      missing source -> non-zero exit)
//   S3 references: every var(--ink-*) is defined; no variable of the other theme; no clash with Obsidian names
//   S4 layer rules: colour literals only in the palette, no nesting, every !important allow-listed
//   S5 official lint (stylelint-config-obsidianmd): 0 errors, warnings == allow-list
//   S6 spec: requirement / check files are well formed and every requirement is covered or UNVERIFIED
//   S7 the opaque surfaces of Q-D1 resolve to the colours Inkdrop 6.1.5 painted (V-20 measurements)
//
// usage: node tests/static/run.mjs [--root <dir>]
//   --root: project root holding src/, tests/spec/, tests/static/lint-allowlist.json, research/data and
//           research/evidence/phase2-p0/measurements/inkdrop-*-1-default.json
//           (default: this repository). tests/static/self-test.mjs points it at mutated copies.
// Prints one PASS / FAIL line per check; exit status 1 if any check fails.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import postcss from "postcss";
import stylelint from "stylelint";
import { darkBranch, declarations, denotation, hasLightDark, hexToRgb, hslToRgb, isTriplet, norm, normalizeNotation, paletteName, parseComputedColor, readCsv, sameColor, substitute } from "../lib/css.mjs";
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

// Tokens the palette must contain (research/14 §6.2): every Inkdrop token named by the mapping candidates
// (research/data/mapping-candidates.csv), these families, and these extras; plus whatever they reference
// (checked by S3). --mermaid-* waits for V-10 (step 9).
const REQUIRED_FAMILIES = ["--editor-", "--syntax-", "--mde-preview-", "--md-", "--gfm-alert-", "--tag-default-"];
const REQUIRED_EXTRA = ["--page-font", "--inline-dropdown-menu-background", "--vertical-menu-background"];

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
  // One aggregated PASS/FAIL line per theme and aspect; a FAIL lists the offending declarations.
  const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(|\b(?:transparent|currentcolor|white|black)\b/gi;
  const literals = (v) => (v.match(COLOUR_LITERAL) ?? []).map((x) => x.toLowerCase()).sort().join(" ");
  const tokenCounts = {};
  for (const [theme, info] of Object.entries(THEMES)) {
    const rows = readCsv(path.join(root, "research/data", info.csv));
    // A token can have a base row and a theme row; the theme's declaration is the one Inkdrop applies.
    const byToken = new Map();
    for (const r of rows) if (!byToken.has(r.token) || r.source === "theme") byToken.set(r.token, r);
    // Our palette name -> CSV row, by the naming rule of research/14 §1.5.
    const byPaletteName = new Map([...byToken.values()].map((r) => [paletteName(r.token, r.raw_value), r]));
    // Rename the var() references of an Inkdrop value to our palette names (with or without a fallback).
    const rename = (v) => v.replace(/var\(\s*(--[\w-]+)/g, (m, n) => (byToken.has(n) ? `var(${paletteName(n, byToken.get(n).raw_value)}` : m));
    // Inkdrop's definitions under our names (dark branch), to resolve both sides to the same form.
    const inkDefs = new Map([...byToken.values()].map((r) => [paletteName(r.token, r.raw_value), rename(darkBranch(r.raw_value))]));
    const themeRepo = byToken.get("--editor-background")["file:line"].split(" ")[0];

    const palette = declarations(readFileSync(path.join(root, "src/palette", `${theme}.css`), "utf8"));
    const defs = new Map(palette.map((d) => [d.prop, d.value]));
    const bad = { unknown: [], declared: [], notation: [], denotes: [], comment: [], resolved: [], hex: [] };
    let acrylicCount = 0, lightDarkCount = 0, notationCount = 0, hexChecked = 0;
    for (const d of palette) {
      if (d.prop.startsWith("--ink-derived-")) continue; // not Inkdrop tokens: checked below
      const acrylic = d.prop.endsWith("-acrylic");
      const row = byPaletteName.get(acrylic ? d.prop.replace(/-acrylic$/, "") : d.prop);
      if (!row) { bad.unknown.push(d.prop); continue; }
      let declared, source;
      if (acrylic) {
        acrylicCount++;
        // The theme's own acrylic override: ":root:has(body.acrylic-window) @<path>:<line> = <value>" in the notes.
        const m = /:root:has\(body\.acrylic-window\) @((?:styles|packages\/dragon\/styles)\/(?:ui|syntax)\.css:\d+) = ([^|;]+)/.exec(row.notes);
        declared = m ? norm(m[2]) : null;
        source = m && `${themeRepo} ${m[1]} | acrylic`;
      } else {
        declared = row.raw_value;
        source = row["file:line"];
      }
      // The two intentional rewrites, each declared in the comment (research/14 §1.5, §1.9):
      //   light-dark(): dark branch only (Q-D11);  notation: spelling required by the official lint, same value.
      const ld = declared !== null && hasLightDark(declared);
      if (ld) { lightDarkCount++; source += " | light-dark(): dark branch"; }
      const asDeclared = declared === null ? null : rename(ld ? darkBranch(declared) : norm(declared));
      const expected = asDeclared === null ? null : normalizeNotation(asDeclared);
      if (expected !== asDeclared) {
        notationCount++;
        source += " | notation (official lint)";
        // Independent of normalizeNotation: same colours (r, g, b, alpha) and the same font names.
        if (denotation(expected) !== denotation(asDeclared)) bad.denotes.push(`${d.prop}: ${expected} vs ${asDeclared}`);
      }
      // 1. Written as declared (after renaming the references): no conversion, no flattening, same references.
      if (expected === null || d.value !== expected) bad.declared.push(`${d.prop}: ${d.value} vs ${expected}`);
      // 2. Colour notation: exactly the colour literals Inkdrop declared (HEX / rgb() / transparent ... are
      //    allowed where Inkdrop wrote them, and nowhere else).
      if (expected !== null && literals(d.value) !== literals(expected)) bad.notation.push(`${d.prop}: [${literals(d.value)}] vs [${literals(expected)}]`);
      // 3. Source comment = research/data file:line (+ markers).
      if (d.comment !== source) bad.comment.push(`${d.prop}: ${d.comment} vs ${source}`);
      if (isTriplet(row.raw_value) || expected === null) continue;
      // 4. Resolved through our palette = resolved through Inkdrop's definitions.
      // (Compared by denotation, so a lint-notation value somewhere in the chain still counts as equal.)
      const ours = substitute(d.value, defs);
      const theirs = substitute(expected, inkDefs);
      if (ours !== theirs && denotation(ours) !== denotation(theirs)) bad.resolved.push(`${d.prop}: ${ours} vs ${theirs}`);
      // 5. Equal to the CSV's 8-bit resolved value within 1/255 (where the CSV has one and ours is one hsl()).
      if (!acrylic && /^#[0-9a-f]{6,8}$/i.test(row.resolved_value) && hslToRgb(ours)) {
        hexChecked++;
        if (!sameColor(hslToRgb(ours), hexToRgb(row.resolved_value))) bad.hex.push(`${d.prop}: ${ours} vs ${row.resolved_value}`);
      }
    }
    // Derived entries (research/14 §6.3): the accent h/s/l are the HSL triplet of --ink-primary-color.
    const derived = palette.filter((d) => d.prop.startsWith("--ink-derived-"));
    const primary = substitute("var(--ink-primary-color)", defs);
    const tri = /^hsl\((-?[\d.]+)deg ([\d.]+%) ([\d.]+%)/.exec(primary);
    const accentOk = tri && defs.get("--ink-derived-accent-h") === tri[1] && defs.get("--ink-derived-accent-s") === tri[2] && defs.get("--ink-derived-accent-l") === tri[3];
    check(`S1 ${theme} derived accent h/s/l = HSL triplet of --ink-primary-color`, Boolean(accentOk), `${defs.get("--ink-derived-accent-h")} ${defs.get("--ink-derived-accent-s")} ${defs.get("--ink-derived-accent-l")} vs ${primary}`);
    const unknownDerived = derived.filter((d) => !/^--ink-derived-accent-[hsl]$/.test(d.prop) || !/^derived: /.test(d.comment ?? ""));
    check(`S1 ${theme} derived entries are only the documented ones, each marked "derived:"`, unknownDerived.length === 0, unknownDerived.map((d) => d.prop).join(", "));
    const n = palette.length;
    tokenCounts[theme] = { declarations: n, acrylic: acrylicCount, lightDark: lightDarkCount, notation: notationCount, hexChecked };
    const list = (xs) => xs.slice(0, 8).join(" | ") + (xs.length > 8 ? ` | ... (${xs.length})` : "");
    check(`S1 ${theme} palette is not empty`, n > 0, `${n} declarations`);
    check(`S1 ${theme} every declaration is an Inkdrop token (naming rule)`, bad.unknown.length === 0, list(bad.unknown));
    check(`S1 ${theme} ${n} declarations = Inkdrop's declaration (values, alpha, references)`, bad.declared.length === 0, list(bad.declared));
    check(`S1 ${theme} colour notation as Inkdrop declared it, except the marked lint notation (no conversion)`, bad.notation.length === 0, list(bad.notation));
    check(`S1 ${theme} ${notationCount} lint-notation values denote the same colours / font names as Inkdrop's`, bad.denotes.length === 0, list(bad.denotes));
    check(`S1 ${theme} source comments = research/data (${lightDarkCount} light-dark, ${notationCount} notation, ${acrylicCount} acrylic marked)`, bad.comment.length === 0, list(bad.comment));
    check(`S1 ${theme} resolved values = Inkdrop's resolved values`, bad.resolved.length === 0, list(bad.resolved));
    check(`S1 ${theme} ${hexChecked} opaque colours = research/data 8-bit values (+-1/255)`, bad.hex.length === 0, list(bad.hex));

    // Selection (research/14 §6.2): the tokens later steps need must all be present.
    const named = new Set(readCsv(path.join(root, "research/data/mapping-candidates.csv")).flatMap((r) => r.inkdrop_tokens.match(/--[\w-]+/g) ?? []));
    const required = [...byToken.keys()].filter((t) => named.has(t) || REQUIRED_FAMILIES.some((f) => t.startsWith(f)) || REQUIRED_EXTRA.includes(t));
    const absent = required.filter((t) => !defs.has(paletteName(t, byToken.get(t).raw_value)));
    check(`S1 ${theme} all ${required.length} required tokens present (mapping candidates + families)`, absent.length === 0, list(absent));
    const acrylicRequired = required.filter((t) => /:root:has\(body\.acrylic-window\) @(?:styles|packages\/dragon\/styles)\//.test(byToken.get(t).notes));
    const acrylicAbsent = acrylicRequired.filter((t) => !defs.has(`${paletteName(t, byToken.get(t).raw_value)}-acrylic`));
    check(`S1 ${theme} all ${acrylicRequired.length} theme acrylic overrides present`, acrylicAbsent.length === 0, list(acrylicAbsent));

    // The output carries every palette declaration unchanged; outside the palette no colour literal at all.
    const out = declarations(outputs[theme]);
    const missing = palette.filter((p) => !out.some((d) => d.selector === p.selector && d.prop === p.prop && d.value === p.value));
    check(`S1 ${theme} output keeps every palette declaration verbatim`, outputs[theme] !== "" && missing.length === 0, list(missing.map((x) => x.prop)));
    const paletteKeys = new Set(palette.map((p) => `${p.selector}|${p.prop}|${p.value}`));
    const converted = out.filter((d) => !paletteKeys.has(`${d.selector}|${d.prop}|${d.value}`) && literals(d.value) !== "");
    check(`S1 ${theme} no colour literal outside the palette in the output`, converted.length === 0, list(converted.map((d) => `${d.prop}: ${d.value}`)));
  }
  console.log(`token counts: ${JSON.stringify(tokenCounts)}`);

  // ---------- S7: opaque surfaces = Inkdrop's measured Computed Style (V-20, research/11 §14.4) ----------
  // The palette is checked against Inkdrop's declarations (S1); this ties the resolved colours of the
  // surfaces Q-D1 maps to what Inkdrop 6.1.5 actually painted (research/evidence/phase2-p0/measurements).
  const MEASURED = {
    "--ink-sidebar-background": "sidebar",
    "--ink-note-list-bar-background": "note-list",
    "--ink-editor-background": "editor-layout",
    "--ink-editor-background-color": "cm-editor",
  };
  for (const [theme, short] of [["solarized-dark", "sd"], ["kanagawa-dragon", "kd"]]) {
    const measured = JSON.parse(readFileSync(path.join(root, `research/evidence/phase2-p0/measurements/inkdrop-${short}-1-default.json`), "utf8"));
    const defs = new Map(declarations(readFileSync(path.join(root, "src/palette", `${theme}.css`), "utf8")).map((d) => [d.prop, d.value]));
    for (const [token, region] of Object.entries(MEASURED)) {
      const m = measured[region];
      const ours = hslToRgb(substitute(`var(${token})`, defs));
      const theirs = parseComputedColor(m?.found ? m.backgroundColor : null);
      check(`S7 ${theme} ${token} = Inkdrop ${region} background (${m?.backgroundColor ?? "missing"})`, sameColor(ours, theirs), ours ? `rgba(${ours.rgb.map((x) => x.toFixed(1))}, ${ours.a})` : "unresolved");
    }
  }

  // ---------- S3: references ----------
  const obsidianVars = new Set(readCsv(path.join(root, "research/data/obsidian-css-variables-1.14.4.csv")).map((r) => r.variable));
  for (const [theme, info] of Object.entries(THEMES)) {
    const decls = declarations(outputs[theme]);
    const defined = new Set(decls.map((d) => d.prop));
    const palettePrefixes = /^--(?:ink-|hsl-|kanagawa-)/;
    const undefinedRefs = [...new Set(decls.flatMap((d) => [...d.value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])))].filter((n) => palettePrefixes.test(n) && !defined.has(n));
    check(`S3 ${theme} every var() reference to a palette name is defined`, undefinedRefs.length === 0, undefinedRefs.join(", "));
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

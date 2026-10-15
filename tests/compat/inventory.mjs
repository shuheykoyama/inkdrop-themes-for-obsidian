// Obsidian compatibility inventory (step 11C, research/14 §6.30.3): what the theme sources depend on in an
// Obsidian build, with where each dependency is used (src file:line) and where Obsidian provides it (app.css
// line, or the app's scripts). Made from one Obsidian asar, so a new version can be checked mechanically.
//
// usage: node tests/compat/inventory.mjs <obsidian-X.Y.Z.asar | .asar.gz> [--out inventory.json] [--against old.json]
//   prints a summary; exit 1 when a dependency is missing in this build (problems) or, with --against, when a
//   dependency the old inventory had in Obsidian is no longer there (lost). Exit 0 otherwise.
//
// Dependencies:
//   variables  every custom property the sources set or read. Category: obsidian (declared in app.css),
//              fallback (only read in app.css, e.g. var(--text-highlight-bg, ...)), script (not in app.css,
//              named in the app's scripts, e.g. set at run time), theme (the theme's own, not in Obsidian).
//              Problem: read but declared nowhere (unresolved). The palette keeps every Inkdrop token, so a
//              theme variable nothing reads is not a compatibility matter and is not reported.
//   classes    every class name in the sources' selectors. Category: app.css (in an app.css selector), script
//              (only in the app's scripts: app.js, CodeMirror, Mermaid, ... builds it), generated (built by
//              joining strings, tests/compat/dependencies.json `generated`), missing (problem).
//   attributes every attribute name in the sources' selectors, categorised like the classes.
//   rules      the app.css rules the sources' comments and the lint allowlist name (dependencies.json `rules`):
//              the selector, property and value as cited must still be in app.css (absent: the cited rule must
//              still not exist). A rule that is gone or changed is a problem: the override may no longer be needed
//              or may no longer win.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";
import postcss from "postcss";
import { runtimeSpecFiles } from "../lib/spec.mjs";

const repo = path.resolve(import.meta.dirname, "../..");

// ---------- the Obsidian build ----------
// An asar is a Chromium pickle: bytes 4-7 hold the header pickle's size, bytes 12-15 the JSON header's length,
// the JSON header starts at 16, and file data starts right after the header pickle (8 + its size); each file
// entry gives its offset (a string) from there and its size.
export function readAsar(file) {
  let b = readFileSync(file);
  if (file.endsWith(".gz")) b = gunzipSync(b);
  const header = JSON.parse(b.subarray(16, 16 + b.readUInt32LE(12)).toString("utf8"));
  const base = 8 + b.readUInt32LE(4);
  const files = new Map();
  const walk = (node, prefix) => {
    for (const [name, e] of Object.entries(node.files)) {
      if (e.files) walk(e, `${prefix}${name}/`);
      else if (!e.unpacked) files.set(`${prefix}${name}`, b.subarray(base + Number(e.offset), base + Number(e.offset) + e.size));
    }
  };
  walk(header, "");
  return files;
}
// The parts of a build the inventory needs: app.css, the scripts that build the DOM (app.js and lib/**.js,
// not the pdf.js worker or the translations), the version, and identifiers to cite.
export function buildFromAsar(file) {
  const files = readAsar(file);
  const appCss = files.get("app.css")?.toString("utf8");
  if (!appCss) throw new Error(`${file}: no app.css`);
  const pkg = files.get("package.json") ? JSON.parse(files.get("package.json").toString("utf8")) : {};
  const scripts = [...files.keys()].filter((n) => /^(app|enhance)\.js$|^lib\/.+\.(m?js)$/.test(n) && !/worker|i18n/.test(n)).sort();
  const mermaid = files.get("lib/mermaid.min.js")?.toString("utf8").match(/\bversion:"(\d+\.\d+\.\d+)"/)?.[1] ?? null;
  return {
    version: pkg.version ?? null,
    appCss,
    appCssSha256: createHash("sha256").update(appCss).digest("hex"),
    scripts: scripts.map((n) => ({ name: n, text: files.get(n).toString("utf8") })),
    mermaid,
  };
}

// ---------- CSS ----------
// Selector text without strings and attribute values, so `.5` in a value or a class-like word in a quoted
// attribute value is not taken for a class.
const bareSelector = (s) => s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""').replace(/\[\s*([\w-]+)[^\]]*\]/g, "[$1]");
const classesOf = (sel) => [...bareSelector(sel).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
const attributesOf = (sel) => [...bareSelector(sel).matchAll(/\[([\w-]+)\]/g)].map((m) => m[1]);
const varsRead = (value) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
const norm = (s) => s.replace(/\s+/g, " ").trim();
// Walks a stylesheet: each rule (selector list, line) and each declaration (prop, value, important, line,
// the rule's selectors). Keyframe steps are not selectors.
export function scan(css, from) {
  const root = postcss.parse(css, { from });
  const rules = [], decls = [];
  root.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes$/.test(r.parent.name)) return;
    rules.push({ selectors: r.selectors.map(norm), line: r.source.start.line });
  });
  root.walkDecls((d) => {
    const r = d.parent?.type === "rule" ? d.parent : null;
    decls.push({ prop: d.prop, value: norm(d.value), important: !!d.important, line: d.source.start.line, selectors: r ? r.selectors.map(norm) : [] });
  });
  return { rules, decls };
}

// ---------- the theme sources ----------
// Every CSS file under src/ (both palettes, the common layers and the theme entries), with repo-relative paths.
export function themeSources(dir = path.join(repo, "src")) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) out.push({ file: path.relative(repo, p), css: readFileSync(p, "utf8") });
    }
  };
  walk(dir);
  return out;
}

// ---------- the inventory ----------
const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
// One name searched in the scripts as a whole word (letters, digits, - and _ around it end the word).
const inScripts = (scripts, name) => {
  const re = new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
  return scripts.filter((s) => re.test(s.text)).map((s) => s.name);
};

export function inventory(build, sources, deps, runtimeSpec = []) {
  const app = scan(build.appCss, "app.css");
  // Obsidian side: where a variable is declared / read, where a class or attribute appears in a selector.
  const appDeclared = new Map(), appRead = new Map(), appClass = new Map(), appAttr = new Map();
  for (const d of app.decls) {
    if (d.prop.startsWith("--")) add(appDeclared, d.prop, d.line);
    for (const v of varsRead(d.value)) add(appRead, v, d.line);
  }
  for (const r of app.rules) for (const s of r.selectors) {
    for (const c of classesOf(s)) add(appClass, c, r.line);
    for (const a of attributesOf(s)) add(appAttr, a, r.line);
  }
  // Theme side, with file:line of every use.
  const setBy = new Map(), readBy = new Map(), classBy = new Map(), attrBy = new Map();
  for (const { file, css } of sources) {
    const t = scan(css, file);
    for (const d of t.decls) {
      if (d.prop.startsWith("--")) add(setBy, d.prop, `${file}:${d.line}`);
      for (const v of varsRead(d.value)) add(readBy, v, `${file}:${d.line}`);
    }
    for (const r of t.rules) for (const s of r.selectors) {
      for (const c of classesOf(s)) add(classBy, c, `${file}:${r.line}`);
      for (const a of attributesOf(s)) add(attrBy, a, `${file}:${r.line}`);
    }
  }
  const problems = [];

  const variables = [...new Set([...setBy.keys(), ...readBy.keys()])].sort().map((name) => {
    const e = { name, set: [...new Set(setBy.get(name) ?? [])].length, read: [...new Set(readBy.get(name) ?? [])].length, usedAt: [...new Set([...(setBy.get(name) ?? []), ...(readBy.get(name) ?? [])])].slice(0, 3) };
    if (appDeclared.has(name)) Object.assign(e, { category: "obsidian", appCss: appDeclared.get(name).slice(0, 3) });
    else if (appRead.has(name)) Object.assign(e, { category: "fallback", appCss: appRead.get(name).slice(0, 3) });
    else if (inScripts(build.scripts, name).length) Object.assign(e, { category: "script", scripts: inScripts(build.scripts, name) });
    else e.category = "theme";
    if (e.read && !e.set && (e.category === "theme" || e.category === "fallback")) problems.push(`variable ${name} is read (${e.usedAt[0]}) but declared neither by the theme nor by Obsidian`);
    return e;
  });

  // A name in no app.css selector and not spelled out in the scripts may still be built by joining strings
  // (deps.generated): the joining code must be in the scripts, and with restInScripts the rest of the name
  // must be a word there too or be named by a runtime check (which saw it in the DOM of the measured build).
  const generatedBy = (name) => {
    for (const g of deps.generated ?? []) {
      const m = name.match(new RegExp(g.pattern));
      if (!m) continue;
      const evidence = build.scripts.filter((s) => s.text.includes(g.evidence)).map((s) => s.name);
      const rest = name.slice(m[0].length);
      const restOk = !g.restInScripts || inScripts(build.scripts, rest).length > 0 || runtimeSpec.some((t) => new RegExp(`\\.${name}(?![\\w-])`).test(t));
      return { pattern: g.pattern, why: g.why, evidence, ok: evidence.length > 0 && restOk };
    }
    return null;
  };
  const selectorNames = (by, appMap, kind) => [...by.keys()].sort().map((name) => {
    const e = { name, usedAt: [...new Set(by.get(name))].slice(0, 3), uses: new Set(by.get(name)).size };
    // Named by a runtime check: that check found it in the DOM of the measured build (the stronger evidence).
    if (kind === "class") e.runtimeChecked = runtimeSpec.some((t) => new RegExp(`\\.${name}(?![\\w-])`).test(t));
    if (appMap.has(name)) Object.assign(e, { category: "app.css", appCss: [...new Set(appMap.get(name))].slice(0, 3) });
    else {
      const s = inScripts(build.scripts, name);
      const g = s.length ? null : generatedBy(name);
      if (s.length) Object.assign(e, { category: "script", scripts: s });
      else if (g?.ok) Object.assign(e, { category: "generated", generated: { pattern: g.pattern, why: g.why, evidence: g.evidence } });
      else { e.category = "missing"; problems.push(`${kind} ${name} (${e.usedAt[0]}) is in no app.css selector and in none of the app's scripts${g ? ` (matches ${g.pattern}, but ${g.evidence.length ? "its rest is in no script and no runtime check" : "the joining code is gone"})` : ""}`); }
    }
    return e;
  });
  const classes = selectorNames(classBy, appClass, "class");
  const attributes = selectorNames(attrBy, appAttr, "attribute");

  // Cited rules: a rule matches when one of its selectors equals the cited selector; the cited declaration
  // must be in it (property, value containing `value` when given, !important when `important`).
  const rules = (deps.rules ?? []).map((c) => {
    const hits = app.decls.filter((d) => (c.absent ? d.selectors.some((s) => s.includes(norm(c.selector))) : d.selectors.includes(norm(c.selector))) && d.prop === c.property);
    const ok = hits.filter((d) => (c.value === undefined || d.value.includes(norm(c.value))) && (c.important === undefined || d.important === c.important));
    const e = { selector: c.selector, property: c.property, value: c.value, important: c.important, absent: !!c.absent, citedBy: c.citedBy, appCss: (c.absent ? hits : ok).map((d) => d.line) };
    if (c.absent) { e.holds = hits.length === 0; if (!e.holds) problems.push(`app.css now has ${c.selector} { ${c.property} } (line ${hits[0].line}), cited as absent by ${c.citedBy.join(", ")}`); }
    else {
      e.holds = ok.length > 0;
      if (!e.holds) problems.push(`app.css has no ${c.selector} { ${c.property}${c.value ? `: ${c.value}` : ""}${c.important ? " !important" : ""} }${hits.length ? ` (the property is there with another value: ${hits[0].value}, line ${hits[0].line})` : ""}; cited by ${c.citedBy.join(", ")}`);
    }
    return e;
  });

  const count = (list) => list.reduce((o, e) => ((o[e.category] = (o[e.category] ?? 0) + 1), o), {});
  return {
    obsidian: { version: build.version, appCssSha256: build.appCssSha256, appCssLines: (build.appCss.match(/\n/g) ?? []).length, mermaid: build.mermaid, scripts: build.scripts.map((s) => s.name) },
    summary: { variables: count(variables), classes: count(classes), attributes: count(attributes), rules: { cited: rules.length, holding: rules.filter((r) => r.holds).length } },
    problems,
    variables, classes, attributes, rules,
  };
}

// What an older inventory had from Obsidian and a newer one no longer has (a variable no longer declared, a
// class no longer in app.css or the scripts, a cited rule no longer found). Line moves are not losses.
const RANK = { obsidian: 2, fallback: 1, "app.css": 2, script: 1, generated: 1, theme: 0, missing: 0 };
export function lost(oldInv, newInv) {
  const out = [];
  for (const kind of ["variables", "classes", "attributes"]) {
    const now = new Map(newInv[kind].map((e) => [e.name, e]));
    for (const e of oldInv[kind]) {
      const n = now.get(e.name);
      if (n && RANK[n.category] < RANK[e.category]) out.push(`${{ variables: "variable", classes: "class", attributes: "attribute" }[kind]} ${e.name}: ${e.category} in ${oldInv.obsidian.version}, ${n.category} in ${newInv.obsidian.version}`);
    }
  }
  const key = (r) => `${r.selector}|${r.property}|${r.value}|${r.absent}`;
  const now = new Map(newInv.rules.map((r) => [key(r), r]));
  for (const r of oldInv.rules) if (r.holds && now.get(key(r))?.holds === false) out.push(`rule ${r.selector} { ${r.property} }: as cited in ${oldInv.obsidian.version}, no longer as cited in ${newInv.obsidian.version}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" }, against: { type: "string" } } });
  if (positionals.length !== 1) { console.error("usage: node tests/compat/inventory.mjs <obsidian.asar|.asar.gz> [--out file] [--against old.json]"); process.exit(2); }
  const deps = JSON.parse(readFileSync(path.join(import.meta.dirname, "dependencies.json"), "utf8"));
  const runtimeSpec = runtimeSpecFiles(path.join(repo, "tests/spec")).map((f) => readFileSync(f, "utf8"));
  const inv = inventory(buildFromAsar(positionals[0]), themeSources(), deps, runtimeSpec);
  const losses = values.against ? lost(JSON.parse(readFileSync(values.against, "utf8")), inv) : [];
  if (values.against) inv.lostSince = { against: values.against, lost: losses };
  if (values.out) writeFileSync(values.out, `${JSON.stringify(inv, null, 1)}\n`);
  console.log(`Obsidian ${inv.obsidian.version} (app.css sha256 ${inv.obsidian.appCssSha256.slice(0, 12)}, ${inv.obsidian.appCssLines} lines; Mermaid ${inv.obsidian.mermaid})`);
  for (const [k, v] of Object.entries(inv.summary)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  for (const p of inv.problems) console.log(`  PROBLEM ${p}`);
  for (const l of losses) console.log(`  LOST ${l}`);
  console.log(inv.problems.length || losses.length ? `${inv.problems.length} problems, ${losses.length} lost` : "no problems");
  process.exit(inv.problems.length || losses.length ? 1 : 0);
}

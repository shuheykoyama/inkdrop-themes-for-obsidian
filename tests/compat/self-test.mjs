// Negative tests of the compatibility inventory (tests/compat/inventory.mjs, step 11C): a dependency the build
// no longer provides (a variable, a class, a cited app.css rule, the code that builds a class) is a problem, a
// dependency an older build had and a newer one lost is reported, and the citations in dependencies.json still
// point at the comments and allowlist entries that make them. Node only (synthetic builds; no Obsidian); runs in CI.
//
// usage: node tests/compat/self-test.mjs
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildFromAsar, inventory, lost, readAsar, themeSources } from "./inventory.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
const tmp = mkdtempSync(path.join(os.tmpdir(), "ink-compat-self-"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} compat self-test: ${name}${ok || !detail ? "" : ` -- ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`}`); };

// A synthetic build and theme: the theme sets an Obsidian variable, reads another, uses an app.css class, a
// class only the scripts name, a generated class, and relies on two app.css rules (one by its absence).
const APP_CSS = `body {
  --background-primary: #000;
  --text-faint: #666;
}
.theme-dark { --background-secondary: #111; }
.nav-file-title { color: var(--text-faint); }
.is-translucent:not(.is-fullscreen) .workspace-ribbon.mod-primary,
.is-translucent:not(.is-fullscreen) .workspace-split {
  background-color: transparent !important;
}
.tree-item-self.is-active { color: red; }
`;
const SCRIPTS = [{ name: "app.js", text: 'el.addClass("view-action");var c=d.map(function(e){return"cm-"+e});t:"header"' }];
const build = (over = {}) => ({ version: "9.9.9", appCss: APP_CSS, appCssSha256: "x", mermaid: null, scripts: SCRIPTS, ...over });
const THEME = [{ file: "src/t.css", css: `.theme-dark {
  --background-primary: var(--ink-bg);
  --ink-bg: #123;
}
.theme-dark .nav-file-title { color: var(--text-faint); }
.theme-dark .view-action { color: red; }
.theme-dark .cm-header { color: red; }
` }];
const DEPS = {
  generated: [{ pattern: "^cm-", evidence: '"cm-"+e', restInScripts: true, why: "test" }],
  rules: [
    { selector: ".is-translucent:not(.is-fullscreen) .workspace-ribbon.mod-primary", property: "background-color", value: "transparent", important: true, citedBy: ["src/t.css:1"] },
    { selector: ".tree-item-self.is-active", property: "box-shadow", absent: true, citedBy: ["src/t.css:2"] },
  ],
};
const inv = (b = build(), t = THEME, d = DEPS, rt = []) => inventory(b, t, d, rt);
const cat = (i, kind, name) => i[kind].find((e) => e.name === name)?.category;
const has = (i, re) => i.problems.some((p) => re.test(p));

// ---------- 1. the inventory of a build that has everything ----------
{
  const i = inv();
  check("a build with every dependency has no problem", i.problems.length === 0, i.problems);
  check("an Obsidian variable is categorised with its app.css line", cat(i, "variables", "--background-primary") === "obsidian" && i.variables.find((e) => e.name === "--background-primary").appCss[0] === 2);
  check("the theme's own variable is categorised as theme", cat(i, "variables", "--ink-bg") === "theme");
  check("a class in an app.css selector / only in the scripts / built by joining", cat(i, "classes", "nav-file-title") === "app.css" && cat(i, "classes", "view-action") === "script" && cat(i, "classes", "cm-header") === "generated");
  check("a cited rule is found with its declaration line; an absent one holds", i.rules[0].holds && i.rules[0].appCss[0] === 9 && i.rules[1].holds);
}

// ---------- 2. a build that lost something ----------
{
  const noVar = build({ appCss: APP_CSS.replace("--text-faint: #666;", "") });
  check("a variable the theme reads and nobody declares is a problem", has(inv(noVar), /--text-faint is read .* declared neither/));
  const noClass = build({ appCss: APP_CSS.replace(".nav-file-title { color: var(--text-faint); }", "") });
  check("a class in no app.css selector and no script is a problem", has(inv(noClass), /class nav-file-title .* in none of the app's scripts/));
  check("a class the scripts no longer name is a problem", has(inv(build({ scripts: [{ name: "app.js", text: 'return"cm-"+e;"header"' }] })), /class view-action/));
  check("a generated class whose joining code is gone is a problem", has(inv(build({ scripts: [{ name: "app.js", text: '"view-action";"header"' }] })), /cm-header .* joining code is gone/));
  const noRest = build({ scripts: [{ name: "app.js", text: '"view-action";return"cm-"+e' }] });
  check("a generated class whose rest is in no script and no runtime check is a problem", has(inv(noRest), /cm-header .* its rest is in no script/));
  check("... but is accepted when a runtime check names it", !has(inv(noRest, THEME, DEPS, ['{"selector": ".markdown-source-view .cm-header"}']), /cm-header/));
  check("a cited rule whose value changed is a problem (and shows the new value)", has(inv(build({ appCss: APP_CSS.replace("transparent !important", "red !important") })), /workspace-ribbon\.mod-primary .* another value: red/));
  check("a cited rule that lost its !important is a problem", has(inv(build({ appCss: APP_CSS.replace("transparent !important", "transparent") })), /workspace-ribbon\.mod-primary \{ background-color: transparent !important \}/));
  check("a cited rule whose selector is gone is a problem", has(inv(build({ appCss: APP_CSS.replace(".is-translucent:not(.is-fullscreen) .workspace-ribbon.mod-primary,\n", "") })), /app\.css has no .*workspace-ribbon/));
  check("a rule cited as absent that now exists is a problem", has(inv(build({ appCss: `${APP_CSS}.workspace .tree-item-self.is-active:hover { box-shadow: none; }\n` })), /now has \.tree-item-self\.is-active \{ box-shadow \}/));
}

// ---------- 3. what a newer build lost against an older inventory ----------
{
  const old = inv();
  check("the same build loses nothing", lost(old, inv()).length === 0);
  check("moved lines are not losses", lost(old, inv(build({ appCss: `/* moved */\n\n${APP_CSS}` }))).length === 0);
  const newer = inv(build({ version: "9.9.10", appCss: APP_CSS.replace("--background-primary: #000;", "") }));
  check("a variable the theme sets that Obsidian no longer declares is lost", lost(old, newer).some((l) => /--background-primary: obsidian in 9\.9\.9, theme in 9\.9\.10/.test(l)));
  const classGone = inv(build({ version: "9.9.10", appCss: APP_CSS.replace(".nav-file-title { color: var(--text-faint); }", "") }));
  check("a class Obsidian no longer has is lost", lost(old, classGone).some((l) => /^class nav-file-title: app\.css in 9\.9\.9, missing in 9\.9\.10/.test(l)));
  const ruleGone =inv(build({ appCss: APP_CSS.replace("transparent !important", "red !important") }));
  check("a cited rule no longer as cited is lost", lost(old, ruleGone).some((l) => /rule .*workspace-ribbon/.test(l)));
}

// ---------- 4. reading a build ----------
{
  // A minimal asar: header pickle size at 4, JSON length at 12, JSON at 16, files after 8 + pickle size.
  const files = { "app.css": APP_CSS, "package.json": '{"version":"9.9.9"}', "app.js": SCRIPTS[0].text, "lib/mermaid.min.js": 'x={version:"11.13.0"}' };
  let offset = 0;
  const tree = { files: {} };
  for (const [name, text] of Object.entries(files)) {
    let node = tree;
    const parts = name.split("/");
    for (const p of parts.slice(0, -1)) node = (node.files[p] ??= { files: {} });
    node.files[parts.at(-1)] = { size: Buffer.byteLength(text), offset: String(offset) };
    offset += Buffer.byteLength(text);
  }
  const json = Buffer.from(JSON.stringify(tree));
  const head = Buffer.alloc(16);
  const pad = (4 - (json.length % 4)) % 4;
  head.writeUInt32LE(4, 0); head.writeUInt32LE(8 + json.length + pad, 4); head.writeUInt32LE(4 + json.length + pad, 8); head.writeUInt32LE(json.length, 12);
  const asar = Buffer.concat([head, json, Buffer.alloc(pad), ...Object.values(files).map((t) => Buffer.from(t))]);
  writeFileSync(path.join(tmp, "a.asar"), asar);
  writeFileSync(path.join(tmp, "a.asar.gz"), gzipSync(asar));
  check("an asar is read file by file", readAsar(path.join(tmp, "a.asar")).get("app.css").toString() === APP_CSS);
  const b = buildFromAsar(path.join(tmp, "a.asar.gz"));
  check("a gzipped asar gives app.css, the version, the scripts and Mermaid's version", b.appCss === APP_CSS && b.version === "9.9.9" && b.scripts.map((s) => s.name).join() === "app.js,lib/mermaid.min.js" && b.mermaid === "11.13.0");
}

// ---------- 5. the citations of dependencies.json ----------
{
  const deps = JSON.parse(readFileSync(path.join(repo, "tests/compat/dependencies.json"), "utf8"));
  const allow = JSON.parse(readFileSync(path.join(repo, "tests/static/lint-allowlist.json"), "utf8")).warnings;
  const bad = [];
  for (const r of deps.rules) for (const c of r.citedBy) {
    if (c === "tests/static/lint-allowlist.json") { if (!allow.some((w) => w.overrides?.includes(r.selector))) bad.push(`${c}: no overrides naming ${r.selector}`); continue; }
    const [file, line] = c.split(":");
    const text = readFileSync(path.join(repo, file), "utf8").split("\n")[Number(line) - 1] ?? "";
    if (!text.includes("app.css")) bad.push(`${c} does not mention app.css: ${text.trim().slice(0, 80)}`);
  }
  check("every citedBy points at a comment line naming app.css or an allowlist override naming the selector", bad.length === 0, bad);
  check("the theme sources are read (both palettes, the common layers, both entries)", themeSources().length >= 20);
}

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} of ${results.length} compat self-test cases FAILED` : `\nall ${results.length} compat self-test cases behaved as expected`);
process.exit(failed ? 1 : 0);

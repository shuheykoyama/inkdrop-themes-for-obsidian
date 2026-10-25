// Self-test of step 11G G7 (research/14 §6.125) without Inkdrop: the chunk finder of V-31 (inkdrop-chunks.mjs) on
// a synthetic bundle, the completeness rules of the measurement (g7-rules.mjs), and g7-c-run.sh with stand-ins for
// the production script and g6-run.mjs (the note is deleted and the config restored on every way out).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LANGUAGES, locate } from "./inkdrop-chunks.mjs";
import { blocks, coverage, judgeBlocks, noteDoc, NOTE_TITLE } from "./g7-rules.mjs";

const repo = path.resolve(import.meta.dirname, "..", "..");
let fails = 0, n = 0;
const ok = (name, cond, extra = "") => { n++; if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} g7 self-test: ${name}${!cond && extra ? ` -- ${extra}` : ""}`); };
const throws = (name, f, re) => { try { f(); ok(name, false, "did not throw"); } catch (e) { ok(name, re.test(e.message), e.message); } };

// ---------- locate: a minimal bundle with the features of 6.1.5 / 6.2.0 ----------
const lezer = "for(let e in X){let t=X[e];t instanceof Q&&(t.name=e)}M([{tag:X.link,class:`tok-link`}]);function P(e,t,n,r=0,i=e.length){let a=new F(r,Array.isArray(t)?t:[t],n);a.highlightRange(e.cursor(),r,i,``,a.highlighters),a.flush(i)}var S=class e extends Z{constructor(e){let t=1;super(t),this.streamParser=e}};export{X as R,P as F,M as L,S as f};";
const entry = (name, body) => `C.of({name:\`${name}\`,${body}}}),`;
const load = (file, then) => `load(){return l(()=>import(\`./${file}\`)${then},__vite__mapDeps([1]),import.meta.url)`;
const langData = (over = {}) => {
  const d = {
    JavaScript: entry("JavaScript", `alias:[\`ecmascript\`,\`js\`,\`node\`],extensions:[\`js\`],${load("dist-js.js", ".then(e=>e.t).then(e=>e.javascript())")}`),
    TypeScript: entry("TypeScript", `alias:[\`ts\`],${load("dist-js.js", ".then(e=>e.t).then(e=>e.javascript({typescript:!0}))")}`),
    Shell: entry("Shell", `alias:[\`bash\`],${load("shell-x.js", ".then(e=>G(e.shell))")}`),
    SQL: entry("SQL", "extensions:[`sql`],load(){return yp(`StandardSQL`)"),
  };
  for (const name of Object.values(LANGUAGES)) d[name] ??= entry(name, load(`dist-${name.toLowerCase()}.js`, `.then(e=>e.${name.toLowerCase()}())`));
  return Object.values({ ...d, ...over }).join("") + "function yp(e){return l(()=>import(`./dist-sql.js`).then(t=>t.sql({dialect:t[e]})),__vite__mapDeps([2]),import.meta.url)}";
};
const app = (tbl = "Xd=re([{tag:b.comment,class:`tok-comment`},{tag:b.special(b.string),class:`tok-string2`}])", data = langData()) =>
  `import{R as b,L as re}from"./dist-lz.js";${tbl};${data}`;
const bundle = (o = {}) => ({ "dist-lz.js": lezer, "app.js": app(), ...o });

const got = locate(bundle());
ok("locate: lezer exports by feature", JSON.stringify(got.lezer) === JSON.stringify({ file: "dist-lz.js", tags: "R", highlightTree: "F", tagHighlighter: "L", StreamLanguage: "f" }), JSON.stringify(got.lezer));
ok("locate: Inkdrop's table and its entries", got.table.file === "app.js" && got.table.alias === "b" && got.table.entries.length === 2 && got.table.entries[1][0] === "b.special(b.string)");
ok("locate: namespace, function and arguments", JSON.stringify(got.languages.ts) === JSON.stringify({ file: "dist-js.js", ns: "t", fn: "javascript", args: { typescript: true } }), JSON.stringify(got.languages.ts));
ok("locate: legacy mode", JSON.stringify(got.languages.sh) === JSON.stringify({ file: "shell-x.js", legacy: "shell" }));
ok("locate: SQL through its loader function", JSON.stringify(got.languages.sql) === JSON.stringify({ file: "dist-sql.js", dialect: "StandardSQL" }));
ok("locate: aliases follow V-31", got.languages.zsh === got.languages.sh && got.languages.md === got.languages.markdown);
ok("locate: no notes without extra entries", got.notes.length === 0);
const md = locate(bundle({ "app.js": app(undefined, langData() + "r=C.of({name:`Markdown`,alias:[`md`],load:()=>Promise.resolve(Qe({}))});") }));
ok("locate: an entry that loads no chunk is reported, the loading one used", md.notes.length === 1 && md.languages.markdown.file === "dist-markdown.js");
throws("locate: two token tables stop the run", () => locate(bundle({ "other.js": `import{R as b,L as re}from"./dist-lz.js";Yd=re([{tag:b.comment,class:\`tok-comment\`}])` })), /Inkdrop's token table: 2 candidates/);
throws("locate: no lezer chunk stops the run", () => locate({ "app.js": app() }), /lezer: tag naming loop: 0 candidates/);
throws("locate: two lezer chunks stop the run", () => locate(bundle({ "dist-lz2.js": lezer })), /lezer: tag naming loop: 2 candidates/);
throws("locate: a table built with another function stops the run", () => locate(bundle({ "app.js": app("Xd=zz([{tag:b.comment,class:`tok-comment`}])") })), /does not use the lezer chunk/);
throws("locate: an unexported StreamLanguage stops the run", () => locate(bundle({ "dist-lz.js": lezer.replace(",S as f", "") })), /StreamLanguage \(S\) is not exported/);
throws("locate: two loading entries of one language stop the run", () => locate(bundle({ "app.js": app(undefined, langData() + entry("Python", load("dist-py2.js", ".then(e=>e.python())"))) })), /language-data: Python: 2 candidates/);
throws("locate: unknown arguments stop the run", () => locate(bundle({ "app.js": app(undefined, langData({ TypeScript: entry("TypeScript", load("dist-js.js", ".then(e=>e.t).then(e=>e.javascript({jsx:!0}))")) })) })), /arguments \{jsx:!0\} not understood/);
throws("locate: a load that is not understood stops the run", () => locate(bundle({ "app.js": app(undefined, langData({ Go: entry("Go", "load(){return somethingElse()") })) })), /Go: load not understood/);

// ---------- g7-rules ----------
const note = readFileSync(path.join(repo, "tests/fixtures/vault/Code blocks.md"), "utf8");
const bs = blocks(note);
const fixture = JSON.parse(readFileSync(path.join(repo, "tests/fixtures/inkdrop-tokens.json"), "utf8"));
ok("blocks: the 21 blocks of V-31, same languages and code", bs.length === 21 && bs.every((b, i) => b.lang === fixture[i].lang && b.code === fixture[i].code));
ok("blocks: start is the body offset of each block's code", bs.every((b) => note.slice(b.start, b.start + b.code.length) === b.code));
// A perfect measurement: one range per line of each block (all characters, newlines excluded), with a colour.
const perfect = (b) => ({ index: 0, lang: b.lang, text: b.code, ranges: b.code.split("\n").reduce((acc, line) => { const from = acc.at; acc.at += line.length + 1; if (line.length) acc.r.push({ from, to: from + line.length, color: "rgb(1, 2, 3)" }); return acc; }, { at: 0, r: [] }).r });
const all = { blocks: bs.map(perfect) };
ok("judgeBlocks: a full measurement is COMPLETE", judgeBlocks(bs, all).state === "COMPLETE", JSON.stringify(judgeBlocks(bs, all).problems));
const cut = structuredClone(all); cut.blocks[3].ranges[0].from += 1;
ok("judgeBlocks: a character not measured is INCOMPLETE", judgeBlocks(bs, cut).state === "INCOMPLETE" && /block 3 \(css\): 1 characters not measured/.test(judgeBlocks(bs, cut).problems.join()));
const twice = structuredClone(all); twice.blocks[0].ranges.push({ from: 0, to: 2, color: "rgb(0, 0, 0)" });
ok("judgeBlocks: a character measured twice is INCOMPLETE", /measured twice/.test(judgeBlocks(bs, twice).problems.join()));
const less = { blocks: all.blocks.slice(0, 20) };
ok("judgeBlocks: a missing block is INCOMPLETE", /20 blocks measured, 21 expected/.test(judgeBlocks(bs, less).problems.join()) && /block 20 .*not measured/.test(judgeBlocks(bs, less).problems.join()));
const text = structuredClone(all); text.blocks[5].text = "x";
ok("judgeBlocks: a block whose text differs is INCOMPLETE", /block 5 \(json\): the shown text differs/.test(judgeBlocks(bs, text).problems.join()));
const err = structuredClone(all); err.blocks[2] = { index: 2, lang: "python", error: "not shown or the highlighting did not settle" };
ok("judgeBlocks: a block that did not settle is INCOMPLETE", /block 2 \(python\): not shown/.test(judgeBlocks(bs, err).problems.join()));
const nocol = structuredClone(all); delete nocol.blocks[1].ranges[0].color;
ok("judgeBlocks: a range without a colour is INCOMPLETE", /without a computed colour/.test(judgeBlocks(bs, nocol).problems.join()));
ok("judgeBlocks: no result is INCOMPLETE", judgeBlocks(bs, null).state === "INCOMPLETE");
ok("coverage: a range outside the block is counted", coverage("ab", [{ from: 0, to: 3 }]).outside === 1);
const d = noteDoc({ id: "note:x", bookId: "book:y", body: "b", now: 5 });
ok("noteDoc: inkdrop-model's required fields", ["_id", "bookId", "title", "doctype", "body", "updatedAt", "createdAt", "timestamp"].every((k) => k in d) && d.title === NOTE_TITLE && d.doctype === "markdown");

// ---------- g7-c-run.sh with stand-ins ----------
const tmp = mkdtempSync(path.join(tmpdir(), "g7-self-"));
const prod = path.join(tmp, "prod.sh"), runner = path.join(tmp, "run.sh");
// The production script: prepare makes the confirmed backup; restore says RESTORED unless G7T_RESTORE=fail.
writeFileSync(prod, `#!/usr/bin/env bash
w="$2"; echo "prod $1" >> "$w/calls.log"
case "$1" in prepare) mkdir -p "$w/private/backup"; touch "$w/private/backup/config.sha256";;
restore) [ "\${G7T_RESTORE:-ok}" = fail ] && { echo "RESTORE NOT CONFIRMED"; exit 5; }; echo "RESTORED: config.json as before";; esac
exit 0
`);
// g6-run.mjs: note-create records the note (and fails after recording when G7T_CREATE=fail); syntax exits with
// G7T_SYNTAX_<theme>; note-remove prints G7T_REMOVE (default REMOVED) once, then REMOVED.
writeFileSync(runner, `#!/usr/bin/env bash
w="$2"; echo "run $1 \${6:-}" >> "$w/calls.log"
case "$1" in
isolation) exit 0;;
note-create) mkdir -p "$w/private"; echo '{"id":"note:t"}' > "$w/private/g7-note.json"; [ "\${G7T_CREATE:-ok}" = fail ] && exit 1; echo "NOTE CREATED"; exit 0;;
syntax) v="G7T_SYNTAX_\${6//-/_}"; exit "\${!v:-0}";;
note-remove) if [ -f "$w/removed-once" ] || [ -z "\${G7T_REMOVE:-}" ]; then echo REMOVED; exit 0; fi; touch "$w/removed-once"; echo "$G7T_REMOVE"; [ "$G7T_REMOVE" = ABSENT ] && exit 0; exit 1;;
esac
`);
chmodSync(prod, 0o755); chmodSync(runner, 0o755);
let k = 0;
const crun = (env = {}) => {
  const work = path.join(tmp, `w${++k}`), out = path.join(tmp, `o${k}`);
  const r = spawnSync("bash", [path.join(repo, "tests/visual/g7-c-run.sh"), work, out, tmp], { cwd: repo, encoding: "utf8", env: { ...process.env, G6_TEST_PROD: prod, G6_TEST_RUN: runner, ...env } });
  return { code: r.status, out: r.stdout + r.stderr, calls: existsSync(path.join(work, "calls.log")) ? readFileSync(path.join(work, "calls.log"), "utf8") : "" };
};
let r = crun();
ok("c-run: all steps -> exit 0, COMPLETE, REMOVED, RESTORED", r.code === 0 && /MEASURE: COMPLETE/.test(r.out) && /NOTE: REMOVED/.test(r.out) && /RESTORE: RESTORED/.test(r.out), r.out);
ok("c-run: order prepare, start, check, create, SD, KD, remove, restore", r.calls.trim().split("\n").map((l) => l.trim()).join("|") === "prod prepare|prod start|run isolation|run note-create|run syntax solarized-dark|run syntax kanagawa-dragon|run note-remove|prod restore", r.calls);
r = crun({ G7T_SYNTAX_kanagawa_dragon: "1" });
ok("c-run: a stopped measurement still deletes the note and restores (exit 1)", r.code === 1 && /stopped at syntax kanagawa-dragon/.test(r.out) && /NOTE: REMOVED/.test(r.out) && /RESTORE: RESTORED/.test(r.out) && /run note-remove/.test(r.calls), r.out);
r = crun({ G7T_SYNTAX_solarized_dark: "5" });
ok("c-run: an INCOMPLETE view goes on, is not COMPLETE (exit 1), note deleted", r.code === 1 && /MEASURE: INCOMPLETE: solarized-dark/.test(r.out) && /run syntax kanagawa-dragon/.test(r.calls) && /NOTE: REMOVED/.test(r.out), r.out);
r = crun({ G7T_CREATE: "fail" });
ok("c-run: a failed create after the record is cleaned up (exit 1)", r.code === 1 && /stopped at note-create/.test(r.out) && /run note-remove/.test(r.calls) && /NOTE: REMOVED/.test(r.out) && !/run syntax/.test(r.calls), r.out);
r = crun({ G7T_REMOVE: "NOT REMOVED: still found after remove" });
ok("c-run: a failed delete is tried once more by the clean-up", r.code === 0 && (r.calls.match(/run note-remove/g) || []).length === 2 && /NOTE: REMOVED/.test(r.out), r.out);
r = crun({ G7T_REMOVE: "ABSENT" });
ok("c-run: an ABSENT note is not COMPLETE success (exit 1)", r.code === 1 && /NOTE: ABSENT/.test(r.out), r.out);
r = crun({ G7T_RESTORE: "fail" });
ok("c-run: a restore not confirmed fails the run (exit 1)", r.code === 1 && /RESTORE: NOT CONFIRMED/.test(r.out), r.out);
const work = path.join(tmp, "exists"); spawnSync("mkdir", [work]);
const e = spawnSync("bash", [path.join(repo, "tests/visual/g7-c-run.sh"), work, path.join(tmp, "ox"), tmp], { cwd: repo, encoding: "utf8", env: { ...process.env, G6_TEST_PROD: prod, G6_TEST_RUN: runner } });
ok("c-run: an existing <work> is refused before anything runs", e.status === 1 && /REFUSED: <work> already exists/.test(e.stdout) && !existsSync(path.join(work, "calls.log")));
rmSync(tmp, { recursive: true, force: true });

console.log(`\n${fails ? `${fails} of ${n}` : `all ${n}`} g7 self-test cases ${fails ? "FAILED" : "behaved as expected"}`);
process.exit(fails ? 1 : 0);

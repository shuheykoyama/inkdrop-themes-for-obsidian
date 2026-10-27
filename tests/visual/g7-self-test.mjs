// Self-test of step 11G G7 (research/14 §6.125) without Inkdrop: the chunk finder of V-31 (inkdrop-chunks.mjs) on
// a synthetic bundle, the completeness rules of the measurement (g7-rules.mjs), and g7-c-run.sh with stand-ins for
// the production script and g6-run.mjs (the note is deleted and the config restored on every way out).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LANGUAGES, locate } from "./inkdrop-chunks.mjs";
import { blocks, coverage, judgeBlocks, noteDoc, NOTE_TITLE, removeNote, requireFocus } from "./g7-rules.mjs";
import { shoot } from "./g6-shot.mjs";
import { alignRows, classify, normClasses, parseCsv, placeMisses } from "./g7-reclassify.mjs";

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

// ---------- g7-measure.js: the preview code-block selector on Inkdrop 6.2.0's markup ----------
// A minimal matcher for compound selectors (tag and .class) joined by " " or ">", enough for the selectors here.
const el = (tag, cls = "", ...children) => ({ tag, cls: cls.split(" ").filter(Boolean), children });
const matches = (node, ancestors, sel) => {
  const parts = sel.trim().split(/\s*(>)\s*|\s+/).filter(Boolean);
  const fits = (n, c) => { const [tag, ...cls] = c.split("."); return (!tag || n.tag === tag) && cls.every((k) => n.cls.includes(k)); };
  // Right to left: the last compound is the node itself; each earlier one an ancestor (">" = the direct parent).
  let i = parts.length - 1, a = ancestors.length;
  if (!fits(node, parts[i--])) return false;
  while (i >= 0) {
    const child = parts[i] === ">"; if (child) i--;
    if (child) { if (!a || !fits(ancestors[--a], parts[i])) return false; }
    else { do { a--; } while (a >= 0 && !fits(ancestors[a], parts[i])); if (a < 0) return false; }
    i--;
  }
  return true;
};
const select = (root, sel, up = []) => [...(matches(root, up, sel) ? [root] : []), ...root.children.flatMap((c) => select(c, sel, [...up, root]))];
const block = (lang, lines) => el("div", `codeblock lang-${lang}`, el("pre", "", el("button", "code-copy-button"),
  el("div", `mde-preview-code${lines ? " with-line-numbers" : ""}`, ...(lines ? [el("code", "mde-preview-code-line-number", el("div", "tok-number"))] : []), el("code", "mde-preview-code-body", el("span", "tok-keyword")))));
const page = el("div", "mde-preview", block("js", false), el("p"), block("ts", true));
const sel = readFileSync(path.join(repo, "tests/visual/g7-measure.js"), "utf8").match(/const codes = \(\) => \[\.\.\.document\.querySelectorAll\("([^"]+)"\)\]/)?.[1];
const found = sel ? select(page, sel) : [];
ok("measure: the preview selector finds each code body, not the line numbers", found.length === 2 && found.every((n) => n.cls.includes("mde-preview-code-body")), `${sel}: ${found.length}`);
ok("measure: the old selector (pre > code) finds none on this markup", select(page, ".mde-preview pre > code").length === 0);

// ---------- g7-reclassify: placing recorded runs and classifying groups ----------
ok("reclassify: CSV with quoted fields", JSON.stringify(parseCsv('a,b\njs,"""fs""",","')) === JSON.stringify([["a", "b"], ["js", '"fs"', ","]]));
const rowsAt = alignRows("let x = 1;\n  y", [{ text: "let" }, { text: "x" }, { text: "= 1;" }, { text: "y" }]);
ok("reclassify: table rows placed in order across whitespace", rowsAt.map((r) => r.from).join() === "0,4,6,13");
throws("reclassify: a row not next in the code stops", () => alignRows("ab cd", [{ text: "cd" }, { text: "ab" }]), /not found/);
ok("reclassify: Obsidian classes as the table writes them", normClasses("cm-hmd-codeblock") === "-" && normClasses("token.keyword < token.module") === "keyword module" && normClasses("(bare text)") === "-");
const code = "a { b } { c }";
const inkCls = [...code].map((ch) => ("{}".includes(ch) ? "tok-brace" : ""));
const obsCls = [...code].map((ch, i) => (i < 7 ? "-" : "punctuation"));
const at2 = placeMisses(code, [{ text: "{", inkdrop: "tok-brace", obsidian: "punctuation" }], inkCls, obsCls);
ok("reclassify: a run is placed where its text and both classes match, not at the first equal text", at2.indexOf(0) === 8 && at2.filter((x) => x === 0).length === 1);
throws("reclassify: a run that fits nowhere stops", () => placeMisses(code, [{ text: "{", inkdrop: "tok-paren", obsidian: "-" }], inkCls, obsCls), /not placed/);
const inks = (o) => new Map(Object.entries(o));
ok("reclassify: EXACT / MISMATCH / CONFLICT / DOMINATED / MIXED",
  classify(["rgb(1, 2, 3)"], inks({ "rgb(1, 2, 3)": 4 })) === "EXACT" && classify(["rgb(1, 2, 3)"], inks({ "rgb(9, 9, 9)": 4 })) === "MISMATCH" &&
  classify(["rgb(1, 2, 3)"], inks({ "rgb(1, 2, 3)": 1, "rgb(9, 9, 9)": 4 })) === "CONFLICT" && classify(["rgb(1, 2, 3)"], inks({ "rgb(8, 8, 8)": 1, "rgb(9, 9, 9)": 4 })) === "DOMINATED" &&
  classify(["rgb(1, 2, 3)", "rgb(9, 9, 9)"], inks({ "rgb(1, 2, 3)": 1 })) === "MIXED");
ok("reclassify: an alpha difference is a different colour", classify(["rgba(197, 201, 197, 0.9)"], inks({ "rgb(197, 201, 197)": 3 })) === "MISMATCH");

// ---------- g7-rules ----------
const note = readFileSync(path.join(repo, "tests/fixtures/vault/Code blocks.md"), "utf8");
const bs = blocks(note);
const fixture = JSON.parse(readFileSync(path.join(repo, "tests/fixtures/inkdrop-tokens.json"), "utf8"));
ok("blocks: the 21 blocks of V-31, same languages and code", bs.length === 21 && bs.every((b, i) => b.lang === fixture[i].lang && b.code === fixture[i].code));
ok("blocks: start is the body offset of each block's code", bs.every((b) => note.slice(b.start, b.start + b.code.length) === b.code));
// A perfect measurement: one range per line of each block (all characters, newlines excluded), with its text and a
// colour, in the expected theme and view, the note unchanged before and after.
const perfect = (b, i) => ({ index: i, lang: b.lang, text: b.code, ranges: b.code.split("\n").reduce((acc, line) => { const from = acc.at; acc.at += line.length + 1; if (line.length) acc.r.push({ from, to: from + line.length, text: line, color: "rgb(1, 2, 3)" }); return acc; }, { at: 0, r: [] }).r });
const st = { theme: "solarized-dark", noteShown: true, titleSame: true, bodySame: true, shownBodySame: true };
const all = { mode: "editor", theme: "solarized-dark", stateBefore: st, stateAfter: st, blocks: bs.map(perfect) };
const EX = { theme: "solarized-dark", view: "editor" };
const probs = (g, ex = EX) => judgeBlocks(bs, g, ex).problems.join("; ");
ok("judgeBlocks: a full measurement is COMPLETE", judgeBlocks(bs, all, EX).state === "COMPLETE", probs(all));
const cut = structuredClone(all); cut.blocks[3].ranges[0].from += 1; cut.blocks[3].ranges[0].text = cut.blocks[3].ranges[0].text.slice(1);
ok("judgeBlocks: a character not measured is INCOMPLETE", judgeBlocks(bs, cut, EX).state === "INCOMPLETE" && /block 3 \(css\): 1 characters not measured/.test(probs(cut)), probs(cut));
const twice = structuredClone(all); twice.blocks[0].ranges.push({ from: 0, to: 2, text: bs[0].code.slice(0, 2), color: "rgb(0, 0, 0)" });
ok("judgeBlocks: a character measured twice is INCOMPLETE", /measured twice/.test(probs(twice)));
const less = { ...all, blocks: all.blocks.slice(0, 20) };
ok("judgeBlocks: a missing block is INCOMPLETE", /20 blocks measured, 21 expected/.test(probs(less)) && /block 20 .*not measured/.test(probs(less)));
const text = structuredClone(all); text.blocks[5].text = "x";
ok("judgeBlocks: a block whose text differs is INCOMPLETE", /block 5 \(json\): the shown text differs/.test(probs(text)));
const err = structuredClone(all); err.blocks[2] = { index: 2, lang: "python", error: "not shown or the highlighting did not settle" };
ok("judgeBlocks: a block that did not settle is INCOMPLETE", /block 2 \(python\): not shown/.test(probs(err)));
const nocol = structuredClone(all); delete nocol.blocks[1].ranges[0].color;
ok("judgeBlocks: a range without a colour is INCOMPLETE", /without a computed colour/.test(probs(nocol)));
ok("judgeBlocks: no result is INCOMPLETE", judgeBlocks(bs, null, EX).state === "INCOMPLETE");
// Review of c77d7b5 (research/14 §6.127): the measured characters, the block identity, the theme, view and note state.
const wrongText = structuredClone(all); wrongText.blocks[0].ranges[0].text = "X" + wrongText.blocks[0].ranges[0].text.slice(1);
ok("judgeBlocks: right positions but other text is INCOMPLETE", judgeBlocks(bs, wrongText, EX).state === "INCOMPLETE" && /block 0 \(js\): 1 ranges whose text is not the block's text/.test(probs(wrongText)), probs(wrongText));
const swapped = structuredClone(all); [swapped.blocks[7], swapped.blocks[8]] = [swapped.blocks[8], swapped.blocks[7]];
ok("judgeBlocks: a block result of another index is INCOMPLETE", /block 7 \(go\): the result is of block 8 \(rust\)/.test(probs(swapped)), probs(swapped));
const lang = structuredClone(all); lang.blocks[4].lang = "xml";
ok("judgeBlocks: a block result of another language is INCOMPLETE", /block 4 \(html\): the result is of block 4 \(xml\)/.test(probs(lang)));
ok("judgeBlocks: another measured view is INCOMPLETE", /measured the editor view, not the preview/.test(probs(all, { theme: "solarized-dark", view: "preview" })));
ok("judgeBlocks: another measured theme is INCOMPLETE", /measured theme solarized-dark, not kanagawa-dragon/.test(probs(all, { theme: "kanagawa-dragon", view: "editor" })) && /theme before the measurement: solarized-dark/.test(probs(all, { theme: "kanagawa-dragon", view: "editor" })));
const themeAfter = structuredClone(all); themeAfter.stateAfter.theme = "default-dark";
ok("judgeBlocks: a theme changed during the measurement is INCOMPLETE", /theme after the measurement: default-dark/.test(probs(themeAfter)));
const prev = { ...structuredClone(all), mode: "preview" }; prev.stateBefore.shownBodySame = null; prev.stateAfter.shownBodySame = null;
const PX = { theme: "solarized-dark", view: "preview" };
ok("judgeBlocks: the preview without a document is judged on the note's own body", judgeBlocks(bs, prev, PX).state === "COMPLETE", probs(prev, PX));
const prevChanged = structuredClone(prev); prevChanged.stateAfter.bodySame = false;
ok("judgeBlocks: a preview whose note body changed is INCOMPLETE", /after the measurement the note's title or body was not the one created/.test(probs(prevChanged, PX)));
const prevUnknown = structuredClone(prev); prevUnknown.stateBefore.bodySame = null;
ok("judgeBlocks: a preview whose note could not be read is INCOMPLETE", /before the measurement the note's title or body was not the one created \(or could not be read\)/.test(probs(prevUnknown, PX)));
const noState = structuredClone(prev); delete noState.stateAfter;
ok("judgeBlocks: a missing state is INCOMPLETE", /no state after the measurement/.test(probs(noState, PX)));
const otherNote = structuredClone(all); otherNote.stateBefore.noteShown = false;
ok("judgeBlocks: another note shown is INCOMPLETE", /before the measurement another note \(or none\) was shown/.test(probs(otherNote)));
const editorDoc = structuredClone(all); editorDoc.stateAfter.shownBodySame = false;
ok("judgeBlocks: an editor not showing the note's body is INCOMPLETE", /after the measurement the editor did not show the note's body/.test(probs(editorDoc)));

// removeNote with a stand-in for inkdrop.localDB.notes (errors shaped as Inkdrop 6.2.0 gives them across IPC).
const nf = () => Object.assign(new Error("missing"), { name: "not_found", status: 404, reason: "missing" });
const dbErr = () => Object.assign(new Error("database is closed"), { name: "Error" });
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const REC = { id: "note:g7", title: NOTE_TITLE, bodySha256: sha256(note) };
const fakeDb = ({ get, remove = async () => ({ ok: true }) }) => { const calls = []; return { calls, get: async (id) => { calls.push("get"); return get(calls.filter((c) => c === "get").length, id); }, remove: async (id) => { calls.push("remove"); return remove(id); } }; };
const doc = { _id: "note:g7", title: NOTE_TITLE, body: note };
let db = fakeDb({ get: (k) => { if (k === 1) return doc; throw nf(); } });
let rm = await removeNote(db, REC);
ok("removeNote: the created note is deleted and confirmed gone -> REMOVED", rm.state === "REMOVED" && db.calls.join() === "get,remove,get", JSON.stringify(rm));
db = fakeDb({ get: () => { throw nf(); } });
rm = await removeNote(db, REC);
ok("removeNote: Inkdrop's not-found error before the delete -> ABSENT", rm.state === "ABSENT" && !db.calls.includes("remove"));
db = fakeDb({ get: () => { throw dbErr(); } });
rm = await removeNote(db, REC);
ok("removeNote: another database error on the first read is not ABSENT", rm.state === "NOT REMOVED" && /could not be read \(Error: database is closed\)/.test(rm.why) && !db.calls.includes("remove"), JSON.stringify(rm));
db = fakeDb({ get: () => { throw Object.assign(new Error("missing"), { name: "not_found" }); } });
rm = await removeNote(db, REC);
ok("removeNote: not_found without status 404 is not ABSENT", rm.state === "NOT REMOVED");
db = fakeDb({ get: (k) => { if (k === 1) return doc; throw dbErr(); } });
rm = await removeNote(db, REC);
ok("removeNote: a read error after the delete is not REMOVED", rm.state === "NOT REMOVED" && /absence could not be confirmed/.test(rm.why), JSON.stringify(rm));
db = fakeDb({ get: () => doc });
rm = await removeNote(db, REC);
ok("removeNote: a note still found after the delete is not REMOVED", rm.state === "NOT REMOVED" && /still found/.test(rm.why));
db = fakeDb({ get: () => doc, remove: async () => { throw dbErr(); } });
rm = await removeNote(db, REC);
ok("removeNote: a failed delete is NOT REMOVED", rm.state === "NOT REMOVED" && /the delete failed/.test(rm.why));
db = fakeDb({ get: () => ({ ...doc, body: note + "edited" }) });
rm = await removeNote(db, REC);
ok("removeNote: a note whose body changed is not deleted", rm.state === "NOT REMOVED" && !db.calls.includes("remove"));
db = fakeDb({ get: () => ({ ...doc, title: "My note" }) });
rm = await removeNote(db, REC);
ok("removeNote: a note whose title changed is not deleted", rm.state === "NOT REMOVED" && !db.calls.includes("remove"));
ok("removeNote: runs from its own source (as in the page)", (await (0, eval)(`(${removeNote})`)(fakeDb({ get: () => { throw nf(); } }), REC)).state === "ABSENT");

// requireFocus inside shoot (g6-shot.mjs): without focus no capture command runs and the backdrop is closed.
const sdir = mkdtempSync(path.join(tmpdir(), "g7-shot-"));
const shotFile = path.join(sdir, "shot.png");
let shotErr = null;
await shoot({ backdrop: ["sleep", "30"], capture: ["touch", shotFile], file: shotFile, settleMs: 50, between: async () => requireFocus({ focused: false }) }).catch((e) => { shotErr = e.message; });
ok("requireFocus: no focus -> no capture taken, the run stops", /did not have focus; no capture taken/.test(shotErr ?? "") && !existsSync(shotFile), shotErr);
ok("requireFocus: focus -> the capture goes on", requireFocus({ focused: true }).focused === true);
rmSync(sdir, { recursive: true, force: true });
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
ok("c-run: after an INCOMPLETE view nothing more is measured; note deleted, config restored (exit 1)", r.code === 1 && /MEASURE: INCOMPLETE: solarized-dark/.test(r.out) && !/run syntax kanagawa-dragon/.test(r.calls) && /run note-remove/.test(r.calls) && /NOTE: REMOVED/.test(r.out) && /RESTORE: RESTORED/.test(r.out), r.out);
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

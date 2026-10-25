// V-31: find, in Inkdrop's renderer/assets (file name -> source text), the chunks inkdrop-tokens.mjs runs. The
// names change with every build, so each chunk is found by what it contains; every feature must match exactly
// once, otherwise `locate` throws (no guess). Pure text matching: nothing here runs the bundle.

const one = (what, list) => {
  if (list.length !== 1) throw new Error(`${what}: ${list.length} candidates${list.length ? ` (${list.map((x) => x.file ?? x).join(", ")})` : ""}; not guessing`);
  return list[0];
};
const matches = (files, what, re) => one(what, Object.entries(files).flatMap(([file, t]) => [...t.matchAll(re)].map((m) => ({ file, m }))));
const esc = (s) => s.replace(/[$.]/g, "\\$&");

// The module's export list `export{local as name,…}` -> { local: name }.
function exportsOf(file, text) {
  const list = one(`${file}: export list`, [...text.matchAll(/export\{([^}]*)\};?\s*$/g)]);
  return Object.fromEntries(list[1].split(",").map((p) => p.trim().split(" as ")).map(([l, n]) => [l, n ?? l]));
}
// The import list of `from"./<chunk>"` in a file -> { exportedName: local }.
function importsFrom(file, text, chunk) {
  const list = one(`${file}: import from ${chunk}`, [...text.matchAll(new RegExp(`import\\{([^}]*)\\}from"\\./${esc(chunk)}"`, "g"))]);
  return Object.fromEntries(list[1].split(",").map((p) => p.trim().split(" as ")).map(([n, l]) => [n, l ?? n]));
}

// The fence names of the V-12 set -> the language-data entry name; aliases resolve as V-31 recorded them.
export const LANGUAGES = { js: "JavaScript", ts: "TypeScript", python: "Python", css: "CSS", html: "HTML", json: "JSON", sh: "Shell", go: "Go", rust: "Rust", yaml: "YAML", sql: "SQL", markdown: "Markdown" };
export const ALIASES = { javascript: "js", typescript: "ts", py: "python", bash: "sh", shell: "sh", zsh: "sh", yml: "yaml", rs: "rust", md: "markdown" };
// The language functions' arguments as they appear in the bundle (only these are understood).
const ARGS = { "": undefined, "{typescript:!0}": { typescript: true } };

export function locate(files) {
  // @lezer/highlight + @codemirror/language: the chunk that names the tags (`for(let e in X){…t.name=e}`),
  // defines highlightTree (`…new B(r,Array.isArray(t)?t:[t],n);a.highlightRange(e.cursor(),…`) and StreamLanguage.
  const naming = matches(files, "lezer: tag naming loop", /for\(let (\w+) in ([\w$]+)\)\{let (\w+)=\2\[\1\];\3 instanceof [\w$]+&&\(\3\.name=\1\)\}/g);
  const file = naming.file, text = files[file];
  const tagsLocal = naming.m[2];
  const ht = one("lezer: highlightTree", [...text.matchAll(/function ([\w$]+)\((\w+),(\w+),(\w+),(\w+)=0,(\w+)=\2\.length\)\{let (\w+)=new [\w$]+\(\5,Array\.isArray\(\3\)\?\3:\[\3\],\4\);\7\.highlightRange\(\2\.cursor\(\)/g)]);
  // tagHighlighter: the function @lezer/highlight's classHighlighter is built with, right after the naming loop.
  const th = one("lezer: tagHighlighter", [...text.matchAll(new RegExp(`\\}([\\w$]+)\\(\\[\\{tag:${esc(tagsLocal)}\\.link,class:\`tok-link\`\\}`, "g"))]);
  const sl = one("lezer: StreamLanguage", [...text.matchAll(/([\w$]+)=class \w+ extends [\w$]+\{constructor\(\w+\)\{(?:(?!=class ).){0,400}?this\.streamParser=/g)]);
  const ex = exportsOf(file, text);
  const named = { tags: tagsLocal, highlightTree: ht[1], tagHighlighter: th[1], StreamLanguage: sl[1] };
  const lezer = { file };
  for (const [k, local] of Object.entries(named)) {
    if (!ex[local]) throw new Error(`${file}: ${k} (${local}) is not exported`);
    lezer[k] = ex[local];
  }

  // Inkdrop's table: `<name>=<fn>([{tag:<alias>.comment,class:`tok-comment`}…])`, whose <fn> and <alias> must be
  // the tagHighlighter and the tags imported from the lezer chunk.
  const t = matches(files, "Inkdrop's token table", /[\w$]+=([\w$]+)\(\[\{tag:([\w$]+)\.comment,class:`tok-comment`\}/g);
  const tText = files[t.file];
  const imp = importsFrom(t.file, tText, file);
  if (imp[lezer.tagHighlighter] !== t.m[1] || imp[lezer.tags] !== t.m[2]) throw new Error(`${t.file}: the token table does not use the lezer chunk's tagHighlighter and tags`);
  const start = t.m.index + t.m[0].indexOf("([") + 2;
  const body = tText.slice(start, tText.indexOf("])", start));
  const table = { file: t.file, alias: t.m[2], entries: [...body.matchAll(/\{tag:(.*?),class:`(.*?)`\}/g)].map(([, expr, cls]) => [expr, cls]) };

  // The language-data list (`.of({name:`JavaScript`,alias:[`ecmascript`,…`): one entry per language that loads a
  // chunk. An entry without a chunk (Inkdrop's own Markdown, `load:()=>…`) is not one V-31 used; it is reported.
  const ld = matches(files, "language-data list", /\.of\(\{name:`JavaScript`,alias:\[`ecmascript`/g).file;
  const ldText = files[ld];
  const languages = {}, others = [];
  for (const [fence, name] of Object.entries(LANGUAGES)) {
    // An entry runs to its `}})` or to the next `.of({`, whichever comes first.
    const end = (i) => Math.min(...[ldText.indexOf("}})", i) + 3, ldText.indexOf(".of({", i + 5)].filter((x) => x > i));
    const entries = [...ldText.matchAll(new RegExp(`\\.of\\(\\{name:\`${name}\`,`, "g"))].map((m) => ldText.slice(m.index, end(m.index)));
    const loading = entries.filter((e) => /load\(\)\{return /.test(e));
    others.push(...entries.filter((e) => !loading.includes(e)).map(() => `${name}: an entry that loads no chunk (not used)`));
    const e = one(`language-data: ${name}`, loading);
    let m;
    if ((m = e.match(/load\(\)\{return [\w$]+\(\(\)=>import\(`\.\/([\w.-]+\.js)`\)(?:\.then\((\w+)=>\2\.(\w+)\))?\.then\((\w+)=>\4\.(\w+)\(([^()]*)\)\)/))) {
      if (!(m[6] in ARGS)) throw new Error(`language-data: ${name}: arguments ${m[6]} not understood`);
      languages[fence] = { file: m[1], ns: m[3], fn: m[5], args: ARGS[m[6]] };
    } else if ((m = e.match(/load\(\)\{return [\w$]+\(\(\)=>import\(`\.\/([\w.-]+\.js)`\)\.then\((\w+)=>[\w$]+\(\2\.(\w+)\)\)/))) {
      languages[fence] = { file: m[1], legacy: m[3] };
    } else if ((m = e.match(/load\(\)\{return ([\w$]+)\(`(\w+)`\)\}/))) {
      // SQL: `load(){return yp(`StandardSQL`)}` with `function yp(e){return l(()=>import(`./x.js`).then(t=>t.sql({dialect:t[e]})),…`.
      const f = one(`language-data: ${name}: ${m[1]}`, [...ldText.matchAll(new RegExp(`function ${esc(m[1])}\\((\\w+)\\)\\{return [\\w$]+\\(\\(\\)=>import\\(\`\\./([\\w.-]+\\.js)\`\\)\\.then\\((\\w+)=>\\3\\.sql\\(\\{dialect:\\3\\[\\1\\]\\}\\)\\)`, "g"))]);
      languages[fence] = { file: f[2], dialect: m[2] };
    } else throw new Error(`language-data: ${name}: load not understood: ${e.slice(0, 200)}`);
  }
  for (const [alias, fence] of Object.entries(ALIASES)) languages[alias] = languages[fence];
  return { lezer, table, languageData: ld, languages, notes: others };
}

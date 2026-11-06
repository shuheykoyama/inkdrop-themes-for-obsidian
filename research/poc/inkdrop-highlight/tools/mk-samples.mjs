import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { languages } from "@codemirror/language-data";
import { LanguageDescription } from "@codemirror/language";
const dir = "data/highlight.js/test/detect/";
const have = new Set(readdirSync(dir));
const manual = { // CM name -> hljs dir
  "C++": "cpp", "C#": "csharp", "F#": "fsharp", "Objective-C": "objectivec", "Objective-C++": "objectivec", "Common Lisp": "lisp", "Shell": "bash", "Properties files": "ini", "LaTeX": "latex", "sTeX": "latex",
  "JSON-LD": "json", "JSX": "javascript", "TSX": "typescript", "Cython": "python", "Closure Stylesheets (GSS)": "css", "ClojureScript": "clojure", "Cobol": "cobol", "VB.NET": "vbnet", "Mathematica": "mathematica", "Octave": "matlab",
  "OCaml": "ocaml", "SML": "sml", "Pug": "pug", "PowerShell": "powershell", "NSIS": "nsis", "R": "r", "RPM Spec": "rpm-specfile", "Spreadsheet": "excel", "SystemVerilog": "verilog", "TTCN": "ttcn", "Web IDL": "webidl",
  "XML": "xml", "SQL": "sql", "MariaDB SQL": "sql", "MS SQL": "sql", "MySQL": "sql", "PLSQL": "sql", "PostgreSQL": "pgsql", "SQLite": "sql", "CQL": "sql", "Sass": "scss", "SCSS": "scss", "LESS": "less", "Dockerfile": "dockerfile",
  "HTML": "xml", "Jinja": "django", "Liquid": "twig", "Angular Template": "xml", "Vue": "xml", "WebAssembly": "wasm", "Squirrel": "squirrel", "Smalltalk": "smalltalk", "Scheme": "scheme", "Tcl": "tcl", "Stylus": "stylus",
  "diff": "diff", "HTTP": "http", "Gas": "armasm", "Fortran": "fortran", "Erlang": "erlang", "Forth": "forth", "Haxe": "haxe", "IDL": "idl", "mIRC": "mirc", "Modelica": "modelica", "Nginx": "nginx", "Pascal": "delphi", "Perl": "perl",
  "Pig": "pig", "ProtoBuf": "protobuf", "Puppet": "puppet", "Q": "q", "Ruby": "ruby", "SAS": "sas", "Scala": "scala", "Solr": "solr", "SPARQL": "sparql", "Swift": "swift", "TOML": "ini", "Turtle": "turtle", "VBScript": "vbscript", "Velocity": "velocity", "Verilog": "verilog", "VHDL": "vhdl", "XQuery": "xquery", "Yacas": "yacas",
  "edn": "clojure", "Eiffel": "eiffel", "Elm": "elm", "Dylan": "dylan", "Factor": "factor", "Gherkin": "gherkin", "Groovy": "groovy", "Haskell": "haskell", "Julia": "julia", "Kotlin": "kotlin", "LiveScript": "livescript", "Lua": "lua", "CoffeeScript": "coffeescript",
  "CMake": "cmake", "Cypher": "cypher", "Crystal": "crystal", "D": "d", "Dart": "dart", "Clojure": "clojure", "APL": "apl", "PGP": "pgp", "Brainfuck": "brainfuck", "Asterisk": "asterisk", "ASN.1": "asn1", "Mbox": "mbox", "Oz": "oz", "Z80": "z80asm", "PHP": "php", "Python": "python", "Rust": "rust", "Go": "go", "Java": "java", "JavaScript": "javascript", "TypeScript": "typescript", "JSON": "json", "YAML": "yaml", "Markdown": "markdown", "CSS": "css", "C": "c", "Troff": "markdown", "Textile": "markdown", "Tiki wiki": "markdown", "TiddlyWiki": "markdown", "Xù": "xml", "MscGen": "markdown", "MsGenny": "markdown",
};
const out = [], missing = [];
for (const d of languages) {
  const cands = [manual[d.name], d.name.toLowerCase(), ...d.alias, ...d.extensions].filter(Boolean);
  const dirName = cands.find((c) => have.has(c));
  // a fence token that resolves back to d
  const tokens = [...d.alias, d.name.toLowerCase(), d.name].filter((x) => !/[\s`]/.test(x));
  const token = tokens.find((x) => LanguageDescription.matchLanguageName(languages, x, true) === d);
  if (!token) { missing.push([d.name, "no fence token"]); continue; }
  let code = null;
  if (dirName && existsSync(dir + dirName + "/default.txt")) code = readFileSync(dir + dirName + "/default.txt", "utf8");
  if (!code) { missing.push([d.name, "no sample"]); continue; }
  code = code.replace(/\r/g, "").replace(/\s+$/, "").split("\n").slice(0, 40).join("\n"); // first 40 lines
  if (/^\s*[`~]{3}/m.test(code)) code = code.replace(/`{3,}/g, "'''"); // keep the fence safe
  out.push({ name: d.name, token, source: dirName, code });
}
writeFileSync("samples.json", JSON.stringify(out));
console.log("samples", out.length, "of", languages.length, "; missing", missing.length);
for (const m of missing) console.log("  MISSING", m.join(": "));

// Fallback for the languages with no hljs sample: one generic text with comments, strings, numbers, keywords, brackets.
const generic = `# hash comment
// slash comment
/* block comment */
-- dash comment
% percent comment
; semicolon comment
define name = "string value" + 'other' + 42 + 3.14 + 0x1F
if (name != null) { call(name, [1, 2, 3], {key: value}); } else return false;
function main(arg) begin
  x := arg * 2 - 1;
  print "done" end
<tag attr="v">text</tag> @decorator $variable &ref #define MACRO
end.`;
const have2 = new Set(out.map((o) => o.name));
for (const d of languages) {
  if (have2.has(d.name)) continue;
  const tokens = [...d.alias, d.name.toLowerCase(), d.name].filter((x) => !/[\s`]/.test(x));
  const token = tokens.find((x) => LanguageDescription.matchLanguageName(languages, x, true) === d);
  if (!token) continue;
  out.push({ name: d.name, token, source: "generic", code: generic });
}
writeFileSync("samples.json", JSON.stringify(out));
const unreachable = languages.filter((d) => ![...d.alias, d.name.toLowerCase(), d.name].some((x) => !/[\s`]/.test(x) && LanguageDescription.matchLanguageName(languages, x, true) === d)).map((d) => d.name);
console.log("total blocks", out.length, "; no fence token possible:", unreachable.join(", "));
// the note
const md = "# Language table\n\n" + out.map((o) => "```" + o.token + "\n" + o.code + "\n```\n").join("\n");
writeFileSync("Languages.md", md);
console.log("note chars", md.length);

// V-12 / V-31: line up the token ranges of Inkdrop (tests/visual/inkdrop-tokens.mjs) and Obsidian
// (tests/visual/obsidian-tokens.mjs) for the same note, character by character, and print a CSV with one
// row per run of characters on which all four labels agree: language, text, Inkdrop classes and colour
// variable, and the Obsidian classes in Source mode, Live Preview and Reading view. Whitespace-only runs
// are left out. A block whose text differs between the two dumps is reported and skipped.
//
// usage: node tests/visual/token-table.mjs <inkdrop-tokens.json> <obsidian-tokens.json>
import { readFileSync } from "node:fs";

const [inkPath, obsPath] = process.argv.slice(2);
const ink = JSON.parse(readFileSync(inkPath, "utf8"));
const obs = JSON.parse(readFileSync(obsPath, "utf8"));
const VIEWS = ["source", "live", "reading"];

// Obsidian classes of all the elements around the text, without the ones every code token has (the code
// block marker, Prism's "token").
const norm = (els) => [...new Set(els.flat())].filter((c) => c !== "cm-hmd-codeblock" && c !== "token").sort().join(" ");
const csv = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// Per character, the label of the range that covers it ("" where nothing does).
const labels = (ranges, length, label) => {
  const a = new Array(length).fill("");
  for (const r of ranges) for (let i = r.from; i < Math.min(r.to, length); i++) a[i] = label(r);
  return a;
};
const textOf = (ranges) => ranges.reduce((s, r) => s + r.text, "");

const rows = [["lang", "text", "inkdrop_classes", "inkdrop_var", ...VIEWS.map((v) => `obsidian_${v}`)]];
ink.forEach((b, k) => {
  const code = b.code;
  const per = VIEWS.map((v) => obs[v][k]);
  for (const [i, p] of per.entries()) {
    // The editing views lose the newline between lines (one range list per line); Reading keeps them.
    const t = textOf(p.ranges);
    const want = VIEWS[i] === "reading" ? code : code.replace(/\n/g, "");
    if (p.lang !== b.lang || t.replace(/\n$/, "") !== want) {
      console.error(`skip ${b.lang} ${VIEWS[i]}: text differs`);
      return;
    }
  }
  const n = code.length;
  const cols = [
    labels(b.ranges, n, (r) => r.cls),
    labels(b.ranges, n, (r) => r.var ?? ""),
    ...per.map((p) => labels(p.ranges, n, (r) => norm(r.els))),
  ];
  let start = 0;
  for (let i = 1; i <= n; i++) {
    const same = i < n && cols.every((c) => c[i] === c[start]) && code[i] !== "\n";
    if (same) continue;
    const text = code.slice(start, i);
    if (text.trim()) rows.push([b.lang, text.trim(), ...cols.map((c) => c[start] || "-")]);
    start = i;
    // A newline is its own (skipped) run.
    if (code[i] === "\n") start = i + 1, i++;
  }
});
console.log(rows.map((r) => r.map(csv).join(",")).join("\n"));

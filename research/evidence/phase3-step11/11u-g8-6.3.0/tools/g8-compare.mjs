// Side-by-side numbers for G8: the computed style of the matching elements of Inkdrop 6.3.0 and Obsidian 1.14.5, per theme.
// usage: node g8-compare.mjs <out-dir>  (reads inkdrop-<sd|kd>.json and obsidian-<sd|kd>.json)
import { readFileSync } from "node:fs";
import path from "node:path";
const dir = process.argv[2];
const load = (a, t) => JSON.parse(readFileSync(path.join(dir, `${a}-${t}.json`), "utf8")).states;
const PAIRS = [
  ["palette", [["container", "container"], ["input", "input"], ["row-selected", "row-selected"], ["row", "row"]]],
  ["menu", [["menu", "menu"], ["item", "item-selected"]]],
  ["modal", [["modal", "modal"], ["header", "header"], ["input", "content"], ["button", "button"], ["button-primary", "button-primary"]]],
  ["notification", [["notification", "notification"]]],
  ["preferences", [["window", "window"], ["sidebar-item-active", "sidebar-item-active"], ["dropdown", "dropdown"], ["checkbox", "checkbox"], ["button", "button"]]],
];
const short = (s) => (s ?? "").replace(/\s+/g, " ").slice(0, 70);
for (const t of ["sd", "kd"]) {
  const I = load("inkdrop", t), O = load("obsidian", t);
  console.log(`\n######## ${t === "sd" ? "Solarized Dark" : "Kanagawa Dragon"}`);
  for (const [state, pairs] of PAIRS) for (const [ik, ok] of pairs) {
    const i = I[state]?.[ik], o = O[state]?.[ok];
    console.log(`\n${state} / Inkdrop ${ik}  vs  Obsidian ${ok}`);
    if (!i || !o) { console.log("  missing:", !i ? "Inkdrop" : "", !o ? "Obsidian" : ""); continue; }
    for (const p of ["background-color", "color", "border-top-width", "border-top-color", "border-radius", "box-shadow", "padding"]) {
      const a = short(i[p]), b = short(o[p]);
      console.log(`  ${p.padEnd(18)} ${a === b ? "=" : "≠"}  ${a}   |   ${b}`);
    }
    console.log(`  size               ${i.rect.slice(2).join("x")}   |   ${o.rect.slice(2).join("x")}`);
  }
}

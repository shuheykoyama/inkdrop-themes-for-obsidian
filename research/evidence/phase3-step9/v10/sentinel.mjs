// Which Mermaid themeVariables colour which elements (Mermaid as bundled in Obsidian, base theme): render
// with a distinct sentinel colour per variable (init directive, no global change) and read the colours back.
import { readFileSync, writeFileSync } from "node:fs";
import { evaluate } from "../../../../tests/runtime/lib/cdp.mjs";
const map = JSON.parse(readFileSync(process.argv[2], "utf8"));
const note = readFileSync(new URL("../../../../tests/fixtures/vault/Mermaid.md", import.meta.url), "utf8");
const all = [...note.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]);
// The first Flowchart and the Sequence diagram of the test note.
const blocks = [all[0], all.find((b) => b.startsWith("sequenceDiagram"))];
const vars = Object.keys(map);
const sentinel = Object.fromEntries(vars.map((v, i) => [v, "#" + (0x102030 + i * 0x010101).toString(16).padStart(6, "0")]));
const page = async (blocks, sentinel) => {
  const out = [];
  for (const [n, code] of blocks.entries()) {
    const text = `%%{init: ${JSON.stringify({ theme: "base", themeVariables: sentinel })}}%%\n${code}`;
    const { svg } = await window.mermaid.render(`v10sentinel${n}`, text);
    const host = document.body.createDiv(); host.style.cssText = "position:absolute;left:-5000px;top:0"; host.innerHTML = svg;
    const kinds = {};
    for (const el of host.querySelectorAll("svg *")) {
      const k = `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !/^\d/.test(c)).join(".")}`.slice(0, 90);
      const cs = getComputedStyle(el);
      (kinds[k] ??= { n: 0, fill: new Set(), stroke: new Set(), color: new Set(), bg: new Set() }).n++;
      kinds[k].fill.add(cs.fill); kinds[k].stroke.add(cs.stroke); kinds[k].color.add(cs.color); kinds[k].bg.add(cs.backgroundColor);
    }
    const style = host.querySelector("style")?.textContent ?? "";
    host.remove();
    out.push({ code: code.split("\n")[0], style, kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, { n: v.n, fill: [...v.fill], stroke: [...v.stroke], color: [...v.color], bg: [...v.bg] }])) });
  }
  return out;
};
const res = await evaluate(9333, `(${page})(${JSON.stringify(blocks)}, ${JSON.stringify(sentinel)})`);
const toHex = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return c; return "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join(""); };
const back = Object.fromEntries(Object.entries(sentinel).map(([k, v]) => [v, k]));
const name = (c) => { const h = toHex(c); return back[h] ? `${back[h]}` : c; };
for (const d of res) {
  console.log("=====", d.code);
  for (const [k, v] of Object.entries(d.kinds)) console.log(String(v.n).padStart(3), k.padEnd(62), "fill", v.fill.map(name).join("/"), "| stroke", v.stroke.map(name).join("/"), "| color", v.color.map(name).join("/"), "| bg", v.bg.map(name).join("/"));
}
writeFileSync(process.argv[3], JSON.stringify({ sentinel, res }, null, 1));

// Negative tests of the Mermaid colour judgement (tests/runtime/lib/mermaid.mjs, research/14 §6.54) on made-up
// dumps: a property an element paints is compared, one it does not paint is not, currentColor brings color in,
// a not-rendered shape is skipped only when it is not rendered on both sides, and a dump of an older kit (no
// namespace / geometry fields) is judged on all four colours as before. Node only (no Obsidian); runs in CI.
//
// usage: node tests/runtime/mermaid-judge-self-test.mjs
import { judgeMermaid, paintedProps } from "./lib/mermaid.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} mermaid judge self-test: ${name}${ok || !detail ? "" : ` -- ${detail}`}`); };

const spec = { kinds: ["flowchart-v2"], unsupported: [], obsidianFilter: "invert(1)", image: "x.png", required: { "flowchart-v2": [] } };
// One element of each sort, as the dump reports them (Chromium: fill / stroke resolved to rgb()).
const base = {
  html: { tag: "span", cls: "nodeLabel", ns: "html", shown: true, fill: "rgb(0, 0, 0)", stroke: "none", color: "rgb(10, 20, 30)", "background-color": "rgba(0, 0, 0, 0)", opacity: "1", "fill-opacity": "1", "stroke-opacity": "1", filter: "none" },
  fo: { tag: "foreignobject", cls: "", ns: "svg", shown: true, fill: "rgb(0, 0, 0)", stroke: "none", color: "rgb(10, 20, 30)", "background-color": "rgba(0, 0, 0, 0)", opacity: "1", "fill-opacity": "1", "stroke-opacity": "1", filter: "none" },
  text: { tag: "text", cls: "", ns: "svg", shown: true, fill: "rgb(10, 20, 30)", stroke: "none", color: "rgb(51, 51, 51)", "background-color": "rgba(0, 0, 0, 0)", opacity: "1", "fill-opacity": "1", "stroke-opacity": "1", filter: "none" },
  rect: { tag: "rect", cls: "background", ns: "svg", empty: false, shown: true, fill: "rgba(0, 45, 56, 0.85)", stroke: "none", color: "rgb(51, 51, 51)", "background-color": "rgba(232, 232, 232, 0.8)", opacity: "0.5", "fill-opacity": "1", "stroke-opacity": "1", filter: "none" },
  hidden: { tag: "rect", cls: "background", ns: "svg", empty: true, shown: false, fill: "rgb(0, 0, 0)", stroke: "none", color: "rgb(51, 51, 51)", "background-color": "rgba(0, 0, 0, 0)", opacity: "1", "fill-opacity": "1", "stroke-opacity": "1", filter: "none" },
};
// The colours result of one diagram whose element `k` differs from the reference by `change` (on Obsidian's side).
const colours = (k, change, refChange = {}) => {
  const actual = Object.values(base).map((e, i) => (Object.keys(base)[i] === k ? { ...e, ...change } : { ...e }));
  const reference = Object.values(base).map((e, i) => (Object.keys(base)[i] === k ? { ...e, ...refChange, shown: undefined } : { ...e, shown: undefined }));
  const page = { view: "reading", diagrams: [{ block: 0, kind: "flowchart-v2", filter: "none", actual, reference }], unsupported: [], others: [{ element: "img x.png", filter: "none" }] };
  return judgeMermaid(spec, page, "dark", {}, "PASS").find((r) => r.id === "mm.reading.flowchart-v2.colours");
};
const status = (k, change, refChange) => colours(k, change, refChange).status;

check("the same dump passes", status("text", {}) === "PASS");
// HTML labels keep their text colour and background.
check("HTML label: color differs -> FAIL", status("html", { color: "rgb(255, 0, 255)" }) === "FAIL");
check("HTML label: background-color differs -> FAIL", status("html", { "background-color": "rgb(255, 0, 255)" }) === "FAIL");
check("HTML label: opacity differs -> FAIL", status("html", { opacity: "0.4" }) === "FAIL");
check("HTML label: filter differs -> FAIL", status("html", { filter: "blur(2px)" }) === "FAIL");
check("foreignObject: filter differs -> FAIL", status("fo", { filter: "blur(2px)" }) === "FAIL");
check("foreignObject: background-color differs -> FAIL", status("fo", { "background-color": "rgb(255, 0, 255)" }) === "FAIL");
// SVG text and shapes: painted with fill / stroke.
check("SVG text: fill differs -> FAIL", status("text", { fill: "rgb(255, 0, 255)" }) === "FAIL");
check("SVG text: stroke differs -> FAIL", status("text", { stroke: "rgb(255, 0, 255)" }) === "FAIL");
check("SVG text: color differs, fill explicit -> PASS (not painted)", status("text", { color: "rgb(255, 0, 255)" }) === "PASS");
check("SVG text: fill is the keyword currentcolor and color differs -> FAIL", status("text", { fill: "currentcolor", color: "rgb(255, 0, 255)" }, { fill: "currentcolor" }) === "FAIL");
check("SVG text: stroke is currentColor (any case) and color differs -> FAIL", status("text", { stroke: "currentColor", color: "rgb(255, 0, 255)" }, { stroke: "currentColor" }) === "FAIL");
check("SVG rect: background-color differs -> PASS (an SVG shape has no CSS background)", status("rect", { "background-color": "rgb(255, 0, 255)" }) === "PASS");
check("SVG rect: opacity 0.5 vs 0.6 -> FAIL", status("rect", { opacity: "0.6" }) === "FAIL");
check("SVG rect: opacity within 0.01 -> PASS", status("rect", { opacity: "0.505" }) === "PASS");
check("SVG rect: fill-opacity differs -> FAIL", status("rect", { "fill-opacity": "0.3" }) === "FAIL");
check("SVG rect: stroke-opacity differs -> FAIL", status("rect", { "stroke-opacity": "0.3" }) === "FAIL");
check("SVG rect: filter differs -> FAIL", status("rect", { filter: "blur(1px)" }) === "FAIL");
check("SVG rect: fill within 1/255 -> PASS (as before)", status("rect", { fill: "rgba(1, 45, 56, 0.85)" }) === "PASS");
// Not rendered (zero size): skipped on both sides only.
{
  const r = colours("hidden", { stroke: "rgb(255, 0, 255)" });
  check("not rendered on both sides: stroke differs -> PASS, reported as not compared", r.status === "PASS" && /1 not rendered, not compared/.test(r.detail), r.detail);
}
check("rendered on Obsidian's side only -> FAIL", status("hidden", { empty: false }) === "FAIL");
check("rendered on the reference's side only -> FAIL", status("rect", {}, { empty: true }) === "FAIL");
check("an HTML element against an SVG one -> FAIL", status("html", { ns: "svg" }) === "FAIL");
// A dump of an older device kit: no ns / empty fields -> all four colours on every element, as before.
{
  const strip = (e) => { const { ns, empty, opacity, "fill-opacity": fo, "stroke-opacity": so, filter, ...rest } = e; return rest; };
  const old = (change) => {
    const actual = Object.values(base).map((e) => strip(e));
    actual[2] = { ...actual[2], ...change };
    const page = { view: "reading", diagrams: [{ block: 0, kind: "flowchart-v2", filter: "none", actual, reference: Object.values(base).map((e) => ({ ...strip(e), shown: undefined })) }], unsupported: [], others: [{ element: "img x.png", filter: "none" }] };
    return judgeMermaid(spec, page, "dark", {}, "PASS").find((r) => r.id === "mm.reading.flowchart-v2.colours").status;
  };
  check("older dump: SVG text color differs -> FAIL (judged as before)", old({ color: "rgb(255, 0, 255)" }) === "FAIL");
  check("older dump: the same -> PASS", old({}) === "PASS");
}
check("paintedProps: SVG shape", JSON.stringify(paintedProps(base.rect, base.rect)) === JSON.stringify(["fill", "stroke", "opacity", "fill-opacity", "stroke-opacity", "filter"]));
check("paintedProps: HTML", JSON.stringify(paintedProps(base.html, base.html)) === JSON.stringify(["fill", "stroke", "color", "background-color", "opacity", "filter"]));

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} of ${results.length} mermaid judge self-test cases FAILED` : `\nall ${results.length} mermaid judge self-test cases behaved as expected`);
process.exit(failed ? 1 : 0);

// Judgement of the Mermaid diagrams (Q-D12, step 9, research/14 §6.21), from the page dump of
// tests/runtime/mermaid-dump.js and the spec tests/spec/mermaid.json. Per view (Reading view, Live Preview)
// and supported kind (Flowchart, Sequence):
//   .filter   the diagram's filter is the expected one: none (dark: the theme lifts Obsidian's inversion; light:
//             Obsidian has none);
//   .elements every element type the spec requires is drawn (exists, visible, with a box) in some block;
//   .colours  every element of every block of that kind has the reference's values of the properties that
//             paint it (+-1/255, alpha +-0.01, opacities +-0.01; "none" and other keywords exactly) and the two
//             SVGs have the same elements. Dark: the reference is Inkdrop's rendering (base theme,
//             themeVariables from the theme's tokens); light: Mermaid's defaults, as Obsidian draws them
//             without the theme. The properties per element (research/14 §6.54):
//               - HTML elements (the labels inside foreignObject): fill, stroke, color, background-color, opacity
//                 (text colour and background are what an HTML label paints);
//               - foreignObject: the same and filter;
//               - other SVG elements: fill, stroke, opacity, fill-opacity, stroke-opacity, filter. color and
//                 background-color are not painted by them (SVG text is painted with fill; an SVG shape has no
//                 CSS background). color counts as well when fill or stroke is the keyword currentcolor (a
//                 browser that reports it unresolved; Chromium reports the resolved colour, so the fill already
//                 carries it);
//               - a rect, circle or ellipse with a zero width, height or radius is not rendered (SVG 2) and is
//                 not compared; their number is reported. It must be so on both sides.
//             A dump without these fields (device kits before step 11F) is judged as before: fill, stroke, color
//             and background-color on every element.
// Per view: .unsupported -- the other kinds keep the filter they should have (dark: Obsidian's inversion, which
// keeps them readable; light: none); reported UNSUPPORTED, never PASS, and FAIL when a filter differs or a kind
// is not drawn. .others -- every other image and SVG of the note has no filter (the note's test image included).
// Source mode: mm.source.code -- no diagram is drawn and every line of every block shows as code.
import { parseComputedColor, sameColor } from "../../lib/css.mjs";

const PROPS = ["fill", "stroke", "color", "background-color"];
const OPACITIES = ["opacity", "fill-opacity", "stroke-opacity"];
const same = (p, a, b) => {
  if (OPACITIES.includes(p) && a !== "" && b !== "" && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) return Math.abs(Number(a) - Number(b)) <= 0.01;
  const ca = parseComputedColor(a), cb = parseComputedColor(b);
  return ca && cb ? sameColor(ca, cb) : a === b;
};
// The properties compared on element `a` (Obsidian's) and its reference `b`; null when neither is rendered.
export function paintedProps(a, b) {
  if (a.ns === undefined) return PROPS;
  if (a.ns === "html") return [...PROPS, "opacity"];
  if (a.tag === "foreignobject") return [...PROPS, "opacity", "filter"];
  if (a.empty && b.empty) return null;
  const props = ["fill", "stroke", ...OPACITIES, "filter"];
  if ([a.fill, a.stroke, b.fill, b.stroke].some((v) => /^currentcolor$/i.test(v ?? ""))) props.push("color");
  return props;
}

// `scheme` "dark" | "light"; `where` is spread into every result; `ok` is the status of a pass.
export function judgeMermaid(spec, page, scheme, where, ok) {
  const results = [];
  const prefix = scheme === "light" ? `mm.light.${page.view}` : `mm.${page.view}`;
  const requirement = scheme === "light" ? "qd12.scope" : "qd12.flowchart-sequence";
  if (page.view === "source") {
    const s = page.source;
    const good = s.diagrams === 0 && s.codeLines === s.blockLines;
    results.push({ id: "mm.source.code", requirement: "qd12.source", ...where, status: good ? ok : "FAIL", detail: `${s.diagrams} diagram(s) drawn, ${s.codeLines}/${s.blockLines} block lines shown as code` });
    return results;
  }
  for (const kind of spec.kinds) {
    const ds = page.diagrams.filter((d) => d.kind === kind);
    const missing = ds.filter((d) => d.missing).map((d) => `block ${d.block} not drawn`);
    const drawn = ds.filter((d) => !d.missing);
    // filter
    const badFilter = drawn.filter((d) => d.filter !== "none").map((d) => `block ${d.block}: ${d.filter}`);
    results.push({ id: `${prefix}.${kind}.filter`, requirement, ...where, status: !drawn.length || missing.length || badFilter.length ? "FAIL" : ok,
      detail: [...missing, ...badFilter].join("; ") || `${drawn.length} diagram(s), filter none` });
    // elements
    const absent = spec.required[kind].filter(([tag, cls]) => !drawn.some((d) => d.actual.some((e) => e.shown && e.tag === tag && cls.split(" ").filter(Boolean).every((c) => e.cls.split(" ").includes(c)))));
    results.push({ id: `${prefix}.${kind}.elements`, requirement, ...where, status: !drawn.length || missing.length || absent.length ? "FAIL" : ok,
      detail: [...missing, ...absent.map(([t, c]) => `no drawn ${t}${c ? `.${c.replace(/ /g, ".")}` : ""}`)].join("; ") || `${spec.required[kind].length} element types drawn` });
    // colours
    const diffs = new Map();
    let elements = 0, notRendered = 0;
    for (const d of drawn) {
      if (d.actual.length !== d.reference.length) diffs.set(`block ${d.block}: ${d.actual.length} elements vs reference ${d.reference.length}`, 1);
      d.actual.forEach((a, i) => {
        const b = d.reference[i];
        elements++;
        if (!b || a.tag !== b.tag) { diffs.set(`block ${d.block}: element ${i} is ${a.tag} vs reference ${b?.tag}`, 1); return; }
        if (a.ns !== b.ns || (a.empty ?? false) !== (b.empty ?? false)) { diffs.set(`block ${d.block}: element ${i} (${a.tag}) is ${a.ns} ${a.empty ? "not rendered" : "rendered"} vs reference ${b.ns} ${b.empty ? "not rendered" : "rendered"}`, 1); return; }
        const props = paintedProps(a, b);
        if (!props) { notRendered++; return; }
        for (const p of props) {
          if (same(p, a[p], b[p])) continue;
          const k = `${a.tag}${a.cls ? `.${a.cls.replace(/ /g, ".")}` : ""} ${p} ${a[p]} vs ${b[p]}`;
          diffs.set(k, (diffs.get(k) ?? 0) + 1);
        }
      });
    }
    results.push({ id: `${prefix}.${kind}.colours`, requirement, ...where, status: !drawn.length || missing.length || diffs.size ? "FAIL" : ok,
      detail: [...missing, ...[...diffs].slice(0, 4).map(([k, n]) => `${n}x ${k}`)].join("; ") + (diffs.size > 4 ? ` (+${diffs.size - 4} more)` : "") || `${drawn.length} diagram(s), ${elements} elements as the reference${notRendered ? ` (${notRendered} not rendered, not compared)` : ""}`,
      measured: diffs.size ? [...diffs].map(([k, n]) => ({ n, diff: k })) : undefined });
  }
  // Unsupported kinds: never PASS.
  const want = scheme === "light" ? "none" : spec.obsidianFilter;
  const found = new Map(page.unsupported.map((u) => [u.kind, u.filter]));
  const wrong = spec.unsupported.filter((k) => found.get(k) !== want).map((k) => `${k}: ${found.get(k) ?? "not drawn"}`);
  results.push({ id: `${prefix}.unsupported`, requirement: "qd12.unsupported", ...where, status: wrong.length ? "FAIL" : "UNSUPPORTED",
    detail: wrong.length ? `filter not ${want}: ${wrong.join("; ")}` : `${spec.unsupported.length} kinds keep filter ${want} (not themed)` });
  // Other images and SVGs.
  const filtered = page.others.filter((o) => o.filter !== "none");
  const image = page.others.some((o) => o.element.endsWith(` ${spec.image}`));
  results.push({ id: `${prefix}.others`, requirement: "qd12.scope", ...where, status: filtered.length || !image ? "FAIL" : ok,
    detail: [!image && `${spec.image} not found`, ...filtered.map((o) => `${o.element}: ${o.filter}`)].filter(Boolean).join("; ") || `${page.others.length} images / SVGs, filter none` });
  return results;
}

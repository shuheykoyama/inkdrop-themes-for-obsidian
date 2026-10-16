// Negative tests of the step 11E helpers (tests/quality/lib.mjs): the !important removal touches exactly the
// named declaration or refuses, the verdict never calls an untested declaration redundant, and the WCAG maths
// gives the known ratios. Node only; runs in CI.
//
// usage: node tests/quality/self-test.mjs
import { contrast, level, over, verdict, withoutImportant } from "./lib.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} quality self-test: ${name}${ok || !detail ? "" : ` -- ${detail}`}`); };
const throws = (f) => { try { f(); return false; } catch { return true; } };

// ---------- withoutImportant ----------
const CSS = `.theme-dark .a,
.theme-dark .b { fill: red !important; stroke: blue !important; }
.theme-dark .c { fill: red !important; }
@media (hover: hover) { .theme-dark .a, .theme-dark .b { color: green !important; } }
.theme-dark .d { fill: red; }
.theme-dark .e { fill: red !important; }
.theme-dark .e { fill: blue !important; }
`;
{
  const out = withoutImportant(CSS, ".theme-dark .a, .theme-dark .b", "fill");
  check("removes the !important of the named declaration only", /\.b \{ fill: red; stroke: blue !important; \}/.test(out) && /\.c \{ fill: red !important; \}/.test(out) && /color: green !important/.test(out), out);
  check("the selector is matched after whitespace normalisation (a rule spread over lines)", !throws(() => withoutImportant(CSS, ".theme-dark .a, .theme-dark .b", "stroke")));
  check("a declaration inside @media is reached", /color: green;/.test(withoutImportant(CSS, ".theme-dark .a, .theme-dark .b", "color")));
  check("no such rule -> refused", throws(() => withoutImportant(CSS, ".theme-dark .z", "fill")));
  check("the declaration exists without !important -> refused", throws(() => withoutImportant(CSS, ".theme-dark .d", "fill")));
  check("two matching !important declarations -> refused (ambiguous)", throws(() => withoutImportant(CSS, ".theme-dark .e", "fill")));
  check("a selector that is only part of a rule's list -> refused", throws(() => withoutImportant(CSS, ".theme-dark .a", "fill")));
}

// ---------- verdict ----------
{
  const v = (o) => verdict({ changed: false, failing: [], unmeasured: [], ...o });
  check("a change caught by a check -> 必要", v({ changed: true, failing: ["mm.x"] }).verdict === "必要" && !v({ changed: true, failing: ["mm.x"] }).coverageGap);
  check("a change no check catches -> 必要 with a coverage gap", v({ changed: true }).verdict === "必要" && v({ changed: true }).coverageGap);
  check("no change, a state not measured -> 検証不足 (never 冗長)", v({ unmeasured: ["inactive window"] }).verdict === "検証不足");
  check("no change in every state it applies to -> 冗長", v({}).verdict === "冗長");
  check("no FAIL alone is not 冗長 while a state is unmeasured", v({ failing: [], unmeasured: ["mobile"] }).verdict !== "冗長");
}

// ---------- contrast ----------
{
  const near = (a, b) => Math.abs(a - b) < 0.01;
  check("white on black is 21:1", near(contrast([255, 255, 255], [0, 0, 0]), 21));
  check("a colour on itself is 1:1", near(contrast([0, 33, 41], [0, 33, 41]), 1));
  check("the order of the two colours does not matter", near(contrast([118, 118, 118], [255, 255, 255]), contrast([255, 255, 255], [118, 118, 118])));
  check("#767676 on white is 4.54:1 (the known AA grey)", near(contrast([118, 118, 118], [255, 255, 255]), 4.54));
  check("#777777 on white is 4.48:1, below AA", near(contrast([119, 119, 119], [255, 255, 255]), 4.48) && level(4.48) === "AA large");
  check("levels: 7 AAA, 4.5 AA, 3 AA large, below", level(7) === "AAA" && level(4.5) === "AA" && level(3) === "AA large" && level(2.99) === "below AA");
  check("source-over: 50% white on black is 127.5 grey; opaque stays", over([255, 255, 255, 0.5], [0, 0, 0]).every((x) => near(x, 127.5)) && over([1, 2, 3, 1], [9, 9, 9]).join() === "1,2,3");
  check("a translucent text colour is composited before the ratio (not compared raw)", contrast(over([253, 246, 226, 0.3], [0, 33, 41]), [0, 33, 41]) < contrast([253, 246, 226], [0, 33, 41]));
}

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} of ${results.length} quality self-test cases FAILED` : `\nall ${results.length} quality self-test cases behaved as expected`);
process.exit(failed ? 1 : 0);

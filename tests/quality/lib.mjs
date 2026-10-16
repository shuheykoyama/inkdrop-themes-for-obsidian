// Pure helpers of the step 11E quality tools (research/14 §6.30.3 11E): the !important removal experiment and
// the WCAG contrast. No Obsidian here; tests/quality/self-test.mjs covers them.
import postcss from "postcss";
import { norm } from "../lib/css.mjs";

// The theme CSS with the !important of exactly one declaration removed: the declaration of `property` in the
// rule whose selector (whitespace-normalised, as the allow-list writes it) is `selector`. Throws unless exactly
// one such !important declaration exists, so an experiment can never run on the wrong declaration or none.
export function withoutImportant(css, selector, property) {
  const root = postcss.parse(css);
  const hits = [];
  root.walkDecls(property, (d) => { if (d.important && d.parent?.type === "rule" && norm(d.parent.selector) === selector) hits.push(d); });
  if (hits.length !== 1) throw new Error(`${hits.length} !important declarations of ${property} in "${selector}" (want exactly 1)`);
  hits[0].important = false;
  return root.toString();
}

// The verdict of one allow-list entry from the experiment (research/14 §6.30.3 11E):
//   changed   : removing the !important changed a computed value in a measured state;
//   failing   : runtime checks that FAIL without it;
//   unmeasured: states where the declaration applies that the experiment did not measure.
// "必要" (needed) when the value changes; `coverageGap` when no runtime check notices the change.
// "冗長" (redundant) only when nothing changes and every state where it applies was measured.
// "検証不足" (not verified enough) when nothing changes but some state was not measured: not failing a check
// is never enough to call a declaration redundant.
export function verdict({ changed, failing, unmeasured }) {
  if (changed) return { verdict: "必要", coverageGap: failing.length === 0 };
  return { verdict: unmeasured.length ? "検証不足" : "冗長", coverageGap: false };
}

// WCAG 2.x relative luminance and contrast ratio of 8-bit sRGB colours ([r, g, b], 0-255).
const channel = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// Source-over compositing of a colour with alpha (0-1) on an opaque backdrop, in 8-bit sRGB as browsers paint it.
export const over = ([r, g, b, a = 1], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
// WCAG 2.x levels for normal text: AA 4.5, AAA 7 (large text: AA 3).
export const level = (ratio) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "below AA");

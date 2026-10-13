// Judgement of one runtime check against its measurement (research/14 §3.2), shared by the desktop runner
// (tests/runtime/run.mjs) and the device runner (tests/device/judge.mjs). A missing, hidden, unreadable or
// unparseable element can never pass a "match".
import { norm, parseColor, parseComputedColor, sameColor, substitute } from "../../lib/css.mjs";

// Expected colour of a check in one theme: a palette token resolved through the theme's own
// declarations, or a literal value. null if it cannot be resolved (which makes the check FAIL).
// `mixWhite` / `alpha` derive the colour as app.css does on mobile: color-mix(in srgb, <colour> (1 - mixWhite),
// white mixWhite), then color-mix(in srgb, <that> alpha, transparent).
function expectedColor(c, defs) {
  let exp;
  if (c.value !== undefined) exp = parseColor(c.value);
  else if (defs.has(c.token)) exp = parseColor(substitute(defs.get(c.token), defs));
  if (!exp) return null;
  const w = c.mixWhite ?? 0;
  return { rgb: exp.rgb.map((x) => x * (1 - w) + 255 * w), a: exp.a * (c.alpha ?? 1) };
}

export function judge(c, m, defs) {
  const expect = c.expect ?? "match";
  if (!m) return ["FAIL", "no measurement returned"];
  if (expect === "absent") return m.found ? ["FAIL", `expected absent (${c.reason}), found ${m.count}`] : ["PASS", `absent: ${c.reason}`];
  if (expect === "hidden") {
    if (!m.found) return ["FAIL", `expected hidden (${c.reason}), element not found`];
    return m.displayed ? ["FAIL", `expected hidden (${c.reason}), element is displayed ${m.size}`] : ["PASS", `hidden: ${c.reason}`];
  }
  if (!m.found) return ["FAIL", `element not found${m.error ? ` (${m.error})` : ""}`];
  if (!m.displayed) return ["FAIL", `element not displayed (size ${JSON.stringify(m.size)})`];
  const kind = c.kind ?? "color";
  if (kind === "first-color" || kind === "var") {
    // first-color: the first rgb()/rgba() in the value (box-shadow); var: a custom property holding a colour,
    // parsed as rgb()/rgba() or, as Chromium keeps custom properties as written, as hsl().
    const raw = m.value ?? "";
    const got = kind === "first-color" ? parseComputedColor((/rgba?\([^)]*\)/.exec(raw) || [""])[0]) : parseColor(raw);
    if (!got) return ["FAIL", `no colour in value: ${JSON.stringify(m.value)}`];
    const exp = expectedColor(c, defs);
    if (!exp) return ["FAIL", `expected colour unresolved (${c.token ?? c.value})`];
    return sameColor(got, exp) ? ["PASS", m.value] : ["FAIL", `${m.value} != rgba(${exp.rgb.map((x) => x.toFixed(1))}, ${exp.a})`];
  }
  if (kind === "first-family") {
    const first = (m.value ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const want = (c.value ?? "").replace(/^["']|["']$/g, "");
    return first === want ? ["PASS", m.value.slice(0, 60)] : ["FAIL", `${first} != ${want}`];
  }
  if (kind === "em") {
    // A length of `value` em: the computed px over the element's font size. WebKit draws borders in whole device
    // pixels (3.333px for 0.25em of 14px at DPR 3), so up to 0.5px off passes.
    const px = parseFloat(m.value), fs = parseFloat(m.fontSize);
    if (!Number.isFinite(px) || !Number.isFinite(fs)) return ["FAIL", `not a length: ${JSON.stringify(m.value)} / font ${JSON.stringify(m.fontSize)}`];
    const want = Number(c.value) * fs;
    return Math.abs(px - want) <= 0.5 ? ["PASS", `${m.value} (${c.value}em of ${m.fontSize})`] : ["FAIL", `${m.value} != ${c.value}em of ${m.fontSize} (${want}px)`];
  }
  if (kind === "text") {
    const exp = c.value !== undefined ? c.value : defs.has(c.token) ? substitute(defs.get(c.token), defs) : null;
    if (exp === null) return ["FAIL", `expected value unresolved (${c.token})`];
    if (m.value === null) return ["FAIL", "value not readable"];
    return norm(m.value) === norm(exp) ? ["PASS", m.value] : ["FAIL", `${JSON.stringify(m.value)} != ${JSON.stringify(exp)}`];
  }
  const got = parseComputedColor(m.value);
  if (!got) return ["FAIL", `value not a colour: ${JSON.stringify(m.value)}`];
  const exp = expectedColor(c, defs);
  if (!exp) return ["FAIL", `expected colour unresolved (${c.token ?? c.value})`];
  return sameColor(got, exp) ? ["PASS", m.value] : ["FAIL", `${m.value} != rgba(${exp.rgb.map((x) => x.toFixed(1))}, ${exp.a})`];
}

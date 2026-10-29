// Judgement of the syntax colours of code blocks (Q-D13, step 8, research/14 §6.17), from the page dump of
// tests/runtime/code-tokens.js, the oracle tests/spec/syntax.json and the colours Inkdrop 6.2.0 renders for the
// same note (tests/fixtures/inkdrop-rendered-6.2.0.json, measured in G7-1, research/14 §6.135: its editor for
// Source mode and Live Preview, its preview for Reading view). The text of every block is cut into runs on
// which both the Inkdrop range and the Obsidian range stay the same; for each run with visible text:
//   (A) implementation: Obsidian's computed colour (and italic / bold where the rule sets them) equals the
//       colour the oracle gives the run's elements in this theme -> syn.<view>.<lang>.impl PASS / FAIL;
//   (B) fidelity: that colour equals the colour Inkdrop renders for the run in this theme and view
//       -> syn.<view>.<lang>.fidelity PASS, or DIFF with every differing run and why it differs
//       (`shared`: its class carries other Inkdrop colours and the theme chose one of them; `bare`: text
//       without an element, coloured by the code block's base colour). A difference never counts as PASS;
//   (C) class choice: the runs are grouped by what CSS can tell apart -- the element classes (in any order)
//       for the editing views, whose lines carry no language (V-12), and the language plus the element
//       classes for Reading view (code.language-*); bare text is one group per view (editing) or per
//       language (Reading). Each group is classified by the set of Inkdrop colours of its runs and the colour
//       the theme gives it: EXACT (one Inkdrop colour, the theme's), MISMATCH (one Inkdrop colour, not the
//       theme's), CONFLICT (several, the theme's is one of them), DOMINATED (several, the theme's is none of
//       them). For element groups MISMATCH and DOMINATED fail syn.<view>.classes. Bare-text groups are
//       classified the same way but reported apart and not failed: their colour is the code block's base
//       colour, which also colours every other untokenised text of the view or language, an open choice
//       (research/14 §6.19). A CONFLICT does not prove that its differing runs cannot be reproduced: which
//       runs differ follows from the colour chosen.
import { parseComputedColor, sameColor } from "../../lib/css.mjs";

const VIEWS = ["source", "live", "reading"];
const inkVar = (v) => (v.startsWith("--") ? v : `--ink-syntax-${v}-color`);

// The variable names the page has to resolve: every one the oracle or the Inkdrop ranges can name.
export function syntaxVars(spec, inkdrop) {
  const names = new Set([spec.editing.default, spec.reading.default, ...Object.values(spec.inkdropDefault)]);
  for (const kind of ["editing", "reading"]) for (const r of spec[kind].rules) names.add(inkVar(r.var));
  for (const v of Object.values(spec.codeVars)) names.add(inkVar(v));
  for (const b of inkdrop) for (const r of b.ranges) if (r.var) names.add(r.var.replace("--syntax-", "--ink-syntax-"));
  return [...names];
}

// The oracle's answer for a run: walk from the innermost element outwards; at each element the matching rule
// with the most classes wins (the later one on a tie), then Obsidian's own rules; none -> the parent.
function oracle(spec, kind, lang, els) {
  const has = (cls, list) => list.every((c) => cls.includes(c));
  const match = (rules, i) => {
    let best = null;
    for (const [n, r] of rules.entries()) {
      if (!has(els[i], r.on) || (r.not && r.not.some((c) => els[i].includes(c)))) continue;
      if (r.lang && !r.lang.includes(lang)) continue;
      if (r.in && !els.slice(i + 1).some((e) => has(e, r.in))) continue;
      const weight = r.on.length + (r.in?.length ?? 0) + (r.not?.length ?? 0);
      if (!best || weight >= best.weight) best = { rule: r, weight, n };
    }
    return best?.rule;
  };
  for (let i = 0; i < els.length; i++) {
    const own = match(spec[kind].rules, i);
    if (own) return { var: inkVar(own.var), italic: own.italic, bold: own.bold, rule: own };
    const base = match(spec[kind].obsidian, i);
    if (base) return { var: inkVar(spec.codeVars[base.code]), rule: base };
  }
  return { var: spec[kind].default, rule: null };
}

// Results for one page dump (one platform, theme and appearance). `where` is spread into every result; its
// theme picks Inkdrop's rendered colours.
export function judgeSyntax(spec, inkdrop, rendered, page, where, ok) {
  const results = [];
  const shown = rendered.themes[where.theme];
  if (!shown) throw new Error(`no rendered Inkdrop colours for theme ${where.theme}`);
  const colour = (name) => parseComputedColor(page.vars[name] ?? "");
  for (const view of VIEWS) {
    const kind = view === "reading" ? "reading" : "editing";
    const groups = new Map(); // signature -> { bare, themeColours: Set, inks: Map(colour -> { runs, chars }), miss: [] }
    const fidelity = [];
    for (const [k, ink] of inkdrop.entries()) {
      const obs = page.views[view][k];
      // Inkdrop's ranges for this block as rendered in the matching view (same blocks and text as `inkdrop`).
      const rb = shown[kind === "reading" ? "preview" : "editor"][k];
      if (rb.lang !== ink.lang || rb.code !== ink.code) throw new Error(`rendered block ${k} is not ${ink.lang}'s text`);
      const id = `syn.${view}.${ink.lang}`;
      const code = ink.code;
      // The dump must hold the same text: Reading keeps the newlines, the editing views have one range list per line.
      const got = obs ? obs.ranges.map((r) => r.text).join("") : "";
      const want = kind === "reading" ? code : code.replace(/\n/g, "");
      if (!obs || obs.error || obs.lang !== ink.lang || got.replace(/\n$/, "") !== want) {
        results.push({ id: `${id}.impl`, requirement: "qd13.implementation", ...where, status: "FAIL", detail: `block not found or text differs (${obs?.error ?? obs?.lang ?? "missing"})` });
        continue;
      }
      // Per character: index of the Inkdrop range and of the Obsidian range (offsets are body offsets).
      const inkAt = new Array(code.length).fill(-1);
      rb.ranges.forEach((r, i) => { for (let c = r.from; c < r.to; c++) inkAt[c] = i; });
      const obsAt = new Array(code.length).fill(-1);
      obs.ranges.forEach((r, i) => { for (let c = r.from; c < Math.min(r.to, code.length); c++) obsAt[c] = i; });
      let runs = 0;
      const implBad = [];
      const misses = [];
      for (let s = 0; s < code.length; ) {
        let e = s + 1;
        while (e < code.length && inkAt[e] === inkAt[s] && obsAt[e] === obsAt[s] && code[e] !== "\n") e++;
        const text = code.slice(s, e);
        const o = obs.ranges[obsAt[s]];
        if (text.trim() && o) {
          runs++;
          const r = inkAt[s] >= 0 ? rb.ranges[inkAt[s]] : null;
          // Inkdrop's colour; text the measurement did not cover (none in a complete measurement) has none.
          const inkColour = r?.color ?? null;
          const want = oracle(spec, kind, ink.lang, o.els);
          const actual = parseComputedColor(o.color);
          // (A) the theme applies the oracle's colour (and font style / weight where the rule sets them).
          const fontOk = (!want.italic || o.fontStyle === "italic") && (!want.bold || Number(o.fontWeight) >= 600);
          if (!actual || !sameColor(actual, colour(want.var)) || !fontOk) {
            implBad.push(`"${text.trim()}" ${o.color}${fontOk ? "" : ` ${o.fontStyle} ${o.fontWeight}`} != ${want.var} ${page.vars[want.var]}`);
          }
          // (C) group by what CSS can tell apart. Fence names of one language share the per-language rules
          // (code.language-a, code.language-b); bare text in the editing views shares --code-normal across languages.
          const lang = spec.langAliases?.[ink.lang] ?? ink.lang;
          // Bare text: no element, or (editing views) only the span CodeMirror puts around untokenised text in a
          // code block, which carries no token class.
          const bare = o.els.every((e) => e.every((c) => c === "cm-hmd-codeblock"));
          const sig = bare
            ? (kind === "reading" ? `${lang} (bare text)` : "(bare text)")
            : (kind === "reading" ? `${lang} ` : "") + o.els.map((x) => [...x].sort().join(".")).join(" < ");
          if (!groups.has(sig)) groups.set(sig, { bare, themeColours: new Set(), inks: new Map(), miss: [] });
          const g = groups.get(sig);
          g.themeColours.add(page.vars[want.var]);
          const ic = g.inks.get(inkColour) ?? { runs: 0, chars: 0, tokens: new Set() };
          ic.runs++; ic.chars += text.trim().length; ic.tokens.add(r?.cls || "(no token)");
          g.inks.set(inkColour, ic);
          // (B) the result equals Inkdrop's colour for this text.
          if (!sameColor(colour(want.var), parseComputedColor(inkColour ?? ""))) {
            const miss = { text: text.trim(), inkdrop: r?.cls || "(no token)", inkdropColour: inkColour, obsidian: o.els.map((x) => x.join(".")).join(" < ") || "(bare text)", got: want.var, group: sig };
            misses.push(miss);
            g.miss.push(miss);
          }
        }
        s = e;
        if (code[s] === "\n") s++;
      }
      results.push({ id: `${id}.impl`, requirement: "qd13.implementation", ...where, status: implBad.length ? "FAIL" : ok, detail: implBad.length ? `${implBad.length}/${runs} runs: ${implBad.slice(0, 4).join("; ")}` : `${runs} runs` });
      fidelity.push({ id: `${id}.fidelity`, runs, misses });
    }
    // (C) classify every group; the category of each differing run follows from its group.
    const classes = [];
    for (const [sig, g] of groups.entries()) {
      const theme = [...g.themeColours];
      const inks = [...g.inks.entries()].map(([c, v]) => ({ colour: c, runs: v.runs, chars: v.chars, tokens: [...v.tokens] })).sort((a, b) => b.runs - a.runs);
      // One element signature must get one colour from the theme; two would mean the grouping is wrong.
      const chosen = theme.length === 1 ? theme[0] : null;
      const hit = chosen !== null && inks.some((i) => sameColor(parseComputedColor(i.colour), parseComputedColor(chosen)));
      const cls = chosen === null ? "MIXED" : inks.length === 1 ? (hit ? "EXACT" : "MISMATCH") : (hit ? "CONFLICT" : "DOMINATED");
      classes.push({ sig, bare: g.bare, class: cls, theme: chosen ?? theme.join(" / "), inks, differing: g.miss.length });
      for (const m of g.miss) m.category = g.bare ? "bare" : cls === "CONFLICT" ? "shared" : cls.toLowerCase();
    }
    for (const f of fidelity) {
      const by = (c) => f.misses.filter((m) => m.category === c).length;
      results.push({ id: f.id, requirement: "qd13.fidelity", ...where, status: f.misses.length ? "DIFF" : ok,
        detail: `${f.runs - f.misses.length}/${f.runs} runs have Inkdrop's colour${f.misses.length ? `; differ: ${by("shared")} shared class, ${by("bare")} bare text${f.misses.length - by("shared") - by("bare") ? `, ${f.misses.length - by("shared") - by("bare")} from failed groups` : ""}` : ""}`,
        measured: f.misses.length ? f.misses : undefined });
    }
    const count = (c, bare) => classes.filter((x) => x.class === c && x.bare === bare).length;
    const tally = (bare) => ["EXACT", "CONFLICT", "MISMATCH", "DOMINATED"].map((c) => `${c} ${count(c, bare)}`).join(", ");
    // Element groups fail on MISMATCH / DOMINATED; any MIXED group (two theme colours for one signature) fails too.
    const bad = classes.filter((x) => x.class === "MIXED" || (!x.bare && ["MISMATCH", "DOMINATED"].includes(x.class)));
    results.push({ id: `syn.${view}.classes`, requirement: "qd13.fidelity", ...where, status: bad.length ? "FAIL" : ok,
      detail: `element groups: ${tally(false)}; base colour (bare text, not failed): ${tally(true)}${bad.length ? ` -- ${bad.slice(0, 3).map((b) => `${b.class} ${b.sig}: theme ${b.theme}, Inkdrop ${b.inks.map((i) => `${i.colour} (${i.tokens.join("/")}) x${i.runs}`).join(", ")}`).join(" | ")}` : ""}`,
      measured: classes });
  }
  return results;
}

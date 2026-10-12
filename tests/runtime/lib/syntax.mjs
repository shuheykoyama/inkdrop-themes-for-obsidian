// Judgement of the syntax colours of code blocks (Q-D13, step 8, research/14 §6.17), from the page dump of
// tests/runtime/code-tokens.js, the oracle tests/spec/syntax.json and Inkdrop's own token ranges for the same
// note (tests/fixtures/inkdrop-tokens.json). The text of every block is cut into runs on which both the
// Inkdrop range and the Obsidian range stay the same; for each run with visible text:
//   (A) implementation: Obsidian's computed colour (and italic / bold where the rule sets them) equals the
//       colour the oracle gives the run's elements in this theme -> syn.<view>.<lang>.impl PASS / FAIL;
//   (B) fidelity: that colour equals the colour Inkdrop gives the run (its --syntax-* token, resolved in this
//       theme) -> syn.<view>.<lang>.fidelity PASS, or NOT REPRODUCIBLE with the list of differing runs. A
//       difference never counts as PASS;
//   (C) avoidable: a difference is only acceptable where the same Obsidian element signature also carries
//       text that Inkdrop colours differently (or has no element at all, i.e. bare text). The signature is
//       the element classes for the editing views (their lines carry no language, V-12) and the language
//       plus the element classes for Reading view (code.language-*). A signature whose runs all have one
//       Inkdrop colour that the theme misses -> syn.<view>.avoidable FAIL.
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

// Results for one page dump (one platform, theme and appearance). `where` is spread into every result.
export function judgeSyntax(spec, inkdrop, page, where, ok) {
  const results = [];
  const colour = (name) => parseComputedColor(page.vars[name] ?? "");
  for (const view of VIEWS) {
    const kind = view === "reading" ? "reading" : "editing";
    const groups = new Map(); // signature -> { inkColours: Set, misses: [] }
    for (const [k, ink] of inkdrop.entries()) {
      const obs = page.views[view][k];
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
      ink.ranges.forEach((r, i) => { for (let c = r.from; c < r.to; c++) inkAt[c] = i; });
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
          const r = inkAt[s] >= 0 ? ink.ranges[inkAt[s]] : null;
          const inkName = r?.var ? r.var.replace("--syntax-", "--ink-syntax-") : spec.inkdropDefault[kind];
          const want = oracle(spec, kind, ink.lang, o.els);
          const actual = parseComputedColor(o.color);
          // (A) the theme applies the oracle's colour (and font style / weight where the rule sets them).
          const fontOk = (!want.italic || o.fontStyle === "italic") && (!want.bold || Number(o.fontWeight) >= 600);
          if (!actual || !sameColor(actual, colour(want.var)) || !fontOk) {
            implBad.push(`"${text.trim()}" ${o.color}${fontOk ? "" : ` ${o.fontStyle} ${o.fontWeight}`} != ${want.var} ${page.vars[want.var]}`);
          }
          // (B) the result equals Inkdrop's colour for this text.
          if (!sameColor(colour(want.var), colour(inkName))) {
            misses.push({ text: text.trim(), inkdrop: r?.cls ?? "(no token)", inkdropVar: inkName, obsidian: o.els.map((x) => x.join(".")).join(" < ") || "(bare text)", got: want.var });
          }
          // (C) group by what CSS can tell apart.
          // Fence names of one language share the per-language rules (code.language-a, code.language-b).
          const lang = spec.langAliases?.[ink.lang] ?? ink.lang;
          const sig = o.els.length ? (kind === "reading" ? `${lang} ` : "") + JSON.stringify(o.els) : null;
          if (sig) {
            if (!groups.has(sig)) groups.set(sig, { inkColours: new Set(), wantColour: page.vars[want.var], miss: [] });
            const g = groups.get(sig);
            g.inkColours.add(page.vars[inkName]);
            if (!sameColor(colour(want.var), colour(inkName))) g.miss.push(`${ink.lang}:"${text.trim()}"`);
          }
        }
        s = e;
        if (code[s] === "\n") s++;
      }
      results.push({ id: `${id}.impl`, requirement: "qd13.implementation", ...where, status: implBad.length ? "FAIL" : ok, detail: implBad.length ? `${implBad.length}/${runs} runs: ${implBad.slice(0, 4).join("; ")}` : `${runs} runs` });
      results.push({ id: `${id}.fidelity`, requirement: "qd13.fidelity", ...where, status: misses.length ? "NOT REPRODUCIBLE" : ok, detail: `${runs - misses.length}/${runs} runs have Inkdrop's colour${misses.length ? `; differ: ${misses.slice(0, 3).map((m) => `"${m.text}"`).join(", ")}…` : ""}`, measured: misses.length ? misses : undefined });
    }
    // (C) a signature whose runs are all one Inkdrop colour can be given that colour: a miss there is the theme's fault.
    const avoidable = [...groups.entries()].filter(([, g]) => g.inkColours.size === 1 && g.miss.length);
    results.push({ id: `syn.${view}.avoidable`, requirement: "qd13.fidelity", ...where, status: avoidable.length ? "FAIL" : ok, detail: avoidable.length ? avoidable.slice(0, 4).map(([sig, g]) => `${sig} -> Inkdrop ${[...g.inkColours][0]}, theme ${g.wantColour}: ${g.miss.slice(0, 3).join(" ")}`).join(" | ") : `${groups.size} element signatures; every difference shares its signature with another Inkdrop colour or is bare text` });
  }
  return results;
}

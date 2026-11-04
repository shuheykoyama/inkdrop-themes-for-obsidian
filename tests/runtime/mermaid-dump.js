// Mermaid dump: runs inside the ISOLATED Obsidian (test vault only), after
// `window.__MERMAID = { note, view: "reading" | "live" | "source", tokens: { themeVariable: "token" }, kinds, unsupported,
//   reference: "inkdrop" | "default", rerender, inline: [{ selector, property, value, priority }] }`,
// with the theme already applied (step 9, research/14 §6.21). For every diagram of `note` whose SVG has one of
// `kinds`, it reports the computed colours of each element of Obsidian's (themed) SVG and of a REFERENCE SVG:
// the same diagram text rendered by the same Mermaid, either with the base theme and themeVariables resolved
// from the theme's --ink-mermaid-* tokens -- what Inkdrop's Mermaid plugin does (inkdropapp/mermaid@384e9f5
// theme.ts) -- or, for `reference: "default"` (light mode), with Mermaid's defaults as Obsidian renders it. The
// reference is mounted outside .mermaid, so the theme's rules do not touch it. Both SVGs have the same element
// order (same text, same Mermaid), so element i of one corresponds to element i of the other.
// Also reported: the filter of every diagram of the `unsupported` kinds, the filter of every other image and
// SVG in the note, and for "source" whether the blocks show as code. `rerender` (Reading view) re-renders the
// note in place before measuring; `inline` sets inline styles on Obsidian's SVG elements (runner self-test).
// Reports what it found, never a judgement (tests/runtime/lib/mermaid.mjs judges).
(async () => {
  const { note, view, tokens, kinds, unsupported, reference, rerender, inline, referenceCss, peleTokens } = window.__MERMAID;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Mermaid diagrams render only in a trusted vault (Obsidian 1.14 asks once per vault): the test vault is trusted.
  app.saveLocalStorage("mermaid-vault-trust", true);
  const previous = app.workspace.activeLeaf;
  const leaf = app.workspace.getLeaf("tab");
  const mode = view === "reading" ? { mode: "preview" } : { mode: "source", source: view === "source" };
  await leaf.setViewState({ type: "markdown", state: { file: note, ...mode }, active: true });
  await sleep(800);
  const lines = (await app.vault.adapter.read(note)).split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "```mermaid") continue;
    const end = lines.indexOf("```", i + 1);
    blocks.push({ line: i, code: lines.slice(i + 1, end).join("\n") });
    i = end;
  }
  const el = leaf.view.contentEl;
  // Draw the block: scroll to it (Reading view renders lazily and drops far sections; Live Preview draws lines
  // near the viewport).
  const scrollTo = async (line) => {
    if (view === "reading") leaf.view.currentMode.applyScroll(line);
    else leaf.view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line: line + 10, ch: 0 } }, true);
    await sleep(300);
  };
  const out = { view, blocks: blocks.length, diagrams: [], unsupported: [], others: [] };
  const others = new Map();
  const collectOthers = () => {
    for (const e of el.querySelectorAll("img, svg")) {
      if (e.closest(".mermaid")) continue;
      const key = `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}${e.getAttribute("src") ? ` ${e.getAttribute("src").split("/").pop().split("?")[0]}` : ""}`;
      others.set(key, getComputedStyle(e).filter);
    }
  };
  if (view === "source") {
    // Source mode: every block shows as code lines, no diagram is drawn.
    let codeLines = 0;
    for (const b of blocks) {
      await scrollTo(b.line);
      const shownLines = [...el.querySelectorAll(".cm-line.HyperMD-codeblock")].map((l) => l.textContent);
      codeLines += b.code.split("\n").filter((l) => shownLines.includes(l)).length;
    }
    out.source = { diagrams: el.querySelectorAll(".mermaid").length, codeLines, blockLines: blocks.reduce((n, b) => n + b.code.split("\n").length, 0) };
    leaf.detach();
    if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
    return out;
  }
  if (rerender && view === "reading") {
    // Draw every block once, then re-render the note in place (Mermaid gives the new SVGs new random ids).
    for (const b of blocks) await scrollTo(b.line);
    leaf.view.previewMode.rerender(true);
    await sleep(800);
  }
  // Obsidian loads Mermaid with the first diagram it draws: on a fresh start (a device) draw one first.
  for (let i = 0; i < 30 && !(window.mermaid || window.pele) && blocks.length; i++) await scrollTo(blocks[0].line);
  // Obsidian 1.15 and later draws with Pele (window.pele); 1.14 with Mermaid.js (window.mermaid).
  const pele = !!window.pele;
  out.engine = pele ? "pele" : "mermaid";
  // themeVariables from the theme's tokens, resolved to computed colours as Inkdrop's plugin resolves its own.
  const probe = document.body.createEl("span");
  const themeVariables = Object.fromEntries(Object.entries(tokens ?? {}).map(([k, t]) => { probe.style.color = `var(--ink-mermaid-${t})`; return [k, getComputedStyle(probe).color]; }));
  probe.remove();
  out.themeVariables = themeVariables;
  // The colours, and what else decides how a colour is painted (tests/runtime/lib/mermaid.mjs picks per element
  // which of them are painted).
  const props = ["fill", "stroke", "color", "background-color", "stop-color", "opacity", "fill-opacity", "stroke-opacity", "filter"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  // A rect, circle or ellipse with a zero width, height or radius is not rendered at all (SVG 2, 10.2-10.4).
  const empty = (e) => { if (!["rect", "circle", "ellipse"].includes(e.localName) || e.namespaceURI !== SVG_NS) return undefined; const b = e.getBBox(); return b.width === 0 || b.height === 0; };
  // shown: drawn with a box (markers' contents and the defs are never drawn themselves).
  const shown = (e) => { const r = e.getBoundingClientRect(); return e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && (r.width > 0 || r.height > 0); };
  // imp: the properties set inline with !important (Mermaid does that for the colours of a few shapes, e.g. the notes of a class diagram):
  // no stylesheet rule can beat them.
  const read = (svg, live) => [...svg.querySelectorAll("*")].filter((e) => !e.closest("style")).map((e) => {
    const cs = getComputedStyle(e);
    return { tag: e.tagName.toLowerCase(), cls: [...e.classList].join(" "), ns: e.namespaceURI === SVG_NS ? "svg" : "html", empty: empty(e), shown: live ? shown(e) : undefined, imp: [...(e.style ?? [])].filter((n) => e.style.getPropertyPriority(n) === "important"), ...Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
  });
  // The visible text of a diagram (its <style> holds the random id, so it is left out).
  const label = (svg) => [...svg.querySelectorAll("text, foreignObject")].map((e) => e.textContent).join("|");
  const host = document.body.createDiv();
  // The reference is laid out as wide as the note: some diagrams (Gantt) place their labels by the width they get.
  host.style.cssText = `position: absolute; left: -10000px; top: 0; width: ${el.querySelector(".markdown-preview-sizer, .cm-content")?.clientWidth ?? 700}px;`;
  // Pele: Inkdrop's stylesheet and the tokens it reads, resolved from the palette (as Inkdrop resolves its own).
  const peleVars = [];
  if (pele && reference !== "default") {
    document.getElementById("ink-ref-pele")?.remove();
    document.head.createEl("style", { attr: { id: "ink-ref-pele" }, text: referenceCss });
    const cs0 = getComputedStyle(document.body);
    for (const n of peleTokens) {
      for (const name of [n.replace("--mermaid-", "--ink-mermaid-"), n.replace("--mermaid-", "--ink-derived-mermaid-")]) { const raw = cs0.getPropertyValue(name).trim(); if (raw) { peleVars.push([n, raw]); break; } }
    }
    for (const [n, src] of [["--muted-text-color", "--ink-muted-text-color"], ["--page-font", "--ink-page-font"], ["--color-white", "--ink-color-neutral-950"], ["--color-neutral-950", "--ink-color-neutral-950"], ["--text-color", "--ink-text-color"]]) peleVars.push([n, cs0.getPropertyValue(src).trim()]);
  }
  // Pele lays a diagram out by the width of its container (a label wraps or shortens, ticks thin out), so the reference must be as wide as
  // the diagram in the note: peleRef draws `code` in a fresh reference host of that width.
  const peleRef = async (code, width) => {
    const outer = host.createDiv(); outer.style.width = `${width}px`;
    const h = outer.createDiv({ cls: reference === "default" ? "mermaid" : "mermaid-diagram" });
    if (reference !== "default") { outer.style.colorScheme = "dark"; for (const [name, v] of peleVars) h.style.setProperty(name, v); }
    window.pele.mount(h, code); await sleep(50);
    return h.querySelector("svg");
  };
  const alnum = (x) => label(x).replace(/\W+/g, "");
  const seen = new Set();
  for (const [n, b] of blocks.entries()) {
    // The diagram type is what Mermaid itself puts on the reference SVG (aria-roledescription), whatever the first word of the text.
    const init = reference === "default" ? "" : `%%{init: ${JSON.stringify({ theme: "base", themeVariables })}}%%\n`;
    let refSvg = null;
    if (pele) {
      // Pele's reference: the same text drawn by the same Pele into a host that is NOT under the theme, as Inkdrop draws it:
      // dark -- a .mermaid-diagram host with Inkdrop's own plugin stylesheet (referenceCss) and its --mermaid-* tokens resolved
      // from the palette; light -- a plain .mermaid host, which gets Obsidian's own colours.
      try {
        const outer = host.createDiv(); outer.style.width = "100%";
        const h = outer.createDiv({ cls: reference === "default" ? "mermaid" : "mermaid-diagram" });
        if (reference !== "default") {
          outer.style.colorScheme = "dark";
          for (const [name, v] of peleVars) h.style.setProperty(name, v);
        }
        window.pele.mount(h, b.code);
        await sleep(50);
        refSvg = h.querySelector("svg");
      } catch (e) { refSvg = null; }
    } else {
    try {
      const { svg: ref } = await window.mermaid.render(`inkref${n}${Date.now()}`, init + b.code);
      host.innerHTML = ref;
      refSvg = host.querySelector("svg");
    } catch (e) { refSvg = null; }
    }
    const want = refSvg?.getAttribute("aria-roledescription");
    if (!want || !kinds.includes(want)) {
      // Another kind: only its filter (Obsidian's inversion keeps it readable).
      let svg = null;
      for (let i = 0; i < 20 && !svg; i++) {
        await scrollTo(b.line);
        collectOthers();
        svg = [...el.querySelectorAll(".mermaid > svg")].find((s) => !kinds.includes(s.getAttribute("aria-roledescription")) && !seen.has(s.getAttribute("aria-roledescription")));
      }
      if (svg) { seen.add(svg.getAttribute("aria-roledescription")); out.unsupported.push({ kind: svg.getAttribute("aria-roledescription"), filter: getComputedStyle(svg).filter }); }
      continue;
    }
    // The SVG of this block: the drawn diagram of that kind with the same visible text as the reference (the
    // order of the drawn diagrams is not stable, as Reading view renders lazily).
    let svg = null;
    for (let i = 0; i < 20 && !svg; i++) {
      await scrollTo(b.line);
      collectOthers();
      const cands = [...el.querySelectorAll(`.mermaid > svg[aria-roledescription="${want}"]`)];
      if (pele) {
        // The drawn diagram of this kind whose text is that of the reference drawn at the diagram's own width.
        for (const c of cands) {
          const r2 = await peleRef(b.code, c.parentElement.getBoundingClientRect().width);
          if (alnum(r2) === alnum(c)) { svg = c; refSvg = r2; break; }
        }
      } else svg = cands.find((s) => label(s) === label(refSvg));
    }
    if (!svg) { out.diagrams.push({ block: n, kind: want, missing: true }); continue; }
    for (const s of inline ?? []) for (const e of svg.querySelectorAll(s.selector)) e.style.setProperty(s.property, s.value, s.priority ?? "");
    out.diagrams.push({ block: n, kind: want, id: svg.id, filter: getComputedStyle(svg).filter, actual: read(svg, true), reference: read(refSvg, false) });
  }
  host.remove();
  document.getElementById("ink-ref-pele")?.remove();
  out.others = [...others].map(([element, filter]) => ({ element, filter }));
  leaf.detach();
  if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  return out;
})()

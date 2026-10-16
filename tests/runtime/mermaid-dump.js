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
  const { note, view, tokens, kinds, unsupported, reference, rerender, inline } = window.__MERMAID;
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
  for (let i = 0; i < 30 && !window.mermaid && blocks.length; i++) await scrollTo(blocks[0].line);
  // themeVariables from the theme's tokens, resolved to computed colours as Inkdrop's plugin resolves its own.
  const probe = document.body.createEl("span");
  const themeVariables = Object.fromEntries(Object.entries(tokens).map(([k, t]) => { probe.style.color = `var(--ink-mermaid-${t})`; return [k, getComputedStyle(probe).color]; }));
  probe.remove();
  out.themeVariables = themeVariables;
  const props = ["fill", "stroke", "color", "background-color"];
  // shown: drawn with a box (markers' contents and the defs are never drawn themselves).
  const shown = (e) => { const r = e.getBoundingClientRect(); return e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && (r.width > 0 || r.height > 0); };
  const read = (svg, live) => [...svg.querySelectorAll("*")].filter((e) => !e.closest("style")).map((e) => {
    const cs = getComputedStyle(e);
    return { tag: e.tagName.toLowerCase(), cls: [...e.classList].join(" "), shown: live ? shown(e) : undefined, ...Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
  });
  // The visible text of a diagram (its <style> holds the random id, so it is left out).
  const label = (svg) => [...svg.querySelectorAll("text, foreignObject")].map((e) => e.textContent).join("|");
  const host = document.body.createDiv();
  host.style.cssText = "position: absolute; left: -10000px; top: 0;";
  const seen = new Set();
  for (const [n, b] of blocks.entries()) {
    // The diagram type is the first word after any %%{init}%% directive or %% comment lines.
    const head = b.code.split("\n").filter((l) => !l.trim().startsWith("%%")).join("\n").trim().split(/\s/)[0];
    const want = /^(flowchart|graph)$/.test(head) ? "flowchart-v2" : head === "sequenceDiagram" ? "sequence" : null;
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
    const init = reference === "default" ? "" : `%%{init: ${JSON.stringify({ theme: "base", themeVariables })}}%%\n`;
    const { svg: ref } = await window.mermaid.render(`inkref${n}${Date.now()}`, init + b.code);
    host.innerHTML = ref;
    const refSvg = host.querySelector("svg");
    // The SVG of this block: the drawn diagram of that kind with the same visible text as the reference (the
    // order of the drawn diagrams is not stable, as Reading view renders lazily).
    let svg = null;
    for (let i = 0; i < 20 && !svg; i++) {
      await scrollTo(b.line);
      collectOthers();
      svg = [...el.querySelectorAll(`.mermaid > svg[aria-roledescription="${want}"]`)].find((s) => label(s) === label(refSvg));
    }
    if (!svg) { out.diagrams.push({ block: n, kind: want, missing: true }); continue; }
    for (const s of inline ?? []) for (const e of svg.querySelectorAll(s.selector)) e.style.setProperty(s.property, s.value, s.priority ?? "");
    out.diagrams.push({ block: n, kind: want, id: svg.id, filter: getComputedStyle(svg).filter, actual: read(svg, true), reference: read(refSvg, false) });
  }
  host.remove();
  out.others = [...others].map(([element, filter]) => ({ element, filter }));
  leaf.detach();
  if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  return out;
})()

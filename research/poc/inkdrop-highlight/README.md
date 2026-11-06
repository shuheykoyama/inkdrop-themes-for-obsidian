# Inkdrop's code highlighting in Obsidian (proof of concept)

An Obsidian plugin that gives fenced code the same token classes Inkdrop 6.3.0 gives it (`tok-*`, `md-*`), by
parsing with the same Lezer grammars. The theme then colours those classes (not done yet, see research/14 §6.201).

Findings and numbers: `research/14-implementation-plan.md` §6.200 and §6.201.

## Layout

- `plugin/main.js`: the plugin (editor extension for Source mode and Live Preview, post-processor for Reading view).
  Bundles its own `@codemirror/language`, `@lezer/highlight` and the grammars; only `@codemirror/state` and `view` come
  from Obsidian. (Obsidian's bundled copies are older and give different legacy-mode tokens.)
- `src/tok-table.js`: Inkdrop's `tok-*` class table, cut out of its bundle by `tools/extract-tok-table.py`.
- `src/blocks.js`: finds fenced code with Lezer Markdown plus the two block types of Inkdrop's Markdown that change
  where a fence is: front matter and `$$` math.
- `fixtures/edge-body.md`: 15 edge cases of fence detection (tilde, list, quote, attributes, unclosed, math, ...).
- `tools/`: sample generation, the Inkdrop measurement, the comparisons and the static version check.

## Re-running after an Inkdrop update

Everything runs from this directory. `data/` is not committed (Inkdrop's measurements are about 5 MB).

1. `npm ci`, then `node plugin/build.mjs` (writes `plugin/out/main.js`).
2. Static drift check: extract Inkdrop's `app.asar` (`npx @electron/asar extract /Applications/Inkdrop.app/Contents/Resources/app.asar <dir>`), then
   `node tools/check-versions.mjs <dir>/renderer/assets`. Every standard Lezer grammar must be reported `SAME`.
   Legacy (StreamLanguage) modes carry no table: step 3 covers them.
3. Dynamic suite, one block per language (needs `git clone --depth 1 https://github.com/highlightjs/highlight.js data/highlight.js`
   for the samples; `node tools/mk-samples.mjs` writes `Languages.md`):
   `LANG_NOTE=<Languages.md> LANG_MEASURE=tools/lang-measure.mjs bash tools/lang-run.sh <work> data/inkdrop-lang135 <tmp>`
   (the user's Inkdrop is quit, started with its debugger, one temporary note is created and removed, everything is
   restored; same method as `tests/visual/g7-c-run.sh`; needs the user's go). Then `node tools/cmp135.mjs preview|editor`.
4. Edge cases and big blocks the same way with `fixtures/edge-body.md` (`tools/edge-measure.mjs`, output `data/inkdrop-edge`)
   and `python3 -I tools/mk-big.py > data/big-body.md` (output `data/inkdrop-big`), compared by `tools/edge-cmp2.mjs`,
   `tools/edge-cmp3.mjs`, `tools/big-cmp.mjs`.
5. Obsidian side: an isolated Obsidian (`tests/runtime/obsidian-isolated.sh`) with the theme and the plugin installed
   in its vault, notes `Languages.md`, `Edge.md`, `Big.md`; `tools/run-ob2.mjs` and `tools/run-ob-edge.mjs` read the DOM
   of Reading view, Source mode and Live Preview.

Notes rendered before the plugin was enabled keep Obsidian's own highlighting until they change or Obsidian restarts
(Obsidian caches the rendered sections); with the plugin enabled at start-up every render is highlighted.

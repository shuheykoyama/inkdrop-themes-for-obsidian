# Inkdrop's code highlighting in Obsidian (proof of concept)

An Obsidian plugin that gives fenced code, front matter and `$$` math the same token classes Inkdrop 6.3.0 gives them
(`tok-*`, `md-*`), by parsing with the same Lezer grammars and the same language table. The theme then colours those
classes (not done yet, see research/14 §6.202).

Findings and numbers: `research/14-implementation-plan.md` §6.200 to §6.202.

## Layout

- `plugin/main.js`: the plugin. An editor extension (Source mode and Live Preview) decorates fenced code (parsed over the
  CodeText ranges, so quote and list markers stay out), front matter and `$$` blocks; a post-processor does Reading view
  (and the properties block when Obsidian shows properties as source). It bundles its own `@codemirror/language`,
  `@lezer/highlight` and every grammar; only `@codemirror/state` and `view` come from Obsidian (its bundled copies are
  older and give different legacy-mode tokens).
- `src/languages.js`: Inkdrop's language table (language-data, Elixir, GraphQL, Svelte, Nix, Mermaid, Markdown with `md`,
  `mkd`, `gfm`) for the editor, and the different one its preview uses (`previewParser`).
- `src/inkdrop-markdown.js`: Inkdrop's Markdown: GFM base plus front matter, `$$` and `$` math, GitHub alerts, bare URLs
  and the `md-*` tags.
- `src/blocks.js`: finds the blocks to decorate with that Markdown.
- `src/tok-table.js`: Inkdrop's `tok-*` class table (`tools/extract-tok-table.py`); `src/url-regex.js`: its URL regex
  (`tools/extract-url-regex.py`). Both are cut out of its bundle as data.
- `fixtures/`: `edge-body.md` (fence detection), `ext-body.md` (Inkdrop-only languages, Mermaid, fences in quotes and
  lists, Markdown inside Markdown, front matter, math), `quirk-body.md` (Markdown aliases and case in the preview).
- `tools/`: sample generation, the Inkdrop measurement, the comparisons and the static version check.

## Re-running after an Inkdrop update

Everything runs from this directory. `data/` is not committed (Inkdrop's measurements are several MB).

1. `npm ci`, then `node plugin/build.mjs` (writes `plugin/out/main.js`).
2. Static drift check: extract Inkdrop's `app.asar` (`npx @electron/asar extract /Applications/Inkdrop.app/Contents/Resources/app.asar <dir>`), then
   `node tools/check-versions.mjs <dir>/renderer/assets`. Every Lezer grammar must be reported `SAME` (6.3.0: 32 of 33; the
   33rd is Inkdrop's extra Julia, which its own table shadows). Legacy (StreamLanguage) modes carry no table: step 3 covers them.
3. Dynamic suite, one block per language (`git clone --depth 1 https://github.com/highlightjs/highlight.js data/highlight.js`
   for the samples; `node tools/mk-samples.mjs` writes `Languages.md`):
   `LANG_NOTE=<Languages.md> LANG_MEASURE=tools/lang-measure.mjs bash tools/lang-run.sh <work> data/inkdrop-lang135 <tmp>`
   (the user's Inkdrop is quit, started with its debugger, one temporary note is created and removed, everything is
   restored; same method as `tests/visual/g7-c-run.sh`; needs the user's go). Then `node tools/regress.mjs`.
4. The same with `fixtures/*.md` (`LANG_MEASURE=tools/edge-measure.mjs`; outputs `data/inkdrop-edge`, `-ext`, `-quirk`) and
   `python3 -I tools/mk-big.py > data/big-body.md`; compare with `tools/regress.mjs`, `tools/ext-cmp.mjs`, `tools/quirk-cmp.mjs`,
   `tools/quirk-prev.mjs`, `tools/big-cmp.mjs`.
5. Obsidian side: an isolated Obsidian (`tests/runtime/obsidian-isolated.sh`) with the theme and the plugin installed in its
   vault and the notes `Languages.md`, `Edge.md`, `Ext.md`, `Quirk.md`, `Big.md`; `tools/run-ob2.mjs` and `tools/run-ob-edge.mjs`
   read the DOM of Reading view, Source mode and Live Preview; `tools/edge-cmp3.mjs`, `tools/ext-cmp-ob.mjs`,
   `tools/quirk-cmp-ob.mjs` compare it with Inkdrop's measurement.

Notes rendered before the plugin was enabled keep Obsidian's own highlighting until they change or Obsidian restarts
(Obsidian caches the rendered sections); with the plugin enabled at start-up every render is highlighted.

# Mermaid diagram types: generator

Generates `src/common/components/mermaid-kinds.css` and `src/palette/<theme>-mermaid.css` (research/14 section 6.195). Not part of `npm test`; the generated files are committed and checked by the static and runtime tests.

For every Mermaid diagram type Obsidian 1.14.5 (Mermaid 11.13.0) draws, other than Flowchart and Sequence (`samples.mjs`: one sample each), the generator renders the sample with Mermaid's base theme and the themeVariables resolved from the theme's `--ink-mermaid-*` tokens (what Inkdrop's Mermaid plugin does), and turns what colours it into CSS:

1. `gen1.mjs` dumps the diagram's own stylesheet (the colour declarations of the reference rendering).
2. `gen3.mjs` dumps the colours carried by presentation attributes and by inline styles (`fill`, `stroke`, `stop-color`), element by element, for the reference and for Obsidian's default rendering.
3. `gen2.mjs` writes the CSS (stylesheet declarations; attribute rules keyed on the default colour) and the palette files. A colour that is one of the theme's `--ink-mermaid-*` tokens uses it; any other is a derived colour `--ink-mermaid-gen-N`, defined per theme in the palette file.

Colours that Mermaid sets inline with `!important` (the notes of a class diagram) cannot be changed by a stylesheet; the runtime test reports them as DIFF.

Run (isolated Obsidian started with `tests/runtime/obsidian-isolated.sh start <work>`, both themes' `dist/` folders copied to `<vault>/.obsidian/themes/SD` and `KD`, `tests/fixtures/vault/Mermaid.md` in the vault):

    node gen1.mjs SD gen1-sd.json;  node gen1.mjs KD gen1-kd.json
    node gen3.mjs SD gen3-sd.json;  node gen3.mjs KD gen3-kd.json
    node gen2.mjs gen1-sd.json gen1-kd.json <out dir> gen3-sd.json gen3-kd.json

then copy the three files from `<out dir>` to the places above and rebuild. When a new Obsidian brings a new Mermaid, regenerate and run the runtime tests.

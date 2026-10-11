# inkdrop-themes-for-obsidian
Faithful ports of Inkdrop's Solarized Dark and Kanagawa Dragon themes for Obsidian.

**Status: in development (Phase 3, step 5: workspace backgrounds and UI details such as text, borders, states, overlays, controls, tags and the UI font; no Markdown styling yet).** There is no usable theme yet,
and the theme names and licence/attribution text are not decided. The research and the implementation plan
are in [`research/`](research/README.md) (plan: [`research/14-implementation-plan.md`](research/14-implementation-plan.md)).

## Development

Requires Node 22+.

```sh
npm ci                       # pinned dependencies (package-lock.json)
npm run build                # dist/<theme>/theme.css and manifest.json (development names)
npm test                     # static tests S1-S6 and their negative self-tests (also run in CI)
npm run test:clean-room      # reinstall in a temporary directory and compare the outputs byte for byte
npm run test:visual-self     # negative tests of the region sampler (synthetic image, Python 3)
npm run test:visual-v04      # the region sampler reproduces the V-04 measurements (research/12)
```

Runtime checks (macOS, Obsidian 1.14.4 installed). They use an isolated instance with its own user data
directory and a copy of `tests/fixtures/vault`; the user's vaults and settings are never opened.

```sh
W="$(mktemp -d)"
V="$(bash tests/runtime/obsidian-isolated.sh start "$W" | tail -1)"
node tests/runtime/run.mjs --vault "$V" --self-test   # the runner's negative tests
node tests/runtime/run.mjs --vault "$V"               # tests/spec/runtime/*.json
node tests/runtime/font-check.mjs                     # V-36: quoted vs unquoted UI font names
bash tests/runtime/obsidian-isolated.sh stop "$W"
```

The default environment is `/Applications/Obsidian.app` (its installer's Electron) running the 1.14.4 app.
A second environment uses the current installer's own Electron: `bash tests/runtime/current-installer.sh prepare`
downloads the official release, checks its digest and code signature, and copies the app to
`~/.cache/inkdrop-themes-for-obsidian/` without launching it. Start it with
`OBSIDIAN_APP="$HOME/.cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app" OBSIDIAN_ASAR=none`
in front of the `start` command above. The copy gets registered with LaunchServices (as a second
`obsidian://` candidate), so run `bash tests/runtime/current-installer.sh check` before and after, and
`... restore` afterwards (research/14 §6.3).

Native screenshots under the V-04 / V-32 conditions (macOS, screen-recording permission already granted):
`bash tests/visual/capture-obsidian.sh <theme> <translucent|opaque> <gray|pattern> <active|inactive> <vault> <out> <tmp>`,
then `python3 -I tests/visual/sample-regions.py --config tests/visual/configs/step4-*.json ...`
(research/evidence/phase3-step4/README.md). The top-left corner under the window buttons:
`python3 -I tests/visual/sample-regions.py --config tests/visual/configs/top-left-corner.json --out <csv> <png> ...`
(research/evidence/phase3-corner/README.md).

| Path | Contents |
|---|---|
| `src/palette/` | Theme values: Inkdrop's declarations with their sources |
| `src/common/` | Structure shared by both themes (mapping, components, platform) |
| `src/themes/` | Entry files (`@import` order) |
| `src/manifests/` | Development manifests (placeholder names) |
| `scripts/build.mjs` | PostCSS with `postcss-import` only |
| `tests/static/` | S1-S6, lint allow-list, negative self-tests |
| `tests/spec/` | Required items and runtime checks |
| `tests/runtime/` | Isolated Obsidian runner |
| `tests/visual/` | Region sampler for native screenshots |

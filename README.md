# inkdrop-themes-for-obsidian
Faithful ports of Inkdrop's Solarized Dark and Kanagawa Dragon themes for Obsidian.

**Status: in development (Phase 3, step 2: palettes; no UI mapping yet).** There is no usable theme yet,
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
bash tests/runtime/obsidian-isolated.sh stop "$W"
```

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

# 02. Inkdrop テーマ設計仕様解析（Solarized Dark / Kanagawa Dragon）

- 調査日: 2026-10-09
- フェーズ: Phase 1（技術調査のみ。テーマ実装は行っていない）
- 対象 SHA（`scratchpad/repo-shas.txt` より。以下、出典は `repo@SHA7 path:line` 形式）

| リポジトリ | SHA7 | 用途 |
|---|---|---|
| inkdropapp/solarized-dark | `4337f6e` (v2.2.1) | 移植対象 1 |
| inkdropapp/kanagawa（`packages/dragon`） | `f9c14a5` (kanagawa-dragon v1.2.1) | 移植対象 2 |
| inkdropapp/css（`@inkdropapp/css` v0.9.14） | `add48d9` | 基盤トークン / 基盤 CSS |
| inkdropapp/default-dark, default-light | `68c28c4`, `ef81d48` | 比較（基盤そのもの） |
| inkdropapp/solarized-light, nord-light, gruvbox | `0f6bbb9`, `96af665`, `3ca0060` | 比較 |
| inkdropapp/kanagawa `packages/wave`, `packages/lotus` | `f9c14a5` | 比較 |
| inkdropapp/solarized-dark-syntax, kanagawa-dragon-syntax（旧形式） | `39f67ee`, `0ef752c` | 比較（v6 統合前） |
| inkdropapp/theme-dev-helpers | `a7bcbe6` | `palette.json` 生成器 |
| inkdropapp/api-docs | `965790b` | テーマ作成ガイド |
| craftzdog/solarized-osaka.nvim | `a21176e` | Solarized Dark の上流 |
| rebelot/kanagawa.nvim | `bb85e4b` | Kanagawa の上流 |

凡例:
- **[確認済]** = ソースを読んで確認した事実。**[推測]** = ソースからの推論。**[未確認]** = 未検証。
- **宣言値** = CSS ソース上の値を `var()` 置換・`light-dark()` 選択して得た値（本書の CSV はすべてこれ）。**Computed Style** = 実ブラウザで計算された値。本調査では実アプリ（Inkdrop）を起動していないため、Computed Style は直接観測していない。`palette.json`（後述）は theme-dev-helpers の harness 上の値で、これとの突合を行った。突合が裏付けるのは `var()` の展開と `light-dark()` の分岐選択が harness と一致したことで、描画色ではない（Phase 1B で訂正。§1.5）。
- 16 進値は宣言 HSL を Python `colorsys` で sRGB に変換し、8 ビットに丸めた**計算値**である。画面上の描画色を測ったものではない。ブラウザの変換や色管理によって ±1 程度ずれる可能性がある（Phase 1B で表現を訂正）。

関連データ（機械可読）:
- `research/data/inkdrop-solarized-dark-tokens.csv`（2,356 トークン、うちテーマ宣言 521）
- `research/data/inkdrop-kanagawa-dragon-tokens.csv`（2,395 トークン、うちテーマ宣言 645）
- `research/data/inkdrop-palettes.json`（両テーマのパレット、Osaka / 本家 Solarized 16 色 / kanagawa.nvim 上流色との対応）
- 生成スクリプト: [`tools/resolve_tokens.py`](tools/resolve_tokens.py), [`tools/build_palettes.py`](tools/build_palettes.py), [`tools/leaks.py`](tools/leaks.py)（Phase 1B でリポジトリに収録。手順は [tools/README.md](tools/README.md)。値の確認に使った `show.py` は表示用の補助で、収録していない）

---

## 0. 要旨

1. 両テーマとも v6 形式の「統合テーマ」（`"theme": true`、UI / エディタ / プレビューを 1 パッケージで扱う）で、`themeAppearance: "dark"` 固定。中身はほぼ **CSS カスタムプロパティの上書きのみ**で、セレクタ単位のスタイル指定は持たない。**[確認済]** solarized-dark@4337f6e package.json:2-14, kanagawa@f9c14a5 packages/dragon/package.json:2-14
2. 実装モデルが根本的に異なる。
   - **Solarized Dark = ランプ上書き型**: 基盤の `--hsl-{neutral,blue,cyan,green,yellow,orange,red,violet,pink}-{50..950}` を Solarized Osaka 由来の値に差し替え（`@layer theme`）、基盤 `ui.css` の既定値をそのまま流用しつつ一部セマンティック変数を上書きする。
   - **Kanagawa Dragon = 名前付きパレット型**: 基盤ランプには触れず、独自の `--kanagawa-*`（39 色）を定義し、セマンティック変数を「ほぼ全部」明示的に再割り当てする（ui.css だけで 569 行）。
3. 背景の奥行き方向が逆。Solarized Dark は **サイドバーが最も明るく（base02）エディタに向かって暗くなる**。Kanagawa Dragon は **サイドバーが暗く（page / menu / input の Black0 に次ぐ Black1）エディタが最も明るい**（kanagawa.nvim の depth model を踏襲とコメントあり）。
4. 自作の解決スクリプトの宣言値は、両テーマの `palette.json` と **1,638 / 1,638 トークン全一致**（引用符の正規化のみ）。`palette.json` は theme-dev-helpers の検証用ページ（harness）上の値で、`var()` の展開はブラウザ、`light-dark()` の分岐はツールの文字列処理による。したがってこの一致は、本調査の解決結果と harness の結果が一致したことを示すもので、実アプリ上の値（harness は `layers.css` を読まない）や描画色を裏付けるものではない（Phase 1B で訂正。§1.5）。

---

## 1. テーマのファイル構成とカスケード

### 1.1 パッケージ構成 [確認済]

| | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| styleSheets（読込順） | `tokens.css`, `ui.css`, `syntax.css`, `preview.css` | `palette.css`, `ui.css`, `syntax.css`, `preview.css` |
| パレットファイルのレイヤ | `@layer theme`（solarized-dark@4337f6e styles/tokens.css:1） | **レイヤなし**（kanagawa@f9c14a5 packages/dragon/styles/palette.css:14） |
| ui.css | `@layer theme.ui`、188 行 | `@layer theme.ui`、569 行 |
| syntax.css | `@layer theme.syntax`、261 行 | `@layer theme.syntax`、298 行 |
| preview.css | `@layer theme.preview`、138 行 | `@layer theme.preview`、155 行 |
| palette.json | 生成物（prepublishOnly で `generate-palette`） | 同左 |

出典: solarized-dark@4337f6e package.json:8-13,15-17、kanagawa@f9c14a5 packages/dragon/package.json:8-13,15-17。

### 1.2 カスケードレイヤ順 [確認済 + 仕様からの推論]

基盤 `layers.css` の宣言順（css@add48d9 layers.css:1-11）:
`reset, base, tokens, recipes, utilities, theme, theme.ui, theme.ui.base, theme.ui.components, theme.preview, theme.syntax`。
基盤ファイルは `theme.ui.base`（ui.css:1, status.css:1, task-progress.css:1）、`theme.preview.base`（markdown.css:1, mermaid.css:1）、`theme.syntax.base`（syntax.css:1）というサブレイヤに入っている。`tags.css` のみ `theme.ui` 直下（css@add48d9 tags.css:1）。

CSS Cascade Layers の仕様では「あるレイヤ直下のスタイルは、そのサブレイヤより優先」なので、実効優先度（低→高）は次のとおり（スクリプトで同一順を算出）:

```
reset < base < tokens < recipes < utilities
 < theme.ui.base < theme.ui.components < theme.ui(直下)
 < theme.preview.base < theme.preview(直下)
 < theme.syntax.base < theme.syntax(直下)
 < theme(直下) < レイヤなし
```

- テーマの `ui.css` / `syntax.css` / `preview.css` は対応する `*.base` に勝つ。これは api-docs のガイドの説明と一致（api-docs@965790b src/app/guides/create-a-theme/page.mdx:86）。
- Solarized の `tokens.css`（`@layer theme` 直下）は `tokens` レイヤの基盤ランプに勝つ。
- **注意（ドキュメントの不整合）**: 同ガイドは「`theme` レイヤは `theme.ui` 等より下」と書いている（page.mdx:378）。しかし仕様上は `theme` 直下が `theme.ui` より上になる（同ガイド page.mdx:86 の「レイヤ自身のルールはサブレイヤより優先」と矛盾）。両テーマとも `theme` 直下と `theme.ui` で同名変数を宣言しないので、実害はない。**[推測: 仕様に基づく]**
- Kanagawa の `palette.css` はレイヤなしで最上位だが、`--kanagawa-*` という固有名なので他と衝突しない。

### 1.3 `light-dark()` の扱い [確認済]

基盤は明暗両対応で `light-dark(明, 暗)` を多用する（ui.css 189 箇所、syntax.css 97、mermaid.css 45、tags.css 112、markdown.css 10）。index.html が `<body>` に color-scheme を設定し、`body.dark-mode` / `[class*='dark-ui']` で dark 側になる（css@add48d9 syntax.css:2-9、mermaid.css:11-16 のコメント）。両テーマとも dark 専用で、**テーマ自身は `light-dark()` を使わず直接値を書く**。例外は Solarized preview.css と Kanagawa ui.css のコメント内の記述 1 件ずつのみ。CSV では全 `light-dark()` を dark 側で解決し、notes に `light-dark->dark` と記録した。

### 1.4 条件付き上書き（既定値の解決からは除外し、CSV の notes に記録）

- `:root:has(body.acrylic-window)`: 半透明ウィンドウ用。両テーマとも page / sidebar / note-list / editor / inline-dropdown / vertical-menu の背景を半透明に差し替え、`--editor-background-color: transparent` にする（solarized-dark@4337f6e styles/ui.css:176-187, styles/syntax.css:258-260、kanagawa@f9c14a5 packages/dragon/styles/ui.css:557-568, syntax.css:295-297）。
- `@supports (corner-shape: squircle)`: 角丸を squircle 15px / 24px にする（css@add48d9 ui.css:1566-1572）。Electron（Chromium）では適用されると扱った。両テーマの `palette.json` が `--default-corner-shape: squircle` を記録しており、これが根拠。
- `@media print`（markdown.css:1019）は対象外。

### 1.5 palette.json の性質 [確認済]

theme-dev-helpers の `generate-palette` が、テーマ適用状態で `body`、`.cm-editor`、`.mde-preview` 上の CSS 変数の **computed value** を抽出して 1 ファイルにまとめたもの（theme-dev-helpers@a7bcbe6 README.md「Generate Palette」節）。`--hsl-*` / `--color-*` などのプリミティブは含まない。本調査の宣言値解決との突合結果は次のとおり。

| | 突合トークン数 | 一致 | 不一致 |
|---|---|---|---|
| Solarized Dark | 1,638 | 1,638 | 0（引用符 `'`/`"` の違いのみ正規化） |
| Kanagawa Dragon | 1,638 | 1,638 | 0（同上） |

この結果から、`palette.json` の生成時点の CSS と現 HEAD の CSS は実質的に同一とみなせる。**[推測]**

**Phase 1B の補足**: `palette.json` の各値は、次の 3 つの処理を経たものである（theme-dev-helpers@a7bcbe6 `src/generate-palette.ts`、`src/palette.ts:246-263`）。

1. `var()` の展開: ブラウザの `computedStyleMap()`。CSS Custom Properties の仕様では、カスタムプロパティの計算値は「変数を置換した指定値」で、色としては解決されない。
2. `light-dark()` の分岐: ツール側の文字列処理（`resolveLightDark`）。ブラウザではない。
3. `color-mix()`: ブラウザに計算させ、計算済みの色で置き換える（`computeColorMixes`）。

両テーマの `palette.json` には `color-mix()` 由来の値がないため（Phase 1B で確認）、色は `hsl(45deg 7% 11%)` のような HSL の文字列のまま記録されている。したがってこの突合が示すのは、本調査の解決スクリプトと harness の結果（`var()` の展開と、別実装の文字列処理による分岐選択）が一致したことである。実アプリ上の値や画面上の描画色を裏付けるものではない。

---

## 2. パレット定義

### 2.1 Solarized Dark（ランプ上書き） [確認済]

`styles/tokens.css` は 9 系統 × 11 段（50〜950）の HSL トリプレットを定義する（solarized-dark@4337f6e styles/tokens.css:4-118）。`--color-*` ラッパーも再宣言する（同 126-240）。基盤側も `--color-x: hsl(var(--hsl-x))` を `:root` に持つので、この再宣言は値を変えない。ヘッダーコメントは「editor scope で再計算するため」としている（同 120-123）。**[推測]** シャドウ DOM（`:host`）などの別スコープ対策と考えられる。

ニュートラル（Solarized base 系）。右端は Osaka（craftzdog_solarized-osaka.nvim@a21176e lua/solarized-osaka/colors.lua:11-22,120-122）との対応。

| トークン | HSL | Hex | コメント | Osaka 名 | 主な用途（後述） |
|---|---|---|---|---|---|
| neutral-50 | 44 87% 94% | `#fdf6e2` | base3 | base3 | 暗背景上のテキストのアルファ基準色（muted/hover 等） |
| neutral-100 | 46 42% 88% | `#ede7d4` | base2 | base2 | 内部ボーダーのアルファ基準色 |
| neutral-200 | 180 7% 70% | `#adb8b8` | base1 | base1 | 太字、Mermaid テキスト |
| neutral-300 | 186 8% 65% | `#9fabad` | base0 | base0 | キャレット |
| neutral-400 | 186 8% 55% | `#839495` | fg | fg | 本文テキスト、エディタ前景 |
| neutral-500 | 196 13% 45% | `#647a82` | base00 | base00 | ボーダー（アルファ）、変数名 |
| neutral-600 | 194 14% 40% | `#586e74` | base01 | base01 | コメント、ガター、引用線 |
| neutral-700 | 192 81% 14% | `#073541` | base02 | base02 | サイドバー、solid border、選択 |
| neutral-800 | 192 100% 11% | `#002d38` | base03 | base03 / bg_highlight | ノートリスト、モーダルヘッダー |
| neutral-900 | 192 100% 8% | `#002129` | (intermediate) | **該当なし** | エディタ背景、モーダル本文 |
| neutral-950 | 192 100% 5% | `#00141a` | base04 (darkest) | base04 / bg | ページ、メニュー、ポップアップ、入力欄 |

アクセント（各系統の 500 が Solarized の基準色）。50〜950 の全段が Osaka の `<color>50..950` と一致する。

| 系統 | 500 HSL | 500 Hex | 本家 Solarized | 備考 |
|---|---|---|---|---|
| yellow | 45 100% 35% | `#b28600` | yellow `#b58900` | |
| orange | 18 80% 44% | `#ca4c16` | orange `#cb4b16` | |
| red | 1 71% 52% | `#dc312e` | red `#dc322f` | |
| pink | 331 64% 52% | `#d33682` | magenta `#d33682` | magenta を pink ランプに割り当て（tokens.css:107） |
| violet | 237 43% 60% | `#6d72c5` | violet `#6c71c4` | |
| blue | 205 69% 49% | `#278bd3` | blue `#268bd2` | |
| cyan | 175 59% 40% | `#2aa298` | cyan `#2aa198` | |
| green | 68 100% 30% | `#859900` | green `#859900` | |

全 99 色の HSL / Hex / Osaka 対応は `inkdrop-palettes.json` の `solarized-dark.ramps` にある。

**上書きされない基盤ランプ**（rose, fuchsia, purple, indigo, sky, teal, emerald, lime, amber, stone, zinc, gray, slate）は Tailwind 系の既定値のまま残る（css@add48d9 tokens.css）。これが §8.3 の「漏れ」の原因になる。

### 2.2 Kanagawa Dragon（名前付きパレット） [確認済]

`styles/palette.css` は 39 色を HSL トリプレットで定義し、元の HEX を行末コメントに残している（kanagawa@f9c14a5 packages/dragon/styles/palette.css:16-64）。コメントは「rebelot/kanagawa.nvim の `dragon` テーマから取り込み、HEX → HSL 変換」と説明している（同 4-11）。

| 名前 | HSL | コメント HEX | HSL→Hex | 上流 HEX（kanagawa.nvim） | 役割コメント |
|---|---|---|---|---|---|
| dragonBlack0 | 0 4% 5% | `#0d0c0c` | `#0d0c0c` | `#0d0c0c` | |
| dragonBlack1 | 60 9% 6% | `#12120f` | `#11110e` | `#12120f` | |
| dragonBlack2 | 0 4% 9% | `#181616` | `#181616` | **`#1d1c19`** | |
| dragonBlack3 | 45 7% 11% | `#1d1c19` | `#1e1d1a` | **`#181616`** | ui.bg |
| dragonBlack4 | 0 1% 15% | `#282727` | `#272626` | `#282727` | ui.bg_gutter |
| dragonBlack5 | 40 3% 22% | `#393836` | `#3a3936` | `#393836` | ui.bg_p2 |
| dragonBlack6 | 30 4% 37% | `#625e5a` | `#625e5b` | `#625e5a` | ui.nontext |
| dragonWhite | 120 4% 78% | `#c5c9c5` | `#c5c9c5` | 同 | ui.fg |
| dragonGreen | 120 17% 60% | `#87a987` | `#88aa88` | 同 | （未使用） |
| dragonGreen2 | 91 13% 54% | `#8a9a7b` | `#89997a` | 同 | string |
| dragonPink | 296 8% 61% | `#a292a3` | `#a294a4` | 同 | number |
| dragonOrange | 23 29% 60% | `#b6927b` | `#b7927b` | 同 | constant |
| dragonOrange2 | 17 31% 60% | `#b98d7b` | `#b98b79` | 同 | |
| dragonGray | 60 5% 63% | `#a6a69c` | `#a5a59c` | 同 | parameter |
| dragonGray2 | 44 5% 60% | `#9e9b93` | `#9e9b94` | 同 | punctuation |
| dragonGray3 | 173 4% 50% | `#7a8382` | `#7a8583` | 同 | ui.special |
| dragonBlue2 | 199 19% 62% | `#8ba4b0` | `#8ca5b1` | 同 | function |
| dragonViolet | 222 15% 60% | `#8992a7` | `#8a93a8` | 同 | keyword |
| dragonRed | 4 42% 60% | `#c4746e` | `#c4746e` | 同 | operator / preproc |
| dragonAqua | 175 11% 60% | `#8ea4a2` | `#8ea4a2` | 同 | type |
| dragonAsh | 120 4% 47% | `#737c73` | `#737d73` | 同 | comment |
| dragonTeal | 220 18% 65% | `#949fb5` | `#96a0b6` | 同 | special1 |
| dragonYellow | 41 33% 65% | `#c4b28a` | `#c3b188` | 同 | identifier |
| oldWhite | 51 33% 68% | `#c8c093` | `#c8c092` | 同 | fg_dim |
| waveBlue1 | 215 36% 21% | `#223249` | `#223249` | 同 | bg_visual |
| waveBlue2 | 205 39% 29% | `#2d4f67` | `#2d4f67` | 同 | bg_search |
| katanaGray | 180 5% 46% | `#717c7c` | `#6f7b7b` | 同 | deprecated（未使用） |
| samuraiRed | 0 81% 53% | `#e82424` | `#e82626` | 同 | error |
| roninYellow | 30 100% 62% | `#ff9e3b` | `#ff9e3d` | 同 | warning |
| dragonBlue | 199 19% 49% | `#658594` | `#658695` | 同 | info |
| waveAqua1 | 163 17% 50% | `#6a9589` | `#6a9589` | 同 | hint |
| springGreen | 87 37% 58% | `#98bb6c` | `#98bc6c` | 同 | ok |
| winterGreen / winterRed / winterBlue / winterYellow | — | `#2b3328` / `#43242b` / `#252535` / `#49443c` | ±1 | 同 | diff 背景 |
| autumnGreen / autumnRed / autumnYellow | — | `#76946a` / `#c34043` / `#dca561` | ±1 | 同 | VCS |

出典: 上流 HEX は rebelot_kanagawa.nvim@bb85e4b lua/kanagawa/colors.lua:14-85。

要点:
- **HSL 宣言と HEX コメントの差**: CSS の正本は「整数 % の HSL」である。HSL を sRGB に変換して 8 ビットに丸めた**計算値**は、コメントの HEX から最大 2/255 ずれる（dragonPink, dragonTeal, dragonYellow, samuraiRed, roninYellow, katanaGray など）。**[確認済: 数値計算]**
  - Phase 1 は「レンダリング色はコメントの HEX からずれる」と書いていたが、描画色は測っていない。計算値と描画色を区別して書き直した（Phase 1B、R-05）。
  - **Inkdrop 版を正本とするなら、Obsidian 側でも同じ `hsl()` 宣言を使うのが最も厳密**である。両アプリとも Chromium の同じ変換を通るので、HEX への換算そのものが不要になる（ただし両アプリの Chromium 版と色管理が同じかは未確認）。HEX コメントは参照値にすぎない。
- **dragonBlack2 / dragonBlack3 の入れ替え**: §10 で詳述する。
- 旧 `kanagawa-dragon-syntax` の palette.css と現行 `packages/dragon/styles/palette.css` の定義は全 39 色が完全一致する（スクリプトで diff して確認）。

---

## 3. 基盤トークンの上書き / 継承（CSV の読み方）

- CSV の各行は、テーマ適用時に `:root` で勝つ宣言 1 件を表す。`source=theme|base`、`file:line`（`repo@SHA7 path:line`）、`raw_value`（ソースのまま）、`resolved_value`（`var()` 置換 + `light-dark()` 暗側 + HSL/RGB→Hex）、`resolution_status`、`notes` の各列からなる。
- `notes` には、負けた宣言の位置（`overrides:`）、レイヤ、`light-dark->dark` / `fallback-used:` フラグ、`conditional-overrides:`（acrylic 等）、置換後の式（`substituted=`）、`palette.json=match|absent` を記録した。
- `partial`（両テーマ 61 件）は全件が `calc()` を含むサイズ系トークン（例: `--absolute-big = calc(calc(18 / 14) * 1rem)`）。`color-mix()` は基盤 `syntax.css:737` のセレクタ内にしかなく、トークンとしては現れない。`unresolved` は 0 件。

上書き数の比較 [確認済: CSV 集計]:

| | テーマ宣言で勝つトークン | 主な上書き範囲 |
|---|---|---|
| Solarized Dark | 521（うちランプ・ラッパー 198） | ランプ全体 + UI 約 60 + syntax 約 190 + preview 約 70 |
| Kanagawa Dragon | 645（うちパレット 39 + preview surface 2） | UI 約 330（tone / 状態 / accent 派生まで網羅）+ syntax 約 190 + preview 約 80 |

Solarized はランプ差し替えにより、**テーマが宣言していない基盤 UI トークン（例: `--page-background`, `--link-color`, `--primary-color-hover`, `--positive-color`, `--solid-internal-border-color`）も自動的に Solarized 色に解決される**。Kanagawa はランプに触れないため、宣言漏れがあれば Inkdrop 既定（Tailwind 系）色がそのまま出る。

---

## 4. 背景の階層構造

宣言値（暗側）。出典の t: はテーマ、b: は基盤。

| 面 | トークン | Solarized Dark | Kanagawa Dragon |
|---|---|---|---|
| ページ（ウィンドウ地） | `--page-background` | `#00141a` neutral-950/base04（b: css ui.css:114 の既定がランプ経由で解決） | `#0d0c0c` dragonBlack0（t: ui.css:39） |
| サイドバー | `--sidebar-background` | **`#073541` neutral-700/base02**（t: ui.css:126） | **`#11110e` dragonBlack1**（t: ui.css:193） |
| ノートリスト | `--note-list-bar-background` | `#002d38` neutral-800/base03（t: ui.css:135） | `#181616` dragonBlack2（t: ui.css:212） |
| ノートリスト節見出し | `--note-list-bar-section-header-background` | `#073541` base02（t: ui.css:137） | `#272626` dragonBlack4（t: ui.css:215） |
| エディタ | `--editor-background` / `--editor-background-color` | **`#002129` neutral-900**（t: ui.css:148 / syntax.css:9） | **`#1e1d1a` dragonBlack3**（t: ui.css:230 / syntax.css:17） |
| プレビュー設定画面 | `--preferences-view-background` | `#002129`（t: ui.css:161） | `#1e1d1a`（t: ui.css:248） |
| 設定サイドバー | `--preferences-sidebar-background` | `#00141a`（t: ui.css:160） | `#0d0c0c`（t: ui.css:247） |
| モーダル: ヘッダー / 本文 / アクション | `--modal-box-*-background` | `#002d38` / `#002129` / `#002129`（t: ui.css:119-121） | `#272626` / `#1e1d1a` / `#1e1d1a`（t: ui.css:186-188） |
| ポップアップ / ツールチップ | `--popup-background`（tooltip は継承） | `#00141a` base04（t: ui.css:103） | `#181616` dragonBlack2（t: ui.css:163） |
| メニュー / ドロップダウン | `--menu-background`, `--dropdown-menu-background` | `#00141a`（t: ui.css:96,113） | `#0d0c0c`（t: ui.css:151,180） |
| 縦メニュー / インラインドロップダウン | `--vertical-menu-background`, `--inline-dropdown-menu-background` | `#00141a` @70%（t: ui.css:97,114） | `#0d0c0c` @70%（t: ui.css:152,181） |
| 入力欄 / select | `--input-background`, `--form-select-background` | `#00141a`（t: ui.css:15,91） | `#0d0c0c`（t: ui.css:24,145） |
| ノート検索入力 | `--note-search-bar-input-background` | `#002129`（t: ui.css:143） | `#0d0c0c`（t: ui.css:225） |
| セグメント | `--segment-background` | `#002d38`（t: ui.css:83） | `#181616`（t: ui.css:137） |
| 通知 | `--notification-item-background` | `#00141a` @80%（t: ui.css:155） | `#0d0c0c` @80%（t: ui.css:242） |
| エディタのドロワー / フローティング操作 | `--editor-drawer-background`, `--editor-floating-actions-background` | `#002d38` @70%, `#002129` @70%（t: ui.css:149-150） | `#11110e` @70%, `#1e1d1a` @70%（t: ui.css:231-232） |
| エディタのパネル（検索等） | `--editor-panel-background-color` | `#002d38`（t: syntax.css:27） | `#11110e`（t: syntax.css:43） |
| エディタの補完ツールチップ | `--editor-tooltip-background-color` | `#002d38`（t: syntax.css:35） | `#1e1d1a`（t: syntax.css:51） |
| ボタン | `--button-background` | `#002d38` @70%（t: ui.css:61） | `#272626`（t: ui.css:109） |

明度順（暗 → 明）:
- **Solarized Dark**: page/menu/popup/input（5%）< **editor**/modal 本文（8%）< note-list/modal ヘッダー（11%）< **sidebar**（14%）。**サイドバーが最も明るい**。スクリーンショットでも左ペインが最も明るい青緑に見える（§12）。base02 をサイドバーに使うのは Osaka にない Inkdrop 版独自の判断である（Osaka の `bg_sidebar` は bg = base04、craftzdog_solarized-osaka.nvim@a21176e lua/solarized-osaka/colors.lua:307-309）。
- **Kanagawa Dragon**: page/menu/input（Black0）< sidebar（Black1）< note-list/popup（Black2）< **editor**/modal 本文（Black3）< モーダルヘッダー/ボタン/kbd（Black4）。ui.css のヘッダーコメントが「editor sits on the lightest ground (dragonBlack3) while the surrounding chrome and floats recede into the darker dragon inks」と明言している（kanagawa@f9c14a5 packages/dragon/styles/ui.css:7-9）。

共通点: メニュー・ドロップダウン・入力欄は最暗色（base04 / Black0）に落とす。モーダル本文はエディタと同色、モーダルヘッダーは 1 段明るい。

---

## 5. 文字色の階層とアクセント

| 役割 | トークン | Solarized Dark | Kanagawa Dragon |
|---|---|---|---|
| 本文 | `--text-color` | `#839495` neutral-400（t: ui.css:26） | `#c5c9c5` @90% dragonWhite（t: ui.css:40） |
| 見出し（UI） | `--header-text-color` | `#b28600` yellow-500（t: ui.css:73） | `#c3b188` dragonYellow（t: ui.css:127） |
| dark-text（※命名と逆で暗側は弱い） | `--dark-text-color` | `#fdf6e2` @40%（b: ui.css:366） | `#c5c9c5` @90%（t: ui.css:88） |
| muted | `--muted-text-color` | `#fdf6e2` @60%（b: ui.css:367） | `#c8c092` @70% oldWhite（t: ui.css:89） |
| light | `--light-text-color` | `#fdf6e2` @85%（b: ui.css:368） | `#7a8583` @90% dragonGray3（t: ui.css:90） |
| unselected | `--unselected-text-color` | `#5b60be` violet-600（t: ui.css:48） | `#8a93a8` @80% dragonViolet（t: ui.css:91） |
| hovered | `--hovered-text-color` | `#fdf6e2` @80%（b: ui.css:374） | `#c5c9c5` @95%（t: ui.css:92） |
| pressed | `--pressed-text-color` | `#fdf6e2` @90%（b: ui.css:375） | `#c5c9c5` @90%（t: ui.css:340） |
| selected | `--selected-text-color` | `#a8dbff` blue-100（t: ui.css:49） | `#c5c9c5`（t: ui.css:93） |
| disabled | `--disabled-text-color` | `#fdf6e2` @30%（b: ui.css:496） | `#c5c9c5` @30%（t: ui.css:341） |
| inverted（色面上の文字） | `--inverted-text-color` | `#00141a` @90%（b: ui.css:382） | `#11110e` @90%（t: ui.css:330） |
| サイドバー項目 / 選択項目 | `--sidebar-menu-item-color` / `-active-item-color` | `#839495` / `#839495`（t: ui.css:128 / b: ui.css:1444） | `#c8c092` @80% / `#c5c9c5`（t: ui.css:200-201） |
| サイドバー節見出し | `--sidebar-menu-section-color` | `#5b60be`（unselected 経由、b: ui.css:1438） | `#8a93a8` @80%（t: ui.css:199） |
| ノートリスト: タイトル / 本文抜粋 / 日付 | `--note-list-view-item-{header,,date}-color` | `#839495` / `#fdf6e2` @60% / `#6d72c5` violet-500（t: ui.css:138,140 / b: ui.css:1499） | `#c5c9c5` / `#c8c092` @70% / `#8a93a8` dragonViolet（t: ui.css:216-220） |

アクセント:

| | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| primary | `#278bd3` @90% blue-500（t: ui.css:10） | `#8ca5b1` dragonBlue2（t: ui.css:16） |
| secondary | `#a1a1aa` @80% **Tailwind zinc-400**（b: ui.css:33、未上書き） | `#8a93a8` dragonViolet（t: ui.css:17） |
| link / link hover（UI） | `#278bd3` / `#47adf5` blue-300（b: ui.css:131 / t: ui.css:31） | `#8ca5b1` / `#96a0b6` dragonTeal（t: ui.css:45-46） |
| テキスト選択（UI） | `--highlight-background` `#278bd3` @30%、文字 `#d7eeff`（t: ui.css:36-37） | `#2d4f67` waveBlue2、文字 dragonWhite（t: ui.css:51-52） |
| positive / negative / info / warning | `#859900` / `#dc312e` / `#278bd3` / `#b28600`（info, warning は t: ui.css:42-43、他はランプ経由で b） | `#89997a` / `#c4746e` / `#658695` / `#ff9e3d`（t: ui.css:80-83） |
| note status: active / onhold / completed / dropped | `#839495` / `#b28600` / `#2aa298` / `#ea413e`（t: ui.css:166-169） | `#c8c092` / `#ff9e3d` / `#89997a` / `#c4746e`（t: ui.css:253-256） |

Solarized の muted / hover / disabled 系テキストは、基盤既定の「`--hsl-neutral-50` のアルファ」がそのまま使われる。Solarized ではそれが **base3（クリーム色 `#fdf6e2`）のアルファ**になる。暖色寄りの半透明テキストは、ランプ置換の副作用として生じたものである。**[確認済: 解決値] / 意図かどうかは [推測不能]**

---

## 6. UI 要素の色割り当てと状態別配色

### 6.1 前提: セレクタは Inkdrop 本体側 [確認済]

テーマの `ui.css` は `:root` の変数宣言（と acrylic 条件）だけで、コンポーネントのセレクタを持たない（solarized-dark@4337f6e styles/ui.css 全体、kanagawa@f9c14a5 packages/dragon/styles/ui.css 全体）。基盤 `@inkdropapp/css` の `ui.css` も、`:root` のトークン宣言（1603 行）しか持たない。トークンを実際の DOM に適用するコンポーネント CSS（`theme.ui.components` レイヤ）は Inkdrop 本体に同梱されており、**本調査範囲のリポジトリには存在しない**。**[未確認]** そのため、状態別配色は「トークン単位」で記す。セレクタとの対応は `inkdropapp_base-ui-theme` リポジトリ、または実アプリの DevTools で別途確認が必要。

### 6.2 状態トークン（宣言値）

| 要素・状態 | トークン | Solarized Dark | Kanagawa Dragon |
|---|---|---|---|
| ノートリスト項目 selected（フォーカス外の選択） | `--note-list-view-item-selected-background` | `#278bd3` @20%（t: ui.css:141） | `#223249` @70% waveBlue1（t: ui.css:221） |
| ノートリスト項目 active（フォーカス中の選択） | `--note-list-view-item-active-background` | `#278bd3` @40%（t: ui.css:142） | `#2d4f67` @80% waveBlue2（t: ui.css:224） |
| ノートリスト区切り線 | `--note-list-view-item-separator-border` | `1px solid #073541`（t: ui.css:139） | `1px solid #272626` @60%（t: ui.css:218） |
| サイドバー項目 inactive 選択 | `--sidebar-menu-item-inactive-background` | `#47adf5` @20% blue-300（b: ui.css:1430） | `#8ca5b1` @20%（t: ui.css:195） |
| サイドバー項目 active 選択 | `--sidebar-menu-item-active-background` | `#47adf5` @30%（b: ui.css:1434） | `#2d4f67` @60%（t: ui.css:198） |
| 設定サイドバー active | `--preferences-sidebar-item-active-background` | `#47adf5` @20%（b: ui.css:1555） | `#8ca5b1` @20%（t: ui.css:548） |
| ボタン: 通常 / hover / down / active | `--button-background`, `--button-{hover,down,active}-background-color` | `#002d38`@70% / `#073541`@70% / `#002d38`@80% / `#073541`@70%（t: ui.css:61-62、b: ui.css:745,755） | `#272626` / `#3a3936` / `#3a3936` / `#3a3936`（t: ui.css:109-113） |
| ボタン文字 | `--button-text-color` | `#fdf6e2` @60%（b: ui.css:709） | `#c5c9c5` @75%（t: ui.css:110） |
| basic ボタン hover / down | `--basic-button-{hover,down}-background` | `#002d38`@50% / `#073541`@50%（t: ui.css:63 / b: ui.css:797） | `#272626`@60% / `#272626`@50%（t: ui.css:114,348） |
| primary ボタン hover / focus / down / active | `--primary-color-{hover,focus,down,active}` | `#2078b6` / `#2078b6` / `#1b6498` / `#1b6498`（blue-600/700、b: ui.css:514,562,610,658） | `#96a0b6` / `#96a0b6` / `#8ca5b1` / `#8ca5b1`（t: ui.css:440,466,492,518） |
| 入力 focus ボーダー | `--input-focus-border-color` | `#278bd3`（t: ui.css:78） | `#8ca5b1`（t: ui.css:132） |
| フォーム focus ボーダー | `--focused-form-border-color` | `#7ed4fc` @60% **Tailwind sky-300**（b: ui.css:89、未上書き） | `#8ca5b1` @70%（t: ui.css:32） |
| フォーカスリング | `--focused-outline-color`（幅 `--2px`、solid） | `#278bd3` @30%（t: ui.css:21） | `#8ca5b1` @30%（t: ui.css:34） |
| メニュー hover / active | `--menu-hover-item-background` / `--menu-active-item-background` | `#ffffff05` / `#0000001a`（b: ui.css:1135,1145） | 同左（b） |
| リスト hover / active | `--selection-list-{hover,active}-background` | `#ffffff05` / `#ffffff14`（b: ui.css:1014,1024） | 同左 |
| ドロップダウン hover / selected | `--dropdown-{hovered-item,selected}-background` | `#ffffff14`（b: ui.css:1387,1394） | 同左 |
| チェックボックス on / トグル on | `--checkbox-active-background`, `--toggle-on-lane-color` | primary `#278bd3` @90%（b: ui.css:1317,1350） | primary `#8ca5b1`（b） |
| 無効 | `--disabled-opacity` | 0.45（b: ui.css:495） | 0.45（b） |
| スクロールバー thumb / track | `--scrollbar-{thumb,track}-background` | `#ffffff33` / `#ffffff05`（b: ui.css:1467-1468、幅 6px） | 同左 |

状態配色の要点:
- **Solarized Dark**: 選択状態は「primary（blue-500）のアルファ段階」（20% → 40%）で表す。ボタンは neutral-800/700 のアルファで明暗を付ける。hover/focus/down の多くは基盤既定で、ランプ経由の自動解決に任せている。
- **Kanagawa Dragon**: 選択状態は kanagawa.nvim の `bg_visual`（waveBlue1）と `bg_search`（waveBlue2）の 2 段で表す。ボタンは Black4 → Black5。accent の hover/focus は「同色」、down/active は「同色 @85%」というアルファ規則で統一している（kanagawa@f9c14a5 packages/dragon/styles/ui.css:364-372 のコメントと 439-542）。
- メニュー・リスト・ドロップダウンの hover は、両テーマとも基盤既定の白アルファ（2〜8%）のまま。

---

## 7. Markdown プレビュー

### 7.1 要素ごとの適用規則（基盤 markdown.css、両テーマ共通） [確認済]

| 要素 | 規則（css@add48d9 markdown.css） | 使うトークン |
|---|---|---|
| 本文 | `.mde-preview { color: var(--text-color); font-size: 16px; line-height: 1.5 }`（112-125） | `--text-color`, `--mde-preview-line-height` |
| 見出し h1〜h6 | margin 24px / 16px、weight bold、line-height 1.25、色 `--mde-preview-heading-color`（363-374）。サイズは `--h1..--h6` = 2 / 1.5 / 1.25 / 1 / 0.875 / 0.85em（ui.css:45-50）。h1 は下線 2px、h2 は下線 1px（`--mde-preview-heading-border-color`、182-189, 376-382）。h6 は muted 色（399-403） | heading-color, heading-border-color, heading-muted-text-color |
| リンク | 色 `--mde-preview-link-color`、下線なし、hover で underline（157-161, 296-298） | link-color |
| 太字 / 斜体 | `strong` は色 `--mde-preview-strong-color`、weight bold。`em` は色 `--mde-preview-em-color`（168-176） | strong-color, em-color |
| リスト | padding-left 2em。`li::marker` の色は 3 段で循環（440-466） | list-marker{,-2,-3}-color |
| 引用 | 左ボーダー 0.25em、`--mde-preview-blockquote-border-color`、文字は muted（410-415） | blockquote-* |
| テーブル | thead の文字色と背景、セル border 1px、行背景、奇数行ストライプ（675-701） | table-* |
| hr | 高さ 0.25em の帯、背景 `--mde-preview-hr-background-color`（240-250） | hr-* |
| インラインコード | font-size 85%、padding 0.2em 0.4em、border-radius 6px、border は width / color トークン（715-725） | inline-code-* |
| コードブロック | `pre`: font-size 85%、line-height 1.45、border 1px、radius 6px（809-820）。メタ行（言語名等）は別背景で上角丸（757-797） | codeblock-* |
| コードブロック内のトークン | `.mde-preview .codeblock .tok-*` が **エディタと同じ `--syntax-*`** を使う（css@add48d9 syntax.css:339-340） | syntax-* |
| タスクリスト | `.task-list-item` は list-style none。完了は line-through、色 `--mde-preview-task-list-checked-color`（915-955） | task-list-checked-color |
| 画像 | 背景 `--mde-preview-image-background-color`（221-226） | image-background-color |
| mark（==hl==） | 文字色・背景、3px の下線（191-199） | inline-mark-* |
| kbd | 11px monospace、radius 6px、inset shadow（342-361） | kbd-* |
| GFM alert | 左ボーダー 0.25em、タイトル色と枠色を `--gfm-alert-{note,tip,important,warning,caution}` から取る（965-1031）。既定は `var(--blue/--green/--purple/--orange/--red, …)`（3-7） | gfm-alert-* |
| 等幅フォント | `ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace`、12px（472-499） | — |

### 7.2 プレビュー配色（宣言値）

| 項目 | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| 見出し | `#b28600` yellow-500（t: preview.css:49） | `#c3b188` dragonYellow（t: preview.css:59） |
| 見出し下線 | `#647a82` @15%（border-color 経由、b） | `#625e5b` @40%（b） |
| リンク | **`#2aa298` cyan-500**（t: preview.css:12）。UI の link は blue | **`#89997a` dragonGreen2**（t: preview.css:17）。ファイル冒頭コメントは「links dragonBlue2」と書いており（preview.css:6）、**コメントと実値が不一致** |
| 太字 | `#adb8b8` base1（t: preview.css:50） | `#c4746e` dragonRed（t: preview.css:60） |
| 斜体 | `#859900` green-500（t: preview.css:51） | `#89997a` dragonGreen2（t: preview.css:61） |
| リストマーカー 1/2/3 | green `#859900` / orange `#ca4c16` / cyan `#2aa298`（t: preview.css:15-17） | dragonTeal `#96a0b6` / roninYellow `#ff9e3d` / springGreen `#98bc6c`（t: preview.css:20-22） |
| 引用（線 / 文字） | `#073541` / `#fdf6e2` @60%（b） | `#3a3936` / `#c8c092` @70%（b） |
| テーブル見出し（文字 / 背景） | `#b28600` / `#073541` @80%（t: preview.css:34-35） | `#c3b188` / `#272626` @60%（t: preview.css:41-42） |
| テーブル行 / ストライプ | `#073541` @80% / `#002d38` @40%（t: preview.css:36-37） | `#272626` @60% / `#181616` @50%（t: preview.css:43-44） |
| テーブル罫線 | `#073541`（b） | `#3a3936`（b） |
| hr（帯 / 線） | `#073541` / `#647a82` @15%（b） | `#3a3936` / `#625e5b` @40%（b） |
| インラインコード（文字 / 背景 / 枠） | `#839495` / `#586e74` @30% / `#586e74` @50%、1px（t: preview.css:26-31） | `#c8c092` / `#272626` @50% / `#625e5b` @50%、1px（t: preview.css:31-36） |
| コードブロック（背景 / メタ背景） | `#002d38` @40% / `#073541` @80%（t: preview.css:20-25） | `#181616` @50% / `#272626` @60%（t: preview.css:25-28） |
| コードブロック枠 | `#79c5fc` @10%（基盤 `hsl(blue-200 / 10%)` が Solarized blue-200 に解決、b: markdown.css:106） | `#bedbfe` @10%（**Tailwind blue-200 のまま**、b） |
| 画像背景 | `#073541` @80%（t: preview.css:42） | `#272626` @60%（t: preview.css:49） |
| mark | 文字 `#ffd2d1` red-50、背景 `#57100f` red-900、下線 `#dc312e`（t: preview.css:45-47） | 文字 dragonWhite、背景 dragonYellow @22%、下線 roninYellow（t: preview.css:52-56） |
| タスク完了取り消し線 | `#fdf6e2` @60%（b） | `#c8c092` @70%（b） |
| GFM alert: note / tip / important / warning / caution | `#278bd3` / `#859900` / **`#a855f7`（Tailwind purple-500）** / `#ca4c16` / `#dc312e`（すべて b、`--blue` 等経由） | `#8ca5b1` / `#89997a` / `#8a93a8` / `#b7927b` / `#c4746e`（`--blue` 等をテーマが再定義、t: ui.css:64-75） |

両テーマとも、プレビューのサーフェスを独自変数にまとめている。Solarized は `--solarized-preview-surface(-subtle)`（preview.css:4-9）、Kanagawa は `--kanagawa-preview-surface(-subtle)`（preview.css:11-12）。**[確認済]**

---

## 8. シンタックスハイライト

### 8.1 エディタ chrome

| 項目 | Solarized Dark（t: syntax.css） | Kanagawa Dragon（t: syntax.css） |
|---|---|---|
| 前景 / 背景 | `#839495` / `#002129`（8-9） | `#c5c9c5` / `#1e1d1a`（16-17） |
| キャレット | `#9fabad` base0（10） | dragonWhite（18） |
| 選択（非フォーカス / フォーカス） | `#073541` base02 / `#278bd3` @30%（11-12） | `#3a3936` Black5 / `#223249` waveBlue1（19-24） |
| アクティブ行（本体 / ガター） | `#002d38` @50%（13-15, 23-25） | `#272626` @30%（25-27, 39-41） |
| ガター文字 / 右線 | `#586e74` base01 / なし（19-20） | `#625e5b` Black6 / `1px solid #272626`（33-34） |
| 括弧一致 | 赤 @90% の枠 + @20% の背景（61-62） | dragonTeal @90% の枠 + @20% の背景（81-85） |
| 選択一致 / 検索一致 / 検索現在 | cyan @30% / yellow @35% / orange @45% + orange 枠（66-73） | waveAqua1 @35% / waveBlue2 / dragonYellow @40% + 枠（90-102） |
| ツールチップ | 背景 base03、枠 base02、radius 0.8em（31-37） | 背景 Black3、枠 Black5、radius 0.8em（47-55） |
| 補完の選択行 | 背景 base02、文字 base1（40-46） | 背景 waveBlue2、文字 dragonWhite（58-66） |
| 末尾空白 | pink @40%（82） | dragonPink @35%（113-115） |

### 8.2 Markdown トークン（エディタ）

基盤 syntax.css が `.tok-*` / `.md-*` クラスを変数へ割り当てる（css@add48d9 syntax.css:339-740）。両テーマが宣言しないのは `--editor-gutter-border-right-color` と `--syntax-content-separator-font-weight` の 2 変数だけで、前者は `--editor-gutter-border-right` を直接上書きしているため実質未使用。

| トークン | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| 見出し（h1〜h6 共通、bold） | `#b28600` yellow-500（216-229） | `#c3b188` dragonYellow（253-266） |
| 太字 | `#adb8b8` base1（236） | `#c4746e` dragonRed（273） |
| 斜体 | `#859900` green（234） | `#89997a` dragonGreen2（271） |
| リンク（下線） / URL | `#2aa298` cyan / `#b28600` yellow（238, 179） | `#8ca5b1` dragonBlue2 / `#96a0b6` dragonTeal（275, 216） |
| 引用（italic） | `#839495`（232-233） | `#c8c092` oldWhite（269-270） |
| リスト本文 / マーカー 1-2-3 | fg / green・orange・cyan（231, 114-116） | dragonTeal / dragonTeal・roninYellow・springGreen（268, 151-153） |
| インラインコード（背景 / 枠） | base01 @30% / @50%（96-98） | Black4 @50% / Black6 @50%（133-135） |
| monospace（コード文字） | `#adb8b8` base1（241） | `#c8c092` oldWhite（278） |
| フェンスコードブロック（背景 / 枠） | base03 @40% / base02（100-102） | Black2 @50% / Black4（137-139） |
| 区切り（hr `---`） | `#c52b75` pink-600（230） | `#c34143` autumnRed（267） |
| mark | red-50 / red-900 / red-500（104-106） | dragonWhite / dragonYellow @22% / roninYellow（141-143） |
| テーブル（枠 / 背景） | base02 / base03 @40%（108-110） | Black4 / Black2 @40%（145-147） |
| 引用線 | base01（112） | Black6（149） |

**旧形式との関係**: 現行 syntax.css は、旧 `solarized-dark-syntax` の index.css の `--color-solarized-*` 参照を `--color-*` に置換したものである。値の差は `--syntax-content-separator-color`（旧 base01 → 新 pink-600）と `--md-list-mark-2/3-color` の新設だけ（スクリプトで全変数を diff）。Kanagawa も同様で、差は content-separator（旧 Black6 → 新 autumnRed）と list-mark-2/3 の新設のみ。**[確認済]**

### 8.3 コードブロック内の言語トークン

| カテゴリ | Solarized Dark | Kanagawa Dragon | kanagawa.nvim dragon `syn`（参考） |
|---|---|---|---|
| comment（italic） | base01 `#586e74` | dragonAsh `#737d73` | comment = dragonAsh |
| string / character / regexp | yellow `#b28600` / yellow / yellow | dragonGreen2 / dragonGreen2 / **dragonRed** | string = dragonGreen2, regex = dragonRed |
| number / bool / atom / null | pink（magenta） `#d33682` / pink / pink / fg | dragonPink / dragonOrange / dragonOrange / dragonOrange | number = dragonPink, constant = dragonOrange |
| keyword（control/definition/module/operator） | green `#859900` | dragonViolet `#8a93a8` | keyword = dragonViolet |
| operator | violet `#6d72c5` | dragonRed | operator = dragonRed |
| punctuation / bracket | cyan（bracket は fg） | dragonGray2 | punct = dragonGray2 |
| name / property | cyan | fg / dragonYellow | identifier = dragonYellow |
| function / definition | blue `#278bd3` | dragonBlue2 | fun = dragonBlue2 |
| variable | base00 `#647a82` | fg（無色） | variable = none |
| class / type | orange `#ca4c16` | dragonAqua | type = dragonAqua |
| tag / attribute name | blue / cyan | dragonBlue2 / dragonYellow | — |
| namespace / label / macro | pink / pink / cyan | dragonAqua / dragonRed / dragonRed | preproc = dragonRed |
| meta / annotation | red / orange | dragonRed / dragonOrange | — |
| inserted / deleted / changed | green / red / yellow | autumnGreen / autumnRed / autumnYellow | vcs.* |
| invalid | base02 + 赤点線 | Black6 + samuraiRed 点線 | — |

出典: solarized-dark@4337f6e styles/syntax.css:119-255、kanagawa@f9c14a5 packages/dragon/styles/syntax.css:156-292（ヘッダーコメント 5-10 が上流 `syn` 表との対応を明記）、rebelot_kanagawa.nvim@bb85e4b lua/kanagawa/themes.lua:241-260。

**Solarized Dark と Osaka nvim の差**: Osaka nvim は `String = cyan500`、`Constant = cyan500`、`Operator = green500`、`Type = yellow500` である（craftzdog_solarized-osaka.nvim@a21176e lua/solarized-osaka/groups/syntax.lua:7-31）。Inkdrop 版は string = yellow、operator = violet、class = orange、punctuation = cyan で、**シンタックス配色は Osaka nvim をそのまま写したものではない**。**[確認済]** 由来は不明（旧 solarized-dark-syntax 時代から同一）。**[未確認]**

---

## 9. Mermaid の配色

基盤 mermaid.css は少数の base トークンから `var()` 連鎖で全図種へ波及する設計（css@add48d9 mermaid.css:1-18、api-docs@965790b src/app/guides/create-a-theme/page.mdx:322-335）。

| トークン | Solarized Dark（t: preview.css） | Kanagawa Dragon（t: preview.css） |
|---|---|---|
| 背景 | transparent（b: mermaid.css:22） | 同左 |
| 文字 / ノード文字 | base1 `#adb8b8`（60, 62） | 未上書き → `--text-color` `#c5c9c5` @90%（b） |
| 線 | cyan `#2aa298`（61） | dragonGreen2（69） |
| ノード背景 / 枠 | base02 `#073541` / blue（63-64） | waveBlue1 @55% / dragonBlue2（70-71） |
| クラスタ背景 / 枠 | preview surface subtle / base01 @50%（65-68） | preview surface subtle / Black6 @40%（72-73） |
| エッジラベル背景 | base03 @85%（69-71） | waveBlue2 @70%（74） |
| ノート（背景 / 枠 / 文字） | yellow-900 / yellow-600 / yellow-100（74-76） | winterYellow / dragonYellow / oldWhite（77-79） |
| シーケンスのラベルボックス | green-900 / green-500、文字 base1（84-86） | autumnRed / autumnRed、文字 dragonWhite（85-87） |
| シーケンス番号 | 未上書き（b） | Black3（82） |
| Gantt（task / active / done / crit / today） | blue-800 / cyan-800 / base01 / red-800 / orange（91-100） | waveBlue2 / dragonPink / Black5 / autumnRed / dragonRed（94-105） |
| seed（primary / secondary / tertiary） | blue-600 / pink-700 / green-600（105-107） | dragonBlue / dragonRed / dragonYellow（108-110） |
| Error | red-950 背景 / red-300 文字（110-111） | winterRed / dragonRed（113-114） |
| Event modeling / Cynefin | violet・green・blue・yellow の @35%（114-136） | dragonPink・dragonGreen2・dragonBlue2・dragonYellow・autumnRed の @35%（117-151） |

Solarized は preview.css のコメントで「gitGraph のブランチラベルに色が漏れるため、ラベル文字はニュートラルに保つ」と理由を述べている（preview.css:78-83）。

---

## 10. 境界線・影・角丸・フォント・余白

すべて**テーマが変更しない基盤由来の値**である（ボーダー色と一部の影色を除く）。

| 項目 | 値 | 出典 | テーマの変更 |
|---|---|---|---|
| border-color / strong / internal / selected | SD: `#647a82` @15% / @22% / `#ede7d4` @10% / @35%。KD: Black6 @40% / @60% / @30% / @80% | b: ui.css:416-431、t: SD ui.css:54-55、KD ui.css:98-101 | 色のみ |
| solid-border（ポップアップ枠、tabular menu、checkbox） | SD base02 `#073541`、KD Black5 `#3a3936` | t: SD ui.css:56、KD ui.css:102 | 色のみ |
| サイドバー / ノートリスト右線 | SD: `1px solid` base03 / base02。KD: `1px solid` Black4 / Black4 @75% | t: SD ui.css:127,136、KD ui.css:194,213 | 色のみ |
| subtle-shadow | `0 1px 2px 0 var(--black)`。SD `#002129`、KD `#181616`（KD は `--black` を Black2 に再定義） | b: ui.css:279、KD t: ui.css:280 | KD のみ間接変更 |
| floating / raised / modal shadow | 黒アルファの多層影（例: floating `0 2px 4px #0003, 0 2px 10px #0000004c`） | b: ui.css:280-285, 1408-1411 | 変更なし |
| grouped-segment shadow | KD のみ Black0 アルファで再定義 | t: KD ui.css:357-362 | KD のみ |
| 角丸 | default 7px（`--default-border-radius` 0.5rem）、squircle 時 15px / 24px（`1.0714rem` / `1.7143rem`）、`corner-shape: squircle` | b: utilities.css:17-18、ui.css:24-26, 1566-1572 | 変更なし |
| エディタのツールチップ角丸 | 0.8em、補完項目 0.2em、折り畳み 0.2em | t: 両 syntax.css | 両テーマ同値（基盤既定と同一。**[推測]**） |
| プレビュー角丸 | code / pre / kbd 6px、エディタのインラインコード 0.4em | b: markdown.css:359,724,819、syntax.css:713 | 変更なし |
| UI フォント | `-apple-system, BlinkMacSystemFont, Segoe UI, 'Lato', 'Helvetica Neue', Arial, …` | b: ui.css:10-18 | 変更なし |
| サイズ | `--em-size` / `--font-size` 14px、line-height 1.4285em、見出し weight 600 | b: utilities.css:7-9、ui.css:42-50,117 | 変更なし |
| プレビュー本文 | 16px / line-height 1.5、コード 12px（pre は 85%） | b: markdown.css:9,123-124,483,497,814 | 変更なし |
| エディタのフォント | トークン定義なし（アプリ設定側） | — | **[未確認]** |
| 余白 | 入力 0.7857em × 1em、popup 0.833em × 1em、プレビューの p/ul/table 等は下 16px、見出し上 24px / 下 16px | b: ui.css:58-60,1228-1229、markdown.css:369-370,543-553 | 変更なし |

---

## 11. Solarized Dark と Solarized Osaka / 本家 Solarized の関係

根拠:
1. README が「The color palette is based on Solarized Osaka」と明記している（solarized-dark@4337f6e README.md:4）。旧 `solarized-dark-syntax` の README も同文（solarized-dark-syntax@39f67ee README.md:4）。作者は両リポジトリとも Takuya Matsuyama（craftzdog）で、Osaka の作者と同一である（package.json:22、Osaka リポジトリ所有者）。
2. 色値の完全一致: Inkdrop の 9 系統 × 11 段のうち、`neutral-900` 以外の全 98 色が Osaka `M.default` の HSL 引数と完全一致する（スクリプトで照合、`inkdrop-palettes.json` の `osaka_match`）。`neutral-900`（192 100% 8%）は Osaka になく、tokens.css のコメントも「(intermediate)」としている（tokens.css:13）。
3. コミット履歴: 浅いクローンのため確認できない。**[未確認]**

本家 Solarized 16 色との比較（https://ethanschoonover.com/solarized/ 、2026-10-09 取得）:

| 本家 | 本家 Hex | Osaka / Inkdrop の対応 | Hex | 差 |
|---|---|---|---|---|
| base03 | `#002b36` | neutral-800 | `#002d38` | ±2 |
| base02 | `#073642` | neutral-700 | `#073541` | ±1 |
| base01 | `#586e75` | neutral-600 | `#586e74` | ±1 |
| base00 | `#657b83` | neutral-500 | `#647a82` | ±1 |
| base0 | `#839496` | neutral-300（Osaka base0 = 65%） | `#9fabad` | **明るく変更** |
| base1 | `#93a1a1` | neutral-200（Osaka base1 = 70%） | `#adb8b8` | **明るく変更** |
| base2 / base3 | `#eee8d5` / `#fdf6e3` | neutral-100 / 50 | `#ede7d4` / `#fdf6e2` | ±1 |
| アクセント 8 色 | 表 §2.1 | 各 500 | — | ≤ ±3 |
| （なし） | — | base04 = neutral-950 | `#00141a` | Osaka 追加色 |

- Osaka は base0 / base1 を明るくしており、旧値をコメントで残している（Osaka colors.lua:16-19）。README は「text colors … are somewhat too dark … brightens the base colors」と理由を述べる（Osaka README.md）。
- **Inkdrop の本文色 `neutral-400`（"fg"、`#839495`）は本家 base0 `#839496` とほぼ同色**。Osaka の `fg`（colors.lua:122）である。つまり本文テキストの明るさは本家 Solarized に近い。**[確認済: 数値]**
- Osaka nvim の Normal 背景は bg = base04（Osaka editor.lua:37）。一方、Inkdrop のエディタは neutral-900（独自の中間色）で、Osaka より 1 段明るい。

---

## 12. Kanagawa Dragon: Inkdrop 版と kanagawa.nvim の違い（Inkdrop 版が正本）

| 項目 | kanagawa.nvim（dragon） | Inkdrop kanagawa-dragon | 判定 |
|---|---|---|---|
| dragonBlack2 / dragonBlack3 の HEX | Black2 = `#1D1C19`、Black3 = `#181616`（colors.lua:64-65）。Black3 は Black2 より暗く、番号順が非単調 | Black2 = `#181616`、Black3 = `#1D1C19`（palette.css:18-19）。**番号順に明るくなるよう入れ替え** | **[確認済] 差異**。上流の colors.lua は 2023-09 以降この並びのまま（GitHub API でコミット履歴を確認、直近の変更 bc78b40 は lotusYellow の空白修正のみ） |
| エディタ背景 | `ui.bg = dragonBlack3` = `#181616`（themes.lua:211） | `--kanagawa-dragonBlack3`（コメント "ui.bg"）= `#1d1c19`（HSL 計算で `#1e1d1a`） | 名前で対応付けたため、**Inkdrop のエディタ背景の宣言値は、上流の bg_m1（`#1d1c19`）に当たる色**（HSL 宣言 `45deg 7% 11%`）になっている。描画色は未測定。意図的な単調化か誤りかは不明 **[推測不能]** |
| サイドバー等 | 上流は sidebar 専用色なし（float.bg = Black0、bg_dim = Black1） | sidebar Black1、note-list Black2、menu / input Black0 | Inkdrop 独自の割り当て |
| pmenu（補完） | bg = waveBlue1、bg_sel = waveBlue2（themes.lua:222-229） | tooltip 背景 = Black3、選択 = waveBlue2（syntax.css:51-60、コメント "pmenu.bg" は不正確） | 一部差異 |
| CursorLine | bg_p2 = Black5（editor.lua:26） | アクティブ行 = Black4 @30%（syntax.css:25-27、コメントは "ui.bg_p2"） | 差異（弱めた） |
| LineNr | fg nontext、bg bg_gutter（editor.lua:57） | ガター文字 Black6、ガター背景 transparent | 背景は差異 |
| Markdown 見出し | `@markup.heading` → Function（dragonBlue2）（treesitter.lua:122, syntax.lua:30） | dragonYellow（syntax.css:253、preview.css:59） | **差異** |
| 太字 / 斜体 | bold / italic のみ（色なし、treesitter.lua:113-115） | 太字 dragonRed、斜体 dragonGreen2 | **差異**（Inkdrop が色付け） |
| 引用 | `@markup.quote` → parameter = dragonGray（treesitter.lua:131） | oldWhite italic | 差異 |
| inline code | `@markup.raw` → String（dragonGreen2）（treesitter.lua:142） | 文字 oldWhite、背景 Black4 @50% | 差異 |
| 言語トークン | syn 表（§8.3） | syn 表にほぼ準拠（ヘッダーコメントで明示） | ほぼ一致 |
| 未使用色 | — | dragonGreen と katanaGray はパレットで定義されているが、ui / syntax / preview のどこからも参照されていない | — |

---

## 13. 他テーマとの比較: 一般パターンと対象 2 テーマ固有の判断

### 13.1 Inkdrop v6 テーマの一般的実装パターン [確認済]

1. `"theme": true` の統合パッケージで、`ui.css` / `syntax.css` / `preview.css` をそれぞれ `@layer theme.ui` / `theme.syntax` / `theme.preview` に包み、**変数だけを上書き**する（api-docs@965790b src/app/guides/create-a-theme/page.mdx:73-86, 150, 252-260, 291）。
2. default-dark / default-light は 3 ファイルとも空のレイヤ宣言とコメントのみ（default-dark@68c28c4 styles/ui.css:1-15 ほか）。**基盤 `@inkdropapp/css` の `light-dark()` 既定値が Inkdrop 標準テーマそのもの**である。
3. パレットの持ち方は 2 系統あり、ガイドが使い分けを説明している（page.mdx:397-405）。
   - **ランプ上書き型**（Tailwind 形の 50〜950 ランプを `@layer theme` で再定義）: solarized-dark / solarized-light / gruvbox / nord-light。gruvbox は 8 系統だけ上書きし、対応のない系統は「重複で埋めず、参照するセマンティック変数を ui.css で付け替える」と明記している（gruvbox@3ca0060 styles/tokens.css:1-24）。
   - **固有名パレット型**: kanagawa wave / dragon / lotus。
4. `palette.json` は publish 時の自動生成物。

### 13.2 同系テーマとの比較（抜粋。CSS 宣言の生値）

| トークン | sol-dark | sol-light | gruvbox | kw-wave | kw-dragon | kw-lotus |
|---|---|---|---|---|---|---|
| sidebar | neutral-700 | neutral-100 | neutral-900 @60% | sumiInk1 | dragonBlack1 | lotusWhite1 |
| note-list | neutral-800 | neutral-50 | neutral-900 @40% | sumiInk2 | dragonBlack2 | lotusWhite3 |
| editor | neutral-900 | neutral-50 | neutral-950 @80% | sumiInk3 | dragonBlack3 | lotusWhite3 |
| preview link | cyan-500 | cyan-500 | blue-500 | crystalBlue | **dragonGreen2** | lotusBlue4 |
| heading | yellow-500 | yellow-500 | green-500 | carpYellow | dragonYellow | lotusYellow3 |
| strong | neutral-200 | neutral-700 | yellow-500 | peachRed | dragonRed | lotusRed |
| note 選択 / active | blue-500 @20/40% | 同左 | 同左 | waveBlue1 @70 / waveBlue2 @80 | 同左 | lotusBlue3 @40/70 |

出典: 各リポジトリの styles/ui.css, preview.css, syntax.css（スクリプトで抽出）。

### 13.3 対象 2 テーマ固有の設計判断（一般パターンではないもの）

- **Solarized Dark**
  - サイドバーを最も明るい base02 にする逆グラデーション（sol-light でも sidebar が neutral-100 と最も濃く、Solarized 系の共通判断。gruvbox や Kanagawa は逆）。
  - エディタ背景に Osaka にない中間色 neutral-900 を新設。
  - プレビューと syntax のリンクを cyan に、UI のリンクを blue に分けている。
  - 日付・未選択テキスト・節見出しに violet を使う。
  - シンタックスの string を yellow にしている（Osaka nvim は cyan）。
  - Mermaid で gitGraph へのラベル色漏れを避けるため中立色にしている。
- **Kanagawa Dragon**
  - ランプを使わず、tone / 状態 / accent の派生トークン約 270 個を手で再割り当て（ui.css:268-550）。理由は「Kanagawa は 1 色相 1 トーンでランプがない」（ui.css:364-372）。
  - hover = 同色、down / active = @85% というアルファ規則。
  - エディタを最も明るい面にする depth model。
  - 太字を dragonRed、プレビューのリンクを dragonGreen2 にする（上流 nvim には無い色付け）。
  - Wave と Dragon は ui.css の構造（行構成）がほぼ同一で、色名だけ違う（kw-wave 563 行 / kw-dragon 569 行、宣言数はどちらも 606）。

### 13.4 既存テーマを無条件に正としない: 基盤既定色の継承と不整合

`leaks.py` で、テーマが上書きしていない基盤ランプ（Tailwind 系）に解決されるセマンティックトークンを機械的に抽出した。**[確認済]**

**Phase 1B の訂正（R-06）**: Phase 1 はこれを「漏れ」「問題点」と呼んでいた。しかし、テーマ作者が意図して基盤既定に任せたのか、見落としたのかは、ソースからは判断できない。また Inkdrop で**実際に表示されるのはこの色**であり、「Inkdrop を正本とする」方針では、これも正本の一部である。本節では「基盤既定色の継承」と中立に呼ぶ。テーマのパレットへ寄せるかどうかはユーザー判断（09 Q-D9）。意図の確認は 09 U-11。
- **Solarized Dark（94 トークン）**:
  - info 系の背景・枠・見出し・文字が sky に解決される（例: `--info-background-color` = sky-200 @20%）。
  - `--focused-form-border-color` が sky-300 に解決される。
  - warning 系の背景・見出し・文字が amber に解決される（`--warning-color` だけはテーマで yellow に変更済み）。
  - secondary 系（ボタン含む）が zinc に解決される。
  - タグ / ラベルの olive・teal・purple が lime・teal・purple に、`--off-white` / `--white-*` / `--mark-color` が gray に解決される。
  - task-progress は gray に解決される。
  - GFM alert の important が Tailwind purple `#a855f7` になる。
  - これらは Solarized の 16 色体系から外れた色であり、**移植時に Solarized 色へ寄せるかどうかは判断事項**である。
- **Kanagawa Dragon**:
  - `--mde-preview-codeblock-border-color` が Tailwind blue-200 @10% のまま。
  - `--input-error-placeholder-color` が Tailwind red-200。
  - **タグ色（`--tag-*`、css@add48d9 tags.css）は全面的に Tailwind 系ランプのまま**（例: `--tag-red-text-color` = `#f87272`、`--tag-green-text-color` = `#4ade80`）。一方 Solarized ではランプ経由で Solarized 色になる（`#ea413e`, `#a3cc00`）。
- コメントと実値の不一致:
  - Kanagawa preview.css:6 のコメントは「links dragonBlue2」だが、値は dragonGreen2。
  - Kanagawa syntax.css:53 の "pmenu.bg" と syntax.css:27 の "ui.bg_p2" のコメントは、上流の意味と一致しない。
- ドキュメントの不整合: api-docs のレイヤ順説明（§1.2）。

---

## 14. スクリーンショット観察（静的解析とは別の視覚メモ）

`docs/screenshot.png` は撮影時期・バージョンが不明で、現 HEAD の CSS と一致する保証はない。**[未確認]**

- Solarized Dark（solarized-dark@4337f6e docs/screenshot.png）
  - 左サイドバーが最も明るい暗青緑、ノートリストは一段暗く、エディタはさらに暗い。§4 の明度順と整合する。
  - 選択中のノートは青みの帯。サイドバーの「All Notes」も青系の帯。
  - 「Notebooks」節見出しと、ノートリストの日付（"a few seconds" 等）は violet 系。
  - エディタはコードフェンス内が強調表示されている。見出し `## Use Puppeteer…` は黄色の bold で、等幅フォント（エディタのフォントはユーザー設定）。
  - タグは orange（Lifehack）、cyan / 青系（Neovim）、赤（Bug）、黄（Database）などの小さなピル。
- Kanagawa Dragon（kanagawa@f9c14a5 packages/dragon/docs/screenshot.png）
  - サイドバーとノートリストがほぼ黒、エディタ / プレビューがわずかに明るい暖色寄りの黒。
  - エディタの見出しは dragonYellow、リンク文字列は下線付き。太字 `**icons**` は赤系。
  - プレビュー（右）の見出しは dragonYellow で、h2 に下線。
  - 未チェックのタスクはチェックボックス表示。インラインコードは枠付きのピル。
  - タグピルは Tailwind 寄りの鮮やかな色（Feature = 黄、Bug = 橙、AI = 赤など）に見え、§13.4 のタグ色の基盤既定色の継承と整合する。**[推測]**

---

## 15. 未確認事項

1. Inkdrop 本体のコンポーネント CSS（`theme.ui.components` レイヤ、`inkdropapp_base-ui-theme` 等）で、各トークンがどのセレクタ・どの状態に適用されるか。本書の状態配色はトークン名からの対応であり、DOM 上の実適用は未検証。
2. 実アプリでの Computed Style（宣言値と `palette.json` の一致は確認済み。ただし `palette.json` 自体の生成時期・Inkdrop バージョンは未記録）。
3. `tags.css`（`theme.ui` 直下）とテーマ `ui.css`（同レイヤ）の読込順。同名変数の衝突がないため結果には影響しないが、アプリの注入順は未確認。
4. エディタのフォントファミリー / サイズ、見出しの文字サイズ（トークン化されていない。アプリ設定側）。
5. Kanagawa の dragonBlack2 / 3 入れ替えが意図的か（Inkdrop リポジトリが浅いクローンで、コミット履歴を確認できない）。
6. Solarized Dark の syntax 配色（string = yellow 等）の出典。Osaka nvim とは異なる。旧 solarized-dark-syntax 以前の履歴も未確認。
7. Solarized `tokens.css` で `--color-*` ラッパーを再宣言する実際の理由（コメントの「editor scope」が何を指すか）。
8. スクリーンショットの撮影バージョン。
9. `@supports (corner-shape: squircle)` が対象の Inkdrop / Electron バージョンで有効か（`palette.json` は有効を示すが、生成環境は不明）。

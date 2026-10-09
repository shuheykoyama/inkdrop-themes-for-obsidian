# 04. 既存 Obsidian テーマの実装パターン調査

- 調査日: 2026-10-09
- 調査範囲: Phase 1 技術調査のみ（テーマ実装は行っていない）
- 表記: 【確認済】はファイル実物で確認したもの、【推測】はコードからの推論、【未確認】は検証していないもの。
- 出典形式: `repo@SHA7 path:line`。調査用クローンは各リポジトリの HEAD 1 コミットだけを持つ浅いクローン（`git log --oneline | wc -l` = 1）のため、「最終コミット日時」はクローン時点の HEAD のコミット日時を指す。

## 対象リポジトリと SHA

| テーマ | リポジトリ | SHA | HEAD コミット日時 | manifest `version` | `minAppVersion` |
|---|---|---|---|---|---|
| Minimal | kepano/obsidian-minimal | `93321bd` | 2026-10-06T15:06:15-07:00 | 9.1.4 | 1.14.0 |
| Catppuccin | catppuccin/obsidian | `95eac6d` | 2026-10-05T13:45:10-06:00 | 0.4.50 | 1.13.0 |
| Border | Akifyss/obsidian-border | `dd59bd5` | 2026-10-06T09:31:13+08:00 | 1.13.9 | 0.16.0 |
| Things | colineckert/obsidian-things | `9b8bef9` | 2026-06-07T07:23:19-07:00 | 2.2.4 | 1.0.0 |
| AnuPpuccin | AnubisNekhet/AnuPpuccin | `82d207c` | 2024-12-01T16:15:52+05:30 | 1.5.0 | 1.6.0 |
| Kanagawa（sspaeti） | sspaeti/obsidian_kanagawa | `4594f5d` | 2026-05-22T08:57:07+02:00 | 4.0.1 | 1.0.0 |
| Kanagawa Palette（kmkkiii） | kmkkiii/obsidian-kanagawa-theme | `515d04d` | 2026-03-30T22:35:07+09:00 | 1.0.0 | 1.0.0 |

参照した一次情報:

- Obsidian 本体 CSS: `obsidian-app/asar-1.14.4/app.css`（Obsidian 1.14.4 の asar から抽出したもの）
- obsidianmd/obsidian-releases@`1eb9ae2` `community-css-themes.json`
- obsidianmd/obsidian-developer-docs@`c56c7e7`
- rebelot/kanagawa.nvim@`bb85e4b`（Kanagawa パレットの照合用）

上の manifest 値はすべて各リポジトリの `manifest.json` で確認した。7 テーマはいずれも `community-css-themes.json` に登録されており、`modes` は全テーマ `["dark","light"]` である（Python で JSON を読んで確認）。

## 計測方法（全テーマ共通）

数値はすべて、配布物の `theme.css` を対象にスクラッチパッドのスクリプト `tools/cssstats.py` で計測した。

- `/* */` コメントを除去してから、波括弧を線形に走査する。プレリュードが `@` で始まらないブロックを「スタイルルール」として数える。ルール内の `prop:` を宣言として数え、`--` 始まりをカスタムプロパティ宣言、それ以外を通常宣言として分類した。
- 「変数のみルール」は宣言がすべてカスタムプロパティのルール。「直接ルール」は通常プロパティ（`color`、`background-color` など）を 1 つ以上含むルール。
- `!important`、`.cm-*`、`:has(` はコメント除去後の出現数。ただしコンポーネント別の数値（`.canvas-` など）は `grep -c` による「該当行数」で、コメント（Style Settings の YAML を含む）も数えている。
- いずれも規模の目安であり、厳密なセレクタ数ではない。

| テーマ | 行数 | スタイルルール | 宣言 | カスタムプロパティ宣言 | 通常宣言 | 変数のみルール | 直接ルール | `!important` | `.cm-*` 参照 | `:has(` |
|---|---|---|---|---|---|---|---|---|---|---|
| Minimal | 8750 | 943 | 2890 | 1550 | 1340 | 294 | 647 | 49 | 205 | 32 |
| Catppuccin | 4575 | 343 | 835 | 375 | 460 | 74 | 258 | 32 | 166 | 0 |
| Border | 9160 | 761 | 2242 | 834 | 1408 | 154 | 607 | 176 | 175 | 60 |
| Things | 1954 | 171 | 497 | 132 | 365 | 4 | 165 | 34 | 72 | 0 |
| AnuPpuccin | 9080 | 1095 | 2548 | 948 | 1600 | 287 | 808 | 56 | 80 | 81 |
| Kanagawa（sspaeti） | 741 | 81 | 352 | 208 | 144 | 4 | 75 | 0 | 32 | 0 |
| Kanagawa Palette（kmkkiii） | 509 | 26 | 294 | 257 | 37 | 5 | 21 | 0 | 1 | 0 |

ファイルサイズ（`wc -c`）: Catppuccin 2,308,208 B、Border 384,497 B、AnuPpuccin 370,085 B、Minimal 266,817 B、Things 69,804 B、sspaeti 18,153 B、kmkkiii 13,107 B。Catppuccin が突出して大きい理由は base64 で埋め込んだ Vollkorn フォント（`url(data:` が 86 箇所）である【確認済: catppuccin/obsidian@95eac6d theme.css:4035-4041, scss/vendors/README.md】。

## 公式ガイドライン（評価軸）

以降の評価は、次の公式ガイドラインを基準にしている。

- 「Use CSS variables」: 一般的な変数は `body` で、色は `.theme-light` / `.theme-dark` で上書きする【確認済: obsidian-developer-docs@c56c7e7 en/Themes/App themes/Theme guidelines.md:5-27】。
- 「Use selectors with low specificity」: テーマ保守で最も多い問題は、Obsidian の新バージョンでクラス名や入れ子構造が変わってセレクタが壊れることだとされる【同 :29-33】。
- アセットはローカルに置く【同 :35-39】。`!important` を避ける【同 :41-43】。
- self-critique checklist は「`:has()` は Canvas で性能問題を起こすため必要時以外使わない」「縦マージンを Live Preview のクラスで変えず padding を使う」を挙げる【確認済: obsidian-developer-docs@c56c7e7 en/Obsidian October theme self-critique checklist.md:9-17】。

---

## 1. Minimal（kepano）— 重点

### ソース構造とビルド【確認済】

- `src/scss/index.scss` が `@use` で約 100 モジュールを読み込む。読み込み順は variables → app → components → content → features → mobile → plugins-core → plugins → color-schemes である【kepano/obsidian-minimal@93321bd src/scss/index.scss:1-106】。
- ディレクトリは `variables/`、`app/`（bases, editor, metadata, preview, ribbon, status-bar, tab-stacks, title-bar, window-frame, workspace）、`components/`、`content/`、`features/`、`plugins-core/`、`plugins/`、`color-schemes/`（14 スキーム）、`mobile/` に分かれる。
- ビルドは `build.js` で、Dart Sass の JS API `sass.compile(..., {style:'expanded'})` を使う。生成物は `license.css` + コンパイル結果 + `plugin-compatibility.css` + `style-settings.css` を連結したもので、`theme.css` と `Minimal.css` に書き出す。`.env` の `OBSIDIAN_PATH` があればテスト Vault にもコピーする。`--watch` を付けると chokidar で監視する【build.js:1-91】。依存は `sass ^1.83.0` と `chokidar ^3.6.0` だけである【package.json】。
- 圧縮出力はコメントアウトされ、無効化されている（"Minification temporarily disabled"）【build.js:44-46】。
- `obsidian.css` は Obsidian 0.15 以下向けの旧版 5.3.2 のアーカイブである【obsidian.css:1-12】。CONTRIBUTING は「生成物の `obsidian.css` / `Minimal.css` を直接編集しない」と定めている【CONTRIBUTING.md:16】。
- `versions.json` はテーマのバージョンから必要アプリバージョンへの対応表である（例 `"9.1.0": "1.14.0"`）【versions.json 末尾】。
- `src/css/main.css`（6836 行）は `build.js` が参照しておらず、旧ビルドの残骸とみられる【推測】。

### セマンティックトークン設計【確認済】

トークンは 3 層になっている。

1. **入力層（HSL の分解値）**: `body` に `--base-h/s/l` と `--accent-h/s/l` を置く【src/scss/variables/dynamic-color.scss:18-26】。
2. **テーマ内部の短縮トークン**: `.theme-light` / `.theme-dark` ごとに、HSL の `calc()` から `--bg1..3`、`--ui1..3`、`--tx1..4`、`--ax1..3`、`--hl1..2`、`--sp1` を導出する。ダークでは `--base-l:15%` を基準にする【dynamic-color.scss:49-152, 154-200】。
3. **Obsidian 公式変数へのマッピング**: `variables/theme.scss` に「Map colors to semantic Obsidian names」とあり、約 80 個の公式変数を 2 の短縮トークンへ代入している【src/scss/variables/theme.scss:1-109】。例:
   - `--background-primary: var(--bg1)`、`--background-secondary: var(--bg2)`
   - `--background-modifier-hover: var(--bg3)`、`--background-modifier-border: var(--ui1)`
   - `--text-normal: var(--tx1)`、`--text-muted: var(--tx2)`、`--text-faint: var(--tx3)`
   - `--text-accent: var(--ax1)`、`--interactive-accent: var(--ax3)`、`--text-selection: var(--hl1)`
   - `--nav-item-background-hover/active: var(--bg3)`、`--nav-item-color-active: var(--tx1)`
   - `--tab-text-color-focused-active`、`--titlebar-*`、`--icon-color*`、`--ribbon-background`

補足:

- `--color-base-*` は再定義していない（theme.css で `--color-base-` は 0 行）。背景・文字・境界線は `--background-*`、`--text-*` などの上位変数を直接上書きしている【確認済: grep】。
- アクセント 8 色（`--color-red` など）は rgb 版（`--color-red-rgb`）と hex 版の両方を `.theme-dark, .theme-light` に定義している【dynamic-color.scss:28-47】。
- **カラースキーム**は body クラス（例 `.theme-dark.minimal-flexoki-dark`）の下で、上の入力層と短縮トークン（`--bg1`、`--tx1`、`--color-*`）だけを上書きする。公式変数へのマッピングは共通のまま使う【src/scss/color-schemes/flexoki.scss:8-104】。このため 14 スキームでも 1 スキームあたり 58〜232 行で済んでいる（`wc -l color-schemes/*.scss`）。

### シンタックス（`--code-*`）

- Minimal は `--code-keyword` などを個別に再定義していない。`--code-normal: var(--tx1)` だけを設定している【確認済: theme.scss:42、`grep -rn -- '--code-' src/scss` の結果は code.scss:2,15 と theme.scss:42 のみ】。
- Obsidian 1.14.4 の既定は `--code-function: var(--color-yellow)`、`--code-keyword: var(--color-pink)`、`--code-string: var(--color-green)`、`--code-comment: var(--text-faint)` などである【確認済: app.css:2189-2200】。つまり Minimal は `--color-*` を差し替えるだけで、シンタックス色を間接的に追随させている。
- 移植への含意: Inkdrop のシンタックス配色に忠実にするには、この間接方式では不足し、`--code-*` を明示的に定義する必要がある【推測】。

### 直接セレクタの使い方

- 計測では直接ルール 647、変数のみルール 294。ただし直接ルールの多くは、body クラスによるオプトイン機能（`features/` 配下、例 `.colorful-active .nav-files-container`）やレイアウト・余白の調整である【確認済: src/scss/features/colorful-active-states.scss:1-30】。
- 色は機能クラス内でも `--nav-item-background-active: var(--interactive-accent)` のように公式変数をローカルに再代入して表現している。
- `!important` は src 全体でコメント除去後 49。多いファイルは plugins/git.scss 8、features/block-width.scss 8、features/cards.scss 5、plugins/kanban.scss 4 で、プラグインと幅系機能に集中している【確認済: `grep -rc '!important' src/scss`】。

### UI 状態表現【確認済】

- hover / active / selected は、まず公式変数（`--nav-item-*`、`--background-modifier-hover`、`--icon-color-hover/active/focused`、`--interactive-accent-hover`）で表現する【theme.scss:47-65】。
- ローカルな再代入も使う。例として `.view-actions` 内では `--icon-color-active: var(--ax1)` としている【theme.scss:117-122】。

### Obsidian 固有コンポーネント【確認済】

- Bases: `--bases-table-column-border-width: 0px` などの変数で調整する【root.scss:5-7】。ツールバーの表示制御は直接セレクタで行う【app/bases.scss:1-31】。
- Properties: `--metadata-label-width`、`--metadata-label-font-size` などの変数で調整する【root.scss:77-81】。
- Callouts: 幅と「outlined」オプションだけを扱う【content/callouts.scss:1-36】。
- Canvas: `plugins-core/canvas.scss`（27 行）。
- Tabs: `app/tab-stacks.scss`、`features/tab-styles.scss`。
- Ribbon: `app/ribbon.scss`（166 行）。
- Status bar: `app/status-bar.scss`。
- Graph: 専用のスタイルはない（`.graph-` / `--graph-` は 0 行）。

### Markdown とエディタ【確認済】

- Live Preview は `.markdown-source-view.mod-cm6 .cm-*` と `.HyperMD-*` で、余白・ガター・見出し間隔を調整している【app/editor.scss:1-50】。
- 色は `--h1-*` 系の変数と、`--text-*` / `--code-*` の継承で扱う。

### プラグイン対応と Style Settings【確認済】

- `plugins/` に calendar、charts、cmenu、dataview、git、hider、kanban、lapel、sortable、style-settings、zoom の 11 ファイルがある。`plugin-compatibility.css` には `/* @plugins */` 宣言として、コア 17 個とコミュニティ 10 個を列挙している【src/css/plugin-compatibility.css:1-33】。
- Style Settings は `/* @settings */` で 223 項目を宣言している（class-toggle 38、class-select 12、variable-* 173。theme.css 内の `type:` 行を `grep -cE` で計測）。例として `--bg1` などの短縮トークンを `variable-themed-color` で公開している【src/css/style-settings.css:20-60】。
- カラースキームの切り替えなど主要機能は、別の自作プラグイン「Minimal Theme Settings」に任せている【README.md:5,58,94】。

### Light/Dark

- `.theme-light` / `.theme-dark` を基本に、`minimal-light-tonal`、`minimal-light-white`、`minimal-dark-black`、`minimal-light-contrast` などのバリアントを body クラスで重ねる【theme.scss:111-210】。
- contrast バリアントでは、ライトモード中の `.titlebar` などに `.theme-dark` と同じトークンを部分適用している【dynamic-color.scss:154-158】。

### 保守性

- CONTRIBUTING は「Minimal は機能完成済み。今後の主目的は新しい Obsidian リリースへの追随」と述べている【CONTRIBUTING.md:3】。
- `versions.json` で互換表を管理している。CHANGELOG ファイルは置いていない【確認済: ルート直下を `ls`】。
- ライセンス: MIT（Copyright 2020-2024 Steph Ango）【LICENSE:1-3】。

---

## 2. Catppuccin（catppuccin/obsidian）— 重点

### ソース構造とビルド【確認済】

- `scss/` は 7-1 パターンに緩く準拠し【CONTRIBUTING.md:7】、`base/`、`components/`、`layout/`、`pages/`、`themes/`、`vendors/` の 6 フォルダに分かれる。`main.scss` が 24 個の partial を `@use` する【scss/main.scss:1-24】。
- package.json の `build` は `sass scss/main.scss:dist/catppuccin.css` で、出力先は `dist/` である。一方 CONTRIBUTING は「PR 用には `sass scss/main.scss theme.css` を実行する」と書いている【package.json scripts, CONTRIBUTING.md:70-78】。つまり配布物の `theme.css` は手動コマンドで生成しており、CI も存在しない（`.github/` なし）【確認済】。
- 開発フローとして、`dist/catppuccin.css` を Vault の snippets にハードリンクして確認する方法が書かれている【CONTRIBUTING.md:66-76】。
- Lint: stylelint（standard / standard-scss / idiomatic-order）を使う。`color-function-notation: legacy`、`alpha-value-notation: percentage` を指定している【.stylelintrc.yml】。依存更新は Renovate、パッケージ管理は pnpm（packageManager pnpm@12.9.1、engines node>=23）である【package.json, renovate.json】。
- `theme.css` と `scss` の同期: HISTORY 0.4.50 の変更「カーソル色を `--text-on-accent` に」が、scss（_typography.scss:200-202）と theme.css（1959-1960 行）の両方に反映されていた。このため最新変更までは同期していると判断した【確認済（部分照合）】。sass がローカルにないため、全体の再ビルド差分は取っていない【未確認】。
- `obsidian.css`（448 KB 程度）は `theme.css` と内容が異なる旧生成物とみられる【推測】。
- `versions.json` はない。変更履歴は `HISTORY.md` で管理している【確認済】。

### セマンティックトークン設計【確認済】

1. **パレット層**: `--ctp-<name>` を **RGB の 3 値**（例 `--ctp-mauve: 203, 166, 247`）で定義する。latte / frappe / macchiato / mocha をそれぞれ `.theme-light.ctp-latte`、`.theme-dark.ctp-mocha` などで切り替える。既定は `.theme-dark, .theme-dark.ctp-mocha` と `.theme-light`（latte）である【scss/base/_ctp-style-settings.scss:863-1023】。hex 版の `--hex-*` も併記している。
2. **アクセント層**: `--ctp-accent` を `.ctp-accent-<color>` の body クラスで差し替える【同 1047-1104】。
3. **公式変数へのマッピング**: 「Actual Configs」節で、`.theme-dark, .theme-light` に `--background-primary: rgb(var(--ctp-base))`、`--background-secondary: rgb(var(--ctp-mantle))`、`--text-normal: rgb(var(--ctp-text))`、`--text-faint: rgb(var(--ctp-surface1))`、`--interactive-accent: rgb(var(--ctp-accent))` などを代入する。**`--color-base-00`〜`--color-base-100` も 11 段すべて再定義**しており、crust → mantle → base → surface0..2 → overlay0..2 → subtext0 → text の順に割り当てている【同 1107-1170】。
4. 透過は `rgb(var(--ctp-crust), 30%)` のように、RGB 3 値に alpha を後置する方式で作る【同 1114-1121】。

### 問題点（アンチパターン）【確認済】

- `--color-cyan` と `--color-purple` が同じセレクタで 2 回定義され、値が食い違っている。1036 / 1040 行は sapphire / mauve の hex、1156 / 1158 行は sky / lavender の rgb で、後勝ちにより lavender / sky が有効になる【_ctp-style-settings.scss:1025-1044, 1107-1170】。
- `scss/base/_app-variables.scss`（650 行）は app.css の `body` 変数群を丸ごと写したもので、コメントに「At present (5/15/23)」とある【_app-variables.scss:1-12】。たとえば `--code-normal: var(--text-muted)`【同:97】は、Obsidian 1.14.4 の既定 `--code-normal: var(--text-normal)`【app.css:2190】と食い違う。本体の既定値を固定化してしまうため、追随漏れの原因になる。HISTORY の Upcoming にも「update _app-variables.scss with any changes to app.css」とあり、手作業で同期していることがわかる【HISTORY.md:4-9】。
- `color: rgb(var(--text-normal))` は誤りである。`--text-normal` はすでに `rgb(...)` 値なので、この宣言は無効値になる【themes/_full-palette.scss:36】。

### 直接セレクタと UI 状態【確認済】

- CONTRIBUTING が状態ごとの配色ルールを明文化している【CONTRIBUTING.md:23-64】。
  - `.is-active`: mauve を使い、ボタンには inset box-shadow で「押下」を表す。
  - `.is-selected`: `--ctp-accent` を背景にし、文字を `--text-on-accent` にする。
  - `:hover`: UI リンクは accent、インタラクティブ要素は pink を使う。
- 実装は `themes/_full-palette.scss` に集中しており、`.nav-file-title:hover`、`.clickable-icon.is-active`、`.workspace-tab-header` などに直接 `background-color` / `color` / `box-shadow` を指定している【_full-palette.scss:1-130】。
- 一部は変数のローカル再代入で済ませている。例: `.suggestion-item.is-selected { --background-modifier-hover: rgb(var(--ctp-lavender)) }`【同:111-119】、`.canvas-controls button:hover { --interactive-hover: ...; --text-normal: var(--text-on-accent) }`【pages/_canvas.scss:12-15】。
- 適用条件は `.theme-dark:not(.css-settings-manager), .theme-light:not(.css-settings-manager), .ctp-full-palette` である。Style Settings が無効のときも「full palette」を既定にするための工夫と読める【_full-palette.scss:1-3、意図は推測】。
- `@media (hover: hover)` を 5 箇所で使い、タッチ端末での hover 残りを避けている【確認済: grep、例 pages/_canvas.scss:21-26】。
- `!important` は 32（主に `components/_mermaid.scss` に 19、`vendors/_plugins.scss` に 13）。Mermaid の SVG はインラインスタイルを持つため、上書きに `!important` が必要になる例と読める【推測】。

### コンポーネント・エディタ【確認済】

- Callouts: `color-mix(in srgb, var(--callout-color) 10%, transparent)` で背景を、60% で枠線を作る。アイコンは `--callout-icon: lucide-*` で差し替える【components/_callouts.scss:1-40】。
- Canvas: `.canvas-node.is-themed` の背景と枠線を同じ `color-mix` 方式で弱めている【pages/_canvas.scss:28-48】。
- Graph と Properties: 専用スタイルはなく、変数の継承に任せている（`.metadata-` は 0 行）。
- Bases: 対応なし（0 行）。
- エディタ: `.cm-strong`、`.cm-em`、`.HyperMD-header-N`、`.markdown-rendered hN` を対にして、`--h1-color: rgb(var(--ctp-h1, var(--ctp-accent)))` のように **Style Settings の値をフォールバック付きで参照**する【base/_typography.scss:22-80】。この方式で Live Preview と Reading View を同時に覆っている。
- シンタックス: `--color-*` を Catppuccin 色にマップし、`--code-*` は `_app-variables.scss` 経由で `--color-*` を参照する【_app-variables.scss:94-106】。

### プラグイン・Light/Dark・保守・ライセンス【確認済】

- `vendors/_plugins.scss`（306 行）で Obsidian Git、Another Quick Switcher、Omnisearch、MAKE.md、Dataview、Calendar、Emoji Autocomplete、Style Settings に対応している【vendors/_plugins.scss:39-306】。
- Style Settings は 20 項目（dark flavor の class-select、accent の class-select、太字・斜体・見出し色の variable など）【_ctp-style-settings.scss:1-30, 77-110】。
- Light/Dark: Light は latte の 1 種、Dark は 3 flavor から選ぶ。`color-scheme: dark/light` と `--highlight-mix-blend-mode` も設定している【_ctp-style-settings.scss:1173-1185】。
- 保守: 変更履歴は HISTORY.md、依存更新は Renovate。
- ライセンス: MIT（Copyright 2021 Catppuccin）。

---

## 3. Border（Akifyss）

- **構造**: 手書きの単一 `theme.css`（9160 行）で、ビルド系は存在しない。`presets/` と `presets.md` で Style Settings のプリセットを配布し、`test.css` は 0 行である【確認済: Akifyss/obsidian-border@dd59bd5 ルート】。
- **トークン**: `.theme-light` / `.theme-dark` で `--color-base-00`〜を再定義する（例 light `#ffffff`、dark `#1e1e1e`）【theme.css:3899, 4020】。さらに `--background-primary` / `--background-secondary` をアクセントの HSL から導出する（例 `hsl(var(--accent-h), calc(var(--accent-s) / 5), calc(1.25*var(--accent-l) / 4.5))`）【theme.css:4054-4056】。背景バリアント（darker / brighter / black）は `.theme-dark.theme-dark-background-*` クラスで切り替える【theme.css:4086-4130】。
- **Style Settings**: 7 つの `@settings` ブロックに 363 項目がある（class-toggle 53、class-select 27、variable 283）。中英二言語（`title.zh`）で、`body:not(.x) .setting-item[data-id=...]` によって設定項目の表示自体を出し分けている【theme.css:1-40, 3691-3720】。
- **直接セレクタ**: 直接ルール 607、`!important` 176、`:has(` 60 で、比較した 7 テーマの中で最も多い。checklist の「`!important` を使わない」「`:has()` を避ける」に最も反する【計測値】。
- **ライセンス**: MIT（Copyright 2022 Akifyss）。`minAppVersion` は 0.16.0 のままで、実際の要求バージョンを反映していない可能性がある【推測】。

## 4. Things（colineckert）

- **構造**: 単一 `theme.css`（1954 行）で、ビルドはない。LICENSE の著作権者は Stephan Ango（kepano, 2020-2021）で、kepano 版からの派生である【確認済: colineckert/obsidian-things@9b8bef9 LICENSE:1-3】。
- **トークン**: Minimal と同系統の `--base-h/s/d/l`、`--accent-h/s/d/l` を `body` に置き、独自色（`--blue`、`--pink` など）と見出し色（`--h3-color: var(--blue)` など）を定義する【theme.css:18-50】。`.theme-light` / `.theme-dark` で `--color-red` などや `--mono-rgb-*` を再定義している【theme.css:105-130】。
- **アンチパターン**:
  - カスタムプロパティの値に `!important` を付けている（`--highlight-background-color--normal: ... !important`）【theme.css:53-55】。
  - `@charset "UTF-8"` がファイル先頭のコメントの後（17 行目）にある。CSS 仕様ではファイル先頭にない `@charset` は無効になる【theme.css:17。仕様の解釈は一般知識で、本調査では未検証】。
- **コンポーネント**: Tabs、Ribbon、Status bar、Callouts、Canvas にはスタイル指定がない（いずれも 0 行）。見出し・チェックボックス（`data-task` 別アイコン）・Kanban（26 行）に集中している【grep 計測】。
- **ライセンス**: MIT。

## 5. AnuPpuccin（AnubisNekhet）

- **構造とビルド**: `src/base.scss` が `@import` で `modules/{Core,Base,Workspace,Markdown-Elements,Features,Integrations}/index.scss` を読み込む（src 配下 100 ファイル）。Makefile の `sass src/base.scss theme.css --no-source-map --no-charset` で `theme.css` と `obsidian.css` を同時に生成する。`snippets/src` から追加スニペットもビルドする【確認済: AnubisNekhet/AnuPpuccin@82d207c Makefile, src/base.scss:16-21】。
- **トークン生成**: SCSS の map と `@each` で、テーマ × 26 色の `--ctp-<color>` を生成する。値は `var(--ctp-custom-<c>, var(--ctp-ext-<c>, R, G, B))` の **3 段フォールバック**で、ユーザー定義 → 拡張スキーム → 組み込みの順に解決する【src/modules/Core/default-colorschemes.scss:1-28】。Sass で値を生成しつつ、実行時の上書き余地を CSS 変数に残す設計である。
- **アンチパターン**:
  - `@import` と、グローバル関数 `map-get` / `red()` / `green()` / `blue()` に依存している。Dart Sass は 1.80.0 で `@import` を非推奨にし、3.0.0 で削除予定としている（https://sass-lang.com/documentation/breaking-changes/import/ を WebFetch で確認）。
  - HEAD は 2024-12-01 で、約 22 か月更新されていない。`:has(` は 81 箇所で、比較した 7 テーマ中最多である。
- **対応範囲**: Callouts（103 行）、Kanban（225 行）、Dataview（58 行）が厚い。Integrations として Advanced Tables、Excalidraw、Calendar、Recent Files、cMenu、Folder Icons、Editing Toolbar、Discord RPC、Style Settings、Dataview、Kanban を持つ。Properties 用の `properties.scss` / `metadata.scss` もある【確認済: src ツリー】。
- **ライセンス**: **GPL-3.0**。base.scss のヘッダで、著作権表示の保持と、コードを再配布する場合のクレジット表記を求めている【src/base.scss:1-14】。コードを流用する場合は GPL の伝播に注意が必要である。

---

## 6. 既存 Kanagawa テーマ 2 つ

> **重要: 以下の 2 テーマは、今回の移植正本（Inkdrop 版 Kanagawa Dragon: inkdropapp/kanagawa の `packages/dragon`）とは別物である。** 配色値は参考記録にとどめ、移植の色の根拠には使わない。

### 6.1 sspaeti/obsidian_kanagawa（registry 名 "Kanagawa"）

- **構造**: 単一 `theme.css`（741 行）。`package.json` の script は `version-bump.mjs` だけで、ビルドはない。`versions.json` は 1.0.0 から 4.0.1 まで、すべて minApp 1.0.0 を指している【確認済: sspaeti/obsidian_kanagawa@4594f5d package.json, versions.json】。
- **パレット**: `:root` に kanagawa.nvim の **旧命名**（`--sumiInk1: #1F1F28`、`--sumiInk1b: #181820` など）を置いている【theme.css:1-54】。同じ `:root` に **Gruvbox パレット**（`--neutral-red` など、insanum/obsidian_gruvbox 由来）と Lotus（light）も置いている【theme.css:56-147】。
- **配色方針**:
  - Dark（Wave 系）: `--background-primary: var(--sumiInk1)`（#1F1F28）、`--text-normal: var(--fujiWhite)`【theme.css:150-196】。
  - 見出し色の `--text-title-h1..h6` は **Gruvbox の neutral 色**で、Kanagawa の色ではない【theme.css:158-163】。
  - Light: Lotus 系だが、`--background-primary` には独自の `--paper-like: #F2EFE9` を使う。
- **アンチパターン**:
  - Obsidian が使わない独自変数名で色を定義し、その変数を直接セレクタから参照している。`--text-title-h1`、`--pre-code`、`--text-mark`、`--interactive-before`、`--text-tag`、`--inline-code` は Obsidian 1.14.4 の app.css に出現しない（各 0 件、`grep -c` で確認）。公式の `--h1-color` などを使っていない。
  - `--interactive-accent-rgb` に hex 値を代入している（本来は RGB 3 値の想定）【theme.css:180, 235】。これを `.graph-view.color-circle { color: var(--interactive-accent-rgb) }` で色として流用している【theme.css:277-281】。なお Obsidian 1.14.4 の app.css は `--interactive-accent-rgb` を参照していないため、コア UI への実害は確認されない【確認済: grep 0 件】。
  - `table`、`th`、`td`、`tr:nth-child`、`a`、`strong` といった**修飾なしの要素セレクタ**を使っている【theme.css:304-402】。設定画面などノート外の表にも波及しうる【推測】。
  - 廃止済みのセレクタが残っている。`.side-dock-ribbon-tab`、`.CodeMirror-foldgutter-folded`（CM5 時代）、`.side-dock-collapse-btn`、`.workspace-leaf-header-title`、`.side-dock-title` は app.css 1.14.4 に 0 件である【theme.css:423, 532 ほか】。
- **ライセンス**: MIT（Copyright 2022 Simon Späti）。

### 6.2 kmkkiii/obsidian-kanagawa-theme（registry 名 "Kanagawa Palette"）

- **構造**: 単一 `theme.css`（509 行）。version-bump だけでビルドはない【確認済: kmkkiii/obsidian-kanagawa-theme@515d04d】。
- **パレット**: `:root` に kanagawa.nvim の **現行命名**で Wave / Dragon / Lotus を定義している。sumiInk0..6 と dragonBlack0..6 の値は kanagawa.nvim の `colors.lua` と一致する（例 `--sumiInk3: #1f1f28`、`--dragonBlack3: #181616`）【theme.css:41-161、rebelot/kanagawa.nvim@bb85e4b lua/kanagawa/colors.lua:5-11, 62-68】。
- **配色方針**:
  - Wave: `--background-primary: var(--sumiInk3)`、`--text-normal: var(--fujiWhite)`、見出しは waveRed → surimiOrange → carpYellow → springGreen → waveAqua2 → crystalBlue【theme.css:167-231】。
  - Dragon: `.theme-dark.kanagawa-dragon` で `--background-primary: var(--dragonBlack3)`（#181616、nvim の dragon `ui.bg` と一致【themes.lua:198-213】）、`--text-normal: var(--dragonWhite)`、`--text-muted: var(--dragonAsh)`、`--interactive-accent: var(--dragonBlue2)`、`--code-background: var(--dragonBlack0)`【theme.css:238-296】。見出し色（`--h1-color` など）は Dragon ブロックで再定義していないため、Wave の値を継承する【推測、コード上の事実】。
  - Light は Lotus 系【theme.css:302-366】。
- **良い点**: 公式変数（`--h1-color`、`--link-color`、`--tag-color`、`--graph-*`、`--checkbox-color`、`--inline-title-color`、`--text-warning/success` など）を中心に使っている。直接ルールは 21、`!important` は 0 で、低詳細度である。
- **問題点**:
  - 一部は Obsidian に存在しない変数を参照している。`--inline-code-color`、`--table-row-even-background`、`--table-row-odd-background` は app.css に定義も使用もない（各 0 件）。テーマ内の直接セレクタからは参照されているが、本体 UI には効かない。
  - **Dragon 変種は Style Settings の class-select でしか選べない**（コメント「Style Settings plugin required」）【theme.css:5-17, 233-236】。
  - 修飾なしの `table` / `th` / `td` / `strong` / `::selection` セレクタがある【theme.css:381-443】。
- **ライセンス**: MIT（Copyright 2026 kmkkiii）。

### 6.3 正本との混同リスク（Inkdrop 担当と要照合）

- Inkdrop 版 Kanagawa Dragon の palette.css では `--kanagawa-dragonBlack2` が `#181616`、`--kanagawa-dragonBlack3` が `#1D1C19 (ui.bg)` とコメントされている【inkdropapp/kanagawa@f9c14a5 packages/dragon/styles/palette.css:16-22】。一方、kanagawa.nvim では `dragonBlack2 = #1D1C19`、`dragonBlack3 = #181616` で、`ui.bg = dragonBlack3` である【kanagawa.nvim@bb85e4b colors.lua:62-68, themes.lua:198-213】。
- つまり**同じ名前が別の HEX を指す**。既存 Obsidian テーマ（nvim 準拠）の変数名を流用すると、正本と食い違う。移植では名前ではなく、Inkdrop 正本の HEX とトークン用途で照合すること【確認済（両ファイル）／正本の意図は Inkdrop 担当の調査範囲】。
- registry 名の衝突: "Kanagawa"、"Kanagawa Paper"、"Kanagawa Palette"、"Kanagawa Hokusai"、"Kanagawa Tide" が既に登録されている【確認済: community-css-themes.json:713, 1385, 3058, 4122, 4934】。命名時に重複を避ける必要がある。

---

## 7. テーマ横断比較表

| テーマ | 構造 | ビルド | トークン設計 | 直接ルール目安（`!important` / `:has`） | プラグイン対応 | Light/Dark | ライセンス |
|---|---|---|---|---|---|---|---|
| Minimal | SCSS 約 100 モジュール | Node + Dart Sass JS API（build.js、watch あり） | HSL 入力 → 短縮トークン（bg/ui/tx/ax）→ 公式変数約 80 個 | 647（49 / 32） | 11 プラグイン + `@plugins` 宣言 + 自作設定プラグイン、Style Settings 223 項目 | 両方 + 14 スキーム + バリアント | MIT |
| Catppuccin | SCSS 7-1 パターン（24 partial） | sass CLI（手動）、stylelint、Renovate | RGB 3 値パレット → accent クラス → 公式変数 + `--color-base-*` 全段 | 258（32 / 0） | 8 程度（vendors/_plugins）、Style Settings 20 項目 | Light 1 + Dark 3 flavor | MIT |
| Border | 単一 CSS | なし | `--color-base-*` 再定義 + アクセント HSL 導出の背景 | 607（176 / 60） | 少（Kanban 4 行程度） | 両方 + 背景バリアント | MIT |
| Things | 単一 CSS | なし | Minimal 系 HSL + 独自色 | 165（34 / 0） | Kanban 中心 | 両方 | MIT |
| AnuPpuccin | SCSS 100 ファイル | Makefile + sass CLI（`@import`） | Sass map から 3 段フォールバックの CSS 変数を生成 | 808（56 / 81） | 多（Kanban, Dataview, Excalidraw ほか約 11） | 両方 + 複数スキーム | GPL-3.0 |
| Kanagawa（sspaeti） | 単一 CSS | なし | 生パレット + 独自変数名（非公式） | 75（0 / 0） | なし | 両方 | MIT |
| Kanagawa Palette（kmkkiii） | 単一 CSS | なし | 生パレット → 公式変数を直接代入 | 21（0 / 0） | なし（Style Settings 3 項目） | 両方（Dragon は Style Settings 必須） | MIT |

## 8. 推奨実装パターンとアンチパターン

### 推奨パターン

1. **公式変数のマッピング層を 1 か所に集める**（根拠: Minimal `variables/theme.scss:1-109`、Catppuccin「Actual Configs」節、公式ガイドライン :5-27）。パレットの定義と公式変数への代入を分け、色の変更がパレット側だけで完結するようにする。
2. **パレットは RGB 3 値または HSL 分解値でも持つ**（Catppuccin `--ctp-*: R, G, B`、Minimal `--base-h/s/l`）。透過色を `rgb(var(--x), 30%)` で派生でき、hover / selection 用の半透明を別トークンなしで作れる。ただし hex 版との二重定義は、Catppuccin の `--color-purple` の不一致のように値がずれる温床になる。単一ソースから生成するのが望ましい。
3. **`--color-base-*` と `--color-<accent>` を両方定義する**（Catppuccin 1131-1170）。Obsidian の既定変数の多く、たとえば `--code-*`（app.css:2189-2200）や `--graph-*`、`--canvas-color-*` がこれらを参照するため、未対応コンポーネントへのフォールバック品質が上がる。
4. **状態はまず公式変数で表現し、足りない箇所だけローカルで再代入する**。`--nav-item-background-hover/active`、`--icon-color-hover/active`、`--background-modifier-hover`、`--interactive-accent-hover` を使い、要素単位では `.x:hover { --background-modifier-hover: ... }` のように変数を再代入する（Catppuccin _full-palette.scss:79-81, 111-119、Minimal theme.scss:117-122）。
5. **Live Preview と Reading View を対で指定する**（`.markdown-rendered hN` と `.HyperMD-header-N`、`.cm-strong` と `strong`。Catppuccin _typography.scss:22-80）。可能な限り `--hN-color`、`--bold-color`、`--italic-color` などの変数経由にする。
6. **`@media (hover: hover)` で hover 装飾をガードする**（Catppuccin、5 箇所）。
7. **配布物をビルドで生成し、生成物を手編集しない**（Minimal CONTRIBUTING:16）。生成物 `theme.css` はコミットする【推測】。なお配布については 03 §9.1 で、Obsidian はリリースに添付された `theme.css` を取得すると確認済みである（リポジトリ直下の `theme.css` ではない）。
8. **`versions.json` でテーマバージョンと `minAppVersion` の対応を管理する**（Minimal、AnuPpuccin、Kanagawa 2 種）。

### アンチパターン

1. 本体 `app.css` の変数群を丸ごと写す（Catppuccin `_app-variables.scss`）。既定値が固定化し、本体更新時に乖離する（`--code-normal` の例）。
2. 公式に存在しない変数名で色を定義し、直接セレクタで当てる（sspaeti、kmkkiii の一部）。本体 UI や他プラグインに配色が届かない。
3. 修飾なしの要素セレクタ（`table`、`th`、`a`、`strong`）を使う（Kanagawa 2 種）。ノート外へ影響が漏れる。
4. 廃止クラスや CM5 セレクタが残ったままになる（sspaeti）。公式ガイドラインが挙げる「壊れたセレクタ」問題そのものである。
5. `!important` と `:has()` を多用する（Border 176 / 60、AnuPpuccin 56 / 81）。checklist に反し、Canvas の性能低下やユーザースニペットでの上書き不能を招く。
6. 別パレットを混入する（sspaeti の見出しが Gruvbox 色）。移植忠実度を損なう。
7. `rgb(var(--already-rgb-color))` のような値形式の不一致（Catppuccin _full-palette.scss:36）や、`*-rgb` 変数への hex 代入（sspaeti）。無効値は気付きにくい。
8. 変種の選択を Style Settings に依存させる（kmkkiii の Dragon）。プラグインなしではその変種を使えない。

## 9. 今回の移植（2 つの独立ダークテーマ、Inkdrop 忠実度重視）への転用

- **独立した 2 テーマ**にすれば、kmkkiii のような class-select による変種切り替えは不要になる。各テーマで `.theme-dark` に直接マップすれば Style Settings への依存をなくせる【推測（設計判断）】。
- 一方で両テーマの共通部分（公式変数へのマッピング層、コンポーネント調整）を共有するなら、Minimal 型の「パレット差し替え + 共通マッピング」を **ビルド時**に適用し、2 つの `theme.css` を生成する構成が適合する。リポジトリ構成は別担当の範囲だが、Sass の `@use` / `@forward`（`@import` は非推奨）か、PostCSS などで十分である【推測】。
- Inkdrop の配色に忠実にするには、Minimal のように `--color-*` だけで間接的に決めるのでは足りない。`--code-*`（app.css:2189-2200 の 12 変数）と `--hN-color`、`--link-*`、`--tag-*`、`--graph-*`、`--canvas-color-*`、`--callout-*` を **明示的に** Inkdrop の値へ割り当てるべきである【推測】。
- `--color-base-00..100` も全段割り当てる（Catppuccin 方式）。これで未対応 UI のフォールバックが Inkdrop の階調になる。
- Inkdrop 側が HSL 3 値トークン（例 `--kanagawa-dragonBlack2: 0deg 4% 9%`）を使っているため、Obsidian 側でも `hsl(var(--x) / α)` で透過を派生できる。Catppuccin の RGB 3 値方式と同じ利点を得られる【確認済（Inkdrop palette.css の記法）／適用は推測】。
- パレット名は nvim と Inkdrop でインデックスがずれている（6.3 節）。HEX をキーに照合し、正本は Inkdrop とする。
- `!important`、`:has()`、要素セレクタ、廃止クラスは使わない。直接セレクタが必要な領域は、比較した 7 テーマで共通していた次の範囲に絞り、状態は変数の再代入で表現する。
  - タブ（`.workspace-tab-header`）
  - ファイルツリーの hover / active
  - Canvas ノートの themed 色（`color-mix`）
  - Callout の背景・枠線（`color-mix`）
  - Mermaid（SVG インラインスタイルのため例外的に `!important` が必要になりうる）
- テーマ名は registry の既存 "Kanagawa*" 5 件と重複しない名前にする。

## 未確認事項

- Catppuccin の `theme.css` が scss の現状と完全に一致するか（sass 未導入のため再ビルド差分を取っていない。確認したのは最新変更 1 件の照合のみ）。
- Minimal の `src/css/main.css` がどの経路で生成された旧物か。
- Border の `minAppVersion: 0.16.0` が実際の要求バージョンと乖離しているか（実機での検証なし）。
- Things の `@charset` の位置ずれが Obsidian（Chromium）で実害を生むか（実機での検証なし）。
- 各テーマの、Obsidian 1.14.x 実機上での描画（スクリーンショット比較はしていない）。
- コンポーネント別の行数（`.canvas-` など）は `grep -c` の行数で、コメントや Style Settings の YAML 内の出現も含む。セレクタの正確な数ではない。
- `--interactive-accent-rgb` をコミュニティプラグインが参照しているか（コア app.css 1.14.4 では未参照であることだけ確認した）。
- Inkdrop palette.css の dragonBlack2 / 3 の命名と `(ui.bg)` コメントの意図（Inkdrop 担当の調査範囲）。
- Obsidian が配布に `theme.css` をどう取得するか（リリースアセットかリポジトリ直下か）の詳細は、本調査では確認していない。

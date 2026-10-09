# Obsidian 主要 UI 要素の棚卸し

- 調査日：2026-10-09
- 対象：Obsidian 1.14.4（デスクトップ版 `obsidian-1.14.4.asar` を展開した `app.css`、`app.js`。`package.json` の version は 1.14.4）
- `app.css` の SHA-256 先頭 16 桁：`866e50ac84dd8ad2`（22,559 行）
- 公式ドキュメント原稿：`obsidianmd/obsidian-developer-docs` @ `c56c7e7`（c56c7e770ba25dd0ea392aacf4588f9425970d36、2026-08-10）
- Inkdrop 側の参照：`inkdropapp/css` @ `add48d9`（`ui.css`、`tokens.css`、`syntax.css`、`mermaid.css`）
- 補助（第三者）：`kepano/obsidian-minimal` @ `93321bd`（クラス名の慣行確認のみ）
- 一覧データ：[`data/obsidian-ui-inventory.csv`](data/obsidian-ui-inventory.csv)（108 行）

## 凡例と前提

本書の値はすべて `app.css` に書かれた宣言値を、`body` と `:root` の定義に `.theme-dark` の上書きを重ねて、`var()` を機械的に展開したものである。
実機の Computed Style は取得していない。
したがって `color-mix()` や `calc()` の最終値、`.mod-macos` など OS クラスによる上書き後の値は、実機では異なる可能性がある。

出典の書式は次のとおり。

- **app.css Lnnnn**：Obsidian 1.14.4 の `app.css` の行番号。
- **docs:<path>@c56c7e7**：`en/Reference/CSS variables/` 配下の原稿ファイル。
- **app.js**：`app.js` を grep して確認した実装箇所（minify 済みのため行番号なし）。

CSV の列の意味は次のとおり。

- **obsidian_variables**：主要変数と dark 既定値。末尾に `*` を付けた変数は docs@c56c7e7 に掲載がない。
- **styling_method**：`variable` は公式変数（未掲載変数を含む）だけで主要な見た目を変えられるもの、`selector` は変数が存在せず直接セレクタが必要なもの、`both` は変数で大半を変えられるが一部の状態や装飾にセレクタが要るもの。
- **inkdrop_counterpart**：Inkdrop に同等 UI があるかの目安（yes / similar / no）。詳細な対応付けは別担当の範囲であり、ここでは判断材料だけを置く。

確度は本文中で「確認済み」「推測」「未確認」と書き分ける。
「確認済み」は、`app.css` または `app.js` の該当箇所を読んで確かめたことを意味する。

## 調査方法

`app.css` を一時スクリプトで規則単位に分解し（3,896 規則）、変数定義と変数参照を抽出した。
docs 原稿からはバッククォートで囲まれた `--*` 名を抽出し、`app.css` の定義と突き合わせた。
要素ごとに変数接頭辞とセレクタの正規表現を割り当て、該当規則と状態クラス（`:hover`、`.is-active`、`.is-selected` など）を列挙したうえで、主要規則の宣言を個別に読んだ。
`app.css` の 1〜1,990 行付近は同梱の pdf.js 由来の規則であり、Obsidian 自身の変数群は L1995 以降にある。

## 全体の構造

Obsidian の変数は、ほぼすべてが `body`（L2020〜2980、876 個）に定義され、`.theme-dark`（L3031、61 個）と `.theme-light`（L2981、46 個）がベース色と一部の派生色を上書きする。
`.theme-dark` は `body` より詳細度が高い。
そのため、`app.css` が `.theme-dark` で定義している変数（`--interactive-normal`、`--text-selection`、`--background-modifier-form-field`、`--shadow-*` など）をテーマが `body` で上書きしても、`.theme-dark` 側に負ける（確認済み、L3063〜3082）。
テーマ側の色定義は `.theme-dark` / `.theme-light` に置く必要がある。

docs との対応は次のとおり（確認済み）。

- `body`、`:root`、`.theme-dark` に定義された変数は 961 個で、そのうち docs に掲載があるのは 628 個である。残る 333 個は未掲載である。
- docs（Publish 配下を除く）に掲載された 637 個のうち、`app.css` に定義があるのは 630 個である。
- docs の Publish 配下にある 50 個（`--sidebar-left-background`、`--outline-heading-color` など）は公開サイト用で、アプリの `app.css` には存在しない。

未掲載変数には、Menu（9 個）、Tooltip（10 個）、Notice（11 個）、Settings（15 個）、Bases カンバン（15 個）、脚注（13 個）、ハイライト色（9 個）、影とブラー（`--shadow-*`、`--blur-*`）が含まれる。
これらは `app.css` 上では各部品の既定値の参照元として実際に使われている。
ただし docs に載っていない以上、将来のバージョンで名前や役割が変わる可能性はある。

docs と実装の食い違いも見つかった（確認済み）。

- `--nav-heading-color-colapsed-hover`（docs、綴り誤り）に対し、実装名は `--nav-heading-color-collapsed-hover`（L2514）。
- `--bases-table-text-size`（docs）に対し、実装は `--bases-table-font-size`。
- `--bases-cards-group-padding`、`--status-bar-scroll-padding`、`--text-highlight-bg` は docs にあるが `app.css` に定義がない。ただし `--text-highlight-bg` は `--highlight-background` の `var()` fallback として参照されるため、テーマから設定すれば今も効く（L2373）。
- `--heading-formatting` は定義されるが参照されない。見出しの `#` 記号は `.cm-formatting-header { color: var(--text-faint) }` で固定されている（L13251）。

定義だけで `app.css` 内から参照されない docs 掲載変数は 27 個あった（`--heading-formatting`、`--metadata-label-text-color-hover`、`--metadata-property-background-active`、`--nav-collapse-icon-color-collapsed`、`--pill-decoration` や deprecated の `*-rgb` 群など）。
このうち `--bases-cards-scale`、`--bases-table-column-min-width`、`--bases-table-column-max-width` は `app.js` から読まれている。

`app.js` が `getComputedStyle` で読む変数とクラスも確認した。
対象は `--traffic-lights-offset-x/y`、`--zoom-factor`、`--font-mermaid`、`--pdf-page-background`、`--bases-*` の一部、Graph View の `.graph-view.color-*` クラスである。
これらは CSS の描画ではなく JS の計算やキャンバス描画の入力になる。

色空間について、docs は 1.13 以降 OKLCH による `color-mix()` へ移行し、`--color-*-rgb` などの RGB/HSL 変数を deprecated と明記している（docs:Foundations/Colors.md@c56c7e7 L78〜89）。
1.14.4 の `app.css` でも hover 色、選択色、タグ背景、Callout 背景はすべて `color-mix(in oklch, ...)` で作られている。
Callout の `--callout-color` も RGB 三つ組ではなく色値で、`rgba(var(--callout-color), x)` を前提とした旧来のスニペットは成立しない（L11637〜11760）。

## カテゴリ別の要素一覧

各要素の変数、セレクタ、状態、出典の詳細は CSV にある。
ここでは要素数と、移植判断に効く所見だけを示す。

| カテゴリ | 要素数 | variable | both | selector |
| --- | --- | --- | --- | --- |
| Foundations | 6 | 6 | 0 | 0 |
| Workspace | 14 | 4 | 9 | 1 |
| Navigation | 8 | 5 | 3 | 0 |
| Editor | 42 | 25 | 10 | 7 |
| General UI | 24 | 18 | 6 | 0 |
| Obsidian 固有 | 14 | 4 | 6 | 4 |
| 合計 | 108 | 62 | 34 | 12 |

### Workspace

ウィンドウ上端は、既定の Hidden frame ではタブバーがタイトルバーを兼ねる。
`.workspace-tabs.mod-top` と `.sidebar-toggle-button` は `--tab-container-background` と `--sidebar-tab-container-background` の両方に `--titlebar-background` を代入しており（L4354〜4358）、タイトルバー色を変えるとタブバー背景も変わる。
`mod-top` は app.js が各分割（ルートと左右ドック）の最上段のタブグループに付けるため、この連動はメイン領域のタブバーだけでなく、左右ドックの最上段のタブ帯にも及ぶ（Phase 1B の批判的レビューで確認。静的解析、実機未確認）。
macOS では左端に `calc(80px - var(--frame-ribbon-left))` の余白を確保し、信号機ボタンの領域にする（L4306〜4309）。
信号機ボタンの位置そのものは、`app.js` が `--traffic-lights-offset-x/y`（既定 `var(--header-height)` = 40px）を読み取り Electron に渡して決める（確認済み）。
この 2 変数は docs に載っていないが、ヘッダー高を変えるテーマはこれも合わせて変える必要がある。

左右サイドバーには専用の背景変数がない。
背景は `.workspace-tabs .workspace-leaf { background-color: var(--background-secondary) }`（L6912）で左右共通に塗られる。
左右で色を分けるには分割ペインのクラスへの直接セレクタが要る。
`app.css` 上で確認できるクラスは `.mod-primary-split`、`.mod-secondary-split`、`.mod-sidedock` である。
**統合時の追加確認**: `app.js` ではサイドドックの生成時に `addClass("mod-sidedock", AS(side, "mod-{side}-split"))` を呼ぶ。`AS()` は `mod-primary-split` / `mod-secondary-split` と、`DS()` が返す `mod-left-split` / `mod-right-split` の両方を返す。`DS()` は RTL（`vb()`）のとき左右を入れ替える（確認済み、静的解析。DOM 上の実在は実機未確認）。
**版による違い（Phase 1B で確認）**: 上は 1.14.4 の実装である。1.13.7 の app.js は `"mod-".concat(i,"-split")` で `mod-left-split` / `mod-right-split` だけを付け、`mod-primary-split` は app.css・app.js のどちらにも出てこない。1.13.x も対象にするなら、左右の塗り分けは `mod-left-split` / `mod-right-split` で書く必要がある（09 Q-D20）。
ノート領域の背景も専用変数がなく `--background-primary`（L4663）であり、Modal、Prompt、Popover も同じ変数を参照する。

ワークスペースタブは `::before` / `::after` の `box-shadow` と `clip-path` でブラウザ風の曲線を描く（L7025〜7050）。
曲線は `--tab-curve` で調整できるが、形状を変えるなら擬似要素への直接セレクタになる。
タブ関連は 46 変数あり、そのうち `--tab-background-hover`、`--tab-inner-*` など 19 個が未掲載である。

`.mod-macos`（L3096〜3126）は `--interactive-normal` と `--interactive-hover` を `--background-modifier-border` に、`--input-shadow` を `none` に、`--scrollbar-thumb-bg` を `gray` に上書きする。
`.mod-macos` と `.theme-dark` は同じ詳細度で、`app.css` 内では `.mod-macos` が後にある。
テーマのスタイルシートは `app.css` より後に挿入される（03 §2.3 で app.js と index.html から確認済み）。したがって同じ詳細度なら、テーマの `.theme-dark` 定義が勝つ（カスケードの規則からの推論。computed は実機未確認、09 V-01）。Phase 1 では読込順を「未確認」としていたが、03 と食い違っていたため Phase 1B で改めた。

### Navigation

File Explorer、Bookmarks、Outline、Tags view、Search の結果は、いずれも `.tree-item-self` という共通部品で描かれ、`--nav-item-*` を共有する（L10734〜10830）。
状態は hover、active（開いているファイル）、selected（複数選択）、dragging、drag-over（highlighted）の 5 系統に変数がある。
キーボードフォーカス（`.has-focus`）には専用変数がない。
hover と active の規則は `body:not(.is-grabbing)` を前提にしている（L10795〜10827）。

`--nav-tag-*` は Tags view ではなく、File Explorer の非 Markdown ファイルに付く拡張子バッジ（`.nav-file-tag`）用である（L16618〜16640、確認済み）。
変数名から Tags view 用と誤読しやすいので注意が要る。
Tags view（`.tag-pane-tag`）に専用変数はない。

### Editor

エディタ系は 42 要素のうち 25 要素が変数だけで主要な見た目を変えられる。
変数がなく直接セレクタが必要なものは次のとおり。

- **アクティブ行**：`app.js` が `.cm-line.cm-active` と `.cm-gutterElement.cm-active` を付与するが、既定スタイルはない（確認済み）。Inkdrop の `--editor-active-line-background-color` を再現するにはこのクラスへの直接指定になる。
- **行番号ガター**：`.cm-gutters` の `color` と `border-right` が `!important`（L3726〜3735）で、上書きにも `!important` が要る。
- **取り消し線**、**Markdown 記号（`.cm-formatting-*`）**、**カスタムタスク状態（`[data-task="?"]`）**：変数がない。本体が装飾するのは `x` / `X` の完了状態だけである（L14486〜14490、L14529〜14532）。
- **Mermaid**：dark テーマでは SVG 全体に `filter: invert(100%) hue-rotate(180deg) saturate(1.25)` を掛けて反転させている（L11875）。`mermaid.initialize` に渡す `themeVariables` は `fontFamily: var(--font-mermaid)` だけで、配色を CSS 変数で渡す経路はない（app.js、確認済み）。Inkdrop は `mermaid.css` に `--mermaid-*` 変数を持つため、移植ではこのフィルタの解除と SVG 内部要素への直接指定が必要になる。
- **数式（MathJax）**：色は `currentColor` の継承で、専用変数はない。

変数はあるが粒度が Inkdrop より粗い箇所もある。
シンタックスハイライトは `--code-comment` から `--code-value` までの 10 色に集約されており（L2191〜2200）、Inkdrop の `syntax.css` にある多数のトークン変数を再現するには `.token.*`（Reading View）と `.cm-*`（編集時）への直接指定が必要になる。
エディタ内検索の一致箇所は `--text-selection` の背景と `--text-accent` の枠を流用しており（L7940〜7955）、検索専用の変数はない。
選択範囲は `--text-selection` の 1 変数で、フォーカスの有無による区別はない。

ハイライト（`==mark==`）は 1.14.4 で色指定（red、orange、yellow、green、blue、purple）を持ち、`--highlight-background-<color>` が未掲載のまま定義されている（L2372〜2379、L14563〜14600）。
dark では `mix-blend-mode: lighten` が掛かるため、指定した色がそのままの値で表示されるとは限らない（Computed 未検証）。

Properties は 46 変数を持ち、hover、focus、active の各状態に変数がある（L2546〜2590）。
Inkdrop にはノート本文内のプロパティフォームがなく、対応 UI は「なし」とした。

### General UI

General UI の 24 要素はすべて変数で主要部分を変えられるが、6 要素は一部にセレクタを要する。
入力欄の枠は `border` ではなく `box-shadow`（`--input-shadow`、`--input-shadow-hover`）で描かれ、dark 既定は内側の白線と外側の影の多層である（L3076〜3077）。
Inkdrop の `--focused-form-border-color` などを移すときは `box-shadow` として組み直す必要がある。

フォーカス表示には全体共通の `:focus-visible` 規則がない。
`app.css` には `:focus-visible` を含む規則が 49 箇所あり、部品ごとに `box-shadow`（2〜3px）や `outline` で `--background-modifier-border-focus` を参照している（L7561、L5223〜5370 ほか）。
Inkdrop の `--focused-outline-*` を一律に適用するなら `:focus-visible` への直接指定になる。

Menu の hover は `:hover` ではなく JS が付与する `.selected` クラスで表現される（L9219）。
Suggestion の一致語 `.suggestion-highlight` は `font-weight: bold` だけで色指定がない（L10313）。
Toggle の ON/OFF のレーン色に専用変数はなく、ON は `--interactive-accent`（L10488）、OFF は `--background-modifier-border-hover`（L10468）を参照する。
`--hotkey-*` は設定画面や空タブのホットキー表示用で、本文の `<kbd>` は `--code-*` を参照する（L10931）。

### Obsidian 固有

Graph View は PIXI によるキャンバス描画であり、CSS は描画に直接効かない。
`app.js` の `testCSS` が `body` に `.graph-view .color-fill` などの一時 div を作り、`getComputedStyle` の `color` と `opacity` を読んで描画色にする（確認済み）。
`onCssChange` から `testCSS` が再実行されるため、テーマ切替にも追従する。
したがって `--graph-*` 変数だけでなく、`.graph-view.color-*` クラスの `color` と `opacity` を直接指定しても制御できる。
`color-fill-highlight`（`--interactive-accent`）と `color-arrow` には専用変数がない（L16784〜16800）。
色文字列の解釈は、RGB/HSL の正規表現に失敗すると OffscreenCanvas の `fillStyle` に委ねる実装であり、`oklch()` などの値も解釈される可能性が高い（推測）。

Canvas の既定ノード色は `body.theme-dark { --canvas-color: #7e7e7e }`（L18187）で定義され、詳細度は (0,1,1) である。
テーマが `.theme-dark { --canvas-color }` で上書きしても負けるため、`body.theme-dark` 以上の詳細度が要る。
選択枠は `--color-accent` を直接参照し、ミニマップの線は `#c0c0c0` で固定されている（L18522、L19019）。

Bases はテーブル、カード、カンバン（ボード）の 3 表示を持ち、79 変数のうち 33 個が未掲載である。
カンバン関連の 15 変数はすべて未掲載であった（docs@c56c7e7 の時点）。

Slides は reveal.js の `black.css` / `white.css` を `<head>` の先頭に挿入して使う（app.js、確認済み）。
配色は reveal.js の `--r-*` 変数で決まり、`.slides-container` の背景は `#191919` で固定されている（L17695）。
テーマ側の `:root` で `--r-*` を上書きすれば後勝ちで効くと考えられるが、実機では確かめていない（推測）。

Web viewer の表示ページ、Publish の公開サイト、PDF の本文はテーマの配色対象外である。
PDF は dark かつ themed 表示のとき、注釈要素に反転フィルタを掛けている（L10952）。

## 直接セレクタが必要な主要箇所

変数で表現できず、移植時に直接セレクタを書くことになる箇所をまとめる。

| 箇所 | セレクタ | 理由 | 出典 |
| --- | --- | --- | --- |
| アクティブ行 | `.cm-line.cm-active` | 既定スタイルも変数もない | app.js |
| 行番号ガター | `.cm-gutters` | `!important` 指定 | L3726 |
| 左右サイドバーの色分け | 分割ペインのクラス | 背景が左右共通の `--background-secondary` | L6912 |
| Mermaid | `.theme-dark .mermaid > svg` ほか | dark は反転フィルタで、配色変数なし | L11875、app.js |
| シンタックスの細分化 | `.token.*`、`.cm-*` | 変数は 10 色のみ | L12031〜12110 |
| エディタ内検索の一致 | `.obsidian-search-match-highlight`、`.search-highlight` | 選択色と共用 | L7940〜7955 |
| フォーカス表示の統一 | `:focus-visible` | 共通規則がなく部品ごと | 49 箇所 |
| カスタムタスク状態 | `[data-task="?"]` | `x` / `X` 以外は装飾なし | L14486 |
| 取り消し線、Markdown 記号 | `.cm-strikethrough`、`.cm-formatting-*` | 変数なし | L3545、L13251 |
| ワークスペースタブの形状 | `.workspace-tab-header::before/::after` | 曲線は擬似要素で描画 | L7025 |
| Canvas ノード既定色 | `body.theme-dark` | 詳細度 (0,1,1) | L18187 |
| Graph の強調色と矢印 | `.graph-view.color-fill-highlight` ほか | 変数なし（JS がクラスの color を読む） | L16784〜16800 |
| Slides 背景 | `.slides-container`、`--r-*` | `#191919` 固定 | L17695 |
| ドロップダウン矢印 | `.theme-dark .dropdown` | SVG の `background-image` | L8032 |
| 折り畳みプレースホルダ | `.cm-foldPlaceholder` | `--text-faint` 固定参照 | L8270 |

なお、`app.css` で色を直書きしている規則は、モバイル用と印刷用を除くと 54 宣言だけであった。
多くは旧 HyperMD 由来の折り畳みスタブ、PDF の注釈、ドラッグゴースト、Lightbox のグラデーションなど周辺部品であり、主要 UI の色はほぼ変数経由で決まっている。

## 移植時の注意点

ここまでの所見のうち、テーマ実装の設計に直接効くものを挙げる。

- 色変数は `.theme-dark` / `.theme-light` で定義する。`body` で定義すると、`app.css` の `.theme-dark` 定義に負ける変数がある。
- 半透明の hover 色（`--background-modifier-hover` は `white` 6.7% の `color-mix`）を Inkdrop の不透明 hover 色で置き換えると、背景が異なる場所（サイドバー、モーダル、エディタ）で同じ色になる。重なり方を変えたくなければ `color-mix()` のまま係数を合わせる方法もある。
- `--background-primary` はノート領域、Modal、Prompt、Popover、Canvas ノードが共有する。Inkdrop のエディタ背景を割り当てると、これらすべての背景が同時に変わる。
- `--accent-h/s/l` はユーザーの設定画面からも変わる。テーマ固定のアクセント色にするか、ユーザー設定を尊重するかは方針を決める必要がある（注入方法は 03 §2.5 で確認済み: `body` の inline style に `setProperty` する）。
- docs 未掲載の変数（Menu、Tooltip、Notice、Settings、Bases カンバンなど）を使えば多くを変数で済ませられるが、将来の変更に弱い。依存箇所は記録しておくのが望ましい。
- 状態ごとの変数の有無は要素で差が大きい。File Explorer、Properties、Bases テーブル、Slider は状態別の変数を持つ。Suggestion、Menu、サイドバータブ、Tags view は `--background-modifier-hover` の流用で、状態別の色分けにはセレクタが要る。
- Windows と Linux のタイトルバーの閉じるボタン hover は白で固定されている（L6561〜6562）。

## 未調査、未確認事項

- 実機の Computed Style は一切取得していない。値はすべて `app.css` の宣言値を機械的に展開したものである。
- 読込順（app.css → theme.css → snippets）とアクセント色の注入方法（`body` の inline style）は、03 §2.3・§2.5 で静的解析により確認済みである（Phase 1B で本書の記述を 03 に合わせた）。実機の computed style で優劣を確かめてはいない（09 V-01・V-02）。
- `.mod-left-split` / `.mod-right-split` は `app.js` の静的解析で付与を確認した（Workspace 節）。実機の DOM では未確認。
- `body.styled-scrollbars` は、`app.js` の `Qy.isMacOS||document.body.addClass("styled-scrollbars")` により **macOS 以外でのみ**付与される（統合時に確認、03 §2.2 と一致）。macOS ではスクロールバー変数が効かない見込みだが、実機では未確認。
- Graph View の色解釈が `oklch()` や `color-mix()` を含む値で正しく働くかは推測にとどまる。
- Slides の `--r-*` 上書きが実際に効くかは確認していない。
- 公開版ドキュメント（https://docs.obsidian.md/Reference/CSS%20variables/CSS%20variables）の全体は取得しておらず、GitHub 原稿 @c56c7e7（2026-08-10）との差分は未確認である（Phase 1 で Window/Tooltip のページが存在しないこと、Phase 1B で Editor/Code の文言が原稿と同じことだけを確認した）。原稿は 1.14.4 の公開より前の時点のため、Bases カンバンなど新しい変数の記載が公開版で追加されている可能性がある。
- モバイル（`.is-mobile`、`.is-phone`、`.is-tablet`）固有の上書きは調査対象外とした。
- コミュニティプラグイン由来の UI、Publish 公開サイトの `publish.css`、PDF 本文の配色は対象外である。
- Inkdrop 側の対応有無は `inkdropapp/css` の変数名とクラス名からの目安であり、Inkdrop アプリの実画面とは突き合わせていない。特に「Inkdrop のメインウィンドウにノートタブはない」は推測である。
- 1.13.7 の `app.css` は同じ作業領域にあるが、本書では差分比較をしていない（`--callout-default` が色値である点は 1.13.7 でも同じことだけ確認した）。

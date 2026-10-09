# 01. Inkdrop テーマシステムの公式仕様と基盤 CSS の解析

- 調査日: 2026-10-09
- フェーズ: Phase 1（技術調査のみ。実装なし）
- 担当範囲: Inkdrop v6 テーマシステムの公式仕様、`@inkdropapp/css` の基盤 CSS、Default Dark / Light、`theme-dev-helpers`
- 付随データ: `research/data/inkdrop-base-tokens.csv`（基盤 CSS の全カスタムプロパティ定義 2,372 行。生成方法は §9）

## 0. 対象 SHA と表記規約

| リポジトリ | SHA（短縮） | コミット日 | 区分 |
|---|---|---|---|
| inkdropapp/api-docs（developers.inkdrop.app の原稿） | `965790b` | 2026-09-23 | 一次情報（公式） |
| inkdropapp/css（`@inkdropapp/css` 0.9.14） | `add48d9` | 2026-10-07 | 一次情報（公式） |
| inkdropapp/default-dark（3.0.0） | `68c28c4` | 2026-09-15 | 一次情報（公式） |
| inkdropapp/default-light（3.0.0） | `ef81d48` | 2026-09-15 | 一次情報（公式） |
| inkdropapp/theme-dev-helpers（0.7.0） | `a7bcbe6` | 2026-09-30 | 一次情報（公式） |
| inkdropapp/base-ui-theme（0.7.8） | `6846d3f` | 2026-09-14 | 一次情報（公式） |
| inkdropapp/inkdrop-ui-theme-template（旧 v5 形式） | `011080b` | 2024-10-25 | 一次情報（公式・旧版） |
| inkdropapp/version-history | `072811f` | 2026-08-04 | 一次情報（公式） |
| inkdropapp/docs（docs.inkdrop.app の原稿） | `96cacac` | 2026-10-08 | 一次情報（公式） |
| inkdropapp/mermaid | `384e9f5` | 2026-09-11 | 一次情報（公式） |
| inkdropapp/gfm-alerts | `0562b55` | 2026-07-22 | 一次情報（公式） |

出典の表記は次のとおりです。

- リポジトリ内のファイルは `repo@SHA path:line` と書きます。
  例: `css@add48d9 ui.css:1428`。`api-docs` の場合、パスの起点は `src/app/` です。
- 公開 Web ページは URL で示します。
  開発元（Takuya Matsuyama）の投稿は一次情報として扱います。
- ラベルの意味は次のとおりです。
  - **【確認済み】**: ソースや公式文書で直接確認できた事実です。
  - **【推測】**: 確認済みの事実から導いた推論です。
  - **【未確認】**: 静的解析では確定できない事項です。
- 本書で「値」と書く場合、断りがなければ CSS ソース上の**宣言値**を指します。
  実アプリ上の Computed Style は確認していません。
  `palette.json` の値は、ヘッドレス Chromium で求めた**近似の解決値**です（§7）。

---

## 1. テーマパッケージの構造とロード順序

### 1.1 v6 で単一パッケージへ統合

- **【確認済み】** v6 のテーマは 1 パッケージで UI・エディタ・プレビューの 3 領域を扱います。
  `package.json` には `"theme": true`（真偽値）を宣言します。
  （`api-docs@965790b guides/create-a-theme/page.mdx:11-26`、`appendix/plugin-migration-from-v5-to-v6/page.mdx:262-299`）
- **【確認済み】** v5 形式の `"theme": "ui" | "syntax" | "preview"` を持つパッケージはロードされません。
  警告 *"<name> does not support v6. Please update the theme."* が出て、有効化もされません。
  （`api-docs@965790b appendix/plugin-migration-from-v5-to-v6/page.mdx:294-298`）
  フォーラムの公式告知には、デフォルトテーマにフォールバックするとあります（https://forum.inkdrop.app/t/whats-new-in-v6/5570 、2026-08-05、開発者投稿）。
- **【確認済み】** 旧形式の参考として `inkdrop-ui-theme-template` があります。
  中身は `"theme": "ui"`、`styleSheets: ["theme.css"]`、`engines.inkdrop: "^5.9.0"` で、`styles/theme.css` は空です（`inkdrop-ui-theme-template@011080b package.json:4-9,25`）。

### 1.2 `package.json` の各キー

| キー | 役割 | 出典 |
|---|---|---|
| `theme` | `true` でテーマとして認識されます。文字列値は非対応です。 | `api-docs@965790b guides/create-a-theme/page.mdx:42,47-63` |
| `themeAppearance` | `"light"` または `"dark"`。テーマ全体の外観を表します。 | 同上 `:53`、migration `:270` |
| `styleSheets` | ロードする CSS の配列。`styles/` 相対のファイル名を書きます（例 `"ui.css"` → `styles/ui.css`）。 | 同上 `:54,65-69`、`default-dark@68c28c4 package.json:7-11` |
| `engines.inkdrop` | ガイドの例は `"^6.0.0"`、Default Dark / Light は `"^6.x"` です。 | ガイド `:61`、`default-dark@68c28c4 package.json:28-30` |
| `scripts.prepublishOnly` | `generate-palette` を実行し、公開時に `palette.json` を同梱します。 | ガイド `:442-456` |
| `devDependencies["@inkdropapp/theme-dev-helpers"]` | ガイドは `^0.6.0`、Default テーマは `^0.6.5` です。 | ガイド `:59`、`default-dark@68c28c4 package.json:25-27` |

外観の判定ロジックは次のとおりです。

- **【確認済み】** `theme-dev-helpers` の `deriveAppearance()` は、パッケージ名に `dark` を含むか、`themeAppearance === 'dark'` なら dark と判定します。
  コメントによると、これはデスクトップアプリの `ThemePackage#getAppearance` と同じ判定です（`theme-dev-helpers@a7bcbe6 src/palette.ts:23-34`）。
- **【推測】** 本体側の実装は非公開です。
  上記のコメントが正しければ、名前に `dark` を含むテーマは `themeAppearance` によらず dark 扱いになります。

### 1.3 スタイルシートのロード順序

- **【確認済み】** 公式ガイドは「`@inkdropapp/css` はテーマより先にロードされる」と明記しています（`api-docs@965790b guides/create-a-theme/page.mdx:165`、migration `:368,402,424`）。
- **【確認済み】** v6 のアプリはテーマ CSS を**そのまま（verbatim）注入**します。
  v5.8.1 のように自動で `@layer` に包む処理はしません（ガイド `:86`、migration `:303`）。
  v5.8.1 では、UI・syntax・preview テーマが自動でレイヤーに包まれていました（`version-history@072811f README.md:552-567`）。
- **【確認済み】** 共有パレットを使う場合、ガイドはそのファイルを `styleSheets` の先頭に置くよう指示しています（ガイド `:350-355,401`）。
  例: `["palette.css", "ui.css", "syntax.css", "preview.css"]`
- **【確認済み】** `generate-palette` が再現しているロード順は次のとおりです（`theme-dev-helpers@a7bcbe6 src/generate-palette.ts:36-48`、`src/palette.ts:64-93`）。
  `reset.css` → `tokens.css` → `utilities.css` → `ui.css` → `tags.css` → `status.css` → `task-progress.css` → `syntax.css` → `markdown.css` → `mermaid.css` → `@inkdropapp/base-ui-theme/styles/theme.css` → テーマの `styleSheets`（記載順）
  - この harness は `layers.css` を読み込みません。
- **【未確認】** 実アプリが同じ順で読み込むかどうかは分かりません。
  アプリ独自の非公開 CSS（サイドバー等のレイアウト規則）の位置も不明です。
- **【確認済み】** ユーザーの個人用調整は `<user data>/styles.css` に書きます（`api-docs@965790b guides/style-tweaks/page.mdx:8`、`docs@96cacac src/app/reference/user-data-directory/page.md:23`）。
  v6 では `styles.less` は読み込まれません（`docs@96cacac src/app/reference/migrate-from-v5-to-v6/page.md:41-42`）。

---

## 2. CSS Cascade Layers

### 2.1 宣言されているレイヤー順

`css@add48d9 layers.css:1-11` の宣言は次のとおりです。

```css
@layer reset, base, tokens, recipes, utilities, theme, theme.ui, theme.ui.base, theme.ui.components, theme.preview, theme.syntax;
```

CSS Cascade Layers 仕様では、親レイヤー直下の規則が自分のサブレイヤーより優先されます。
公式ガイドも "a layer's own rules outrank its sub-layers" と述べています（ガイド `:86`）。
この前提で、通常宣言（`!important` なし）の優先度を低い順に並べると次のようになります。**【推測（仕様からの導出）】**

```
reset < base < tokens < recipes < utilities
  < theme.ui.base < theme.ui.components < theme.ui（直下）
  < theme.preview.base < theme.preview（直下）
  < theme.syntax.base < theme.syntax（直下）
  < theme（直下）
  < レイヤー外（unlayered）
```

- `theme.syntax.base` と `theme.preview.base` は `layers.css` で宣言されていません。
  `syntax.css` / `markdown.css` / `mermaid.css` で初めて使われた時点で、それぞれの親レイヤーの最初のサブレイヤーとして暗黙に作られます。
  それでも親レイヤー直下（テーマの規則）より低い位置になります。**【確認済み（ソース）＋仕様】**
- **公式ガイドとの食い違い（要注意）**: ガイドは「`@layer theme` は `tokens` より上、`theme.ui`/`theme.syntax`/`theme.preview` より下」と書いています（ガイド `:378`）。
  しかし仕様上、`@layer theme { … }` 直下の規則はサブレイヤー `theme.ui` 等の規則より**強く**なります。
  同じプロパティを `palette.css`（`@layer theme`）と `ui.css`（`@layer theme.ui`）の両方で宣言すると、`palette.css` 側が勝ちます。**【推測（仕様からの導出）。実アプリでの検証はしていない】**
  名前が重ならない独自トークン（`--motif-*`）や、`--hsl-*` を再定義するだけなら実害はありません。
- `theme.preview` は `theme.ui` より、`theme.syntax` は `theme.preview` より強くなります。
  同じ変数を複数のファイルで上書きした場合は syntax > preview > ui の順に勝ちます。**【推測（仕様からの導出）】**

### 2.2 各ファイルの所属レイヤー（ソースが正。README は古い）

| ファイル | 実際のレイヤー（ソース） | README の記載 | 内容 |
|---|---|---|---|
| `reset.css` | `reset`（`reset.css:1`） | `reset` | normalize 系のリセット |
| `tokens.css` | `tokens`、セレクタ `:where(:root, :host)`（`tokens.css:1-2`） | `tokens` | プリミティブトークン |
| `utilities.css` | `utilities`（`utilities.css:1-2`） | `utilities` | サイズ・角丸・px→rem 換算・グリッド |
| `ui.css` | `theme.ui.base`（`ui.css:1`） | 記載なし | UI セマンティックトークン 892 個 |
| `status.css` | `theme.ui.base`（`status.css:1`） | `theme.ui` | `--note-status-*` |
| `task-progress.css` | `theme.ui.base`（`task-progress.css:1`） | `theme` | `--task-progress-view-*` |
| `tags.css` | **`theme.ui`（直下）**（`tags.css:1`） | `—` | `--tag-*` 336 個 |
| `syntax.css` | `theme.syntax.base`（`syntax.css:1`） | 記載なし | `--editor-*` `--syntax-*` `--md-*` と `.tok-*` 規則 |
| `markdown.css` | `theme.preview.base`（`markdown.css:1`） | `theme.preview` | `--mde-preview-*` `--gfm-alert-*` と `.mde-preview` 規則 |
| `mermaid.css` | `theme.preview.base`（`mermaid.css:1`） | `theme.preview` | `--mermaid-*` |
| base-ui-theme `styles/theme.css` | `theme.ui.base`（`base-ui-theme@6846d3f src/semantic.less:13`） | — | Semantic UI 由来のコンポーネント規則 |

README の記載は `css@add48d9 README.md` の Cascade layers 表によります。

- **【確認済み】** README の表は古く、ソースと一致しません。
- **【確認済み】** `theme.ui.components` は `layers.css` で宣言されていますが、公開リポジトリには使用箇所がありません。
- **【推測】** 本体の非公開 CSS（アプリ固有コンポーネント）が `theme.ui.components` を使っている可能性があります。
- **【推測】** `tags.css` だけが `theme.ui` 直下にあるため、テーマの `@layer theme.ui { :root { --tag-… } }` と同じレイヤーで競合します。
  詳細度はどちらも `:root` なので、後から読み込まれる方が勝ちます。
  テーマは基盤 CSS の後に読み込まれるので（§1.3）、通常はテーマが勝つはずです。
- **【確認済み】** `gfm-alerts` プラグインは `@layer base` に `--gfm-alert-*` を定義しています（`gfm-alerts@0562b55 styles/index.css:1-9`）。
  プラグイン側の規則（`.gfm-alert` 等）はレイヤー外です。
  `markdown.css` も `--gfm-alert-*` を `theme.preview.base` で定義しています（`markdown.css:3-7`）。
  レイヤー順では `theme.preview.base` の方が強くなります。

### 2.3 テーマ CSS が入るべきレイヤー（公式指示）

公式ガイドの指示は次のとおりです（ガイド `:73-86,350-432`、migration `:301-314`）。

| テーマのファイル | 包むレイヤー | 上書き対象 |
|---|---|---|
| `styles/ui.css` | `@layer theme.ui` | `ui.css` / `status.css` / `tags.css` / `task-progress.css` の変数 |
| `styles/syntax.css` | `@layer theme.syntax` | `--editor-*`（CodeMirror）/ `--syntax-*` / `--md-*` |
| `styles/preview.css` | `@layer theme.preview` | `--mde-preview-*` / `--gfm-alert-*` / `--mermaid-*` |
| 共有パレット（`palette.css` / `tokens.css`） | `@layer theme` | 独自名トークン（任意）、または `--hsl-*` / `--color-*` ランプの再定義（必須） |

- **【確認済み】** ランプ（`--hsl-neutral-*` 等）を再定義する場合は `--color-*` ラッパーも再宣言するよう、ガイドは指示しています（ガイド `:417-432`）。
- **【推測】** `--color-*` も `tokens` レイヤーの `:where(:root,:host)` にあります。
  そのため、`var()` の再解決自体は `:root` 上の値で起きます。
  再宣言を求める理由として公式は「ラッパーが上書き後の値に対して確実に解決されるように」と書いていますが、実際の技術的必要性は確認していません。

---

## 3. CSS カスタムプロパティのトークン体系

### 3.1 プリミティブ（`tokens.css`、`@layer tokens`）

全 499 個です。CSV では `defined_in` が `tokens.css:*` の行にあたります。

- `--font-weights-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}`
  値は 100〜900 です（`tokens.css:3-11`）。
- `--color-current`, `--color-black`(#000), `--color-white`(#fff), `--color-transparent`, `--hsl-black`, `--hsl-white`
  （`tokens.css:12-17`）
- `--hsl-<family>-<step>`
  - HSL 三つ組で、`hsl()` で包まずに保持されます（例: `--hsl-slate-500: 215deg 16% 47%`）。
  - 透明度を付けるときは `hsl(var(--hsl-x) / 30%)` の形で使います。
  - 22 ファミリ × 11 段階 = 242 個です。
- `--color-<family>-<step>`: `hsl(var(--hsl-<family>-<step>))` のラッパー（242 個、`tokens.css:261-502` 付近）。
- ファミリ（Tailwind CSS v3 と同じ名前と段階）:
  `rose pink fuchsia purple violet indigo blue sky cyan teal emerald green lime yellow amber orange red stone neutral zinc gray slate`
- 段階: `50 100 200 300 400 500 600 700 800 900 950`（50 が最も明るい）
- **【確認済み】** `tokens.ts` は同じ値の TS 版です。
  三つ組の表記は `'215 16% 47%'` で、`deg` が付きません（`tokens.ts:12` 以降）。
- **【確認済み】** migration ガイドは、v6 の主要ファミリを `neutral` と `blue cyan green yellow orange red violet pink` と紹介しています（migration `:368-376`）。
  実際の `tokens.css` には 22 ファミリすべてがあります。

### 3.2 ユーティリティ（`utilities.css`、`@layer utilities`）

- 基準サイズは `--em-size: 14px`、`--font-size: 14px` です（`utilities.css:7-9`）。
- 角丸は `--absolute-border-radius: var(--7px)`、`--default-border-radius` です（`:16-26`）。
- サイズ比は `--mini-size`〜`--massive-size`、rem / em 版は `--mini`… `--relative-*` `--absolute-*` です（`:35-94`）。
- `--1px`〜`--64px`、`--128px` は 14px 基準の rem 値です（`--7px: 0.5rem` など）。
  `--relative1px`… は em 版です（`:109-238`）。
- トランジションは `--default-duration: 0.1s` と `--default-easing: ease` です（`:46-47`）。

### 3.3 セマンティック（UI: `ui.css`、`@layer theme.ui.base`、`:root`）

命名規則は次の 3 種です。

- グローバルの意味トークン: `--text-color`, `--border-color`, `--primary-color` など
- Semantic UI のコンポーネント状態トークン: `--<component>[-<variant>]-<state>-<property>`（例 `--basic-button-hover-box-shadow`）
- アプリ領域トークン: `--sidebar-*`, `--note-list-*`, `--editor-*`, `--header-note-menu-*`, `--preferences-*`

**【確認済み】** `base-ui-theme` の運用ルールにも、命名規則は `--<component>-<property>` と書かれています（`base-ui-theme@6846d3f .claude/rules/css-variables.md`）。

主な階層は §5.2 の表にまとめます。参照関係の全体は CSV の `references` 列で追えます。

### 3.4 `light-dark()` と `color-scheme`

- **【確認済み】** 基盤 CSS は light と dark の両方の既定値を 1 つの宣言に入れています。
  `light-dark(<light>, <dark>)` を使う宣言は CSV 全体で 450 個あります（§9 のスクリプトで集計）。
  主な場所は `ui.css`、`syntax.css`、`markdown.css`、`mermaid.css`、`tags.css`、`task-progress.css` です。
- **【確認済み（コード内コメント）】** `light-dark()` は、`index.html` が `<body>` に設定する `color-scheme` に対して解決されます。
  既定は light で、`body.dark-mode` または `[class*='dark-ui']` のときに dark になります（`syntax.css:2-9`、`mermaid.css:12-16`）。
- **【確認済み】** `base-ui-theme` の README も、ダークモードは `ui.css` の `light-dark()` で扱い、ダーク専用のスタイルシートは存在しないと述べています（`base-ui-theme@6846d3f README.md` の "Dark mode" 節）。
- **【推測】** 本体の `index.html` は非公開です。
  `css@add48d9 markdown.html` は CSS 確認用のサンプル文書ですが、その本文に移行計画メモが入っています。
  メモには、`index.html` がクエリパラメータ `dark-ui` を受け取ること、「dark-mode inline script」が存在することが書かれています（`markdown.html` 中の `?windowType=full&entry=main&acrylic=1&dark-ui=1&windowId=1` 等）。
  したがって `color-scheme` を設定する仕組みは、`themeAppearance` からアプリが付ける body クラスによる、と推定します。
- **【確認済み】** テーマが `color-scheme` を自分で設定する公式手順はありません。
  ガイドに記載がなく、Default テーマも何も設定していません。
- **【確認済み】** `base-ui-theme` に `.sidebar-layout-content { color-scheme: var(--sidebar-color-scheme); }` という規則があります（`base-ui-theme@6846d3f src/themes/default/globals/site.overrides:5-7`）。
  ただし `--sidebar-color-scheme` は `@inkdropapp/css` のどこでも定義されていません。
- **【推測】** 未定義の場合、`color-scheme` は継承値になります（computed-value time で無効になり、継承プロパティなので inherit 扱い）。
  テーマが `--sidebar-color-scheme: dark` を設定すれば、サイドバー内の `light-dark()` だけを反転できると考えられます。
- 注意: 変数に入っている `light-dark()` は、**使用される要素**の `color-scheme` に対して解決されます。
  `:root` の変数値そのものは未解決のトークン列のままです。
  `theme-dev-helpers` も「ブラウザはカスタムプロパティ内の `light-dark()` を未解決のまま残す」と明記しています（`theme-dev-helpers@a7bcbe6 src/palette.ts:230-241`）。

### 3.5 `color-mix()`

- **【確認済み】** `@inkdropapp/css` のトークン定義に `color-mix()` はありません（0 件）。
  使用箇所は `syntax.css:735-738` の `.md-task-done-text` の `text-decoration-color` のフォールバック（`color-mix(in srgb, currentColor, transparent 40%)`）だけです。
- **【確認済み】** `generate-palette` は、テーマが `color-mix()` を使う場合に備えて、ブラウザで計算した値で置き換える処理を持っています（`palette.ts:265-307`、`generate-palette.ts:110-122`）。
  サードパーティ製テーマ（Kanagawa など）が `color-mix()` を使っているかは 02 の調査範囲です。

### 3.6 OS / ウィンドウ状態による条件分岐

すべて **【確認済み】** です。

| 条件 | 上書きされる変数 | 出典 |
|---|---|---|
| `@supports (corner-shape: squircle)` | `--default-corner-shape: squircle`, `--default-squircle-radius: var(--15px)`, `--large-squircle-radius: var(--24px)` | `ui.css:1566-1572` |
| `:root:has(body.acrylic-window)` | `--page-background: transparent`, `--sidebar-background`, `--note-list-bar-background`, `--editor-background`, `--editor-drawer-background`, `--inline-dropdown-menu-background`, `--vertical-menu-background` | `ui.css:1578-1592` |
| `:root:has(body.acrylic-window)`（syntax） | `--editor-background-color: transparent` | `syntax.css:742-744` |
| `:root:has(body.acrylic-window[class*='dark-ui'].platform-win32)`, `:root:has(body.dark-mode.acrylic-window.platform-win32)` | `--sidebar-background`, `--page-background` | `ui.css:1598-1602` |
| `.cm-editor, .mde-preview .codeblock .md-table .md-inline-code` | `--md-inline-code-padding: 0px` | `syntax.css:716-718` |
| `@media print`（markdown） | 表・`pre > code` の折り返し（変数ではない） | `markdown.css:1019-1029` |

- 公式ガイドは、アクリル（macOS / Windows 11+ のすりガラス）が有効なとき `body` に `acrylic-window` クラスが付くと述べています。
  対応例として `:root:has(body.acrylic-window)` と `body.acrylic-window.platform-win32` を挙げています（ガイド `:209-242`）。
- `prefers-color-scheme` のメディアクエリは基盤 CSS で使われていません。
  OS の外観への追従は、アプリがデフォルトの light / dark テーマを切り替える方式です（`docs@96cacac src/app/reference/extend-with-plugins/page.md:71`、`version-history@072811f README.md:929-930`）。**【確認済み】**

---

## 4. 領域別のスタイル体系

### 4.1 UI（アプリ chrome）

- **【確認済み】** UI コンポーネントの規則は `@inkdropapp/base-ui-theme` にあります。
  Semantic UI の LESS を `@layer theme.ui.base` 内にコンパイルした `styles/theme.css` です。
  - 有効なコンポーネントは site, button, container, divider, header, image, input, label, list, loader, segment, form, menu, message, table, accordion, checkbox, dropdown, modal, popup, sticky, transition です。
  （`base-ui-theme@6846d3f README.md`「File structure」節、`src/semantic.less:13-`）
- **【確認済み】** 規則は `var(--token, @lessFallback)` の形で CSS 変数を読みます。
  ただしラップ済みは LESS 変数使用の約 27% だけです。
  `container`, `sticky`, `transition` は 0% です（`base-ui-theme@6846d3f .claude/rules/css-variables.md`）。
  変数で上書きできない見た目がある、ということです。
- **【確認済み】** `base-ui-theme` が参照しているのに `@inkdropapp/css` で未定義の変数が 70 前後あります。
  主なものは `--label-<color>-hover-*`, `--popup-inverted-*`, `--tag-<color>-color`, `--sidebar-color-scheme` などです。
  本調査の機械解析でも、`base-ui-theme` を含めると未定義参照は 85 件でした（§9）。
- **【確認済み】** `site.less` は `body` 等に `--page-font`, `--font-size`, `--line-height`, `--text-color`, `--link-color` を、`::selection` に `--highlight-background` / `--highlight-color` を適用しています（`base-ui-theme@6846d3f src/definitions/globals/site.less:32-45,123-129,186-200`）。
- **【確認済み】** サイドバー、ノートリスト、エディタ外枠、ヘッダーノートメニュー、環境設定、通知の `--*` は、**公開ソースのどこからも参照されていません**。
  機械解析で consumer が 0 でした（§5.2 の「消費箇所」列）。
- **【推測】** これらは非公開のアプリ本体 CSS が読んでいます。
  変数とクラスの対応は名前・コメント・既知のクラス名（`.sidebar-layout-content`, `.note-list-bar-item .note-list-item-view.active`）からの推定です。
  クラス名の出典は `guides/style-tweaks/page.mdx:14` です。

### 4.2 Syntax（CodeMirror 6）

- **【確認済み】** `syntax.css` は 3 種類の変数群を `theme.syntax.base` の `:root` に定義しています（`syntax.css:10-331`）。
  - `--editor-*`（chrome）: 背景、前景、キャレット、選択、アクティブ行、ガター、パネル、ツールチップ、補完、括弧、検索一致、折りたたみ等。`syntax.css:18-143` で 63 個です。
  - `--syntax-*`（Lezer ハイライトトークン）: `syntax.css:150-286`
  - `--md-*`（Markdown 固有）: `syntax.css:291-330`
- **【確認済み】** 色付けの規則は `.cm-editor, .mde-preview .codeblock` の配下で `.tok-*` を対象にしています（`syntax.css:339-740`）。
  - `.tok-*` クラスは `@inkdropapp/cm6-theme-common` の tokenHighlighter が付けます。
  - `.md-*` クラスは mdTokenHighlighter が付けます。
  - したがって、エディタとプレビューのコードブロックは同じ `--syntax-*` を共有します。
  - 例:
    - `.tok-keyword` → `--syntax-keyword-color`
    - `.tok-name.tok-function` → `--syntax-name-function-color`
    - `.tok-heading-1` → `--syntax-heading-1-color` / `-font-weight`
    - `.tok-link` → `--syntax-link-color` / `--syntax-link-text-decoration`
    - `.md-list-mark` → `--md-list-mark-color`
    - `.md-list-mark-2 .md-list-mark` → `--md-list-mark-2-color`
    - `.md-inline-code` → `--md-inline-code-*`（未指定なら `--md-codeblock-*` にフォールバック）
    - `.md-inline-mark` → `--md-inline-mark-*`
    - `.md-task-done-text` → `--md-task-done-text-decoration(-color)`（未定義変数。フォールバックあり）
  - `.md-header-mark`, `.md-link-mark`, `.md-emphasis-mark`, `.md-code-mark`, `.md-table-delimiter`, `.md-strikethrough-mark`, `.md-hard-break` は空の規則です（`syntax.css:679-704`）。
  - `.tok-type-name` と `.tok-escape` は、現行の highlighter では出力されない legacy alias です（`syntax.css:445-448,470-474`）。
- **【確認済み】** 修飾付きトークンは基本トークンにフォールバックします。
  色を指定しないトークンは `--editor-foreground-color` にフォールバックします（ガイド `:277`、`syntax.css:152-175,213,233,262-273`）。
- **【確認済み】** CM5 → CM6 の対応表が migration ガイド `:426-473` にあります。
  例: `.CodeMirror` 背景 → `--editor-background-color`、`.cm-keyword` → `--syntax-keyword-color` など。
- **【確認済み】** `--editor-*` chrome 変数（63 個）と一部の `--md-*`（`--md-blockquote-border-color`, `--md-table-*`, `--md-codeblock-color`）は、公開 CSS 規則からは参照されていません。
- **【推測】** これらは本体内の CodeMirror テーマ拡張、または非公開 CSS が消費していると考えられます。
- **【確認済み】** `syntax.css:7-8` のコメントには「テーマの `:root` はレイヤー外なのでこのレイヤーより強い」とあります。
  これは v5 時代の前提で、v6 では各テーマが `@layer theme.syntax` に包むことが求められます（§2.3）。

### 4.3 Preview（Markdown）

- **【確認済み】** `markdown.css` の `:root` には 52 個の変数があります（`--gfm-alert-*` 5 個、`--mde-preview-*` 47 個、`markdown.css:2-110`）。
  `.mde-preview { … }` 配下の規則（`markdown.css:112-1017`）がそれらを読みます。
  - 本文: `color: var(--text-color)`, `font-size: 16px`, `line-height: var(--mde-preview-line-height)`（`:117-124`）
  - リンク: `--mde-preview-link-color`
  - 見出し: `--h1`〜`--h6`（`ui.css:45-50` 由来）、`--mde-preview-heading-*`、`--mde-preview-h1-border-width`
  - 強調: `--mde-preview-strong-color` / `-em-color`
  - インラインコード、コードブロック枠、表、脚注、kbd、`<mark>`、タスクリスト、リストマーカー、画像背景、hr、引用、GFM Alert（`.gfm-alert-type-*`）
- **【確認済み】** 多くの `--mde-preview-*` は UI トークンを既定値にしています。
  例: `--text-color`, `--muted-text-color`, `--border-color`, `--solid-border-color`, `--link-color`, `--kbd-*`, `--transparent-black/white`, `--strong-transparent-black/white`, `--primary-color-active`
  そのため UI テーマを変えるとプレビューも追従します（`markdown.css:10-109`、ガイド `:291`）。
- **【確認済み】** `--gfm-alert-*` の既定値は `var(--blue, hsl(var(--hsl-blue-500)))` などで、UI の `--blue`/`--green`/`--purple`/`--orange`/`--red` を経由します（`markdown.css:3-7`）。
- **【確認済み】** `--mde-preview-codeblock-meta-background-color`（`markdown.css:97-100`）は、`.mde-preview` 配下の規則から参照されていません（§9 の consumer 解析）。
  また `markdown.css` の本文規則に、未定義の `--base-size-8` への参照が 1 件あります。
- **【確認済み】** コードブロック内のハイライトは syntax 側（`--syntax-*`）が担当します。
  preview 側が担当するのは枠（背景・枠線・meta バー）だけです（migration `:588-592`）。
- **【確認済み】** `.mde-preview` は内容のルート要素です。
  `.mde-preview-container` は外側のラッパーで、キーマップやコマンドのスコープに使われます（ガイド `:309-316`、migration `:203-205`）。
- **【確認済み】** ガイドは、エディタ用の CSS で `font-family` を指定しないよう推奨しています（ユーザー設定を上書きするため。ガイド `:282-287`）。

### 4.4 Mermaid

- **【確認済み】** `mermaid.css` の `:root` に `--mermaid-*` が 150 個あります（`mermaid.css:20-283`）。
  色を実際に持つのは少数の基本トークンで、他は `var()` でそこから派生します。
  - 基本トークン: `--mermaid-text-color`, `--mermaid-line-color`, `--mermaid-node-background-color`, `--mermaid-node-border-color`, `--mermaid-cluster-*`, `--mermaid-edge-label-background-color`, `--mermaid-note-*`, `--mermaid-section-*`, `--mermaid-task-*`, `--mermaid-primary/secondary/tertiary-color` など
  - 3 つの seed 色（primary/secondary/tertiary）は、pie / git / quadrant のカテゴリ色の元になります（`mermaid.css:131-138`、ガイド `:335`）。
- **【確認済み】** mermaid プラグインは Mermaid の `base` テーマを使います。
  `themeVariables` は描画のたびに次の手順で作ります（`mermaid@384e9f5 packages/mermaid/src/theme.ts`、`src/render.ts:44-82`）。
  1. 不可視の probe 要素の `color` に `var(--mermaid-<token>)` を入れる。
  2. `getComputedStyle` で具体的な色に解決する。
  3. その色を `themeVariables` に渡す。
  - 印刷やエクスポート時は probe に `color-scheme: light` を強制します。
- **【確認済み】** 色は SVG に焼き込まれます。
  そのため描画済みの図はテーマを切り替えても即時には変わらず、再描画で反映されます（ガイド `:339-346`）。
- **【確認済み】** `theme.ts` は `vert-line-color` を参照していますが、`--mermaid-vert-line-color` は `mermaid.css` で未定義です。
  未定義のときの具体的な挙動は未確認です。

### 4.5 タグ・ステータス・タスク進捗

- **【確認済み】** タグは 14 色あります。
  色は `default red orange yellow olive green teal blue violet purple pink brown grey black` です。
  各色に 8 つのプロパティがあります。
  プロパティは `background/border/text`、`active-background/border/text`、`circular-background/border` の各 `-color` です。
  1 組で 112 個、これが 3 組あって合計 336 個です。
  - `--tag-light-<c>-*`（明背景用、`tags.css:3-131`）
  - `--tag-dark-<c>-*`（暗背景用、`:132-260`）
  - `--tag-<c>-*` は `light-dark(var(--tag-light-…), var(--tag-dark-…))` です（`:261-722`）。
- **【確認済み】** ステータス変数は `--note-status-{active,onhold,completed,dropped}` で、後方互換の別名 `--task-icon-*` もあります（`status.css:3-12`）。
- **【確認済み】** タスク進捗の変数は `--task-progress-view-{border,background,foreground,completed}-color` です（`task-progress.css:17-26`）。

---

## 5. 継承と上書き：テーマが何もしない場合の既定値

### 5.1 原則

- **【確認済み】** テーマが上書きしない変数には、基盤 CSS の宣言値が使われます。
  `themeAppearance` に応じて `light-dark()` のどちらかの枝が選ばれます（§3.4、§6）。
- **【確認済み】** 依存関係の連鎖は、典型的に次の 4 段です（CSV の `references` 列で全件を追えます）。
  1. プリミティブ: `--hsl-*` / `--color-*`
  2. グローバル意味トークン: `--text-color`, `--border-color`, `--primary-color`, `--*-text-color`, `--transparent-*`
  3. コンポーネント / 領域トークン
  4. preview / mermaid のトークン
- 上流を変えたときの波及の例:
  - `--text-color` を上書きすると、`--input-color`（light 枝）, `--basic-button-text-color`, `--menu-item-text-color`, `--mde-preview-heading-color`, `--mde-preview-strong-color`, `--mermaid-text-color` などに伝わります。
  - `--primary-color` を上書きすると、`--note-list-view-item-date-color`, light の `--note-list-view-item-active-background`, `--sidebar-menu-item-active-background`, `--checkbox-active-background`, `--toggle-on-lane-color` に伝わります。
- **【確認済み】** 一部のトークンは上流トークンを経由していません。
  例: `--editor-background`, `--sidebar-background`, `--page-background` は `--color-neutral-*` / `--color-gray-*` を直接参照しています。
  したがって、`--hsl-neutral-*` ランプを再定義するとこれらも一括で変わります（ガイド `:401`、Solarized 方式）。
- **【確認済み】** `--editor-background`（UI 側、`ui.css:1519`）と `--editor-background-color`（syntax 側、`syntax.css:19`）は**別の変数**です。
  既定値はどちらも `light-dark(white, neutral-950)` です。
- **【推測】** 2 つの消費先の違い（外枠 / CodeMirror 内）は非公開 CSS 次第で、確認できていません。
  移植では両方を同じ値にするのが安全です。

### 5.2 UI 領域ごとのトークン対応（マッピング用）

列の意味は次のとおりです。

- 「宣言」: 主要トークンと定義行（`css@add48d9`）
- 「既定（light / dark）」: Default テーマの `palette.json` の解決値です（§7。代表値のみ）
- 「消費箇所」: 次のいずれかです。
  - **公開**: `base-ui-theme` / `@inkdropapp/css` の規則で使用を確認済み
  - **非公開**: 公開ソースに consumer がなく、本体 CSS での使用を推定

| 領域 | 主要トークン（定義行） | 既定 light / dark（代表） | 消費箇所 |
|---|---|---|---|
| アプリ全体・ページ | `--page-background`(114), `--text-color`(118), `--page-font`(16), `--font-size`/`--em-size`(utilities 7-9), `--line-height`(117), `--link-color`(131), `--link-hover-color`(133), `--highlight-background`/`--highlight-color`(140-141; `::selection`), `--primary-color`(32), `--secondary-color`(33) | page: `#fff` / `hsl(0 0% 4%)`; text: `hsl(0 0% 0% / 87%)` / `hsl(0 0% 98% / 87%)`; primary: `hsl(217 91% 60%)` / `hsl(213 94% 68% / 80%)` | `--page-background`: 非公開。その他: 公開（site.less） |
| 文字色の階層 | `--dark-text-color`, `--muted-text-color`, `--light-text-color`, `--unselected-`/`--hovered-`/`--pressed-`/`--selected-`/`--disabled-text-color`, `--inverted-*`(366-410, 496-503) | 黒 / neutral-50 の 20〜95% アルファ | 公開（トークン経由で多数） |
| 境界線 | `--border-color`, `--strong-border-color`, `--internal-border-color`, `--selected-border-color`, `--solid-border-color`, `--solid-internal-border-color`(416-449) | `hsl(neutral-900 / 15%)` / `hsl(neutral-100 / 10%)` | 公開 |
| 透過色・影 | `--subtle-/--strong-/--very-strong-transparent-black`, `--transparent-white` 他(259-266), `--subtle-shadow`, `--floating-shadow`, `--raised-shadow`(279-285) | — | 公開 |
| 意味色 | `--positive-*`, `--negative-*`, `--info-*`, `--warning-*`(292-353), `--success-*`/`--error-*`(475-485)、色名 `--red`…`--black`(167-179), `--<c>-background`, `--<c>-header-color`, `--<c>-text-color`, `--<c>-border-color`(204-253) | — | 公開 |
| サイドバー | `--sidebar-background`(1428), `--sidebar-border-right`(1429), `--sidebar-menu-item-inactive-background`(1430), `--sidebar-menu-item-active-background`(1434), `--sidebar-menu-section-color`(1438), `--sidebar-menu-section-separator-color`(1439), `--sidebar-menu-item-color`(1443), `--sidebar-menu-active-item-color`(1444), `--sidebar-menu-action-color`/`-hover-color`(1445-1446), `--sidebar-sync-status-view-*`(1447-1453), `--sidebar-scrollbar-*`(1454-1456), `--sidebar-notification-view-*`(1457-1461), `--sidebar-color-scheme`（未定義、site.overrides:6） | bg: `hsl(220 14% 96%)` (gray-100) / `hsl(0 0% 9%)` (neutral-900) | 非公開（`--sidebar-color-scheme` だけ公開） |
| ノートリスト | `--note-list-bar-background`(1473), `--note-list-bar-border-right`(1477), `--note-list-bar-pinned-section-header-*`/`-footer-*`(1479-1484), `--note-list-bar-section-header-text-color`/`-background`/`-border-bottom`, `--note-list-bar-section-footer-border-bottom`(1485-1497), `--note-list-view-item-header-color`(1498), `--note-list-view-item-color`(1499), `--note-list-view-item-separator-border`(1500), `--note-list-view-item-date-color`(1502), `--note-list-view-item-selected-background`(1503), `--note-list-view-item-active-background`(1507), `--note-list-header-separator-border`(1511), `--note-search-bar-*`(1512-1514) | bg: `hsl(60 9% 98%)` (stone-50) / `hsl(0 0% 9% / 50%)` | 非公開 |
| タグ / ステータス / 進捗 | `--tag-*`(tags.css), `--note-status-*`(status.css), `--task-progress-view-*` | §4.5 | 非公開（tags.html はサンプル） |
| エディタ外枠（UI） | `--editor-background`(1519), `--editor-header-title-input-background`(1520), `--editor-floating-actions-background`(1521), `--editor-drawer-background`/`-border-left`(1525-1529), `--note-tags-bar-input-background`(1530) | `#fff` / `hsl(0 0% 4%)` | 非公開 |
| エディタ本体（CodeMirror） | `--editor-background-color`, `--editor-foreground-color`, `--editor-caret-color`, `--editor-selection-background`, `--editor-focused-selection-background`, `--editor-active-line-background-color`, `--editor-gutter-*`, `--editor-panel-*`, `--editor-tooltip-*`, `--editor-completion-*`, `--editor-search-match-*`, `--editor-*-bracket-*`, `--editor-placeholder-color` 他（syntax.css 18-143） | fg: `hsl(215 28% 17%)` (gray-800) / `hsl(216 12% 84%)` (gray-300) | 非公開（CM 拡張と推定） |
| シンタックス | `--syntax-*`（syntax.css 150-286）、`--md-*`（291-330） | keyword: violet-600 / violet-400 | 公開（`.tok-*`, `.md-*`） |
| ヘッダー（ノート上部メニュー） | `--header-note-menu-background`(1535), `--header-note-menu-color`(1536), `--header-note-menu-action-item-active-background`/`-border`(1537-1538), `--header-note-menu-action-item-separator-border`(1539), `--header-note-menu-encrypt-button-*`(1540-1541) | bg: transparent | 非公開 |
| 見出し要素（Semantic UI `.ui.header`） | `--header-text-color`(918), `--sub-header-*`, `--h1`〜`--h6`(45-50), `--header-font`, `--header-font-weight` | — | 公開（header.less, site.less） |
| モーダル | `--modal-border`, `--modal-border-radius`, `--modal-box-shadow`, `--modal-box-close-*`, `--modal-box-header-background`/`-color`/`-border`/`-font-*`, `--modal-box-content-background`, `--modal-box-actions-background`/`-border`(1405-1423) | header / content bg: `white` / `neutral-900`; actions: `off-white` / `neutral-800` | 公開（modal.less） |
| メニュー | `--menu-background`, `--menu-border`, `--menu-item-text-color`, `--menu-hover-item-background`, `--menu-active-item-*`, `--menu-divider-background`(1124-1153)、`--vertical-menu-*`(1154-1164)、`--tabular-menu-*`(1165-1173)、`--secondary-menu-*`/`--secondary-pointing-menu-*`(1174-1192) | `white` / `neutral-900` | 公開（menu.less） |
| ドロップダウン | `--dropdown-menu-background`/`-box-shadow`/`-border*`(1359-1366)、`--dropdown-menu-item-*`、`--dropdown-hovered-item-*`、`--dropdown-selected-*`、`--dropdown-active-item-*`、`--inline-dropdown-menu-background`(1379) | `white` / `neutral-900` | 公開（dropdown.less） |
| ポップアップ / ツールチップ | `--popup-*`(1221-1250)、`--tooltip-*`(1252-1277) | bg: `white` / `neutral-900` | 公開（popup.less） |
| ボタン | `--button-*`, `--basic-button-*`, `--primary-button-*`, `--secondary-/--positive-/--negative-button-*`, `--basic-<v>-button-*`(708-890) | bg: gray-200 / `neutral-800 / 70%` | 公開（button.less） |
| 入力・フォーム | `--input-*`(57-82, 951-981), `--focused-form-*`, `--focused-outline-*`(89-108), `--form-*`(1075-1119), `--input-highlight-*`(143-147) | input bg: `white` / `neutral-900` | 公開 |
| チェックボックス / トグル | `--checkbox-*`, `--radio-*`, `--toggle-*`(1300-1353) | active: `--primary-color` | 公開 |
| メッセージ / セグメント / ラベル / 表 / リスト | `--message-*`(1197-1216), `--segment-*`/`--grouped-segment-*`/`--piled-segments-*`(1039-1070), `--label-*`(986-1008), `--table-*`(1282-1295), `--selection-list-*`(1013-1028) | — | 公開 |
| スクロールバー | `--scrollbar-width`, `--scrollbar-track-background`, `--scrollbar-thumb-background`(1466-1468) | thumb: `rgba(0,0,0,.2)` / `rgba(255,255,255,.2)` | `--sidebar-scrollbar-*` 経由のみ（非公開） |
| 通知 | `--notification-item-background`(1546) | `white / 80%` / `neutral-900 / 80%` | 非公開 |
| 環境設定画面 | `--preferences-sidebar-background`, `--preferences-sidebar-item-active-background`, `--preferences-view-background`(1554-1559) | — | 非公開 |
| mark / kbd（UI） | `--mark-*`, `--kbd-*`(905-912) | — | `--kbd-*` は preview 経由で公開 |
| 角丸・形状 | `--default-corner-shape`, `--default-squircle-radius`, `--large-squircle-radius`(24-26), `--absolute-border-radius` 他 | Chromium では squircle（palette 値） | 公開 |

- 補足 1: `ui.css` の "Header" 節（`--header-text-color` 等、`:914-945`）は Semantic UI の `.ui.header`（見出しコンポーネント）用です。
  アプリ上部のヘッダーバーではありません。
  ノート上部のメニューは `--header-note-menu-*` です。**【確認済み（命名と header.less）／ヘッダーバーとの対応は推測】**
- 補足 2: 「非公開」とした領域は、変数名とクラスの対応を実アプリの DevTools で確認する必要があります（§10）。

---

## 6. Default Dark / Default Light が上書きしているもの

- **【確認済み】** どちらも `styles/ui.css`, `syntax.css`, `preview.css` の 3 ファイルを持っています。
  中身は**空の `@layer theme.ui|theme.syntax|theme.preview { }` とコメントだけ**で、変数を 1 つも上書きしていません（`default-dark@68c28c4 styles/*.css`、`default-light@ef81d48 styles/*.css`）。
- **【確認済み】** 2 つの `package.json` の違いは `name`、`description`、`themeAppearance`（`"dark"` / `"light"`）、`repository` だけです（両 `package.json:2-6`）。
- **【推測（強い根拠あり）】** したがって Default Dark と Default Light の見た目の違いは、すべて次の仕組みで生じます。
  1. アプリが `themeAppearance` に応じて body のクラスや `color-scheme` を切り替える。
  2. 基盤 CSS の `light-dark()` がその枝を選ぶ。
  - Default の色を知りたい場合は、`@inkdropapp/css` の `light-dark()` の各枝を読めば足ります。
  - 実際に解決された値は `palette.json` にあります（§7）。
- 主な差（`palette.json` から抜粋。light / dark の順）:
  - `--page-background`: `#fff` / `hsl(0 0% 4%)`
  - `--sidebar-background`: `hsl(220 14% 96%)` / `hsl(0 0% 9%)`
  - `--note-list-bar-background`: `hsl(60 9% 98%)` / `hsl(0 0% 9% / 50%)`
  - `--editor-foreground-color`: `hsl(215 28% 17%)` / `hsl(216 12% 84%)`
  - `--primary-color`: `hsl(217 91% 60%)` / `hsl(213 94% 68% / 80%)`
  - `--border-color`: `hsl(0 0% 9% / 15%)` / `hsl(0 0% 96% / 10%)`
  - `--syntax-keyword-color`: `hsl(262 83% 58%)` / `hsl(255 92% 76%)`
  - `--mermaid-line-color`: `hsl(215 25% 27%)` / `hsl(38 92% 50%)`

  dark 側は明度が低く、多くの値がアルファ付きです。
  mermaid の線色は dark で amber になります。
- 例外として、dark でも light と同じ値のトークンがあります。
  例: `--link-color`（`var(--color-blue-500)`、`ui.css:131`）、`--mde-preview-link-color`、`--note-status-*`。
- **【確認済み】** Default テーマの README は「このリポジトリを fork してテーマを作らないこと」と注意しています（`default-dark@68c28c4 README.md`）。

---

## 7. `theme-dev-helpers` の役割

- **【確認済み】** `@inkdropapp/theme-dev-helpers`（0.7.0、Node ≥ 24）には 2 つの CLI があります（`theme-dev-helpers@a7bcbe6 README.md`、`package.json:12-15`）。
  1. `dev-server`（Vite）
     - Variables / Color Tokens / Components の 3 タブで、変数一覧、プリミティブ、Semantic UI コンポーネントをプレビューします（ガイド `:173-207`）。
     - Variables タブは `document.body.computedStyleMap()` の `--*` を列挙します（`src/dev-server/get-css-variables.ts`）。
  2. `generate-palette`（puppeteer）
     - テーマの CSS 変数の解決値を `palette.json` に書き出します。
     - 用途はテーマ設定画面のプレビューカードと、将来のモバイルアプリです（ガイド `:442-462`、フォーラム https://forum.inkdrop.app/t/whats-new-in-v6/5570 ）。
- **【確認済み】** `generate-palette` の処理（`src/generate-palette.ts`、`src/palette.ts`）は次のとおりです。
  1. 基盤 CSS 11 本とテーマの `styleSheets` を読み込んだ HTML を組み立てる。
     body のクラスは `<name> <appearance>-mode` です（`palette.ts:64-93`）。
  2. 対象の変数名は `@inkdropapp/css/variables.json` から取る。
     この JSON は `scripts/generate-variable-names.ts` が生成します。
     対象は `ui, status, tags, task-progress, markdown, mermaid, syntax` の各ファイルで、**セレクタがちょうど `:root` の宣言**だけを集めます。
     そのため acrylic 等の条件付き宣言は対象外です（`css@add48d9 scripts/generate-variable-names.ts:17-46`）。
  3. 領域ごとに読み取る要素を変える。
     ui は `body`、syntax は `.cm-editor`、preview は `.mde-preview` の `computedStyleMap()` から読みます（`palette.ts:138-150`）。
     テーマが `.cm-editor` 等にスコープした上書き（Solarized の例）も拾うためです。
  4. 値の中の `light-dark()` を、文字列処理で外観に合う枝に置き換える（`palette.ts:246-263`）。
  5. `color-mix()` はブラウザに計算させて `#rrggbb` / `rgba()` に置き換える。
- **【確認済み】** 本調査で再現した `variables.json` 相当の集合は 1,638 個でした。
  Default Dark / Light の `palette.json` のキー集合（各 1,638 個）と完全に一致します。
  `base-ui-theme` のルール文書にある「1,638 tokens are exported today」とも一致します。
  つまり **`palette.json` は、テーマが上書きできる変数すべての解決済み既定値表**として使えます。
- 注意点:
  - **【確認済み】** Default テーマの `palette.json` は 2026-09-15 時点の生成物です。
    メタデータキー（`themeDevHelpersVersion` 等）がないので、0.7.0 より前のバージョンで生成されています。
    `@inkdropapp/css` の最新コミット（2026-10-07）とは差分がありえます。
  - **【推測】** `palette.json` の値は harness 上の値です。
    harness は `layers.css` を読み込まず、`light-dark()` も文字列置換で解決しています。
    そのため実アプリの Computed Style と完全には一致しない可能性があります。
  - `--editor-background-color` の acrylic 時の値のような条件付き宣言は、`palette.json` に含まれません。

---

## 8. 移植（Obsidian 側）に効く要点の整理

マッピング担当（06）向けの所見です。

1. **トークンの 3 層構造**
   - 1 層目: プリミティブ `--hsl-*`（`hsl()` で包まない三つ組）と `--color-*`
   - 2 層目: グローバル意味トークン（`--text-color` など）
   - 3 層目: 領域・コンポーネントトークン

   Obsidian の `--color-base-*` / `--background-*` / `--text-*` との対応は、主に 2〜3 層目の値を写すことになります。
2. **テーマが上書きしない部分は基盤の `light-dark()` 既定値が使われる**
   各テーマの最終的な色は「テーマの上書き ∪ `palette.json` の既定値」で決まります。
   02（テーマ別解析）は、各テーマリポジトリの `palette.json` を一次データとして使えます。
3. **`--editor-background`（UI）と `--editor-background-color`（CM）は別変数**
   同様に、`--md-*`（エディタ）と `--mde-preview-*`（プレビュー）も別系統です。
   ただし `--syntax-*` だけはエディタとプレビューのコードブロックで共有されます。
4. **レイヤー優先度の目安は syntax > preview > ui**
   さらに `@layer theme` 直下はサブレイヤーより強くなります（§2.1。公式記述との食い違いあり）。
5. **acrylic / platform 分岐**
   `body.acrylic-window`, `.platform-win32`, `body.dark-mode`, `[class*='dark-ui']` は実行時に付くクラスです。
   Obsidian では透過ウィンドウ（`is-translucent`）が近い概念です（Obsidian 側の詳細は別担当）。

---

## 9. 機械解析（`research/data/inkdrop-base-tokens.csv`）

- スクリプト: `scratchpad/analyze_tokens.py`（リポジトリ外の一時ファイル。Python 3.12 の標準ライブラリだけを使用）
  - コメントを除去し、括弧と引用符の深さを追いながら `{ } ;` を走査します。
  - 宣言ごとに次を記録します。
    - ファイル名と行番号
    - ブロックの入れ子（`@layer` / `@supports` / セレクタ）
    - 値の中の `var(--x)` 参照
  - consumer は次の 3 種で判定します。
    - `@inkdropapp/css` の通常プロパティ規則
    - `base-ui-theme/src` の LESS 内の `var(--x)`
    - mermaid `theme.ts` のトークン対応表
- 対象: `css@add48d9` の `tokens, utilities, ui, status, task-progress, tags, syntax, markdown, mermaid, reset`
- CSV の列:
  - `token`
  - `defined_in`（file:line）
  - `layer`
  - `selector_condition`
  - `raw_value`（空白を正規化）
  - `references`
  - `notes`（`light-dark`、`has-var-fallback`、`refs-undefined:…`、`consumers=…`）
- 集計結果:
  - 定義は 2,372 件で、ユニークなトークンは 2,354 個です。
    件数との差は、条件付きの再定義と、`ui.css` 内の重複宣言（`--sub-header-text-color`, `--sub-header-font-size`, `--disabled-text-color`, `--inverted-disabled-text-color` など）によるものです。
  - レイヤー別: `tokens` 499、`utilities` 217、`theme.ui.base` 920、`theme.ui` 336、`theme.syntax.base` 198、`theme.preview.base` 202
  - `light-dark()` を含む定義: 450 件。トークン定義内の `color-mix()`: 0 件
  - 条件付き定義（`:root` / `:where(:root,:host)` 以外）: 13 件（§3.6 の表の内容）
  - 公開ソースに consumer がないトークン: 736 件
    - 内訳の主なもの: `ui.css` 334、`utilities.css` 173、`tokens.css` 128、`syntax.css` 68、`tags.css` 55、`mermaid.css` 33
    - プリミティブとユーティリティは未使用分を含みます。
    - `ui.css` / `syntax.css` の分は、非公開の本体 CSS が消費していると推定します。
  - `@inkdropapp/css` 内の参照先が未定義の変数（いずれもフォールバックあり、または実害は限定的）:
    `--base-size-8`, `--colored-box-shadow`, `--inverted-text-shadow`, `--md-task-done-text-decoration`, `--md-task-done-text-decoration-color`
  - `base-ui-theme` を含めると未定義参照は 85 件です（§4.1）。
- CSV の限界:
  - CSV は宣言値です。`var()` の連鎖を解決した値は `palette.json` を参照してください。
  - consumer の判定は正規表現によります。
    本体の非公開 CSS と JS（CodeMirror 拡張）は対象外です。

---

## 10. 未確認事項

1. **アプリ本体（非公開）の CSS と DOM**
   次の変数が、実際にどのセレクタとプロパティに適用されるかは確認できていません。
   - `--page-background`, `--sidebar-*`, `--note-list-*`, `--editor-background` 系 UI 変数
   - `--header-note-menu-*`, `--preferences-*`, `--notification-item-background`
   - `--editor-*`（CodeMirror chrome）、`--md-table-*`、`--md-blockquote-border-color`

   Development Mode の Inspect Element で確認する必要があります。
2. **`color-scheme` を設定する主体と条件**
   次の点はコードコメントと間接資料による推定です。
   - body の `color-scheme`
   - `dark-mode` / `[class*='dark-ui']` クラスの付与条件
   - テーマ名の body クラス付与（v5 で "body class name theme indicator" の修正履歴あり。`version-history@072811f README.md:68`）

   `index.html` は非公開です。
3. **実アプリでの読み込み順序**
   - `layers.css` の読み込みタイミング
   - `base-ui-theme/styles/theme.css` と本体 CSS の位置
   - テーマ CSS が `<style>` と `<link>` のどちらで、どの順に挿入されるか
4. **`theme.ui.components` サブレイヤーを使っている CSS**
   公開リポジトリには使用箇所がありません。
5. **`@layer theme` 直下とサブレイヤーの優先度**
   仕様上は直下の方が強くなりますが、公式ガイドは逆の趣旨を書いています。
   実アプリでの挙動は検証していません。
6. **`--sidebar-color-scheme` の想定用途**
   未定義のまま規則だけが存在します。
   公式テーマが設定しているかは 02 で確認してください。
7. **`palette.json` と実 Computed Style の一致度**
   harness と実アプリの差（`layers.css` 未読込、文字列による `light-dark()` 解決、body クラスの違い）による誤差は、実測していません。
8. **v6 のリリースノート**
   `version-history@072811f` は v5.11.10（2026-08-04）までで、v6 のエントリがありません。
   v6 の変更点は api-docs・docs・フォーラム（https://forum.inkdrop.app/t/whats-new-in-v6/5570 ）から把握しました。
9. **`--mermaid-vert-line-color` が未定義のときの描画結果**、および `--mde-preview-codeblock-meta-background-color` が規則から参照されない理由
10. **名前に `dark` を含み `themeAppearance: "light"` を宣言したテーマの扱い**
    `deriveAppearance` のコメントどおり、本体でも dark 扱いになるかは確認していません。

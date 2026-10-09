# 03. Obsidian テーマシステムの公式仕様

- 調査日: 2026-10-09
- 対象 Obsidian: 最新安定版 **1.14.4**（主対象）、ユーザー環境 **1.13.7**（差分比較用）
- 一次情報ソースと参照 SHA
  - `obsidianmd/obsidian-developer-docs@c56c7e7`（2026-08-10、docs.obsidian.md の原稿。shallow clone のためファイル単位の履歴は未取得）
  - `obsidianmd/obsidian-sample-theme@beff415`（2026-08-14）
  - `obsidianmd/obsidian-releases@1eb9ae2`（2026-10-09）
  - Obsidian 本体の CSS と JS: `obsidian-1.14.4.asar` と 1.13.7 asar を展開した `app.css` / `app.js` / `index.html`（以降 `app.css(1.14.4) L<行>` と表記する）
- 凡例
  - **[確認済]** 一次情報（ドキュメント原稿、app.css、app.js）で確認した
  - **[推測]** 一次情報からの推論で、実機では検証していない
  - **[未確認]** 情報源を見つけられなかった
  - **[第三者]** 公式サイトを WebFetch の要約経由で読んだもの（原文の全文照合はしていない）
  - CSS 値はすべて **宣言値** を指す。Computed Style（実機 DevTools での解決値）は本調査では取得していない。
- 付属データ: `research/data/obsidian-css-variables-1.14.4.csv`（生成スクリプト: scratchpad の `scripts/cssvars.py`。リポジトリには含めない）

---

## 0. 結論サマリ（移植設計に直結する事項）

1. テーマは `manifest.json` と `theme.css` の 2 ファイルで成立する。`versions.json` はテーマでも任意で使える（sample-theme が同梱している）。スクリーンショットのパスは manifest ではなく、Community directory の投稿フォームで指定する。
2. 変数を定義する場所の公式推奨は次の 3 つ。モードに依存しない値は `body`、色は `.theme-dark` / `.theme-light`、`:root` は必要な場合だけ。app.css 本体も同じ構造で定義している（`body` で 899 宣言、`.theme-dark` で 61、`.theme-light` で 46）。
3. `.theme-dark` / `.theme-light` / `.mod-macos` / `.is-mobile` はすべて `<body>` に付くクラスである。そのため **テーマが `body {}`（詳細度 0,0,1）で上書きしても、app.css 側の `.theme-dark {}`（0,1,0）が勝つ変数がある**。対象は `--interactive-normal`、`--interactive-hover`、`--interactive-accent`、`--text-accent`、`--text-selection`、`--background-modifier-form-field` など。
4. **モバイルのダークモードでは `.is-mobile.theme-dark`（0,2,0）が `--color-base-00/10/20` を `#000/#111/#1e1e1e` で上書きする**。テーマの `.theme-dark` の定義は負けるので、モバイルでも色を固定したい場合は同等以上の詳細度が必要になる。
5. ユーザー設定の一部は `<body>` のインラインスタイルとして注入され、テーマより優先される。アクセント色（`--accent-h/s/l` と `--text-on-accent`）、フォント（`--font-*-override`）、文字サイズ（`--font-text-size`）が該当する。
6. 1.13 以降、色の合成は OKLCH の `color-mix()` に移行した。`--color-*-rgb`、`--color-accent-hsl`、`--mono-rgb-*`、`--interactive-accent-hsl` などは **非推奨（互換のためだけに残っている）**。`--callout-color` は RGB の三つ組ではなく、CSS の色値を受け取るように変わった（破壊的変更）。
7. 1.14 では `--text-highlight-bg` のデフォルト定義が消え、`--highlight-background` 系（色付きハイライト）に置き換わった。`--text-highlight-bg` は、テーマが定義した場合だけフォールバックとして読まれる。また `--tooltip-*`、`--notice-*`、`--hotkey-*`、`--tab-inner-*`、`--tab-container-*`、Bases kanban 系など 84 変数が追加された。
8. 配布は 2026 年時点で **community.obsidian.md（Community directory）経由の投稿** に移行している。`obsidian-releases` の `community-css-themes.json` は、directory から 1 時間ごとに自動ミラーされる。手動で PR を出す手順はドキュメントから消えている。
9. ガイドラインの公式記載は次の 4 点。CSS 変数を使う、低詳細度のセレクタを使う、アセットはローカルに置く（ネットワーク読み込み禁止）、`!important` を避ける。加えて self-critique checklist と公式 stylelint 設定が、`:has()` の回避と、Live Preview でクラスの垂直 margin を変えないことを挙げている。
10. テーマ名に **"Theme" と "Obsidian" を含めてはならない**（Manifest リファレンス）。テーマ名は directory への投稿後に変更できない。

---

## 1. テーマのファイル構造と manifest.json

### 1.1 ファイル構成 [確認済]

| ファイル | 必須 | 根拠 |
|---|---|---|
| `manifest.json` | 必須。リポジトリの HEAD に置き、リリースアセットにも添付する | `obsidian-developer-docs@c56c7e7 en/Themes/App themes/Submit your theme.md:26,42-45,55-57` |
| `theme.css` | 必須。リリースアセットに添付する | 同 `:42-45`。app.js も `ZT="theme.css",JT="manifest.json"` という固定ファイル名で読む（`app.js(1.14.4)` 内の文字列） |
| スクリーンショット | directory への掲載に必須。推奨は 512×288（16:9） | `Submit your theme.md:25`、`obsidian-sample-theme@beff415 README.md:41-46`。パスは投稿フォームの **Screenshot path** に入力する（`Community directory/Set up and claim.md:91-94`） |
| `README.md` | 投稿時に必須。冒頭部分が掲載ページに表示される | `Submit your theme.md:23` |
| `LICENSE` | 投稿時に必須。GitHub が "Custom license" と判定すると警告が出る | `Submit your theme.md:24`、`Developer policies.md:46`、`Frequently asked questions.md:86-88` |
| `versions.json` | 任意。テーマ版 → minAppVersion の対応表 | sample-theme が同梱している（`versions.json:1-3`, `README.md:54-71`）。Reference の `Versions.md:5-9` は plugin 向けの説明しかなく、**テーマで同じフォールバックが働くかはドキュメントに明記がない [未確認]** |

- ローカルの配置先は `<vault>/.obsidian/themes/<テーマ名>/`。**ディレクトリ名は manifest の `name` と完全一致させる**必要がある（`Build a theme.md:55`）。manifest の変更を反映するには Obsidian の再起動が要る（同 `:61,65`）。
- app.js は `themes/<name>/theme.css` と `manifest.json` の 2 ファイルだけを同期対象として扱う [確認済: `app.js(1.14.4)` の `"themes"!==a[0]||3!==a.length||"theme.css"!==s&&"manifest.json"!==s` 分岐]。

### 1.2 manifest.json のフィールド [確認済]

出典: `obsidian-developer-docs@c56c7e7 en/Reference/Manifest.md:9-18`

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | Yes | 表示名 |
| `version` | string | Yes | SemVer の `x.y.z` 形式 |
| `minAppVersion` | string | Yes | 動作に必要な最小 Obsidian バージョン |
| `author` | string | Yes | 作者名 |
| `authorUrl` | string | No | 作者サイトの URL |
| `fundingUrl` | string または object | No | 単一の URL、または `{ "表示名": "URL" }` 形式（`:47-69`） |

- `description`、`id`、`isDesktopOnly` は **plugin 専用**（`:20-28`）。テーマの manifest には書かない。
- `name` の規則（`:33-45`）
  - 投稿後は変更できない（テーマのみ。plugin は変更可）
  - Basic Latin のみ。ハイフン、`+`、括弧以外の記号と絵文字は不可
  - **"Obsidian" とその変形（"Obsi-", "-sidian"）を含めない**
  - **テーマ名に "Theme" を含めない**
  - 一意であること。コア機能名（例: "Live Preview"）だけの名前は不可
- sample-theme の manifest 例は `{"name":"Sample Theme","version":"1.0.0","minAppVersion":"1.10.6","author":"Obsidian","authorUrl":"https://obsidian.md"}`（`manifest.json:1-7`）。サンプル自体の名前に "Theme" が含まれていて規則と矛盾するが、テンプレート上のプレースホルダと解釈する [推測]。
- `community-css-themes.json` の `modes`（dark/light）は manifest のフィールドではない。投稿フォームの **Supported modes** から生成される（§9）。

---

## 2. theme.css の仕様、変数を定義する場所、カスケード

### 2.1 公式推奨 [確認済]

- Theme guidelines: "Override general variables under `body`, and colors under `.theme-light` or `.theme-dark`."（`Theme guidelines.md:9`）。コード例は `:root{--input-focus-border-color}`、`body{--font-text-size}`、`.theme-light/.theme-dark{--background-primary}`（`:11-27`）。
- Build a theme の tip（`Build a theme.md:143-148`）
  - ライトとダークで共通の値は `body` に書く
  - モードで値を変えたいときだけ `.theme-dark` / `.theme-light` を使う
  - `:root` は慎重に使う。`body`、`.theme-dark`、`.theme-light` に置ける値はそちらに置く
- ライブのページ（https://docs.obsidian.md/Themes/App%20themes/Theme%20guidelines）を 2026-10-09 に WebFetch で取得し、見出し 4 つとコード例が原稿と一致することを確認した。

### 2.2 app.css 側の定義構造（1.14.4）[確認済]

app.css の前半 L1–L1997 は pdf.js 由来の CSS である（L1 コメント "generated from the pdf.js repo"）。Obsidian 本体の変数は L1998 のコメント `/* Obsidian theme variables */` から始まる。

| セレクタ | 行 | 詳細度 | 内容 |
|---|---|---|---|
| `:root` | L2001（`@supports (font-variation-settings: normal)` 内にも再定義 L2011） | 0,1,0 | `--h1-weight`〜`--h6-weight`。コメントは "Font weights applied to root so that varible weights can be overridden by themes" |
| `body` | L2020–L2980 | 0,0,1 | アニメーション、Bases、ブロック、コード、色の意味づけ（`--background-*`、`--text-*`、`--interactive-*`）、`--accent-h/s/l` など、ほぼすべてのコンポーネント変数 |
| `.theme-light` | L2981–L3030 | 0,1,0 | `color-scheme: light`、`--mono-*`、拡張色 8 色、`--color-base-00..100`、`--color-accent(-1,-2)`、影、非推奨の `-rgb` / `-hsl` |
| `.theme-dark` | L3031–L3095 | 0,1,0 | 上記のダーク版に加え、`--interactive-*`、`--text-accent`、`--text-selection`、`--background-modifier-form-field` など、body の値を上書きする 11 変数 |
| `.mod-macos` | L3096–L3126 | 0,1,0 | radius、toggle、slider、`--interactive-normal/hover` など 29 変数（うち body の既定値を上書きするもの 26） |
| `body`（フォント） | L3186 | 0,0,1 | `--font-default`、`--font-*-theme`、`--font-*-override`、`--font-text-size: 16px` |
| `:root`（モバイル系） | L19483 | 0,1,0 | `--safe-area-inset-*: env(...)`、`--preferred-text-scale`、`--keyboard-height` |
| `.is-mobile` | L19491 | 0,1,0 | 106 変数 |
| `.is-mobile.theme-dark` | L19601 | 0,2,0 | `--color-base-00:#000`、`--color-base-10:#111`、`--color-base-20:#1e1e1e` など 15 変数 |
| `.is-phone` / `.is-tablet` / `.is-ios` / `.is-android` | L19630 / L19665 / L19681 / L10020 | 0,1,0 | 端末ごとの寸法 |

`<body>` に付くクラス [確認済、`app.js(1.14.4)`]
- `index.html` の初期状態は `<body class="theme-dark">`
- `updateTheme()` が `theme-light` / `theme-dark` を `document.body` に toggle する
- OS クラスは `e.body.addClass("mod-macos"|"mod-windows"|"mod-linux")`
- `is-tablet` / `is-phone` は `document.body.toggleClass`（判定は `(min-width: 600px) and (min-height: 600px)`）
- `is-translucent`、`is-hidden-frameless`、`is-frameless`、`is-fullscreen`、`is-focused`、`show-inline-title`、`is-floating-nav`、`mod-rtl`、`styled-scrollbars`（macOS 以外）も body に付く
- `is-mobile` は `o.addClass("is-mobile")` で付く。`o` は前後の文脈から document.body と読める [推測]
- `is-ios` / `is-android` を付与するコードは app.js に見つからなかった。モバイルアプリ側で付与していると考えられる [未確認]

### 2.3 読み込み順序 [確認済]

- `index.html(1.14.4)`: `<link href="app.css">` が `<head>` にある。
- CustomCss の constructor が `document.head.createEl("style")` で **app.css の後ろ** に theme 用の `<style>` を追加し、`theme.css` の中身を textContent として流し込む（`loadTheme`）。snippets はその後ろに `insertAfter` で追加される（`loadSnippets`）。
- したがって詳細度が同じなら、優先順位は **app.css < theme.css < snippets** になる。
- CSP は `style-src 'unsafe-inline' 'self' https://fonts.googleapis.com`（index.html）。技術的には Google Fonts の CSS を読み込めるが、ポリシーで禁止されている（§7）。

### 2.4 詳細度による落とし穴 [確認済。実機の Computed Style は未検証]

テーマを `body { --x: ... }` で書いた場合、app.css の次のルールが勝つ（同じ要素に付くクラスの詳細度が高いため）。

- `.theme-dark`（0,1,0）が body の値を上書きする変数（L3031–）: `--background-modifier-form-field`, `--blur-background`, `--interactive-accent`, `--interactive-accent-hover`, `--interactive-hover`, `--interactive-normal`, `--pdf-shadow`, `--pdf-thumbnail-shadow`, `--raised-mask-background`, `--text-accent`, `--text-selection`
- `.mod-macos`（0,1,0）: `--interactive-normal`, `--interactive-hover`, `--input-radius`, `--modal-radius`, `--tab-radius`, `--toggle-*`, `--slider-thumb-*`, `--search-input-radius`, `--scrollbar-thumb-bg`, `--clickable-icon-radius`, `--corner-shape`, `--vault-profile-radius` など 29 変数（うち body の既定値を上書きするもの 26。`--input-shadow(-hover)` は `.theme-*` の値を上書きする）
- `.is-mobile`（0,1,0）: 106 変数。`--interactive-normal`、`--modal-background`、`--font-ui-*`、`--icon-*`、`--input-*`、`--caret-color` などを含む
- `.is-mobile.theme-dark`（0,2,0）: `--color-base-00/10/20`、`--interactive-normal/hover`、`--modal-background`、`--tag-background`、`--background-modifier-message`、`--setting-items-*` など。**テーマの `.theme-dark` でも負ける**。1.13.7 でも同じ（`app.css(1.13.7) L18854`）。

設計上の含意 [推測]
- 色はすべて `.theme-dark` / `.theme-light` に置き、body には置かない。
- モバイルのダークモードで base 色を固定するなら、`.theme-dark.is-mobile` か `body.theme-dark`（0,1,1）以上の詳細度で再定義する必要がある。ただし後者でも 0,2,0 には負ける。Theme guidelines の「低詳細度」推奨とは衝突するので、仕様判断が必要になる。

### 2.5 インラインスタイルで注入される変数 [確認済、`app.js(1.14.4)`]

| 変数 | 注入元 | 備考 |
|---|---|---|
| `--accent-h`, `--accent-s`, `--accent-l` | `setAccentColor()` → `document.body.style.setProperty` | ユーザーがアクセント色を設定した場合だけ。未設定なら removeProperty され、テーマの値が使われる |
| `--text-on-accent` | 同上。明るいアクセントのとき `var(--text-on-accent-inverted)` | |
| `--font-interface-override`, `--font-text-override`, `--font-monospace-override`, `--font-print-override` | `updateFontFamily()` | テーマは `--font-*-theme` を使う設計になっている（L3189–L3198 の `var(--font-text-override), var(--font-text-theme), var(--font-default)`） |
| `--font-text-size` | `updateFontSize()`。`<html>` の `font-size` も設定する | 呼ばれると常に setProperty される。**Theme guidelines の例 `body{--font-text-size:18px}` はインラインスタイルに負けて効かない可能性が高い [推測。実機未検証]** |
| `--zoom-factor`, `--keyboard-height` | ポップアウトウィンドウ処理（`d0=["--zoom-factor","--keyboard-height"]`） | |

---

## 3. CSS 変数の体系

### 3.1 ドキュメントのカテゴリ [確認済]

`en/Reference/CSS variables/` の構成
- Foundations: Borders, Colors, Cursor, Icons, Layers, Radiuses, Spacing, Typography
- Components: Button, Checkbox, Color input, Dialog, Dragging, Dropdowns, Indentation guides, Modal, Multi-select, Navigation, Popover, Prompt, Slider, Tabs, Text input, Toggle
- Editor: Bases, Block, Blockquote, Callout, Code, Embed, File, Footnote, Headings, Horizontal rule, Inline title, Link, List, Properties, Table, Tag
- Plugins: Canvas, File explorer, Graph, Search, Sync
- Window: Divider, Ribbon, Scrollbar, Sidebar, Status bar, Vault profile, Window frame, Workspace
- Publish: 8 ページ（アプリのテーマには関係しない）

索引ページ `CSS variables.md:1-82` には、Bases、Dropdowns、Prompt、Sync、Sidebar、Vault profile へのリンクがない（ページ自体は存在する）。

### 3.2 Foundations: 色（`Foundations/Colors.md`）[確認済]

- **Base**: `--color-base-00, -05, -10, -20, -25, -30, -35, -40, -50, -60, -70, -100`（12 段階）。「通常はテーマだけが定義する値」とされる（`:9`）。デフォルト値はドキュメント（`:11-24`）と app.css の `.theme-light` L2981 / `.theme-dark` L3031 で一致する。ダークの `--color-base-00` は app.css では `#1C1C1C`（大文字）。
- **Accent**: `--accent-h: 258`, `--accent-s: 88%`, `--accent-l: 66%`（body で定義）。これを `--color-accent`、`--color-accent-1`、`--color-accent-2` が `hsl(calc(...))` で合成する。ライトとダークで係数が異なり、ダークの `-1` は `h-3, s*1.02, l*1.15`、ライトの `-1` は `h-1, s*1.01, l*1.075`。`--interactive-accent` はライトでは `--color-accent-1`（body）、ダークでは `--color-accent`（`.theme-dark`）。
- **Extended**: `--color-red/orange/yellow/green/cyan/blue/purple/pink`。`-rgb` 版は **1.13 から非推奨**（`Colors.md:79-89`）。代わりに `color-mix(in oklch, var(--color-red) 20%, transparent)` を使う。app.css にも `/* Deprecated — kept for theme compatibility */` のコメント付きで残っている（`.theme-light` L3014 付近、`.theme-dark` L3082 付近、body L2977 付近）。
- **Mono**: `--mono-0` / `--mono-100`。「値を変えるのは避ける」と警告がある（`:100-101`）。
- **Semantic**: `--background-primary(-alt)`, `--background-secondary(-alt)`, `--background-modifier-*`, `--interactive-*`, `--text-normal/muted/faint/on-accent/on-accent-inverted/success/warning/error/accent/accent-hover`, `--text-selection`, `--text-highlight-bg`, `--caret-color`。
- app.css だけにある色の変数（ドキュメント未掲載）: `--background-modifier-warning(-hover)`, `--background-modifier-form-field-hover`, `--background-modifier-box-shadow`, `--background-modifier-cover`, `--color-secondary-2..6`（1.14 で追加、`.theme-dark` のみ）, `--highlight-background(-red/orange/yellow/green/blue/purple)`, `--highlight-opacity`, `--highlight-mix-blend-mode`。

### 3.3 Components / Editor / Plugins / Window の主要変数（移植で触る可能性が高いもの）

- Editor
  - コード: `--code-background`, `--code-normal`, `--code-comment`, `--code-function`, `--code-important`, `--code-keyword`, `--code-operator`, `--code-property`, `--code-punctuation`, `--code-string`, `--code-tag`, `--code-value`（body L2186–L2200。セレクタへの対応は §6.3）
  - 見出し: `--h1-color` 〜 `--h6-*`（size, weight, line-height, font, style, variant, color, `--hN-letter-spacing`［未掲載］）
  - その他: `--link-*`, `--tag-*`, `--blockquote-*`, `--callout-*`, `--table-*`, `--metadata-*`（Properties）, `--bases-*`, `--embed-*`, `--file-line-width`, `--file-margins`, `--inline-title-*`, `--list-*`, `--hr-*`, `--footnote-*`
- Window: `--ribbon-background(-collapsed)`, `--titlebar-*`, `--tab-*`, `--status-bar-*`, `--scrollbar-*`, `--divider-*`, `--sidebar-*`, `--vault-profile-*`
- 詳細は CSV を参照。

### 3.4 ドキュメントと app.css の突き合わせ結果 [確認済、`scripts/cssvars.py`]

| 指標 | 件数 |
|---|---|
| app.css(1.14.4) で定義されるカスタムプロパティ（全体、pdf.js 部を含む） | 1,177 |
| うち Obsidian 部（L1998 以降） | 1,052 |
| 同 1.13.7 | 971 |
| ドキュメントに掲載されている変数（全体） | 687 |
| うち Publish 専用を除いたもの | 637 |
| 掲載あり、かつ app.css に定義あり | 630 |
| **掲載あり、app.css に定義なし** | 7 |
| **app.css に定義あり、掲載なし**（Obsidian 部） | 422 |
| 1.14.4 で追加（対 1.13.7） | 84 |
| 1.14.4 で削除（対 1.13.7） | 3 |
| var() で参照されるが定義がない変数（1.14.4） | 22 |

**ドキュメントにあるが app.css にない変数**
- `--nav-heading-color-colapsed-hover`: ドキュメントの綴り間違い（`Components/Navigation.md:42`）。app.css の実名は `--nav-heading-color-collapsed-hover`（L2514）。
- `--bases-table-text-size`（`Editor/Bases.md:42`）: app.css の実名は `--bases-table-font-size`（L2066）。
- `--bases-cards-group-padding`（`Editor/Bases.md:58`）: 1.13.7 と 1.14.4 のどちらにも定義も参照もない。
- `--status-bar-scroll-padding`（`Window/Status bar.md:18`）: 定義も参照もない。
- `--size`: 本文中の総称表現で、実在する変数ではない（`Foundations/Spacing.md:12`）。
- `--text-highlight-bg`: 1.14 でデフォルト定義が削除された（§8）。
- `--text-highlight-bg-rgb`: 1.14 で削除された。ドキュメントでは非推奨とされている。

**ドキュメント未掲載で app.css にある主な系統**（422 件。上位の接頭辞）: `bases`(40), `tab`(20), `setting`(16), `slider`(16), `footnote`(13), `highlight`(13), `font`(12), `touch`(12), `blur`(11), `menu`(11), `metadata`(11), `notice`(11), `view`(11), `nav`(10), `tooltip`(10), `anim`(9), `raised`(9), `shadow`(9)。たとえば `--shadow-s/l/xs`、`--input-shadow(-hover)`、`--menu-background`、`--tooltip-background`、`--notice-background`、`--tab-inner-background*`、`--font-text`、`--font-interface`、`--font-monospace` は移植で使う可能性が高いが、未掲載である。

**pdf.js 由来の変数**（125 件。CSV では `defined_in_appcss=pdfjs-only`）は Obsidian のテーマ変数ではない。注意点として、Build a theme の Step 6（`Build a theme.md:117-139`）と Theme guidelines の例（`:12-14`）が使う `--input-focus-border-color` と `--input-hover-border-color` は、**pdf.js の `.annotationLayer` 上でだけ定義されている**（app.css L1086–L1111）。`:root` で上書きしても `.annotationLayer` の再定義が勝つため、ドキュメントの説明（「設定画面やノートの入力欄に効く」）は 1.14.4 の実装と食い違う [確認済。効果がないことは推測で、実機未検証]。

### 3.5 CSV の列定義

`research/data/obsidian-css-variables-1.14.4.csv`（1,235 行 + ヘッダー）

| 列 | 内容 |
|---|---|
| `variable` | 変数名 |
| `documented` | ドキュメント原稿（`en/Reference/CSS variables/**`）でバッククォート付きで掲載されているか |
| `doc_page` | 掲載ページ（`;` 区切り） |
| `defined_in_appcss` | `y` = Obsidian 部で定義あり / `pdfjs-only` / `n` |
| `default_dark` / `default_light` | `.theme-dark` / `.theme-light` の宣言値。なければ `body` / `:root` の宣言値。**`.is-mobile` などのクラス上書きは反映していない**。値は宣言値で、var() は解決していない |
| `defining_selector` | 定義セレクタと行番号（最大 4 件） |
| `notes` | 他のセレクタでの再定義、非推奨、1.13.7 との差分、ドキュメントとの食い違い、インライン注入など |

---

## 4. Light / Dark の切り替え [確認済]

- 設定値は vault 設定 `theme` に入る。`"obsidian"` = ダーク、`"moonstone"` = ライト、`"system"`（`app.js(1.14.4)` の `Ure=[{id:"obsidian",nameI18n:"dark-theme"},{id:"moonstone",...},{id:"system",...}]`）。
- `updateTheme()` は、`system` のとき `matchMedia("(prefers-color-scheme: dark)")` で判定する（Linux のデスクトップ版は `nativeTheme.shouldUseDarkColors`）。その結果で `body` の `theme-light` / `theme-dark` を toggle し、`css-change` イベントを発火する。
- テーマ選択（`cssTheme`）と明暗の設定は独立している。テーマの CSS は常に読み込まれ、明暗は body クラスだけで切り替わる。`.theme-dark` / `.theme-light` の両方を定義するのが前提になっている（`Build a theme.md:88-109`）。
- **片方のモードだけに対応するテーマの扱い**: manifest には対応モードを宣言するフィールドがない。directory の投稿フォームの **Supported modes**（Dark / Light）で申告し、それが `community-css-themes.json` の `modes` になる（`Set up and claim.md:94`）。実績として、847 テーマ中 223 が dark のみ、38 が light のみ。片方だけ対応するテーマをユーザーが逆のモードで使った場合、アプリ側に強制切り替えなどの仕組みがあるかは見つからなかった [未確認]。未定義側のモードでは app.css のデフォルト値がそのまま出ると考えられる [推測]。
- 1.10.3 で "Use light mode" と "Use dark mode" のコマンドが削除され、"Toggle light/dark mode" に統合された [第三者: obsidian.md/changelog/page/5/]。
- `@media print` では `.theme-dark` でも `--highlight-mix-blend-mode: darken` になる（L3132 付近）。

---

## 5. デスクトップとモバイル、OS 差 [確認済]

| クラス | 付与条件（app.js） | app.css での主な用途 |
|---|---|---|
| `.is-mobile` | モバイルアプリ（`Qy.isMobile`） | タッチ寸法（`--touch-size-*`、`--touch-radius-*`）、フォーム、モーダル、ナビ（L19491 以降に 106 変数） |
| `.is-phone` / `.is-tablet` | モバイルで 600×600 以上なら tablet、それ以外は phone | 寸法差（L19630, L19665） |
| `.is-ios` / `.is-android` | app.js では付与箇所が見つからない [未確認] | iOS のトグル形状（L19681）、Android のスクロールバー（L10020） |
| `.mod-macos` / `.mod-windows` / `.mod-linux` | プラットフォーム判定 | macOS 26 風のトグルと入力（L3096）、フレーム余白（L4296–L4330） |
| `.is-frameless` / `.is-hidden-frameless` | `titlebarStyle` が native 以外なら frameless、`hidden` なら hidden-frameless | titlebar の表示とレイアウト（L4333–L4430, L6515） |
| `.is-translucent` | 設定 `translucency` が有効、かつ対応環境（`enableTranslucency`） | `body.is-translucent { background-color: transparent }`（L3292）、`.is-translucent:not(.is-fullscreen)` で 3 変数（L6570） |
| `.is-fullscreen`, `.is-maximized`, `.is-focused`, `.is-popout-window` | ウィンドウの状態 | タブ、タイトルバー |
| `.mod-rtl` | RTL 言語 | `--direction`、`--inset-start/end`、`--safe-area-inline-*` の反転（L4870–L4890）。1.14.0 で「ワークスペース全体がフリップ」[第三者: changelog] |

- safe-area: `:root` で `--safe-area-inset-{top,bottom,left,right}: env(safe-area-inset-*)`（L19483–L19487）。論理方向版の `--safe-area-inline-start/end` は 1.14 で追加された。`index.html` の viewport は `viewport-fit=cover`。
- テーマ作者にとっての要点は、モバイルで `.is-mobile`（0,1,0）と `.is-mobile.theme-dark`（0,2,0）が多数の変数を再定義することである（§2.4）。

---

## 6. CodeMirror 6、Live Preview、Reading View の DOM とクラス [確認済。DOM の入れ子は app.css のセレクタから推定]

### 6.1 編集ビュー（Source / Live Preview）

- コンテナは `.markdown-source-view.mod-cm6`（L3645。`::selection` と `.cm-selectionBackground` を `--text-selection` にする）。
- Live Preview のときは `.markdown-source-view.is-live-preview`（L13591 ほか）。Source mode のときはこのクラスが付かない [推測]。
- CM6 の標準クラス: `.cm-editor`, `.cm-scroller`, `.cm-content`, `.cm-line`, `.cm-cursor`, `.cm-selectionBackground`, `.cm-gutters`, `.cm-focused`, `.cm-active`, `.cm-panels`, `.cm-tooltip`。
- Obsidian のトークンクラスは `.cm-s-obsidian` の配下にある（app.css 内で 171 回参照）。
  - 行単位: `.HyperMD-header-N`, `.HyperMD-list-line`, `.HyperMD-quote`, `.HyperMD-codeblock(-begin/-end/-bg)`, `.HyperMD-task-line`, `.HyperMD-table-row`, `.HyperMD-footnote`, `.HyperMD-hr`
  - インライン: `.cm-header-N`, `.cm-strong`, `.cm-em`, `.cm-strikethrough`, `.cm-inline-code`, `.cm-hashtag(-begin/-end)`, `.cm-hmd-internal-link`, `.cm-url`, `.cm-link`, `.cm-formatting(-*)`, `.cm-highlight(-red..-purple)`, `.cm-math`, `.cm-hmd-frontmatter`, `.cm-blockid`, `.cm-footref`
  - ウィジェット: `.cm-table-widget`, `.cm-html-embed`, `.cm-embed-block`, `.cm-callout`
- Live Preview でマークアップ記号を隠すのは `span.hmd-hidden-token.cm-formatting-*`（L13936 以降）。ここでは `font-size: 1px !important` を使っている。
- self-critique checklist に「Live Preview で使われるクラスの垂直 margin を変えず、padding を使う」とある（`Obsidian October theme self-critique checklist.md:11`）。CM6 の行の高さ計算が崩れるのを避けるためと考えられる [推測]。

### 6.2 閲覧ビュー（Reading）

- `.markdown-reading-view`（L4714）> `.markdown-preview-view`（L4718。`font-size: var(--font-preferred-size)`、`padding: var(--file-margins)`）> `.markdown-preview-sizer`（`.is-readable-line-width` のとき `max-width: var(--file-line-width)`）> `.markdown-preview-section` > 各ブロックの `div`。
- `.markdown-rendered`（L4743, L14548）は Reading view と埋め込みとポップオーバーに共通するレンダリング用クラスで、app.css で 126 回参照される。要素のスタイルは `.markdown-rendered h1`、`.markdown-rendered code`、`.markdown-rendered mark[data-highlight="red"]` などで当てる。
- 見出しは `h1, .markdown-rendered h1`（L13155）と、編集側の `.HyperMD-header-1, .HyperMD-list-line .cm-header-1`（L13263）を **別のセレクタで並べて** 同じ `--h1-*` 変数を参照している。

### 6.3 シンタックスハイライト（`--code-*`）

`Editor/Code.md:17-18` は、「Editing view と Reading view で別ライブラリを使うため完全には一致しない」と注記している。app.css(1.14.4) での対応は次のとおり。

| 変数 | Reading（Prism `.token`、L12045–L12095） | Editing（CM `.cm-*`、L12099–L12137） |
|---|---|---|
| `--code-comment` | `.token.comment, .prolog, .doctype, .cdata` | `.cm-comment, .cm-meta` |
| `--code-tag` | `.token.tag, .constant, .symbol, .deleted` | `.cm-tag` |
| `--code-punctuation` | `.token.punctuation` | `.cm-punctuation, .cm-bracket, .cm-hr` |
| `--code-value` | `.token.boolean, .number` | `.cm-number` |
| `--code-string` | `.token.selector, .attr-name, .string, .char, .inserted` | `.cm-qualifier, .cm-string, .cm-string-2` |
| `--code-operator` | `.token.operator` | `.cm-operator` |
| `--code-property` | `.token.entity, .parameter, .property, .url, .variable` など | `.cm-link, .cm-variable, .cm-variable-2, .cm-variable-3` |
| `--code-function` | `.token.atrule, .attr-value, .builtin, .function, .class-name, .property-access` | `.cm-builtin, .cm-property, .cm-attribute, .cm-type` |
| `--code-keyword` | `.token.keyword` | `.cm-keyword` |
| `--code-important` | `.token.regex, .important` | （該当なし） |
| `--code-normal` | `code[class*="language-"]`, `.markdown-rendered code` | `.cm-inline-code, .cm-math`, `.HyperMD-codeblock` |
| `--code-background` | `.markdown-rendered pre/code` | `div.HyperMD-codeblock-bg`, `span.cm-inline-code` |
| `--code-bracket-background` [未掲載] | — | `.cm-editor.cm-focused .cm-matchingBracket` |

- `--code-property` は Reading では property、Editing では variable に対応し、`--code-function` は Editing では `.cm-property` に対応する。つまり **同じ変数でもトークンの意味が両ビューで一致しない**。これは Inkdrop の配色（トークン単位）を写すときの制約になる [確認済]。
- `.cm-*` のトークンルールは `.cm-s-obsidian` で限定されていない。そのためエディタ外の CM6 インスタンス（`.formula-editor .cm-scroller` など）にも効く [推測]。

---

## 7. ガイドラインと推奨事項

### 7.1 Theme guidelines（原文に即した要約）[確認済: `Theme guidelines.md`]

1. **Use CSS variables**（`:5-27`）: Obsidian の UI の大半は CSS 変数でできているので、組み込み変数の上書きだけで表現力の高いテーマが作れる。汎用の変数は `body` に、色は `.theme-light` / `.theme-dark` に置く。
2. **Use selectors with low specificity**（`:29-33`）: 特定クラスを狙う複雑なセレクタを避ける。テーマの保守で最も多い問題は、新しいバージョンでクラス名や入れ子が変わり、セレクタが壊れることである。
3. **Keep assets local**（`:35-39`）: フォントや画像などのリモートアセットを読み込まない（オフラインで使えず、プライバシーを侵害しうるため）。directory に出すならネットワーク呼び出しは禁止で、すべて同梱する。方法は data URL による埋め込み（`Embed fonts and images in your theme.md:6-25`）。埋め込みはファイルサイズを増やすので注意する（同 `:46-52`）。
4. **Avoid `!important` declarations**（`:41-43`）: ユーザーが snippet で上書きできなくなるため。

- ドキュメントの不整合: `Embed fonts and images in your theme.md:4` は `[[Theme guidelines#Keep resources local]]` にリンクしているが、実際の見出しは "Keep assets local" である。

### 7.2 Developer policies（テーマに関係する部分）[確認済: `Community directory/Developer policies.md`]

- "Themes may not load assets from the network."（`:28`）
- コードの難読化、動的広告、クライアント側のテレメトリ、自己更新は禁止（`:23-27`）
- LICENSE の同梱、元のライセンスの遵守（必要なら README に帰属表示）、Obsidian の商標を第一者製品と誤認させる使い方の禁止（`:44-48`）
- Fork の掲載条件（`:50-61`）

### 7.3 Self-critique checklist（"Obsidian October theme self-critique checklist"）[確認済]

- CSS 変数を使う、`!important` を使わない、Live Preview のクラスで垂直 margin を変えない（padding を使う）、実験的な CSS 機能を使うなら必要なインストーラーのバージョンを README に書く（`:9-12`）
- **`:has()` は絶対に必要な場合だけ使う。特に Canvas で性能問題を起こす**（`:16`）
- 名前に "Obsidian" を入れない、スクリーンショットと README を最新に保つ、スクリーンショットは 512×288 程度に小さく、LICENSE を置く（`:22-26`）

---

## 8. 非推奨の変数とバージョン依存

### 8.1 非推奨（公式）[確認済]

- `Colors.md:79-89`（1.13 で非推奨）: `--color-{red,orange,yellow,green,cyan,blue,purple,pink}-rgb`, `--color-accent-hsl`, `--mono-rgb-0`, `--mono-rgb-100`, `--interactive-accent-hsl`, `--background-modifier-error-rgb`, `--background-modifier-success-rgb`, `--text-highlight-bg-rgb`
- app.css(1.14.4) の `/* Deprecated — kept for theme compatibility */` 配下にもこのうち 14 変数が残っている。`--text-highlight-bg-rgb` だけは 1.14 で **定義自体が削除** された。
- `--callout-color` は 1.13.0 から CSS の色値を受け取る（以前は RGB の三つ組）。changelog は「破壊的変更」としている [第三者: obsidian.md/changelog/2026-05-28-desktop-v1.13.0/]。ドキュメントも "Accepts any valid CSS color" に更新済み（`Editor/Callout.md:11`）。app.css でも `--callout-default: var(--color-blue)`（L2143）であり、`color-mix(in oklch, var(--callout-color) ...)` で使われている（L11641–）。

### 8.2 1.13.7 → 1.14.4 の差分 [確認済、CSV の notes 列]

- **削除**: `--text-highlight-bg`（デフォルト値がなくなった。L2373 の `--highlight-background: var(--text-highlight-bg, var(--highlight-background-yellow))` が、未定義時のフォールバックとして参照する）、`--text-highlight-bg-rgb`、`--settings-home-background`
- **追加**（84）: `--highlight-background(-red/orange/yellow/green/blue/purple)`, `--highlight-opacity`, `--tooltip-*`(10), `--notice-*`(11), `--hotkey-*`(5), `--tab-inner-*`, `--tab-container-padding-*`, `--tab-background(-hover)`, `--tab-corner-shape`, `--bases-kanban-*`(15), `--color-secondary-2..6`, `--safe-area-inline-start/end`, `--frame-ribbon-left/right`, `--font-preferred-size`, `--scroll-mask-small`, `--setting-item-name-*`, `--raised` ほか。changelog の 1.14.0 には "Added CSS variables for tooltips, notices, hotkeys, and tabs, using the prefixes `--tooltip-`, `--notice-`, `--hotkey`, `--tab-inner-` and `--tab-container-`." とある [第三者]。
- **宣言値の変更**（16）: `--icon-m` 18px→16px、`--icon-m-stroke-width` 1.75px→2px、`--tab-curve` 6px→10px、`--tab-radius-active` 6px→10px、`--nav-item-radius` radius-s→radius-m、`--titlebar-background-focused` secondary-alt→secondary、`--modal-border-color` と `--prompt-border-color` → `--background-modifier-border-hover`、`--file-header-justify` center→start。また `--font-text-size` を直接参照していた 6 変数（`--checkbox-size`, `--table-text-size`, `--popover-font-size` など）が `--font-preferred-size` 経由に変わった。

### 8.3 1.9〜1.13 のテーマ関連の変更 [第三者: obsidian.md/changelog の WebFetch 要約]

- 1.9.x: Bases が登場した（`--bases-*` 変数群。ドキュメントは `Editor/Bases.md`）。
- 1.10.x: Properties がデフォルトで有効になった。Bases ビューに `data-view-name` 属性が付いた。`.is-collapsed` クラスが追加された。`appearance.json` の変更時にテーマが再読み込みされるようになった（1.10.3）。
- 1.11.4 / 1.11.5: macOS のトグルとスライダーがネイティブ風になった。**`--blur-translucency-s/m` が `--blur-opacity-s/m` に改名された**（app.css(1.14.4) では `--blur-opacity-s: 65%`、body L2120）。Inter Variable が同梱された。
- 1.12.0: `corner-shape` プロパティに対応した（`-electron-corner-smoothing` を置き換え。Chromium 139 以上が必要）。`--traffic-lights-offset-x/y` が追加された。app.css(1.14.4) では `corner-shape:` 宣言が 90 箇所あり、`--*-corner-shape` 変数が多数ある。
- 1.13.0: Base 色が OKLCH に移行した（§8.1）。
- 1.13.4: macOS 26 に合わせてボタンと入力欄のスタイルが更新された。

### 8.4 minAppVersion の目安 [推測]

- `color-mix(in oklch)` を前提とする非推奨変数の置き換えと、`--callout-color` の CSS 色値を使うなら、`minAppVersion` は 1.13.0 以上。
- `--tooltip-*`、`--notice-*`、`--highlight-background-*` などを使うなら 1.14.0 以上。
- sample-theme の既定は `1.10.6`。

---

## 9. Community Themes への配布

### 9.1 現行の手順（2026-10 時点）[確認済]

1. GitHub に公開する。`manifest.json` を HEAD に置く。
2. SemVer `x.y.z` のタグで GitHub Release を作り、**タグを manifest の `version` と一致させる**。`manifest.json` と `theme.css` をバイナリ添付する（`Submit your theme.md:35-45`）。GitHub Actions のテンプレートは `gh release create "$tag" --draft manifest.json theme.css`（`Release your theme with GitHub Actions.md:3-31`、sample-theme の `.github/workflows/release.yml`）。
3. community.obsidian.md に Obsidian アカウントでサインインし、GitHub を連携して、**New theme** から投稿する。入力項目は GitHub repository URL、Owner、**Screenshot path**、**Supported modes**。Developer policies に同意する（`Set up and claim.md:82-96`）。
4. 自動レビューは Manifest / Releases / Source code / Build verification の 4 区分で行われ、各項目が Error / Warning / Recommendation / Pass で評価される。Error が残っている間はアプリからインストールできない（`Submit your theme.md:59-63`、`Manage your plugin or theme.md:19-27`、`Frequently asked questions.md:64-66`）。**Review branch** で事前にスキャンできる。
5. 以降は新しい Release を作るだけでユーザーに配布される。再投稿は不要（`FAQ:17-19`）。
6. インストール時、Obsidian は manifest の `version` と同じタグの Release から `manifest.json` と `theme.css` を取得する（`Submit your theme.md:57`）。

掲載ページの追加素材として、デスクトップのスクリーンショット 1200×800 を最大 5 枚、モバイル 900×1600 を最大 5 枚（JPEG/PNG/WebP、各 5MB まで）登録できる（`Manage your plugin or theme.md:37`）。

### 9.2 obsidian-releases リポジトリの位置づけ [確認済]

- README は「submission の詳細は docs を参照」と案内するだけで、PR 手順は書かれていない（`README.md:9-11`）。PR テンプレートには theme 用の選択肢が残っている（`.github/pull_request_template.md:1-4`）が、**現行の正規ルートは directory** と判断する [推測]。
- `community-css-themes.json` は `https://community.obsidian.md/assets/community-themes.json` から **1 時間ごとに自動ミラー** される（`.github/workflows/mirror-community-json.yml:4-6,19,21`）。
- エントリーの形式は `{name, author, repo:"owner/name", screenshot, modes:["dark"|"light"], legacy?:true}`。ワークフローの jq 検証（`mirror-community-json.yml:103-113`）と実データ（847 件。`legacy` 付きは 17 件）で確認した。`legacy` の意味はドキュメントに見当たらない [未確認]。
- アプリはこの JSON を `obsidianmd/obsidian-releases` の `community-css-themes.json` から取得する（`app.js(1.14.4)` の `VS("obsidianmd/obsidian-releases","community-css-themes.json")`）。
- `desktop-releases.json`: `latestVersion: "1.14.4"`、`minimumVersion: "1.1.9"`。`beta.latestVersion` も 1.14.4。

---

## 10. Lint、アクセシビリティ、パフォーマンス（公式記載の有無を区別）

| 観点 | 公式の記載 | 内容 / 出典 |
|---|---|---|
| Lint | **あり** | sample-theme に `stylelint` と `stylelint-config-obsidianmd` が同梱されている（`package.json:6-10`、`.stylelintrc.json`、`.github/workflows/lint.yml`）。README には「テーマレビューと同じ CSS ルールを強制する」とある（`README.md:39`）。 |
| Lint ルールの中身 | あり（README）[第三者: github.com/obsidianmd/stylelint-config の WebFetch 要約] | Error: `http`/`https`/`file` の url() を禁止し、data URI のみ許可。Warning: `!important`、名前付き色（`red` など）、重複プロパティ、`no-unsupported-browser-features`（既定は Electron 43 / Obsidian 1.13.4 相当）、**`:has()` の禁止**、`all` プロパティの禁止、未知の擬似クラスや単位。**名前付き色が Warning になるため、ドキュメントの例（`white`、`black`、`magenta`）自体が lint に引っかかる。** |
| `!important` | あり | Theme guidelines と checklist。app.css 自身は Obsidian 部で `!important` を 64 回使っている。たとえば `.is-flashing` の `background-color: var(--highlight-background) !important`（L3309）。テーマ側でこれを打ち消すには、変数経由で上書きするしかない。 |
| パフォーマンス: `:has()` | あり | checklist `:16`（Canvas で問題になる）と stylelint。app.css 自身は Obsidian 部で `:has(` を 13 回使っている。 |
| パフォーマンス: アセットのサイズ | あり | `Embed fonts and images in your theme.md:46-52` |
| パフォーマンス: 汎用セレクタや深い子孫セレクタ | **なし** | 公式の記載は見つからなかった。低詳細度の推奨は保守性の観点であり、性能の観点ではない。 |
| アクセシビリティ: コントラスト | **なし** | テーマ向けドキュメントにコントラスト比の要件は見当たらない [未確認ではなく、記載なしを確認]。 |
| アクセシビリティ: フォーカス表示 | **なし（変数のみ）** | 専用のガイドラインはない。app.css ではフォーカスリングが `--background-modifier-border-focus` を使っている（`outline: 2px solid ...` や `box-shadow: 0 0 0 2px/3px ...`。L4171、`--bases-table-cell-shadow-active` L2070 ほか）。`--bases-table-cell-shadow-focus` などは `--interactive-accent` を使う。`:focus-visible` は 47 箇所。 |
| reduced motion / forced colors | なし | app.css には `prefers-reduced-motion` が 1 箇所（1.14 で追加）、`forced-colors` が 7 箇所ある（大半は pdf.js 由来）。テーマ向けの記載はない。 |

---

## 11. 対象バージョンの確定と、ドキュメントと app.css の食い違い

### 11.1 バージョン [確認済]

- 最新安定版: **1.14.4**（`obsidian-releases@1eb9ae2 desktop-releases.json` の `latestVersion`。changelog では 2026-10-05 リリース [第三者]）
- ユーザー環境: **1.13.7**（2026-08-12 [第三者]）
- ドキュメント原稿の最終コミット: `c56c7e7`（2026-08-10、"Update 1.13 release status (#261)"）。**1.14.0（2026-09-02）より前** なので、1.14 で追加された変数（tooltip / notice / hotkey / tab-inner / highlight-background / kanban）はドキュメントに載っていない。

### 11.2 食い違いの一覧 [確認済]

| # | ドキュメント | app.css(1.14.4) / app.js | 影響 |
|---|---|---|---|
| 1 | `--text-highlight-bg` がハイライト背景の変数として掲載されている（`Colors.md:168`） | デフォルト定義が削除され、`--highlight-background` のフォールバックとしてだけ読まれる（L2373） | テーマで定義すれば効く。色付きハイライト（`mark[data-highlight]`、`.cm-highlight-*`）は `--highlight-background-*` を直接使うので、こちらも定義が必要になる [推測] |
| 2 | `--nav-heading-color-colapsed-hover`（綴り間違い） | 実名は `--nav-heading-color-collapsed-hover` | ドキュメントどおりに書くと効かない |
| 3 | `--bases-table-text-size` | 実名は `--bases-table-font-size` | 同上 |
| 4 | `--bases-cards-group-padding`, `--status-bar-scroll-padding` | 定義も参照もない | 効かない |
| 5 | Step 6 と Theme guidelines の `--input-focus-border-color` / `--input-hover-border-color` を `:root` で指定する例 | pdf.js の `.annotationLayer` でだけ定義・使用されている | 一般の入力欄には効かない [推測] |
| 6 | Theme guidelines の `body{--font-text-size:18px}` の例 | app.js がユーザー設定の値を body のインラインスタイルで常に設定する | テーマからは効かない可能性が高い [推測] |
| 7 | 1.14 で追加された 84 変数が未掲載 | 定義あり | CSV の notes に `NEW in 1.14.x` と記録した |
| 8 | Colors のデフォルト値の表は `.theme-dark`/`.theme-light` の値 | モバイルでは `.is-mobile.theme-dark` が `--color-base-00/10/20` を上書きする | ドキュメントに記載がない |
| 9 | 索引 `CSS variables.md` に Bases、Dropdowns、Prompt、Sync、Sidebar、Vault profile のリンクがない | ページは存在する | — |
| 10 | Theme guidelines の Embed ページのアンカー `#Keep resources local` | 見出しは "Keep assets local" | リンク切れ |

---

## 未確認事項

1. 実機（1.14.4 / 1.13.7）での Computed Style。特に §2.4 の詳細度の落とし穴、§2.5 の `--font-text-size` がテーマから効かないこと、§11.2 #5（pdf.js 変数）。本調査はすべて宣言値と静的解析に基づく。
2. `.is-ios` / `.is-android` / `.is-mobile` を付与するコード（モバイルアプリ側）。デスクトップの asar では一部しか確認できない。
3. `versions.json` のフォールバックがテーマでも働くか。ドキュメントは plugin についてのみ記載しており、sample-theme は同梱している。
4. `community-css-themes.json` の `legacy: true` の意味。
5. 片方のモードだけに対応するテーマを、未対応のモードで使ったときのアプリの挙動（警告や切り替えの有無）。
6. Community directory の自動レビューのうち、テーマ固有のチェック項目の全体（FAQ は「plugin と区分は同じでチェック内容は異なる」とだけ書いている）。stylelint-config の内容と同じかどうかは未照合。
7. changelog の 1.9〜1.14 の情報は WebFetch の要約経由であり、各リリースノートの原文全文とは照合していない（1.13.0 のみ個別ページで確認した）。1.13.x の日付に要約間の揺れがある（1.13.6: 8/7 と 8/10）。
8. ドキュメント原稿のファイル単位の更新履歴（shallow clone のため取得していない）。
9. Electron / Chromium の具体的なバージョン（`no-unsupported-browser-features` の判定基準）。changelog では 1.13.6 のインストーラーが Electron 43.3.0 [第三者]。**追記（統合時に確認）**: ユーザー環境の Obsidian.app はインストーラー 1.11.7 で、同梱の Electron は 39.5.1（Chrome/142.0.7444.265）だった [確認済: `Electron Framework.framework` の Info.plist とバイナリ文字列]。asar の更新では Electron は更新されないため、同じアプリ版でも利用者ごとに Chromium が異なる。asar 版と installer 版の組み合わせによって、使える CSS 機能（例: `corner-shape` には Chromium 139 以上が必要）が変わる。

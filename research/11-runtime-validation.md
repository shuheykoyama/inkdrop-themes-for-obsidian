# 11. 実機検証（Phase 2B: P0 項目と背景階層）

- 検証日: 2026-10-10
- 基準コミット: `f14be25d4e4e55fccbe3f481da4c4e7e86e21dbe`（Phase 1B 完了時点）
- 対象: 09 §2.1 の P0（V-30、V-20、V-22、V-01）と、Q-D1 の判断に必要な V-03・V-16
- 前提（ユーザー確定済み、本書では再審議しない）: Q-D20（Obsidian 1.14.0 以降）、Q-D10（モバイル完全対応）、Q-D6、Q-D9、Q-D15、Q-D13、Q-D21（Vanilla CSS + PostCSS を第一候補）、Q-D2（実際に適用されるコードが正本、HSL 宣言は保持）
- 証拠: [`evidence/phase2-p0/`](evidence/phase2-p0/README.md)（スクリーンショット、Computed Style の測定値、診断用 CSS / JS）、[`data/inkdrop-consumers-6.1.5.csv`](data/inkdrop-consumers-6.1.5.csv)（Inkdrop 6.1.5 の静的解析）
- **本書はデザイン判断を確定しない。** Q-D1 は選択肢ごとの技術的な判断材料までを示す。

## 証拠の区分

| 区分 | 意味 |
|---|---|
| **VERIFIED** | 対象バージョンの実機で直接確認した（Computed Style、DOM、スクリーンショット） |
| **VERIFIED（エミュレーション）** | Obsidian デスクトップ版の `app.emulateMobile(true)` で確認した。iOS / Android の実機ではない |
| **STATIC** | アプリの CSS / JS を静的に解析した（アプリは起動していない） |
| **INFERRED** | 根拠に基づく推測 |
| **BLOCKED** | 環境・権限の制約で確認できなかった |

---

## 1. 検証概要

| 項目 | 状態 | 要旨 |
|---|---|---|
| V-30 Inkdrop の基準スクリーンショット | **BLOCKED** | Inkdrop がこの Mac にインストールされていない。インストールとログインは無断で行わない約束のため未実施。リポジトリ既存の `docs/screenshot.png` は撮影環境が不明で、PASS として扱わない |
| V-20 Inkdrop UI 変数の適用先 | **STATIC**（実機は BLOCKED） | 公開配布物 Inkdrop 6.1.5 を展開して静的解析した。06 の対象 42 行のうち 41 行で消費箇所を特定。実機の Computed Style は未確認 |
| V-22 Inkdrop エディタ変数の適用先 | **STATIC**（実機は BLOCKED） | CodeMirror の外枠のテーマは本体 JS の `EditorView.theme` に直接書かれていた。主要な変数の適用先を特定 |
| V-01 Obsidian の CSS 優先関係 | **VERIFIED** | Obsidian 1.14.4 の隔離インスタンスで、診断用 CSS の Computed Style を測定。静的解析の予測はすべて実測と一致した |
| V-03 Obsidian の DOM 構造 | **VERIFIED** | サイドドックのクラス（論理名と物理名の両方）、`mod-top`、File Explorer の子要素構成を確認 |
| V-16 背景色のスコープ再定義 | **VERIFIED**（デスクトップ）、**VERIFIED（エミュレーション）**（モバイル） | 方式 1〜4 はすべてデスクトップで成立。モバイルでは方式 2 に別のセレクタと変数が必要なことを確認 |

---

## 2. 対象アプリ・OS・テーマのバージョン

| 対象 | 版 | 確認方法 |
|---|---|---|
| macOS | 26.5.2（build 25F84）、Intel（x86_64） | `sw_vers`、`uname -m` |
| Obsidian（ユーザー環境） | **1.14.4**（2026-10-10 00:27 から稼働）。調査資料の 1.14.4 と同じ | ユーザーの `obsidian.log` の「Loaded updated app package … obsidian-1.14.4.asar」行（ログの読み込み記録だけを読んだ） |
| Obsidian（検証用の隔離インスタンス） | 1.14.4。asar の SHA-256 はユーザー環境のものと同一（`146ef847…`） | `document.title`（"… - Obsidian 1.14.4"） |
| Obsidian インストーラー / Electron | 1.11.7 / Electron 39.5.1 / Chrome 142.0.7444.265 | `navigator.userAgent` |
| Obsidian 最新安定版 | 1.14.4（2026-10-10 時点） | `obsidian-releases` の `desktop-releases.json` |
| Inkdrop | **未インストール**。静的解析には公開配布物 6.1.5（`https://dist.inkdrop.app/releases/inkdrop-6.1.5-arm64-mac.zip`、SHA-256 `96c9a1e6…`）を使った | Homebrew cask の `url`（[formulae.brew.sh/cask/inkdrop](https://formulae.brew.sh/cask/inkdrop)） |
| Inkdrop 6.1.5 同梱の `@inkdropapp/css` | **0.9.12**（調査で使ったリポジトリ版は 0.9.14）。差は `syntax.css` のインラインコードの装飾（0.9.12 は `border`、0.9.14 は `outline`）など | 同梱の `package.json` と差分 |
| Solarized Dark / Kanagawa Dragon | リポジトリ版 2.2.1 / 1.2.1（02 のまま）。Inkdrop 本体には同梱されておらず、実機で適用した版は未確認 | — |

Phase 1B の資料と版の差はない（Obsidian 1.14.4）。Inkdrop 本体の版（6.1.5）は今回初めて特定した。

---

## 3. 検証環境の制約

1. **Inkdrop が未インストール**: `/Applications` にも Spotlight にも見つからなかった。公式マニュアルはアカウントにサインインしてアプリをダウンロードする手順を案内しており（[docs.inkdrop.app/manual](https://docs.inkdrop.app/manual)）、アプリの利用にもアカウントが要ると考えられる（INFERRED）。インストールとログインは無断で行わない約束のため、実機の検証（V-30・V-20・V-22）は行っていない。§13 にユーザーの操作手順をまとめた。
2. **Inkdrop の静的解析**: 公開配布物の zip を一時領域に展開し、`app.asar` の CSS / JS を読んだ。アプリは起動もインストールもしていない。展開物とそのコードはリポジトリに含めていない（`data/inkdrop-consumers-6.1.5.csv` には 1 宣言程度の短い抜粋とセレクタ名だけを残した）。展開したのは arm64 版で、この Mac（Intel）用の x64 版と CSS が同じかは確認していない（INFERRED: 同一と見込む）。
3. **Obsidian の実機検証**: ユーザーの Obsidian と既存の Vault には触れず、専用の `--user-data-dir` とテスト Vault で別インスタンスを起動した。接続は `--remote-debugging-port` と Chrome DevTools Protocol（`evidence/phase2-p0/tools/cdp.mjs`）で行い、GUI を手で操作したわけではない。検証後、起動したプロセスだけを終了した。
4. **モバイル**: iOS / Android の実機はない。Obsidian デスクトップ版の `app.emulateMobile(true)` で、タブレットとして判定されたモバイル UI を確認しただけである（phone の判定は未確認）。
5. **表示条件**: ウィンドウ 1024×800 CSS px、`devicePixelRatio` 2、ダーク、`is-hidden-frameless`（既定のフレーム設定）。translucent は無効。

---

## 4. V-30 の結果（Inkdrop の基準スクリーンショット）: BLOCKED

- 実機での撮影はできなかった。
- 参考として、リポジトリ既存の画像（`solarized-dark@4337f6e docs/screenshot.png`、`kanagawa@f9c14a5 packages/dragon/docs/screenshot.png`）の観察は 02 §14 にある。撮影バージョンや環境が不明なため、V-30 の PASS としては扱わない。
- 撮影の手順と条件は §13.1 にまとめた。

---

## 5. V-20 の結果（Inkdrop UI 変数の適用先）: STATIC

### 5.1 集計

06 の「Inkdrop 適用先」が非公開・混在の 42 行について、Inkdrop 6.1.5 の本体 CSS / JS で消費箇所を探した（`tools/inkdrop_consumers.py`）。

| 区分 | 件数 | 行 |
|---|---|---|
| 全トークンの消費箇所を特定 | 39 | — |
| 一部のトークンだけ特定 | 2 | W07、G02 |
| 消費箇所なし | 1 | W04（エディタのドロワー） |

消費箇所が見つからなかったトークン: `--editor-drawer-background` / `--editor-drawer-border-left`（6.1.5 の本体に drawer というコンポーネントがない）、`--header-note-menu-action-item-active-background`（名前が使われていない）、`--pink` / `--teal` / `--violet` / `--yellow`（定義だけ。メッセージ等は `--<color>-background` などの別名を使う）。`--red` などの色名トークンは、`--gfm-alert-*` を経由して GFM alert でだけ使われる。

これは **STATIC** であり、実機で Computed Style を確かめたものではない。06 の「Inkdrop 適用先」列（公開リポジトリでの消費の有無）は Phase 1 の定義のまま変えていない。

### 5.2 背景の面と適用先（SD / KD 共通の構造）

| 面 | セレクタと宣言（Inkdrop 6.1.5、STATIC） | SD の宣言値 | KD の宣言値 |
|---|---|---|---|
| ページ（最背面） | `renderer/index.html` の `#app-container { background-color: var(--page-background, transparent) }`。`html`・`body` は透明 | `#00141a` | `#0d0c0c` |
| サイドバー | `.sidebar-layout-content { background-color: var(--sidebar-background); border-right: var(--sidebar-border-right, none) }` | `#073541` | `#11110e` |
| ノートリスト | `.note-list-bar-layout-content { background: var(--note-list-bar-background); border-right: var(--note-list-bar-border-right, none) }` | `#002d38` | `#181616` |
| エディタ外枠 | `.editor-layout { background: var(--editor-background) }` | `#002129` | `hsl(45deg 7% 11%)` |
| エディタ本体 | CodeMirror の `EditorView.theme` の `&`（`.cm-editor`）に `backgroundColor: var(--editor-background-color)` | `#002129` | `hsl(45deg 7% 11%)` |
| ノート上部のメニュー | `.editor-title-bar-layout { background: var(--header-note-menu-background) }`（既定は transparent。`.editor-header-layout` も透明） | transparent | transparent |
| 設定画面 | `.preferences-layout .preferences-view` に `--preferences-view-background`、サイドメニューに `--preferences-sidebar-background` | — | — |
| 通知 | `.notification-bar .notification-item-view` に `--notification-item-background` と `backdrop-filter: blur(10px)`。`position: absolute` で浮く | 80% の半透明 | 80% の半透明 |

値は 02 の宣言値（`data/inkdrop-*-tokens.csv`）。HEX の表記は 02 の換算値で、描画色ではない。

**構造の読み取り（STATIC / INFERRED）**: React の定義からは、`.main-layout`（flex）の下に、サイドバー・ノートリスト・エディタの各レイアウトが**横に並ぶ兄弟**として置かれていると読める。ノートリストがサイドバーの上に重なる構造ではない。各面は不透明色なので、通常はページ背景が見えない。`:root:has(body.acrylic-window)` のときだけ、各面が半透明（サイドバー 50%、ノートリスト 70%、エディタ 90%）になり、ページは透明になる。DOM の入れ子は実機で確認していない（§13.1）。

### 5.3 状態色（Phase 1 の前提の訂正、STATIC）

| 要素 | 塗り（選択中） | フォーカス時に追加されるもの |
|---|---|---|
| ノートリスト | `.note-list-item-view.active { background-color: var(--note-list-view-item-selected-background, …) }` | `.note-list-bar:focus-within .note-list-item-view.focused { box-shadow: inset 5px 0 0 var(--note-list-view-item-active-background) }` |
| サイドバー | `.sidebar-menu-item.active { background: var(--sidebar-menu-item-inactive-background, var(--sidebar-menu-item-active-background)) }` | `.sidebar-menu:focus-within .sidebar-menu-item.active { box-shadow: inset 5px 0 0 var(--sidebar-menu-item-active-background) }` |

Phase 1 の 06 は `--*-active-background` を「フォーカス中の選択の塗り」と読んでいたが、6.1.5 では**ペインにフォーカスがあるときの左 5px のアクセントバー**だった。選択中の項目の塗りは `selected` / `inactive` の側である。06 の N03〜N05 の根拠をこの事実に合わせて改めた。

なお、ノートリストの規則の最後のフォールバックは `--note-list-view-item-active-background` が `var()` で包まれておらず、CSS としては無効なトークンになっている。テーマが `--note-list-view-item-selected-background` を定義していれば影響しない（両テーマとも定義している）。

---

## 6. V-22 の結果（Inkdrop エディタ変数の適用先）: STATIC

CodeMirror の外枠のテーマは、独立したパッケージではなく本体 JS（`renderer/assets/notebook-picker-*.js`）の `EditorView.theme({...})` に直接書かれていた。Phase 1B で推定していた `@inkdropapp/cm6-theme-common` という名前のパッケージは、6.1.5 には同梱されていない。

| 要素 | セレクタ | 変数 |
|---|---|---|
| 前景・背景 | `&`（`.cm-editor`） | `--editor-foreground-color` / `--editor-background-color` |
| キャレット | `.cm-content` の `caretColor`、`.cm-cursor, .cm-dropCursor` の `borderLeftColor` | `--editor-caret-color` |
| 選択（非フォーカス） | `.cm-content ::selection` ほか、`.cm-selectionBackground` | `--editor-selection-background` |
| 選択（フォーカス） | `&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground` | `--editor-focused-selection-background` |
| アクティブ行 | `.cm-activeLine` / `.cm-activeLineGutter` | `--editor-active-line-background-color` / `--editor-active-line-gutter-background-color` |
| ガター | `.cm-gutters` の color / backgroundColor / borderRight。横スクロール時は `.cm-gutters.cm-gutters-hscrolled` が `var(--editor-gutter-background-solid-color, var(--editor-background-color))` | `--editor-gutter-color` / `--editor-gutter-background-color` / `--editor-gutter-border-right` |
| 検索一致 | `.cm-searchMatch`、`.cm-searchMatch.cm-searchMatch-selected` | `--editor-search-match-*` |
| 同一語の一致 | `.cm-selectionMatch` | `--editor-selection-match-background-color` |
| 括弧の一致 | `&.cm-focused .cm-matchingBracket` | `--editor-matching-bracket-*` |
| 折りたたみ | `.cm-foldPlaceholder` | `--editor-fold-placeholder-*` |
| ツールチップ・補完 | `.cm-tooltip`、`.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]` | `--editor-tooltip-background-color`、`--editor-tooltip-autocomplete-item-selected-background-color` |
| パネル | `.cm-panels` | `--editor-panel-background-color` |

**エディタ周辺の境界の作り方（STATIC）**: エディタは `.editor-layout`（`--editor-background`）の上に `.cm-editor`（`--editor-background-color`）が重なる 2 層構造で、ノート上部のメニュー（`.editor-title-bar-layout`）は透明なので、エディタ外枠の色がそのまま上端まで続く。サイドバーとノートリストの右端の線は `border-right` で描かれる。

Obsidian 側の対応（VERIFIED、§7）: アクティブ行は `.cm-line.cm-active`、ガターは `.cm-gutters` で、どちらもテーマから塗れる。Inkdrop の `.cm-activeLine` と Obsidian の `.cm-line.cm-active` はクラス名が違う。

---

## 7. V-01 の結果（Obsidian の CSS 優先関係）: VERIFIED

診断用 CSS（`evidence/phase2-p0/obsidian/diagnostic-theme/case-A-cascade.css`）をテスト Vault のテーマとして読み込み、Computed Style を測った（`measurements/v01-v16-case-A.json`）。

| # | 確認内容 | 予測（Phase 1B、STATIC） | 実測（VERIFIED） |
|---|---|---|---|
| 1 | 読み込み順 | app.css → テーマ `<style>` | `<link href="app.css">`（index 0）の後にテーマの `<style>`（index 1）。テーマの `<style>` は `app.customCss.styleEl` と同一 |
| 2 | `.theme-dark` で定義した変数 | app.css の `.theme-dark` に勝つ | 勝つ。`--text-selection` → `rgb(4, 5, 6)`、`--background-primary` / `--background-secondary` / `--ribbon-background` も目印の値 |
| 3 | `.mod-macos` が再定義する変数 | 同じ詳細度で後に読まれるテーマが勝つ | 勝つ。`--interactive-normal` → `rgb(1, 2, 3)` |
| 4 | `body` だけで定義した変数 | app.css の `.theme-dark` に負ける | 負ける。`body { --text-accent }` は無視され、app.css の `.theme-dark` の値（`hsl(calc(258 - 3), …)`）のまま |
| 5 | `body.theme-dark` の規則 | テーマの `.theme-dark` は負ける | 負ける。`--canvas-color` は app.css の `#7e7e7e` のまま |
| 6 | 子孫要素での変数の再定義 | 局所再定義は配下の参照箇所にだけ効き、`body` で計算済みの派生変数には伝わらない | そのとおり。左ドックで `--background-secondary` を再定義すると、ドックの leaf と vault profile は変わったが、分割要素自身の背景（`--tab-container-background` 由来）は変わらなかった |
| 7 | `!important` | `.cm-gutters` の文字色は変数の再定義で変えられ、`border-right` は負ける | そのとおり。文字色は `rgb(153, 0, 0)`、`border-right` は `0px none`、`box-shadow: inset -1px 0 0` による線は描けた |
| 8 | アクティブ行 | `.cm-line.cm-active` に既定のスタイルはなく、テーマで塗れる | 塗れた（`rgb(30, 30, 0)`） |

**静的解析の予測と実測の差**: なし。ただし予測していなかった事実が 1 つあった。既定の Hidden frame（`is-hidden-frameless`）では `.titlebar` 自体が `display: none` で、さらにウィンドウがフォーカスされている間は `body.is-focused .titlebar { --titlebar-background: var(--titlebar-background-focused) }` が効く（`measurements/v16-titlebar.json`）。`--titlebar-background` が画面に現れるのは、各分割の最上段のタブ帯（`.workspace-tabs.mod-top`）を通じてである。

---

## 8. V-03・V-16 の結果（背景階層の再現可能性）

### 8.1 DOM 構造（VERIFIED、`measurements/v03-dom-baseline.json`）

| 要素 | 実機の構造 |
|---|---|
| Ribbon | `.workspace-ribbon.side-dock-ribbon.mod-primary`（`.mod-left` ではない）。背景は `--ribbon-background` |
| 左ドック | `.workspace-split.mod-horizontal.mod-sidedock.mod-primary-split.mod-left-split`（論理名と物理名の両方が付く） |
| 右ドック | `.workspace-split.mod-horizontal.mod-sidedock.mod-secondary-split.mod-right-split` |
| ノート領域 | `.workspace-split.mod-vertical.mod-root` |
| `mod-top` | 左ドック・ルート・右ドックの、それぞれ最上段のタブグループに 1 つずつ付く |
| タブ帯 | `.workspace-tab-header-container`。ルートと右ドックは `--titlebar-background` の色（ケース A で実測）。左ドックもケース A の A5 で上書きしなければ同じになると考えられる（INFERRED。ケース A では A5 で別色にしていたため、上書きなしの左ドックは目印の色で測っていない。既定のテーマでは 3 つのタブ帯とも `rgb(40, 40, 40)` で同色だった） |
| File Explorer | `.workspace-leaf-content[data-type="file-explorer"]` の直下は `.nav-header` と `.nav-files-container` の 2 つだけ（`.view-content` はない） |
| ドック本体 | `.workspace-tabs .workspace-leaf` が `--background-secondary` で塗られる（`.workspace-leaf-content` 自体は透明） |
| ステータスバー | `.status-bar`。背景は `--background-secondary`（body で計算済みの値） |
| タイトルバー | `.titlebar` は Hidden frame では `display: none` |

### 8.2 方式別の結果

**方式 1: 公式 CSS 変数のみ** — **実現可能（VERIFIED）**

- `.theme-dark` で `--background-primary`（ノート領域）、`--background-secondary`（左右ドック本体、ステータスバー）、`--ribbon-background`、`--titlebar-background`（最上段のタブ帯）、`--tab-container-background`（分割の地）を設定し、それぞれ独立に色が変わることを確認した。
- 制約: 左右ドック本体は同じ色。ステータスバーもドック本体と同じ `--background-secondary` を使う。左ドックのタブ帯は `--titlebar-background` に連動する。

**方式 2: 左右ドックの色を分離** — **条件付きで実現可能（デスクトップは VERIFIED、モバイルは VERIFIED（エミュレーション））**

- デスクトップ: `.workspace-split.mod-left-split { --background-secondary: X }` と `.mod-right-split` で、左右のドック本体が別色になった（左 `rgb(0, 102, 0)`、右 `rgb(0, 0, 102)`）。1.14.4 では `.mod-primary-split` / `.mod-secondary-split` も同じ要素に付く。
- 副作用: 左ドック下端の vault profile も左の色になる。分割要素自身の背景とタブ帯は変わらない（§7 #6）ため、帯まで揃えるには別途指定が要る。ステータスバーは変わらない。
- モバイル（エミュレーション）: `.workspace-split.mod-*-split` は存在しない（0 件）。サイドバーは `.workspace-drawer.mod-primary.mod-left` / `.workspace-drawer.mod-secondary.mod-right` で、背景は `--mobile-sidebar-background`。ドロワー上で `--background-secondary` を再定義しても**変わらなかった**（ケース B）。`--mobile-sidebar-background` を再定義すると左右別色になった（ケース C、`measurements/mobile-emulation-case-C.json`）。
- 結論: デスクトップとモバイルで別のセレクタ・変数を書く必要がある。

**方式 3: File Explorer の内部を塗り分け** — **実現可能（デスクトップは VERIFIED、モバイルは VERIFIED（エミュレーション））**

- `.workspace-leaf-content[data-type="file-explorer"] .nav-header` と `.nav-files-container` に別々の背景を付けられた。同じドックの Search・Bookmarks の `.workspace-leaf-content` は透明のまま（影響なし）。
- モバイル（エミュレーション）でも同じセレクタが効いた。ただしモバイルではドロワー上部に別の要素（ビューの切り替え「Files」）があり、配置が違う（`obsidian/02-mobile-emulation-tablet-case-A.png`）。
- 制約: File Explorer のタブを開いているときだけの見た目になる。`.nav-header` は他のビュー（Bookmarks など）にも存在するため、`[data-type="file-explorer"]` で限定する必要がある。

**方式 4: タブ帯とタイトルバーの色を分離** — **条件付きで実現可能（VERIFIED、デスクトップ）**

- 公式変数だけでは分離できない。`.workspace-tabs.mod-top` の規則（app.css L4354-4358）が、タブ帯の変数に `--titlebar-background` を代入するため。
- 直接セレクタ `.workspace-split.mod-left-split .workspace-tabs.mod-top { --sidebar-tab-container-background: X }`（詳細度 0,4,0）で、左ドックのタブ帯だけを別色にできた（`rgb(0, 153, 153)`。ルートと右ドックのタブ帯は `--titlebar-background` のまま）。
- 補足: Hidden frame では `.titlebar` 自体が表示されないため、`--titlebar-background` は実質的に「最上段のタブ帯の色」として働く。
- モバイル: 未確認（モバイルのドロワーにはデスクトップと同じタブ帯がなく、別の構造。§10）。

### 8.3 背景の段数のまとめ

デスクトップでは、少なくとも次の面を互いに独立した色にできることを実測で確認した。

1. Ribbon（`--ribbon-background`、公式変数）
2. 左ドックのタブ帯（直接セレクタ）
3. File Explorer のヘッダー（直接セレクタ）
4. File Explorer のファイル一覧（直接セレクタ）
5. 左ドック本体（スコープ再定義）
6. ルートの最上段のタブ帯（`--titlebar-background`、公式変数）
7. ノート領域（`--background-primary`、公式変数）
8. 右ドック本体（スコープ再定義）
9. ステータスバー（公式変数だが `--background-secondary` を共有。分けるには直接セレクタ）

「CSS 変数のみでは 2 段」と「CSS では表現できない」は別である。今回の実測で、**背景色の段数は CSS では制約にならない**ことが確認できた。制約になるのは、docs 未掲載のクラス・変数への依存（保守性）と、デスクトップとモバイルでの書き分けである。

**レイアウト構造は別問題**: Inkdrop のサイドバーとノートリストを横に並べた 2 ペインにすることは、Obsidian の File Explorer が 1 本のツリーである以上、テーマ CSS の範囲ではない（今回は扱っていない）。

---

## 9. Q-D1 の選択肢別の技術評価

Inkdrop 側の正本（§5.2、STATIC）: サイドバー｜ノートリスト｜エディタが横に並ぶ 3 面で、各面は不透明。ノート上部のメニューは透明で、エディタの色が上端まで続く。SD はサイドバーが最も明るく（`#073541` > `#002d38` > `#002129`）、KD はエディタが最も明るい（`#11110e` < `#181616` < `hsl(45deg 7% 11%)`）。

| 選択肢 | 再現可能性 | 忠実度（再現できる Inkdrop の面） | 副作用 | 保守性 | 1.14.0 以降 | モバイル | 技術面の暫定評価 |
|---|---|---|---|---|---|---|---|
| (a) 左右ドック本体 = サイドバー色 | 成立（VERIFIED） | サイドバー。ノートリストの面は失われる | 右ドックとステータスバーも同じ色 | 高（公式変数のみ） | 成立 | `--background-secondary` が `--mobile-sidebar-background` の既定値なので同じ方法で効く（VERIFIED（エミュレーション）） | 最も堅いが、面の数が最も少ない |
| (b) 左右ドック本体 = ノートリスト色 | 成立（VERIFIED） | ノートリスト。サイドバーの面は失われる | 同上 | 高 | 成立 | 同上 | 同上 |
| (c) テーマごとに (a) / (b) | 成立 | テーマによる | 同上 | 高 | 成立 | 同上 | SD と KD で奥行きの向きが逆なので意味がある |
| (d) 左ドックのタブ帯 = サイドバー色、本体 = ノートリスト色 | 公式変数だけでは**不成立**（タブ帯がタイトルバー色に連動）。直接セレクタ `.mod-left-split .workspace-tabs.mod-top` で**成立**（VERIFIED） | 両方の色が左ドックに現れる。ただしタブ帯は細い横帯で、Inkdrop の縦長のサイドバー面とは面積が大きく違う | 直接セレクタ版は他の帯に影響しない（実測） | 中（`mod-top`、`--sidebar-tab-container-background` は docs 未掲載） | 成立（`--sidebar-tab-container-background` は 1.14 から） | モバイルのドロワーはタブ帯の構造が違い、未確認 | 実現できるが、見た目の印象は Inkdrop と違う可能性が高い |
| (e) 左ドック = サイドバー色、右ドック = 別の色 | 成立（VERIFIED）。デスクトップは `.mod-left-split`（または `.mod-primary-split`）で `--background-secondary` を再定義 | 左右の段を分けられる。右ドックに何の色を当てるかは別の判断 | vault profile も左の色。分割要素の地とタブ帯は別途指定 | 中（docs 未掲載のクラス） | 成立 | **別の書き方が必要**: `.workspace-drawer.mod-primary` で `--mobile-sidebar-background` を再定義（VERIFIED（エミュレーション）） | 成立。デスクトップとモバイルの書き分けが前提 |
| (f) File Explorer のビューだけ別色 | 成立（VERIFIED） | File Explorer を開いている間だけ、別の面を作れる | 同じドックの他のビュー（Search 等）は元の色 | 中（`data-type` は docs 未掲載） | 成立 | 同じセレクタが効く（VERIFIED（エミュレーション）） | 成立。タブを切り替えると色が変わる点をどう評価するか |
| **(g) 新規: File Explorer 内部の 2 色化**（`.nav-header` = サイドバー色、`.nav-files-container` = ノートリスト色） | 成立（VERIFIED） | File Explorer の中に 2 つの面。ヘッダーは操作ボタンの細い帯 | 他のビューに影響しない | 中 | 成立 | 同じセレクタが効く（VERIFIED（エミュレーション））。配置は異なる | (d) と同じく、面積の比率は Inkdrop と違う |
| **(h) 新規: 組み合わせ**（例: Ribbon・タブ帯・ドック本体・File Explorer 内部を個別に指定） | 各要素は成立（VERIFIED） | 方式 1〜4 の組み合わせ次第で、Inkdrop の 3 面に近い明度の段を作れる | 指定する要素が増えるほど、他の UI との整合の確認が増える | 低〜中（未掲載クラスへの依存が増える） | 成立 | 要素ごとにモバイルでの書き分けが要る | 技術的には最も自由度が高い。どの面を Inkdrop のどの面に当てるかはデザイン判断 |

**本書は Q-D1 を確定しない。** 判断の際は、Inkdrop の実機スクリーンショット（V-30、未取得）と、上の各方式を当てた Obsidian の見た目を並べて比べることを勧める。

---

## 10. モバイルで追加検証が必要な事項

確認できたこと（VERIFIED（エミュレーション）、タブレット判定）:

- デスクトップ固有のセレクタで、モバイルに存在しないもの: `.workspace-split.mod-left-split` / `.mod-right-split` / `.mod-primary-split` / `.mod-secondary-split`、`.workspace-ribbon`（0 件。Ribbon はドロワー内に統合される）。
- モバイルで代わりに使うもの: `.workspace-drawer.mod-primary.mod-left` / `.workspace-drawer.mod-secondary.mod-right`、`--mobile-sidebar-background`。
- 両方で同じように効くもの: File Explorer 内部（`.nav-header`、`.nav-files-container`）、`--background-primary`。
- `.is-mobile.theme-dark` により `--color-base-00` は `#000` になる。テーマが `--background-primary` を直接設定した場合はそちらが使われた（`body_bgPrimary` が目印の値）。

確認できていないこと（BLOCKED）:

1. iOS / Android 実機の DOM と Computed Style（`.is-ios` / `.is-android` の付与、safe-area、キーボード表示時）。
2. phone 判定（`.is-phone`）の UI。エミュレーションはタブレット判定だった。
3. モバイルのドロワー上部（ビュー切り替え、タブ帯に相当する部分）の構造と、方式 4 の可否。
4. モバイルのフローティングナビゲーション（`is-floating-nav`）とグラデーションの重なり。

完全対応に必要な環境: iOS と Android の実機（phone と tablet）各 1 台以上、それぞれに検証専用の Vault、Safari Web Inspector（iOS）または Chrome の `chrome://inspect`（Android）によるリモートデバッグ。

---

## 11. 区分の一覧

| 事項 | 区分 |
|---|---|
| ユーザー環境の Obsidian が 1.14.4 であること | VERIFIED（ログ） |
| 読み込み順（app.css → テーマ） | VERIFIED |
| `.theme-dark` / `.mod-macos` / `body` / `body.theme-dark` との優先関係 | VERIFIED |
| 子孫での変数の再定義の効き方 | VERIFIED |
| `.cm-gutters` の `!important` と迂回策 | VERIFIED |
| `.cm-line.cm-active` の存在と塗り | VERIFIED |
| サイドドックのクラス、`mod-top`、File Explorer の子要素 | VERIFIED |
| Hidden frame での `.titlebar` の非表示、`--titlebar-background-focused` | VERIFIED |
| 方式 1〜4（デスクトップ） | VERIFIED |
| モバイルのドロワー構造と `--mobile-sidebar-background` | VERIFIED（エミュレーション） |
| iOS / Android 実機、phone 判定 | BLOCKED |
| Inkdrop の各面の適用先（§5.2）と状態色の構造（§5.3） | STATIC |
| Inkdrop の CodeMirror 外枠の適用先（§6） | STATIC |
| Inkdrop のレイアウトが横並びの兄弟で、面が重ならないこと | STATIC / INFERRED（DOM の入れ子は未確認） |
| x64 版の Inkdrop が arm64 版と同じ CSS を持つこと | INFERRED |
| Inkdrop の実機の Computed Style と描画、基準スクリーンショット | BLOCKED |

---

## 12. Phase 2 の設計判断に進むための条件

1. **Q-D1 の判断材料**: Obsidian 側の技術的な実現性は揃った（§8・§9）。各方式が成立するかどうかは実測で確認済みで、残るのは「どの面にどの色を当てるか」というデザイン判断である。
2. **残る前提**: 判断の比較基準になる Inkdrop の実機スクリーンショット（V-30）と、Inkdrop 実機での面の構造の確認（V-20 の DOM の入れ子）がない。静的解析の結果（§5.2）だけで判断を進めることは可能だが、Inkdrop の実際の見え方との比較はできない。
3. **モバイル**: デスクトップの方式のうち、方式 2 は書き分けが必要、方式 4 はモバイルで未確認。モバイルの実機検証は、実装方針（デスクトップとモバイルで別のセレクタを持つこと）を決めるうえでは必須ではないが、完全対応（Q-D10）の確認には必須である。

---

## 13. ユーザーにお願いする操作（Inkdrop の実機検証）

Inkdrop のインストールとサインインはユーザーの判断で行う必要がある。以下は、承認が得られた場合に必要な最小限の操作である。

### 13.1 V-30・V-20・V-22 を進めるための手順

1. **Inkdrop 6.1.5 をインストールしてサインインする**（この Mac は Intel のため x64 版）。既存のノートを使わず、検証用のノートブックを 1 つ作り、Obsidian の検証と同じサンプルノート（`evidence/phase2-p0/obsidian/test-vault/Sample note.md`。frontmatter は除く）を 1 件入れる。
2. **テーマを Solarized Dark に切り替える**（Preferences → Themes。元のテーマを控えておき、検証後に戻す）。
3. **リモートデバッグ付きで起動する**（Claude Code が Obsidian と同じ方法で測定するため）:

   ```sh
   open -a Inkdrop --args --remote-debugging-port=9334
   ```

   起動したら Claude Code に伝えてもらう。Claude Code は次を実行する（読み取りのみ）:

   ```sh
   curl -s http://127.0.0.1:9334/json/list            # Inkdrop のウィンドウの URL を確認
   CDP_URL_PREFIX=<上の URL の先頭> node research/evidence/phase2-p0/tools/cdp.mjs 9334 eval research/evidence/phase2-p0/tools/probe-inkdrop.js
   CDP_URL_PREFIX=<同上> node research/evidence/phase2-p0/tools/cdp.mjs 9334 shot <保存先>.png 1024 800
   ```

4. **Kanagawa Dragon に切り替えて、手順 3 を繰り返す**。
5. **元のテーマに戻す**。

リモートデバッグを使わない場合は、Inkdrop の DevTools（View → Toggle Developer Tools）を開き、Console に `probe-inkdrop.js` の内容を貼り付けて実行し、出力（JSON）とスクリーンショットを共有してもらえれば同じ検証ができる。

### 13.2 撮影条件（V-30）

| 条件 | 値 |
|---|---|
| ウィンドウ | 1024×800（CDP の `shot` に `1024 800` を渡すと固定される） |
| 表示 | 3 ペイン（サイドバー、ノートリスト、エディタ）を表示。検証用ノートを選択し、エディタにフォーカス |
| 状態 | (1) 既定、(2) サイドバーの項目を hover、(3) ノートリストにフォーカス（左 5px のバーの確認）、(4) プレビュー表示、(5) コマンドパレットかメニューを 1 つ開く |
| 記録 | Inkdrop の版、テーマ名と版（Preferences → Themes に表示される版）、OS、表示倍率 |

### 13.3 モバイル（Q-D10）

iOS / Android の実機での検証は、実機と検証専用 Vault の用意が必要で、今回は実施していない（§10）。

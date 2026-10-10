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
| V-30 Inkdrop の基準スクリーンショット | **VERIFIED**（§14・§15） | 両テーマ × 5 状態の基準スクリーンショット（不透明表示、§14.3）と、macOS 既定の半透明（acrylic）表示のネイティブキャプチャ（V-32、§15）を取得した |
| V-20 Inkdrop UI 変数の適用先 | **VERIFIED**（§14） | 主要な背景面・境界線・選択状態の項目で、静的予測と実機の Computed Style が全件一致した。DOM 階層も確認した |
| V-22 Inkdrop エディタ変数の適用先 | **VERIFIED**（§14） | エディタの背景・前景・キャレット・選択・アクティブ行・ガターを実機で確認した |
| V-01 Obsidian の CSS 優先関係 | **VERIFIED** | Obsidian 1.14.4 の隔離インスタンスで、診断用 CSS の Computed Style を測定。静的解析の予測はすべて実測と一致した |
| V-03 Obsidian の DOM 構造 | **VERIFIED** | サイドドックのクラス（論理名と物理名の両方）、`mod-top`、File Explorer の子要素構成を確認 |
| V-16 背景色のスコープ再定義 | **VERIFIED**（デスクトップ）、**VERIFIED（エミュレーション）**（モバイル） | 方式 1〜4 はすべてデスクトップで成立。モバイルでは方式 2 に別のセレクタと変数が必要なことを確認 |
| V-32 Inkdrop の半透明（acrylic）表示の実際の見え方 | **VERIFIED**（§15。背景は制御した背景ウィンドウ、壁紙の影響は未確認） | 両テーマで acrylic / 不透明の対照をネイティブキャプチャで撮影し、各面の画素を計測した。背後のウィンドウの柄もフォーカスの有無も合成結果を変えず、半透明の面は一定の暗い灰色の上に重なったように見える |

**経緯**: V-30・V-20・V-22 は、Phase 2B の初回（基準コミット `f14be25` の時点）では Inkdrop がこの Mac に未インストールだったため、V-30 は BLOCKED、V-20・V-22 は公開配布物 6.1.5 の静的解析（STATIC。06 の対象 42 行のうち 41 行で消費箇所を特定）にとどまった。その後ユーザーが Inkdrop をインストールしてサインインし、同日の再開検証（§14）で 3 件とも VERIFIED になった。当初の記録は §3・§4・§5・§6 に残してある。半透明表示のスクリーンショットは再開検証でも取れず（§14.8）、V-32 として §15 で取得した。

---

## 2. 対象アプリ・OS・テーマのバージョン

| 対象 | 版 | 確認方法 |
|---|---|---|
| macOS | 26.5.2（build 25F84）、Intel（x86_64） | `sw_vers`、`uname -m` |
| Obsidian（ユーザー環境） | **1.14.4**（2026-10-10 00:27 から稼働）。調査資料の 1.14.4 と同じ | ユーザーの `obsidian.log` の「Loaded updated app package … obsidian-1.14.4.asar」行（ログの読み込み記録だけを読んだ） |
| Obsidian（検証用の隔離インスタンス） | 1.14.4。asar の SHA-256 はユーザー環境のものと同一（`146ef847…`） | `document.title`（"… - Obsidian 1.14.4"） |
| Obsidian インストーラー / Electron | 1.11.7 / Electron 39.5.1 / Chrome 142.0.7444.265 | `navigator.userAgent` |
| Obsidian 最新安定版 | 1.14.4（2026-10-10 時点） | `obsidian-releases` の `desktop-releases.json` |
| Inkdrop（静的解析） | 公開配布物 6.1.5（`https://dist.inkdrop.app/releases/inkdrop-6.1.5-arm64-mac.zip`、SHA-256 `96c9a1e6…`）を展開して解析した | Homebrew cask の `url`（[formulae.brew.sh/cask/inkdrop](https://formulae.brew.sh/cask/inkdrop)） |
| Inkdrop（実機） | **6.1.5**（x86_64、`/Applications/Inkdrop.app`）。下の表の (2)・(3) の環境 | §14.1、§15.1 |
| Inkdrop 6.1.5 同梱の `@inkdropapp/css` | **0.9.12**（調査で使ったリポジトリ版は 0.9.14）。差は `syntax.css` のインラインコードの装飾（0.9.12 は `border`、0.9.14 は `outline`）など | 同梱の `package.json` と差分 |
| Solarized Dark / Kanagawa Dragon | 実機で適用した版は **2.2.1 / 1.2.1**（リポジトリ版と同じ。`inkdrop.packages` が報告） | §14.1 |

Phase 1B の資料と版の差はない（Obsidian 1.14.4）。

**検証環境の 3 段階**（いずれも同じ Mac、macOS 26.5.2、2026-10-10）:

| 段階 | Inkdrop の状態 | 行った検証 | 記録 |
|---|---|---|---|
| (1) Phase 2B 初回 | 未インストール（当時） | Obsidian の V-01・V-03・V-16、Inkdrop は配布物の静的解析だけ | §3〜§13 |
| (2) Inkdrop 実機検証（再開） | ユーザーがインストール・サインイン済み。CDP のエミュレーションで 1024×800 CSS px、倍率 1。**不透明表示**（acrylic を一時的に無効化） | V-30・V-20・V-22 | §14 |
| (3) V-32（本書 §15） | 同上。実ウィンドウ 1200×700 pt、倍率 2。**acrylic と不透明の両方**をネイティブの画面キャプチャで撮影 | V-32 | §15 |

§3 の「未インストール」は段階 (1) 時点の記録であり、現在の状態ではない。

---

## 3. 検証環境の制約

以下は段階 (1)（Phase 2B 初回）の制約である。Inkdrop の未インストールは段階 (2) で解消した（§14）。

1. **Inkdrop が未インストール（段階 (1) 当時）**: `/Applications` にも Spotlight にも見つからなかった。公式マニュアルはアカウントにサインインしてアプリをダウンロードする手順を案内しており（[docs.inkdrop.app/manual](https://docs.inkdrop.app/manual)）、アプリの利用にもアカウントが要ると考えられる（INFERRED）。インストールとログインは無断で行わない約束のため、実機の検証（V-30・V-20・V-22）は行っていない。§13 にユーザーの操作手順をまとめた。
2. **Inkdrop の静的解析**: 公開配布物の zip を一時領域に展開し、`app.asar` の CSS / JS を読んだ。アプリは起動もインストールもしていない。展開物とそのコードはリポジトリに含めていない（`data/inkdrop-consumers-6.1.5.csv` には 1 宣言程度の短い抜粋とセレクタ名だけを残した）。展開したのは arm64 版で、この Mac（Intel）用の x64 版と CSS が同じかは確認していない（INFERRED: 同一と見込む）。
3. **Obsidian の実機検証**: ユーザーの Obsidian と既存の Vault には触れず、専用の `--user-data-dir` とテスト Vault で別インスタンスを起動した。接続は `--remote-debugging-port` と Chrome DevTools Protocol（`evidence/phase2-p0/tools/cdp.mjs`）で行い、GUI を手で操作したわけではない。検証後、起動したプロセスだけを終了した。
4. **モバイル**: iOS / Android の実機はない。Obsidian デスクトップ版の `app.emulateMobile(true)` で、タブレットとして判定されたモバイル UI を確認しただけである（phone の判定は未確認）。
5. **表示条件**: ウィンドウ 1024×800 CSS px、`devicePixelRatio` 2、ダーク、`is-hidden-frameless`（既定のフレーム設定）。translucent は無効。

---

## 4. V-30 の結果（Inkdrop の基準スクリーンショット）: 当初 BLOCKED（§14 で VERIFIED）

- 実機での撮影はできなかった。
- 参考として、リポジトリ既存の画像（`solarized-dark@4337f6e docs/screenshot.png`、`kanagawa@f9c14a5 packages/dragon/docs/screenshot.png`）の観察は 02 §14 にある。撮影バージョンや環境が不明なため、V-30 の PASS としては扱わない。
- 撮影の手順と条件は §13.1 にまとめた。

---

## 5. V-20 の結果（Inkdrop UI 変数の適用先）: 当初 STATIC（§14 で VERIFIED）

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

## 6. V-22 の結果（Inkdrop エディタ変数の適用先）: 当初 STATIC（§14 で VERIFIED）

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

**本書は Q-D1 を確定しない。** 判断の際は、Inkdrop の実機スクリーンショット（V-30 の不透明表示は §14.3、半透明表示は §15）と、上の各方式を当てた Obsidian の見た目を並べて比べることを勧める。上の表は不透明表示を基準にした評価で、半透明表示を基準にした場合の扱いは §15.7 と 09 Q-D1 にまとめた。

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
| Inkdrop の各面の適用先（§5.2）と状態色の構造（§5.3） | STATIC → **VERIFIED**（§14.4、32 項目一致） |
| Inkdrop の CodeMirror 外枠の適用先（§6） | STATIC → **VERIFIED**（§14.5） |
| Inkdrop のレイアウトが横並びの兄弟で、面が重ならないこと | STATIC → **VERIFIED**（§14.4 の DOM 階層） |
| x64 版の Inkdrop が arm64 版と同じ CSS を持つこと | INFERRED（実機の x64 版の Computed Style は arm64 版の静的予測と一致した） |
| Inkdrop の基準スクリーンショット（不透明表示） | **VERIFIED**（§14.3） |
| macOS の既定が acrylic（半透明）であることと、そのときの Computed Style | **VERIFIED**（§14.4） |
| acrylic 表示の実際の見え方（スクリーンショット） | **VERIFIED**（§15。制御した背景ウィンドウの前で撮影。§14.8 の時点では BLOCKED） |
| acrylic 表示で、背後のウィンドウの柄とフォーカスの有無が合成結果を変えないこと | **VERIFIED**（§15.4、この環境） |
| acrylic 表示が壁紙（デスクトップ画像）の影響を受けるか | 未確認（§15.8） |
| Inkdrop のオーバーレイ（メニュー、モーダル、ポップアップ） | 未実施（§14.8、V-33） |
| Obsidian の translucent の仕組み、translucent 時の CSS の優先関係、Inkdrop の acrylic 宣言値を当てた合成結果 | **VERIFIED**（V-04、Obsidian 1.14.4。[12](12-obsidian-translucency-validation.md)） |

---

## 12. Phase 2 の設計判断に進むための条件

1. **Q-D1 の判断材料**: Obsidian 側の技術的な実現性は揃った（§8・§9）。各方式が成立するかどうかは実測で確認済みで、残るのは「どの面にどの色を当てるか」というデザイン判断である。
2. **（2026-10-10 更新）比較基準**: Inkdrop の実機スクリーンショット（不透明表示）と、面の構造・実際の適用色が揃った（§14）。Inkdrop の実際の見え方と Obsidian の各方式を並べて比較できる。新たに、macOS の既定が半透明表示であること（09 Q-D22）と、アクティブ行・ガターが既定で表示されないこと（09 Q-D23）が判断事項に加わった。半透明表示の実際の見え方も V-32 で揃い（§15）、Q-D22 の (a) 不透明 / (b) 半透明 / (c) 両方の比較材料がそろった。
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

---

## 14. Inkdrop の実機検証（再開、2026-10-10）

ユーザーが Inkdrop をインストールしてサインインしたため、V-30・V-20・V-22 を実機で検証した。

### 14.1 環境と手順

| 項目 | 値 |
|---|---|
| Inkdrop | **6.1.5**（x86_64、`/Applications/Inkdrop.app`）。静的解析した配布物と同じ版 |
| テーマ | Solarized Dark **2.2.1**、Kanagawa Dragon **1.2.1**（`inkdrop.packages` が報告した版）。調査で解析したコミット（`solarized-dark@4337f6e`、`kanagawa@f9c14a5 packages/dragon`）の `package.json`・`palette.json`・`styles/` を `packages/` に置いて読み込んだ（ユーザーの承認による。ipm の CLI は未インストールで、本体のレンダラー側にインストール API はない） |
| 元の状態（復元用に記録） | テーマ `default-dark`、`core.mainWindow.acrylicEnabled` は `true`、`editor.lineNumbers` と `editor.styleActiveLine` は `false`、パッケージは markdown-emoji / math / mermaid、開いているノートなし |
| 接続 | ユーザーの承認を得て Inkdrop を通常終了し、`--remote-debugging-port=9334 --remote-debugging-address=127.0.0.1` で再起動。待ち受けは `127.0.0.1:9334` だけ（`lsof` で確認） |
| 検証データ | ユーザーの承認を得て、検証用ノートブック「Theme Validation (Phase 2B)」とノート「Sample note」（Obsidian の検証と同じ本文、frontmatter を除く）を 1 件ずつ作成し、検証後に削除した |
| 撮影範囲 | サイドバーを検証用ノートブックのワークスペース（`actions.sidebar.showWorkspace`）に絞り、他のノートブック・タグ・ノートが写らないようにした。全スクリーンショットを目視で確認した |
| 表示 | CDP の `Emulation.setDeviceMetricsOverride` で 1024×800 CSS px、`deviceScaleFactor` 1（画像は 1024×800 px）。Obsidian の画像（2048×1600、倍率 2）とは倍率が違う |
| 区分 | 以下の Computed Style・DOM・スクリーンショットはすべて **VERIFIED**（Inkdrop 6.1.5 実機） |

先に、専用の `--user-data-dir` で隔離インスタンスを試したが、ログイン画面で止まった（認証情報は入力していない）。そのため、ユーザーのインスタンスで検証した。

### 14.2 復元（VERIFIED）

- テスト用ノートとノートブックは、作成時に記録した ID と名前の両方が一致することを確かめてから削除した（`db.notes.remove`、`db.books.remove`）。作成と削除はアカウントに同期されるため、同期の履歴には残る。
- テーマは `default-dark`、acrylic は `true`、行番号とアクティブ行の強調は `false` に戻した。
- 2 つのテーマパッケージは unload したうえで `packages/` から取り除いた（リポジトリ外の作業領域へ移動）。パッケージ一覧は作業前と同一。
- `config.json` は、途中の再起動で `lastNavigationState`（削除したテスト用ノートを指していた）とウィンドウ位置が書き込まれていたため、Inkdrop を終了してから作業前の控えを書き戻した。作業前のファイルとバイト単位で一致し、通常起動後も変化しないことを確認した。
- Inkdrop はリモートデバッグなしで通常起動し、ポート 9334 が閉じていることを確認した。

### 14.3 V-30: 基準スクリーンショット（VERIFIED、不透明表示）

| 状態 | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| 1. 既定（エディタにフォーカス、選択なし。行番号・アクティブ行は Inkdrop 既定の無効） | `inkdrop/sd-1-default.png` | `inkdrop/kd-1-default.png` |
| 2. ノートリストにフォーカス（選択項目の左 5px バー） | `inkdrop/sd-2-notelist-focus.png` | `inkdrop/kd-2-notelist-focus.png` |
| 3. サイドバーのステータス行「Active」を hover | `inkdrop/sd-3-sidebar-hover.png` | `inkdrop/kd-3-sidebar-hover.png` |
| 4. エディタ（行番号とアクティブ行を一時的に有効化、「bold」を選択） | `inkdrop/sd-4-editor-selection.png` | `inkdrop/kd-4-editor-selection.png` |
| 5. プレビュー | `inkdrop/sd-5-preview.png` | `inkdrop/kd-5-preview.png` |

各画像に対応する Computed Style は `measurements/inkdrop-<sd|kd>-<状態>.json`。KD の状態 2 と 3 の画像は同一（hover で画素が変わらなかった）。

macOS 既定の半透明（acrylic）表示のスクリーンショットは取得できなかった。CDP のスクリーンショットは透過部分にデスクトップが合成されないため使えない。macOS の画面キャプチャを試したところ、システムの権限確認ダイアログが重なって写ったので、そこで中止した（その 1 枚はコミットしていない）。→ V-32 として §15 で取得した。

### 14.4 V-20: 背景面と状態色（VERIFIED）

**DOM 階層**（両テーマ共通）:

```
body.dark-mode.platform-darwin.theme-<name>[.acrylic-window]
└─ div#app-container                         背景 --page-background
   └─ div.main-layout.main-layout-full
      ├─ div.sidebar-layout (x 0, 幅 200)     └ .sidebar-layout-content       背景 --sidebar-background
      ├─ div.note-list-bar-layout (x 200, 幅 300) └ .note-list-bar-layout-content 背景 --note-list-bar-background
      ├─ div.editor-layout (x 500, 幅 524)    背景 --editor-background
      │  ├─ .editor-title-bar-layout          背景 --header-note-menu-background（透明）
      │  └─ .mde-layout > .editor > .mde > .cm-editor  背景 --editor-background-color
      │     （プレビュー時は .mde-preview-container > .mde-preview。背景は透明）
      └─ div.modal-layout (幅 0)
```

3 つの面は `.main-layout` の直下に横に並ぶ兄弟で、重ならない。静的解析（§5.2）の推定どおりだった。

**静的予測との照合**: 32 項目すべてが一致した（1/255 以内、`measurements/inkdrop-static-vs-runtime.csv`、`tools/compare-inkdrop.py`）。主な値（不透明表示）:

| 面 | Solarized Dark（Computed） | Kanagawa Dragon（Computed） |
|---|---|---|
| ページ `#app-container` | `rgb(0, 20, 26)` | `rgb(13, 12, 12)` |
| サイドバー | `rgb(7, 53, 65)`、右線 `1px solid rgb(0, 45, 56)` | `rgb(17, 17, 14)`、右線 `1px solid rgb(39, 38, 38)` |
| ノートリスト | `rgb(0, 45, 56)`、右線 `1px solid rgb(7, 53, 65)` | `rgb(24, 22, 22)`、右線 `1px solid rgba(39, 38, 38, 0.75)` |
| エディタ外枠 / `.cm-editor` | `rgb(0, 33, 41)` / `rgb(0, 33, 41)` | `rgb(30, 29, 26)` / `rgb(30, 29, 26)` |
| ノート上部のメニュー、プレビュー | 透明（エディタ外枠の色が見える） | 透明 |

ページ背景は、不透明表示では 3 つの面に覆われて見えない（各面が `#app-container` の全域を覆う）。

KD のエディタ背景の宣言 `hsl(45deg 7% 11%)` は、Chromium の計算値で `rgb(30, 29, 26)`（`#1e1d1a`）になった。HEX コメントの `#1D1C19` ではない（Q-D2 の前提を実機で確認）。

**状態色**:

| 要素 | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| サイドバーの選択行の塗り（`--sidebar-menu-item-inactive-background`） | `rgba(71, 173, 245, 0.2)` | `rgba(140, 165, 177, 0.2)` |
| サイドバーの選択行の左 5px バー | サイドバーにフォーカスがないため透明（`rgba(0, 0, 0, 0) 5px 0 0 0 inset`） | 同左 |
| ノートリストの選択項目の塗り（`--note-list-view-item-selected-background`） | `rgba(39, 139, 211, 0.2)`。フォーカスの有無で変わらない | `rgba(34, 50, 73, 0.7)` |
| ノートリストにフォーカスしたときの左 5px バー（`--note-list-view-item-active-background`） | `rgba(39, 139, 211, 0.4) 5px 0 0 0 inset` | `rgba(45, 79, 103, 0.8) 5px 0 0 0 inset` |
| サイドバーの行の hover | 背景は透明のまま（変化なし） | 背景は透明のまま。画素も変化なし |

`*-active-background` が塗りではなくフォーカス時の左 5px バーであること（§5.3 の静的解析）は、実機で確認できた。

**macOS 既定の半透明（acrylic）表示**（VERIFIED、Computed Style のみ）:

- Inkdrop 6.1.5 の既定設定は `acrylicEnabled: !!Mo()`（本体 JS、プラットフォーム判定）で、ユーザー環境も `true` だった。**macOS で Inkdrop を使う人が普段見ているのは半透明の表示である**。
- このとき `body.acrylic-window` が付き、テーマの acrylic 用の規則が効く。

| 面 | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| ページ | 透明 | 透明 |
| サイドバー | `rgba(0, 45, 56, 0.5)`（base03 の 50%。不透明時の base02 とは別の色） | `rgba(17, 17, 14, 0.5)` |
| ノートリスト | `rgba(0, 33, 41, 0.7)`（neutral-900 の 70%。不透明時の base03 とは別の色） | `rgba(24, 22, 22, 0.7)` |
| エディタ外枠 / `.cm-editor` | `rgba(0, 33, 41, 0.9)` / 透明 | `rgba(30, 29, 26, 0.9)` / 透明 |

記録: `measurements/inkdrop-sd-acrylic.json`、`measurements/inkdrop-kd-acrylic.json`。実際の見え方は、背後のデスクトップとぼかしの合成で決まり、Computed Style からは決まらない。

### 14.5 V-22: エディタ（VERIFIED）

| 要素 | Solarized Dark | Kanagawa Dragon | 備考 |
|---|---|---|---|
| 前景 | `rgb(131, 148, 149)` | `rgb(197, 201, 197)` | `.cm-editor` の color |
| キャレット | `.cm-cursor` の `border-left: 2px solid rgb(159, 171, 173)` | `2px solid rgb(197, 201, 197)` | `.cm-content` の `caret-color` は透明で、CodeMirror の描画カーソルを使う |
| 選択（フォーカス時） | `.cm-selectionBackground` が `rgba(39, 139, 211, 0.3)` | `rgb(34, 50, 73)` | |
| アクティブ行 / そのガター | `rgba(0, 45, 56, 0.5)` | `rgba(39, 38, 38, 0.3)` | `editor.styleActiveLine` が有効なときだけ存在する。**Inkdrop の既定は無効** |
| ガター | 文字 `rgb(88, 110, 116)`、背景透明、右線なし | 文字 `rgb(98, 94, 91)`、右線 `1px solid rgb(39, 38, 38)` | `editor.lineNumbers` が有効なときだけ存在する。**Inkdrop の既定は無効** |

Inkdrop 6.1.5 の既定のエディタ設定は `lineNumbers: false`、`styleActiveLine: false` である（本体 JS の既定値、ユーザー設定も同じ）。既定の見た目には、ガターもアクティブ行の強調もない。

### 14.6 静的解析との差（訂正と追加）

| 事項 | 静的解析（§5・§6、Phase 1） | 実機 | 区分 |
|---|---|---|---|
| 各面の色・境界線・選択状態 | 宣言値を予測 | 32 項目すべて一致 | 一致 |
| DOM 階層（横並びの兄弟） | 推定 | 確認 | 一致 |
| `*-active-background` は左 5px バー | 推定 | 確認 | 一致 |
| macOS での既定の表示 | 不透明を前提に分析していた。acrylic は条件付きの上書きとして扱った | **macOS の既定は acrylic（半透明）**。サイドバーとノートリストは、不透明時とは別の色（SD は base03 と neutral-900）の半透明になる | **訂正** |
| アクティブ行・ガター | テーマの変数として分析 | Inkdrop の既定では**表示されない**（設定で有効にしたときだけ） | **追加** |
| サイドバーの hover | 配色は未特定 | 背景の変化なし | **追加** |
| KD エディタ背景の計算値 | `#1e1d1a`（計算） | `rgb(30, 29, 26)` | 一致 |

### 14.7 Q-D1 の判断に関係する新しい発見

1. **比較の基準になる Inkdrop の見た目が 2 つある**: 不透明表示（テーマの基本の配色）と、macOS 既定の半透明表示。Obsidian にも半透明（`.is-translucent`）があるが、既定は無効である。どちらを忠実度の基準にするかは、新しい判断事項（09 Q-D22）。
2. **3 つの面は横並びで重ならず、明度の順は不透明時に SD: サイドバー > ノートリスト > エディタ、KD: エディタ > ノートリスト > サイドバー**（実測値で確認）。半透明時は SD の宣言色の組み合わせが変わる（サイドバー base03 の 50%、ノートリスト neutral-900 の 70%、エディタ neutral-900 の 90%）。合成後の明度の順は §15.4 で実測した（SD は順序を保ち差が縮む、KD は順序が崩れてほぼ平坦）。
3. **選択状態は「塗り」と「フォーカス時の左 5px バー」の 2 層**。Obsidian の File Explorer で再現するなら、`--nav-item-background-active` などの塗りに加えて、`box-shadow: inset 5px 0 0 …` をフォーカス時に重ねる必要がある（直接セレクタ）。
4. **アクティブ行とガターは Inkdrop の既定では表示されない**。Obsidian 側で既定でどう扱うかは判断事項（09 Q-D23）。

### 14.8 残る未確認事項

- acrylic 表示の実際の見え方（スクリーンショット）。macOS の画面収録の権限がある状態で、ウィンドウキャプチャを撮る必要がある。→ **§15（V-32）で解消**。
- サイドバー以外の hover（ノートリストの未選択項目、ボタン類）。検証用ノートが 1 件だけで、未選択のノート項目がなかった。
- メニュー、モーダル、コマンドパレット、ポップアップなどのオーバーレイ（今回は撮影していない）。
- 撮影時のウィンドウは CDP のエミュレーションで 1024×800 にした。実ウィンドウ（1200×700、倍率 2）での見え方とは、レイアウト幅と倍率が異なる。→ §15 では実ウィンドウ 1200×700 pt・倍率 2 で撮影した（ただし acrylic の検証が目的で、状態は既定・プレビュー・非アクティブだけ）。

---

## 15. Inkdrop の半透明（acrylic）表示の実機検証（V-32、2026-10-10）

§14.8 で残った「macOS 既定の半透明表示の実際の見え方」を、ネイティブの画面キャプチャで確認した。本節の区分は、Computed Style・DOM・スクリーンショット・画素の計測値が **VERIFIED**（Inkdrop 6.1.5 実機）、Inkdrop 本体のウィンドウ設定が **STATIC**（`app.asar` の読み取り）、合成の仕組みの解釈が **INFERRED** である。

### 15.1 環境と撮影条件

| 項目 | 値 |
|---|---|
| Inkdrop | 6.1.5（x86_64） |
| テーマ | Solarized Dark 2.2.1、Kanagawa Dragon 1.2.1。V-32 の開始時点で、ユーザー環境の `packages/` に両テーマがインストール済みだったので、それを使った（追加・削除はしていない） |
| macOS | 26.5.2（build 25F84）、Intel、外観ダーク、「透明度を下げる」は無効（`reduceTransparency = 0`、読み取りのみ。設定は変えていない） |
| ディスプレイ | 内蔵、2048×1280 pt、倍率 2、カラープロファイル「Color LCD」 |
| ウィンドウ | 1200×700 pt、位置 (400, 250)（画面左上原点）。`inkdrop.window.setSize` / `setPosition` で固定（`tools/inkdrop-window-geometry.js`） |
| 背景 | ウィンドウの真後ろに、検証用の枠なしウィンドウ（`tools/backdrop.swift`、1400×900 pt、位置 (300, 150)、通常ウィンドウより 1 段下のレベル）を置いた。`gray` は sRGB (128, 128, 128) の一様な灰色、`pattern` は 100 pt 幅の縦縞（白・黒・赤・緑・青・黄）。壁紙は変えていない（変更にはユーザーの承認が要るため） |
| 撮影方法 | `/usr/sbin/screencapture -x -R400,250,1200,700`（ウィンドウサーバーの合成結果、ディスプレイの色空間）。2400×1400 px。CDP の `Page.captureScreenshot` は使っていない |
| 表示内容 | 検証用ノートブック「Theme Validation (Phase 2B)」のワークスペースと「Sample note」（§14 と同じ本文）。行番号とアクティブ行の強調は Inkdrop 既定の無効 |
| 状態 | `editor`: エディタ表示、エディタにフォーカス。`preview`: プレビュー表示。`active`: Inkdrop が前面でアクティブ。`inactive`: 背景ウィンドウのアプリをアクティブにして Inkdrop を非アクティブにした（Inkdrop は前面のまま） |
| acrylic / 不透明 | `core.mainWindow.acrylicEnabled` を `true` / `false` にして、それぞれ Inkdrop を再起動して撮影（設定の反映に再起動が必要） |
| Computed Style | 各撮影の直前と直後に `tools/probe-inkdrop.js` で取得し、`body.is-blurred` の有無でフォーカス状態を確認した（`active` は直前・直後とも無し、`inactive` は直前・直後とも有り） |
| 手順 | `tools/inkdrop-v32-capture.sh`（テーマ切り替え → 状態の設定 → 位置の固定 → 背景ウィンドウ → 撮影 → 測定） |

すべての画像を目視で確認し、検証用のノートブックとノート以外（個人のノート、ノートブック、タグ、アカウント情報、壁紙、他のアプリ）が写っていないことを確かめた。画像は加工していない（切り抜き・色補正なし）。

### 15.2 撮影一覧

| ファイル（`evidence/phase2-p0/inkdrop/`） | テーマ | 表示 | 背景 | 状態 | 撮影時刻（UTC） |
|---|---|---|---|---|---|
| `sd-v32-acrylic-gray-editor-active.png` | SD | acrylic | gray | editor・active | 03:16:07 |
| `sd-v32-acrylic-pattern-editor-active.png` | SD | acrylic | pattern | editor・active | 03:16:15 |
| `sd-v32-acrylic-gray-preview-active.png` | SD | acrylic | gray | preview・active | 03:16:22 |
| `sd-v32-acrylic-gray-editor-inactive.png` | SD | acrylic | gray | editor・inactive | 03:16:30 |
| `sd-v32-opaque-gray-editor-active.png` | SD | 不透明 | gray | editor・active | 03:20:01 |
| `sd-v32-opaque-pattern-editor-active.png` | SD | 不透明 | pattern | editor・active | 03:20:08 |
| `kd-v32-acrylic-gray-editor-active.png` | KD | acrylic | gray | editor・active | 03:16:38 |
| `kd-v32-acrylic-pattern-editor-active.png` | KD | acrylic | pattern | editor・active | 03:16:46 |
| `kd-v32-acrylic-gray-preview-active.png` | KD | acrylic | gray | preview・active | 03:16:53 |
| `kd-v32-acrylic-gray-editor-inactive.png` | KD | acrylic | gray | editor・inactive | 03:17:02 |
| `kd-v32-opaque-gray-editor-active.png` | KD | 不透明 | gray | editor・active | 03:20:17 |
| `kd-v32-opaque-pattern-editor-active.png` | KD | 不透明 | pattern | editor・active | 03:20:24 |

各画像のメタデータ（撮影方法、時刻、画素数、SHA-256、ウィンドウと背景の矩形、フォーカス）と撮影直前・直後の Computed Style は `measurements/inkdrop-<ファイル名>.json`。SHA-256 の一覧は [`evidence/phase2-p0/README.md`](evidence/phase2-p0/README.md) にもある。

### 15.3 Computed Style（VERIFIED、実ウィンドウ）

§14.4 の値（CDP のエミュレーション時）と同じだった。フォーカスの有無（`is-blurred`）とプレビュー表示で、各面の背景の計算値は変わらなかった。

| 面 | SD acrylic | SD 不透明 | KD acrylic | KD 不透明 |
|---|---|---|---|---|
| ページ `#app-container` | `rgba(0, 0, 0, 0)` | `rgb(0, 20, 26)` | `rgba(0, 0, 0, 0)` | `rgb(13, 12, 12)` |
| サイドバー | `rgba(0, 45, 56, 0.5)` | `rgb(7, 53, 65)` | `rgba(17, 17, 14, 0.5)` | `rgb(17, 17, 14)` |
| ノートリスト | `rgba(0, 33, 41, 0.7)` | `rgb(0, 45, 56)` | `rgba(24, 22, 22, 0.7)` | `rgb(24, 22, 22)` |
| エディタ外枠 | `rgba(0, 33, 41, 0.9)` | `rgb(0, 33, 41)` | `rgba(30, 29, 26, 0.9)` | `rgb(30, 29, 26)` |
| プレビュー `.mde-preview` | 透明 | 透明 | 透明 | 透明 |

### 15.4 合成結果の画素（VERIFIED、スクリーンショットの計測値）

**以下はディスプレイの色空間で合成された画素値であり、CSS の色の値ではない。** 文字や部品のない背景だけの矩形（ウィンドウ内の pt 座標、サイドバー (20, 470, 130, 160)、ノートリスト (220, 300, 260, 380)、エディタ (600, 640, 550, 50)）の平均を `tools/sample-pixels.py` で求めた（全件は `measurements/inkdrop-v32-pixel-samples.csv`）。相対輝度は、画素値を sRGB とみなして計算した参考値である。

| 条件 | サイドバー | ノートリスト | エディタ | 相対輝度の順 |
|---|---|---|---|---|
| SD 不透明（gray / pattern 同値） | (8, 53, 64) | (1, 45, 56) | (1, 33, 41) | サイドバー 0.0297 > ノートリスト 0.0217 > エディタ 0.0125 |
| SD acrylic（gray / pattern / preview / inactive） | (22.5, 43.8, 48.5) | (13.3, 35.8, 40.8) | (5.4, 33.3, 41.3) | サイドバー 0.0218 > ノートリスト 0.0150 > エディタ 0.0130 |
| KD 不透明（gray / pattern 同値） | (16, 16, 14) | (24, 22, 22) | (30, 29, 26) | サイドバー 0.0051 < ノートリスト 0.0083 < エディタ 0.0123 |
| KD acrylic（gray / pattern / preview / inactive） | (30.1, 29.2, 28.2) | (30.3, 27.8, 27.9) | (31.4, 30.4, 28.4) | ノートリスト 0.0118 < サイドバー 0.0125 < エディタ 0.0133 |

- 不透明表示の画素は、Computed Style とほぼ同じ値だった（差は各成分 1 以内）。
- acrylic 表示の各面は、標準偏差 0.4〜0.6 程度のわずかな揺らぎ（ノイズ状）を含む。不透明表示は揺らぎがない（標準偏差 0）。
- acrylic 表示のサイドバーとノートリストの平均値は、背景が gray でも pattern でも、エディタ表示でもプレビュー表示でも、アクティブでも非アクティブでも、小数第 1 位まで一致した。エディタ領域だけ、pattern のとき標準偏差が 0.8 程度に増えた（平均値の差は 0.2 以内）。

**問いへの回答**:

1. **3 ペインの見分け方**: acrylic でも 3 つの面は区別できる。ただし不透明時より差が小さく、面の色の差よりも、面の境界線、選択項目の塗り、文字の配置で区切りが分かる程度になる（特に KD）。
2. **SD のサイドバーとノートリスト**: 不透明時は青緑がはっきりした面（(8, 53, 64)、(1, 45, 56)）。acrylic では、サイドバーは灰色が混ざって彩度が下がった明るめの面（(22.5, 43.8, 48.5)）、ノートリストはやや暗い青緑（(13.3, 35.8, 40.8)）になる。エディタはほぼ不透明時と同じ（(5.4, 33.3, 41.3)）。明度の順（サイドバー > ノートリスト > エディタ）は保たれるが、ノートリストとエディタの差は小さい。
3. **KD の明度の順**: 不透明時の「サイドバー < ノートリスト < エディタ」は、acrylic では**保たれない**。3 面はほぼ同じ明るさ（各成分 28〜31）に揃い、ノートリストがわずかに最も暗い。不透明時の奥行き（左ほど暗い）は acrylic ではほぼ消える。
4. **背景の影響**: この環境では、背後のウィンドウ（一様な灰色と高コントラストの縦縞）による差は検出できなかった。背後が透けて見えたり、縞がぼけて現れたりすることはなかった。壁紙（デスクトップ画像）の影響は確認していない（§15.8）。
5. **フォーカスの影響**: アクティブと非アクティブで、各面の画素は同じだった。違いは信号機ボタンの色など、ウィンドウの部品だけ。Inkdrop 本体がウィンドウを `visualEffectState: 'active'`（常にアクティブの見た目）で作っていること（§15.5）と整合する。

### 15.5 Inkdrop 本体のウィンドウ設定（STATIC、`app.asar` の読み取り）

Inkdrop 6.1.5 の本体 JS は、`acrylicEnabled` が真のとき、Electron の `BrowserWindow` を次のように作る。

- macOS: `transparent: true`、`backgroundColor: '#00000000'`、`vibrancy: 'under-window'`。全ウィンドウ共通で `visualEffectState: 'active'`。
- Windows 11 以降: `backgroundColor: '#00000000'`、`backgroundMaterial: 'acrylic'`。
- 無効のときは `backgroundColor` がダークなら `#000000`。

つまり macOS の acrylic は、Electron の vibrancy（macOS の視覚効果マテリアル `under-window`）の上に、テーマの半透明の面を重ねたものである。

### 15.6 合成の簡単なモデル（INFERRED）

「画素 = α × 面の色 + (1 − α) × M」（ガンマ補正後の値のまま線形に混ぜる単純なモデル）で、下地 M を逆算すると、α が 0.5 と 0.7 の面（サイドバー、ノートリスト）では両テーマとも M ≈ (43〜45, 41〜43, 40〜42) になった。α = 0.9 のエディタは誤差の影響が大きく、M を安定して求められない。

このことから、**この環境では、Inkdrop の acrylic は「テーマに依存しない、ほぼ一定の暗い灰色（ディスプレイ値で約 rgb(44, 42, 41)）の下地に、半透明の面を重ねた見た目」に近い**と推測する。ただし、これは 1 台の Mac・1 つの壁紙・1 つの macOS 版での観察に基づく近似で、マテリアルの色やぼかしの仕様を確かめたものではない。macOS の版、外観、壁紙、「透明度を下げる」の設定で変わる可能性がある。

### 15.7 Q-D22・Q-D1 への影響（判断は確定しない）

- **Q-D22**: 「半透明表示を基準にする」ことは、少なくともこの環境では「背後が透ける見た目」ではなく、「各面の色が一定の灰色に寄り、面の差が縮んだ見た目」を基準にすることを意味する。この見た目は、Obsidian の半透明（translucent）を使わなくても、不透明な色で近似できる可能性がある（例えば上の画素値を面の色に使う）。一方、Obsidian の translucent を使えば、macOS のマテリアルとの合成そのものを再現できる可能性があるが、Obsidian が使うマテリアルの種類と、テーマが半透明の面を描けるかは未確認である（下の「Obsidian 側で将来必要な検証」）。→ V-04（12）で確認した。選択肢の比較は 09 Q-D22 にまとめた。
- **Q-D1**: 不透明表示を基準にするなら、11 §9 の評価（面の明度の段の再現）がそのまま使える。半透明表示を基準にするなら、KD では 3 面の明度差がほぼないため、「どの面にどの色を当てるか」の重要度が下がり、境界線と選択色で区切る設計に近くなる。SD は順序が保たれるので、不透明時と同じ割り当ての考え方が使える。詳細は 09 Q-D1。

**Obsidian 側で将来必要な検証**（本タスクでは実施していない。分析のみ。→ 1〜3 は V-04 として [12](12-obsidian-translucency-validation.md) で実施した。Obsidian は `setVibrancy("sidebar")` を使い、テーマは `.workspace-leaf-content` などの層に半透明の面を描ける）:

1. Obsidian の translucent 有効時に、Electron の `BrowserWindow` がどの vibrancy（マテリアル）を使うか。Inkdrop の `under-window` と同じか。
2. translucent 有効時、テーマ CSS で各面に半透明の背景（例: `rgba(0, 45, 56, 0.5)`）を置けるか。06 W11・V-04 のとおり、Obsidian は translucent 時に各面を `transparent !important` にするため、上書きの可否と方法を実測する必要がある。
3. 同じ条件（同じ背景ウィンドウ、同じ位置、ネイティブキャプチャ）で Obsidian を撮影し、画素を §15.4 と比べる。背後のウィンドウ・フォーカスの有無で見た目が変わるかも確認する。
4. translucent はデスクトップの機能であり、モバイル（Q-D10）では使えない見込み（INFERRED）。モバイルでは不透明の配色が必要になる。
5. Windows（`backgroundMaterial: 'acrylic'`）は Inkdrop と Obsidian の両方で未確認。

### 15.8 未確認事項

- 壁紙（デスクトップ画像）を変えたときの合成結果。ユーザーの承認なしに壁紙を変えないため、変えていない。
- 「透明度を下げる」を有効にしたとき。システム全体の設定のため、変えていない。
- ライト外観、他の macOS 版、Apple Silicon、外部ディスプレイ。
- Windows 11 の `backgroundMaterial: 'acrylic'` の見え方。
- オーバーレイ（メニュー、モーダル、コマンドパレット）と hover（V-33）。
- 合成の仕組み（§15.6）は推測で、macOS のマテリアルの仕様は確認していない。

### 15.9 復元（VERIFIED）

- 検証用ノートとノートブック（V-32 用に作成）は、作成時に記録した ID と名前の両方が一致することを確かめてから削除した（同期の履歴には残る）。
- テーマは `default-dark`、acrylic は `true`、行番号とアクティブ行の強調は `false` に戻した。
- インストール済みのテーマパッケージ（V-32 の開始前からあったもの）は残した。パッケージ一覧は作業前と同一。
- Inkdrop を終了してから `config.json` を作業前の控えと比べた。差分は検証で書き込まれた `lastNavigationState`（削除したテスト用ノートを指す）と `mainWindow` の位置・サイズだけだったので、控えを書き戻した。バイト単位で一致し、通常起動後も変化しないことを確認した。
- Inkdrop はリモートデバッグなしで通常起動し、ポート 9334 が閉じていることを確認した。背景ウィンドウのプロセスは残っていない。
- macOS の画面収録の権限は、ユーザーが事前に許可済みだったものを使った。この作業で新たに権限を付与・変更していない。壁紙・「透明度を下げる」などのシステム設定も変えていない。

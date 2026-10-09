# 06. Inkdrop ↔ Obsidian UI マッピング候補

- 調査日: 2026-10-09
- 段階: Phase 1。**最終的な配色仕様ではなく、移植のための対応候補**である。採否は Phase 2 で決める。
- 入力資料
  - Inkdrop 側: [01](01-inkdrop-theme-system.md)（基盤トークンと UI 領域の対応）、[02](02-inkdrop-theme-analysis.md)（対象 2 テーマの解決値）
  - Obsidian 側: [03](03-obsidian-theme-system.md)（仕様と詳細度）、[05](05-obsidian-ui-inventory.md)（UI 棚卸し）
- 機械可読版: [`data/mapping-candidates.csv`](data/mapping-candidates.csv)（97 行）
  - 列: `id, area, obsidian_element, inkdrop_candidate, classification, inkdrop_tokens, obsidian_vars_or_selectors, rationale, confidence, solarized_dark_values, kanagawa_dragon_values, theme_divergence, sources, live_verification`
  - `solarized_dark_values` / `kanagawa_dragon_values` は、02 の解決済みトークン CSV から**スクリプトで機械的に引いた宣言値**である。手で転記していない。末尾の `[t]` はテーマ側の宣言、`[b]` は基盤（`@inkdropapp/css`）からの継承を表す。
  - 生成スクリプト: `scratchpad/scripts/gen_mapping.py`（リポジトリ外）。行の内容は人手で記述し、値の列だけを自動で埋めている。

---

## 1. 分類と判定基準

| 分類 | 定義 | 件数 |
|---|---|---|
| **Direct Analogue** | 両アプリに同等の役割を持つ UI がある | 49 |
| **Semantic Analogue** | 完全には一致しないが、役割や視覚的階層から類推できる | 32 |
| **Obsidian-native** | Inkdrop に適切な対応元がない | 16 |

確信度の内訳は High 37、Medium 47、Low 13 である。

判定の原則は次のとおり。

1. **色名や変数名の類似では対応付けない。** たとえば Inkdrop の `--header-text-color` は Semantic UI の見出しコンポーネント用で、アプリ上部のヘッダーバーではない（01 §5.2 補足 1）。Obsidian の `--nav-tag-*` も Tags view 用ではなく拡張子バッジ用である（05 Navigation）。
2. **視覚的な階層を優先する。** 背景は「どの面がどの面の上に乗っているか」「どれが最暗・最明か」で対応させる（02 §4 の明度順）。
3. **操作状態は意味で対応させる。** Inkdrop の `active` / `selected` と Obsidian の `active` / `selected` は語が同じでも意味が違う（N03・N04）。
4. **Inkdrop 側の消費箇所が非公開のトークンは確信度を下げる。** サイドバー、ノートリスト、エディタ外枠、ヘッダーメニュー、環境設定、通知の変数は、公開ソースに適用先のセレクタがない（01 §4.1・§9）。名前とコメントから推定した対応であり、Inkdrop 実機の DevTools で確認する必要がある。
5. **確信度の意味**
   - High: 役割が一致し、Inkdrop 側の適用先も公開ソースで確認できる。または Inkdrop に対応 UI がないことが明らか。
   - Medium: 役割は近いが、粒度の違い、状態の意味のずれ、Inkdrop 側の適用先が非公開、のいずれかがある。
   - Low: 類推の根拠が弱い。複数の候補があり、どれを採るかで見た目が大きく変わる。

---

## 2. 構造上の前提: 両アプリの画面構成の違い

| | Inkdrop（v6） | Obsidian（1.14） |
|---|---|---|
| 左端 | サイドバー（ノートブック、タグ、ステータス、同期状態） | Ribbon（アイコン列） + 左サイドドック（File Explorer、Search、Bookmarks 等をタブで切替） |
| 中央左 | ノートリスト（タイトル・抜粋・日付のカード列） | （なし。ノート一覧は File Explorer に統合） |
| 中央 | エディタ（ヘッダーメニュー + CodeMirror）、プレビュー | ワークスペース（タブ、View Header、Source / Live Preview / Reading） |
| 右 | エディタドロワー（推定） | 右サイドドック（Outline、Backlinks 等） |
| 下端 | なし | ステータスバー |

出典: 01 §5.2、05 Workspace。Inkdrop 側は変数名と公開ガイドからの把握で、画面の実測ではない。

この差から、次の 3 点が対応付けの中心的な難所になる。

- **File Explorer が Inkdrop の 2 ペイン（サイドバー + ノートリスト）の役割を 1 つで担う**（W03、N01〜N05）。
- **Obsidian の `--background-primary` はノート領域、Modal、Prompt、Popover、補完ポップアップが共有する**（05 注意点）。Inkdrop ではモーダル本文はエディタ面と同色（02 §4）なので整合するが、popup は異なる（G10）。
- **Obsidian はエディタと閲覧で同じ変数を使う箇所が多い**（`--link-color`、`--text-normal` など）。Inkdrop はエディタ（`--syntax-*` / `--md-*`）とプレビュー（`--mde-preview-*`）が別系統で、テーマによっては値が異なる（E01・E02・E14）。

---

## 3. テーマ間で対応が分かれる箇所

Solarized Dark（以下 SD）と Kanagawa Dragon（以下 KD）で、同じ Obsidian 要素に対して異なる判断が必要になりうる箇所を挙げる。値は `data/mapping-candidates.csv` の機械抽出値である。

| 論点 | SD | KD | 影響する行 |
|---|---|---|---|
| **背景の奥行き方向** | sidebar `#073541`（最明）> note-list `#002d38` > editor `#002129` > page `#00141a` | page `#0d0c0c` < sidebar `#11110e` < note-list `#181616` < editor `#1e1d1a`（最明） | W02, W03, W06 |
| 左サイドバーを Inkdrop の sidebar と note-list のどちらに合わせるか | sidebar を採ると Obsidian の左ペインが画面で最も明るくなる | どちらを採っても editor より暗い | W03 |
| リンク色 | preview / editor は cyan `#2aa298`、UI は blue `#278bd3` | preview は dragonGreen2 `#89997a`、editor と UI は dragonBlue2 `#8ca5b1` | E14, E15 |
| 本文色 | editor と preview が同値 `#839495` | editor `#c5c9c5`、preview `#c5c9c5` @90% | E01, E02 |
| 検索入力の背景 | editor 色 `#002129` | 最暗色 `#0d0c0c` | N08 |
| 基盤（Tailwind）色の漏れ | info / warning / secondary / focused-form / GFM important / purple が Tailwind 系 | タグ色、コードブロック枠、input error placeholder が Tailwind 系 | E20, E26, E30, G02, G17 |
| 状態色の作り方 | primary（blue）のアルファ段階（20% → 40%） | waveBlue1 / waveBlue2 の 2 色。hover = 同色、down / active = @85% | N03, N04, G13, G14 |

---

## 4. 対応候補表

凡例: 分類は Direct / Semantic / Obsidian-native。SD と KD の具体値は CSV の `solarized_dark_values` / `kanagawa_dragon_values` 列にある。「実画面検証」は、Inkdrop と Obsidian の実機で確認が必要かどうかを示す。`Q-Dn` は [09](09-open-questions.md) の判断事項番号である。

### Workspace

| ID | Obsidian の UI 要素 | Inkdrop の対応候補 | 分類 | Inkdrop の CSS 変数 | Obsidian の変数 / セレクタ | 対応付けの根拠 | 確信度 | SD / KD の差 | 根拠ソース | 実画面検証 |
|---|---|---|---|---|---|---|---|---|---|---|
| W01 | ウィンドウ最背面 / Hidden frame のタブバー兼タイトルバー | ページ背景（ウィンドウ地） | Semantic | `--page-background` | --titlebar-background, --titlebar-background-focused, --tab-container-background（.workspace-tabs.mod-top は titlebar 色を代入） | Inkdrop の page は最暗の地色で、各ペインの背後に来る。Obsidian で各ペインの背後にある面は titlebar / tab container。ただし Inkdrop の page が実際にどの DOM に塗られるかは非公開 CSS | Low | 両テーマとも page は最暗色（SD base04 / KD Black0）で傾向は同じ | 01 §5.2（page: 非公開）, 02 §4, 05 Workspace, app.css L4354-4357 | 要: Inkdrop 実機で page 背景の露出箇所を確認 |
| W02 | Ribbon（左端アイコン列） | なし（隣接するサイドバー or page を流用） | Obsidian-native | `--sidebar-background`<br>`--page-background` | --ribbon-background, --ribbon-background-collapsed | Inkdrop に縦アイコン列はない。配色は隣接面（左サイドバー or 地色）から決めるしかない | Low | SD はサイドバーが最も明るいため、ribbon をサイドバー色にすると左端が最明部になる。KD は最暗部側に揃う | 05 Workspace, 02 §4 | 要: 両案の見え方比較 |
| W03 | 左サイドバー（File Explorer 等を収めるサイドドック） | Inkdrop サイドバー（ノートブック / タグ）または ノートリスト | Semantic | `--sidebar-background`<br>`--note-list-bar-background` | --background-secondary（左右共通）。左だけ変えるなら .workspace-split.mod-left-split への直接セレクタ（app.js がサイドドックに mod-primary/secondary-split と mod-left/right-split を付与。RTL では left/right が反転） | Obsidian の File Explorer は Inkdrop の『サイドバー（ノートブック階層）』と『ノートリスト（ノート一覧）』の 2 役を 1 ペインで担う。どちらの面色を採るかで全体の明度構成が変わる | Medium | **SD と KD で結論が変わりうる**: SD は sidebar(base02 #073541) > note-list(base03) で sidebar が最明。KD は sidebar(Black1) < note-list(Black2) で最暗に近い | 01 §5.2, 02 §4・§13.3, 05 Workspace（L6912） | 要: 両案のモック比較（ユーザー判断 Q-D1） |
| W04 | 右サイドバー（Outline / Backlinks 等） | エディタドロワー（候補）/ なし | Semantic | `--editor-drawer-background`<br>`--editor-drawer-border-left` | --background-secondary（左右共通）、右だけなら .workspace-split.mod-right-split（app.js で付与を確認。DOM 上の実在は実機未確認） | Inkdrop のエディタ右側ドロワーは補助情報パネルという役割で近い。ただし drawer の実表示箇所は非公開 CSS で未確認 | Low | SD drawer は base03 @70%、KD は Black1 @70%（半透明） | 01 §5.2（drawer: 非公開）, 02 §4 | 要: Inkdrop のドロワー実画面確認 |
| W05 | ノート領域（エディタ背景） | エディタ背景 | Direct | `--editor-background`<br>`--editor-background-color` | --background-primary（Modal / Prompt / Popover / Canvas ノードと共有）、--color-base-00 | 両アプリとも本文編集面。役割が一致する | High | SD neutral-900 #002129（Osaka にない中間色）、KD dragonBlack3（HSL 宣言から #1e1d1a。上流 kanagawa.nvim の ui.bg #181616 ではない） | 01 §5.1, 02 §4・§12, 05 注意点 | 推奨: 他面への波及（modal 等）を実機確認 |
| W06 | ワークスペースタブ（メイン領域のノートタブ） | なし | Obsidian-native | `--editor-background`<br>`--note-list-bar-background` | --tab-background-active, --tab-text-color(-active/-focused-active), --tab-container-background, .workspace-tab-header::before/::after | Inkdrop メインウィンドウにノートタブは見当たらない（05 は推測と明記）。アクティブタブ = エディタ面、タブバー = 背後面、と Obsidian 既定の構造に従うのが自然 | Low | 機械比較: --editor-background: SD #002129 / KD #1e1d1a; --note-list-bar-background: SD #002d38 / KD #181616 | 05 Workspace（L7025-7050） | 要: Inkdrop にタブ相当 UI がないか確認 |
| W07 | View Header（ノート上部のパンくず・操作アイコン） | ノートヘッダーメニュー（header-note-menu） | Semantic | `--header-note-menu-background`<br>`--header-note-menu-color`<br>`--header-note-menu-action-item-active-background` | --background-primary（view-header）、--icon-color(-hover/-active)、.view-header | ノート上部の操作列という役割が一致。Inkdrop 側の背景は transparent（エディタ面に乗る） | Medium | 両テーマとも背景 transparent 系 | 01 §5.2（非公開）, 05 Workspace | 要: Inkdrop の header 実画面 |
| W08 | Inline title（本文先頭のノートタイトル） | エディタヘッダーのタイトル入力 | Semantic | `--editor-header-title-input-background`<br>`--text-color` | --inline-title-color, --inline-title-size, --inline-title-weight | ノートのタイトルを本文上部に表示する役割が同じ。Inkdrop のタイトル文字色・サイズのトークンは見当たらない | Medium | 機械比較: --text-color: SD #839495 / KD #c5c9c5e6 | 01 §5.2, 05 Editor | 要: Inkdrop タイトルの文字サイズ・色を実測 |
| W09 | ステータスバー | なし（近いのはサイドバー下部の同期状態表示） | Obsidian-native | `--sidebar-sync-status-view-background`<br>`--sidebar-sync-status-view-text-color` | --status-bar-background, --status-bar-text-color, --status-bar-border-color | Inkdrop に常設ステータスバーはない。情報の役割（状態表示）で同期状態表示が最も近い | Low | 機械比較: --sidebar-sync-status-view-background: SD #002d384c / KD #27262666; --sidebar-sync-status-view-text-color: SD #fdf6e299 / KD #c8c092b2 | 01 §5.2, 05 Workspace | 不要（設計判断） |
| W10 | 分割ペイン境界（divider） | サイドバー / ノートリストの右境界線 | Direct | `--sidebar-border-right`<br>`--note-list-bar-border-right` | --divider-color, --divider-width | ペイン間の区切り線という役割が一致 | Medium | SD: base03 / base02 の 1px。KD: Black4 / Black4@75% | 02 §10, 05 Workspace | 推奨 |
| W11 | 半透明ウィンドウ（macOS vibrancy） | acrylic-window 条件の半透明背景 | Direct | `--page-background`<br>`--sidebar-background` | body.is-translucent / .is-translucent:not(.is-fullscreen) と関連 3 変数 | OS 透過を前提とした背景差し替えという機能が一致。Inkdrop は :root:has(body.acrylic-window) で各面を半透明化 | Medium | 両テーマとも acrylic 時の上書きあり（SD ui.css:176-187, KD ui.css:557-568） | 01 §3.6, 02 §1.4, 03 §5 | 要: macOS 実機で透過度を比較 |

### Navigation

| ID | Obsidian の UI 要素 | Inkdrop の対応候補 | 分類 | Inkdrop の CSS 変数 | Obsidian の変数 / セレクタ | 対応付けの根拠 | 確信度 | SD / KD の差 | 根拠ソース | 実画面検証 |
|---|---|---|---|---|---|---|---|---|---|---|
| N01 | File Explorer のフォルダ項目 | サイドバーのノートブック項目 | Semantic | `--sidebar-menu-item-color`<br>`--sidebar-menu-active-item-color`<br>`--sidebar-menu-item-active-background` | --nav-item-color(-hover/-active), --nav-item-background-(hover/active), .nav-folder-title | 階層化されたコンテナ（ノートブック ≒ フォルダ）という役割が一致 | Medium | SD 項目色は fg #839495、KD は oldWhite @80% | 01 §5.2, 02 §5, 05 Navigation（L10734-10830） | 要: Inkdrop サイドバーの hover 表現 |
| N02 | File Explorer のノート項目 | ノートリスト項目（タイトル） | Semantic | `--note-list-view-item-header-color`<br>`--note-list-view-item-color` | --nav-item-color, .nav-file-title | 個々のノートを列挙する役割が一致。ただし Obsidian はタイトル 1 行、Inkdrop は 2〜3 行カード（抜粋・日付） | Medium | SD タイトル fg / 抜粋 base3@60%。KD タイトル dragonWhite / 抜粋 oldWhite@70% | 01 §5.2, 02 §5 | 要 |
| N03 | File Explorer: 開いているファイル（active） | ノートリスト active（フォーカス中の選択）または サイドバー active | Semantic | `--note-list-view-item-active-background`<br>`--sidebar-menu-item-active-background` | --nav-item-background-active, --nav-item-color-active | 『現在開いているノート』を示す状態。Inkdrop ではノートリストの選択がこれに当たるが、active / selected の意味（フォーカス有無）が Obsidian の active / selected（開いている / 複数選択）と一致しない | Medium | SD blue-500 @40%（list）/ blue-300 @30%（sidebar）。KD waveBlue2 @80%（list）/ waveBlue2 @60%（sidebar） | 02 §6.2, 05 Navigation | 要: 状態の対応を実機で確認 |
| N04 | File Explorer: 複数選択（selected） | ノートリスト selected（フォーカス外の選択） | Semantic | `--note-list-view-item-selected-background` | --nav-item-background-selected, --nav-item-color-selected | 選択の弱い段階として転用可能。意味は一致しない（Inkdrop は非フォーカス選択） | Low | SD blue-500 @20%、KD waveBlue1 @70% | 02 §6.2, 05 Navigation | 要 |
| N05 | File Explorer: hover | サイドバー inactive 背景 / メニュー hover（基盤既定の白アルファ） | Semantic | `--sidebar-menu-item-inactive-background`<br>`--menu-hover-item-background` | --nav-item-background-hover, --background-modifier-hover | Inkdrop のサイドバー hover 専用トークンは見当たらない。inactive-background が hover か非フォーカス選択かは非公開 CSS 次第 | Low | 両テーマとも menu hover は基盤既定 #ffffff05 | 01 §5.2, 02 §6.2 | 要: Inkdrop 実機で hover 色を観察 |
| N06 | ナビ見出し / セクション見出し（Vault 名・ブックマーク見出し等） | サイドバー節見出し | Semantic | `--sidebar-menu-section-color` | --nav-heading-color(-hover/-collapsed), .tree-item-self.mod-root | グループ見出しという役割が一致 | Medium | SD violet-600 系（unselected-text 経由）、KD dragonViolet @80% | 02 §5 | 推奨 |
| N07 | 折り畳みアイコン | なし（サイドバーの展開矢印は非公開） | Semantic | `--sidebar-menu-action-color` | --collapse-icon-color(-collapsed), --nav-collapse-icon-color | 展開・折り畳みのアイコン色。Inkdrop は action 色がアイコン類に当たると推定 | Low | 機械比較: --sidebar-menu-action-color: SD #fdf6e24c / KD #c5c9c54c | 01 §5.2 | 要 |
| N08 | Search ペインの入力欄 | ノート検索バー | Direct | `--note-search-bar-input-background`<br>`--input-background` | --background-modifier-form-field, --input-shadow, .search-input-container input | ノート検索の入力という役割が一致 | Medium | SD #002129、KD Black0（SD は editor 色、KD は最暗色と方針が異なる） | 02 §4 | 推奨 |
| N09 | Search 結果の一致箇所ハイライト | エディタ検索一致 | Semantic | `--editor-search-match-background-color`<br>`--highlight-background` | --text-highlight-bg / --highlight-background（.search-result-file-matched-text） | 検索語の一致を示す役割が近い | Medium | SD yellow @35%、KD waveBlue2 | 02 §8.1, 05 Editor | 推奨 |
| N10 | Bookmarks | なし（近い: ノートリストの pinned セクション） | Semantic | `--note-list-bar-pinned-section-header-background` | --nav-item-*（tree-item 共通） | ピン留め = 優先表示という役割が近いが UI 構造は異なる | Low | 機械比較: --note-list-bar-pinned-section-header-background: SD #002129 / KD #272626 | 01 §5.2, 05 Navigation | 不要 |
| N11 | Outline | 不明（Inkdrop の目次 UI のトークンは見当たらない） | Obsidian-native | — | --nav-item-*（tree-item 共通） | 公開 CSS に目次 UI のトークンがない。tree-item 共通の配色に従う | Low | —（比較できる Inkdrop トークンなし） | 05 Navigation | 要: Inkdrop に目次 UI があるか確認 |
| N12 | Backlinks / Outgoing links | なし | Obsidian-native | — | --nav-item-*, .search-result-* | Inkdrop にリンク逆引き UI はない | High | —（比較できる Inkdrop トークンなし） | 05 Navigation | 不要 |
| N13 | Tags view（タグペイン） | サイドバーのタグ一覧 | Semantic | `--sidebar-menu-item-color`<br>`--tag-default-text-color` | .tag-pane-tag（専用変数なし。--nav-item-* を流用） | タグによる絞り込み一覧という役割が一致。Inkdrop のタグはサイドバー項目 + 色付きピル | Medium | KD のタグ色は Tailwind 系のまま（02 §13.4） | 02 §13.4, 05 Navigation | 推奨 |

### Editor

| ID | Obsidian の UI 要素 | Inkdrop の対応候補 | 分類 | Inkdrop の CSS 変数 | Obsidian の変数 / セレクタ | 対応付けの根拠 | 確信度 | SD / KD の差 | 根拠ソース | 実画面検証 |
|---|---|---|---|---|---|---|---|---|---|---|
| E01 | 本文テキスト（編集時） | エディタ前景 | Direct | `--editor-foreground-color` | --text-normal（全 UI 共有）、--color-base-100 | 本文文字色。--text-normal は UI 全体の文字色でもあるため、Inkdrop の UI 文字色との差に注意 | High | SD #839495（UI text と同値）。KD editor #c5c9c5、UI --text-color は #c5c9c5 @90% で **わずかに異なる** | 02 §5・§8.1 | 推奨 |
| E02 | 本文テキスト（Reading View） | プレビュー本文 | Direct | `--text-color` | --text-normal（.markdown-rendered は同変数） | 本文文字色。Obsidian は編集・閲覧で同じ変数 | High | KD は編集と閲覧で値が異なる（上記）。どちらに寄せるかは判断事項 | 01 §4.3, 02 §5 | 推奨 |
| E03 | 弱い文字（muted / faint） | muted / light / disabled テキスト | Semantic | `--muted-text-color`<br>`--light-text-color`<br>`--disabled-text-color` | --text-muted, --text-faint | 階層の 2 段目・3 段目の文字。Inkdrop は段数が多い（dark/muted/light/unselected/hovered/...） | Medium | SD は base3（クリーム）のアルファになる（ランプ置換の副作用、02 §5）。KD は oldWhite / dragonGray3 | 02 §5 | 要: Solarized のクリーム系アルファを採るか判断（Q-D3） |
| E04 | キャレット | エディタキャレット | Direct | `--editor-caret-color` | --caret-color | 役割一致 | High | SD base0 #9fabad、KD dragonWhite | 02 §8.1 | 不要 |
| E05 | 選択範囲 | エディタ選択（非フォーカス / フォーカス）+ UI テキスト選択 | Direct | `--editor-selection-background`<br>`--editor-focused-selection-background`<br>`--highlight-background` | --text-selection（1 変数。フォーカス有無の区別なし）、.cm-selectionBackground, ::selection | 役割一致。ただし Obsidian は 1 変数で、Inkdrop の 2 段階を再現するには .cm-focused 等への直接セレクタが要る | High | SD base02 / blue-500 @30%。KD Black5 / waveBlue1 | 02 §8.1, 05 Editor（L3645-3659） | 推奨 |
| E06 | アクティブ行 | エディタのアクティブ行（本体 / ガター） | Direct | `--editor-active-line-background-color`<br>`--editor-active-line-gutter-background-color` | .cm-line.cm-active, .cm-gutterElement.cm-active（変数なし・既定スタイルなし） | 役割一致。Obsidian に変数がないため直接セレクタ必須 | High | SD base03 @50%、KD Black4 @30% | 02 §8.1, 05 直接セレクタ表 | 推奨 |
| E07 | 行番号ガター | エディタガター | Direct | `--editor-gutter-color`<br>`--editor-gutter-background-color`<br>`--editor-gutter-border-right` | .cm-gutters（color / border-right が !important） | 役割一致。上書きにも !important が必要になる可能性 | High | SD 文字 base01・線なし。KD 文字 Black6・右線 1px Black4 | 02 §8.1, 05 直接セレクタ表（L3726） | 要: !important なしで効くか |
| E08 | 見出し H1〜H6（色・太さ） | エディタ見出しトークン + プレビュー見出し | Direct | `--syntax-heading-1-color`<br>`--mde-preview-heading-color` | --h1-color〜--h6-color, --h1-weight…, .HyperMD-header-N / .markdown-rendered hN | 役割一致。Inkdrop は h1〜h6 同色 | High | SD yellow-500 #b28600。KD dragonYellow（上流 nvim の Function=dragonBlue2 とは異なる） | 02 §7.2・§8.2・§12 | 不要 |
| E09 | 見出しサイズ・下線 | プレビュー見出しサイズ（--h1..--h6）と h1/h2 下線 | Semantic | `--mde-preview-heading-border-color` | --h1-size〜--h6-size, .markdown-rendered h1/h2 の border（変数なし） | Reading View には写せるが、Live Preview で同じ下線を出すと編集時の見た目が変わる。エディタ側の見出しサイズは Inkdrop でトークン化されていない | Medium | サイズ比は基盤共通（2 / 1.5 / 1.25 / 1 / 0.875 / 0.85em） | 02 §7.1・§10 | 要: Inkdrop エディタの見出しサイズを実測 |
| E10 | 見出し記号 `#` などの Markdown 記号 | .md-header-mark 等（規則が空。見出しトークンの色を継承すると推測） | Direct | `--syntax-heading-1-color` | .cm-formatting-header（--text-faint 固定）、.cm-formatting-* | 記号の表示色。Inkdrop は記号用の規則が空（syntax.css:679-704）で、見出しなら見出し色を継承する可能性が高い（推測）。Obsidian は --text-faint 固定のため差が出る | Medium | 機械比較: --syntax-heading-1-color: SD #b28600 / KD #c3b188 | 01 §4.2, 05 Editor（L13251） | 要: Inkdrop で # の色を観察 |
| E11 | 太字 | 強調（strong） | Direct | `--syntax-strong-color`<br>`--mde-preview-strong-color` | --bold-color, --bold-weight | 役割一致 | High | SD base1 #adb8b8。KD dragonRed #c4746e（上流 nvim にない色付け） | 02 §7.2・§8.2 | 不要 |
| E12 | 斜体 | 強調（em） | Direct | `--syntax-emphasis-color`<br>`--mde-preview-em-color` | --italic-color | 役割一致 | High | SD green-500、KD dragonGreen2 | 02 §7.2・§8.2 | 不要 |
| E13 | 取り消し線 | strikethrough トークン（装飾のみ） | Direct | `--syntax-strikethrough-text-decoration` | .cm-strikethrough, .markdown-rendered del（変数なし） | 役割一致。色指定はなく装飾のみ | Medium | 両テーマ同値（機械比較） | 02 §8.2, 05 直接セレクタ表 | 推奨 |
| E14 | 外部リンク（Reading / Live Preview） | プレビューのリンク / エディタのリンク | Direct | `--mde-preview-link-color`<br>`--syntax-link-color`<br>`--link-color` | --link-external-color(-hover), --link-color, --link-decoration | 役割一致。ただし Inkdrop はエディタ・プレビュー・UI でリンク色が分かれている | High | **SD**: preview / editor cyan、UI blue。**KD**: preview dragonGreen2、editor dragonBlue2、UI dragonBlue2。Obsidian は LP と Reading で同じ変数のため、どれを正とするか判断が要る | 02 §5・§7.2・§8.2 | 要: Q-D4 |
| E15 | 内部リンク（wikilink） | リンク（Inkdrop のノート間リンクも同じリンク色） | Semantic | `--mde-preview-link-color`<br>`--syntax-link-color` | --link-color(-hover), .cm-hmd-internal-link, .internal-link | ノート間リンクという役割は近いが、Inkdrop は wikilink 記法を持たず通常リンクと同色 | Medium | E14 と同じ分岐 | 02 §7.2 | 要 |
| E16 | URL 文字列（Source / LP の生 URL） | エディタ URL トークン | Direct | `--syntax-url-color` | .cm-url（--link-external-color 系） | 役割一致 | High | SD yellow、KD dragonTeal | 02 §8.2 | 不要 |
| E17 | 未解決リンク | なし | Obsidian-native | — | --link-unresolved-color, --link-unresolved-opacity | Inkdrop に未解決リンクの概念はない | High | —（比較できる Inkdrop トークンなし） | 05 Editor | 不要 |
| E18 | ハイライト（==mark==） | インライン mark | Direct | `--md-inline-mark-background-color`<br>`--md-inline-mark-text-color`<br>`--mde-preview-inline-mark-background-color` | --highlight-background（1.14 は --text-highlight-bg を fallback として読む）、.cm-highlight, .markdown-rendered mark | 役割一致。dark では mix-blend-mode: lighten が掛かり、指定色がそのまま出ない可能性。Inkdrop の 3px 下線は変数なし | High | SD 文字 red-50 / 背景 red-900 / 下線 red-500。KD dragonWhite / dragonYellow @22% / roninYellow | 02 §7.2・§8.2, 03 §11.2, 05 Editor（L2372-2379） | 要: blend mode 下の見え方 |
| E19 | インラインコード | インラインコード（エディタ / プレビュー） | Direct | `--md-inline-code-background-color`<br>`--md-inline-code-border-color`<br>`--mde-preview-inline-code-text-color` | --code-background（コードブロックと共有）、--code-normal、.cm-inline-code、.markdown-rendered :not(pre)>code | 役割一致。Obsidian はインラインとブロックで背景変数を共有し、枠線の変数もない → 直接セレクタ | High | SD 背景 base01 @30%・枠 @50%。KD 背景 Black4 @50%・枠 Black6 @50%、文字 oldWhite | 02 §7.2・§8.2, 03 §6.3 | 推奨 |
| E20 | コードブロック（枠・背景） | フェンスコードブロック | Direct | `--md-codeblock-background-color`<br>`--mde-preview-codeblock-background-color`<br>`--mde-preview-codeblock-border-color` | --code-background, .HyperMD-codeblock-bg, .markdown-rendered pre | 役割一致。Inkdrop プレビューの言語名メタ行に対応する UI は Obsidian にない（コピーボタンのみ） | High | SD base03 @40%。KD Black2 @50%。KD の枠色は Tailwind blue-200 @10% のまま（02 §13.4） | 02 §7.2, 03 §6.3 | 推奨 |
| E21 | コード内シンタックスハイライト | --syntax-*（エディタとプレビューで共有） | Semantic | `--syntax-keyword-color`<br>`--syntax-string-color`<br>`--syntax-comment-color` | --code-comment / -function / -keyword / -important / -operator / -property / -punctuation / -string / -tag / -value + .token.*（Reading）/ .cm-*（Editing） | Inkdrop は Lezer トークン単位（数十種）、Obsidian は 10 色に集約、かつ同じ変数が Reading と Editing で別トークンを指す（03 §6.3）。完全一致は不可能で、近似の割り当て方針が要る | Medium | 配色体系が全く異なる: SD keyword green / string yellow / function blue。KD keyword dragonViolet / string dragonGreen2 / function dragonBlue2 | 02 §8.3, 03 §6.3 | 要: 言語別サンプルで比較 |
| E22 | リストマーカー（階層別色） | リストマーカー 1/2/3 | Direct | `--md-list-mark-color`<br>`--md-list-mark-2-color`<br>`--md-list-mark-3-color`<br>`--mde-preview-list-marker-color` | --list-marker-color(-hover/-collapsed)（1 変数）、階層別は .HyperMD-list-line-N / ul ul li::marker への直接セレクタ | 役割一致。Obsidian は階層別色の変数を持たない | High | SD green / orange / cyan。KD dragonTeal / roninYellow / springGreen | 02 §7.2・§8.2, 05 Editor | 推奨 |
| E23 | タスクリストのチェックボックス | UI チェックボックス + タスク完了色 | Semantic | `--checkbox-active-background`<br>`--mde-preview-task-list-checked-color` | --checkbox-color(-hover), --checkbox-border-color, --checkbox-marker-color, --checklist-done-color, --checklist-done-decoration | 完了状態の表現（取り消し線と色）が近い。Inkdrop はプレビューの task-list に専用チェックボックス変数を持たない | Medium | SD primary blue @90%、KD dragonBlue2 | 02 §6.2・§7.1 | 要 |
| E24 | カスタムタスク状態（[?] [!] など） | なし | Obsidian-native | — | [data-task="?"] 等（変数なし） | Inkdrop は GFM の [ ] [x] のみ | High | —（比較できる Inkdrop トークンなし） | 05 Editor | 不要 |
| E25 | 引用（blockquote） | 引用 | Direct | `--md-blockquote-border-color`<br>`--mde-preview-blockquote-border-color`<br>`--syntax-quote-color` | --blockquote-border-color, --blockquote-border-thickness, --blockquote-color, --blockquote-font-style | 役割一致 | High | SD 線 base01（editor）/ base02（preview）、文字 fg。KD 線 Black6、文字 oldWhite italic | 02 §7.2・§8.2 | 不要 |
| E26 | Callout | GFM alert（note / tip / important / warning / caution） | Semantic | `--gfm-alert-note`<br>`--gfm-alert-tip`<br>`--gfm-alert-important`<br>`--gfm-alert-warning`<br>`--gfm-alert-caution` | --callout-default / -info / -tip / -important / -warning / -danger 等（1.13 以降は色値）、.callout[data-callout] | 注記ブロックという役割と 5 種の型名が近い。Obsidian の callout は種類が多く（13 系統）、残りは Inkdrop に対応元がない | Medium | --gfm-alert-* 自体は両テーマとも基盤定義で、参照先の --blue / --green / --purple / --orange / --red が値を決める。SD は --purple 未上書きのため important が Tailwind purple #a855f7（漏れ）。KD は参照先をテーマで再定義済み | 02 §7.2・§13.4, 03 §0 | 推奨 |
| E27 | テーブル | テーブル（エディタ / プレビュー） | Direct | `--mde-preview-table-head-background-color`<br>`--mde-preview-table-head-text-color`<br>`--mde-preview-table-row-stripe-background-color`<br>`--md-table-border-color` | --table-header-background, --table-header-color, --table-row-alt-background, --table-border-color, --table-row-background-hover | 役割一致 | High | SD 見出し文字 yellow・背景 base02 @80%。KD dragonYellow・Black4 @60% | 02 §7.2 | 不要 |
| E28 | 水平線（hr） | プレビュー hr（0.25em の帯）/ エディタ区切りトークン | Direct | `--mde-preview-hr-background-color`<br>`--syntax-content-separator-color` | --hr-color, --hr-thickness, .cm-hr（--code-punctuation） | 役割一致。Inkdrop プレビューは太い帯、エディタは記号に強い色 | Medium | エディタ記号: SD pink-600、KD autumnRed（両テーマとも旧版から変更された箇所） | 02 §7.2・§8.2 | 推奨 |
| E29 | 画像 | プレビュー画像背景 | Direct | `--mde-preview-image-background-color` | .markdown-rendered img, .image-embed（変数なし） | 役割一致（透過画像の下地） | Medium | SD base02 @80%、KD Black4 @60% | 02 §7.2 | 推奨 |
| E30 | インラインタグ（#tag） | Inkdrop のタグピル（メタデータ） | Semantic | `--tag-default-background-color`<br>`--tag-default-text-color` | --tag-color(-hover), --tag-background(-hover), --tag-border-color, --tag-radius | Inkdrop のタグは本文中の #記法ではなくノート属性の色付きピル。見た目（ピル）は近いが、意味と 14 色の色分けは対応しない | Low | KD のタグ色は全面的に Tailwind 系のまま。SD は上書きしたランプの系統（red / green 等）は Solarized 色になるが、olive / teal / purple は Tailwind の lime / teal / purple のまま（02 §13.4）。default タグは両テーマとも Tailwind gray 系 #9ca3b0 | 01 §4.5, 02 §13.4 | 要: Q-D5 |
| E31 | Properties（frontmatter フォーム） | なし（近い: タグバー入力、ノートステータス） | Obsidian-native | `--note-tags-bar-input-background` | --metadata-*（46 変数） | Inkdrop に本文内のプロパティフォームはない | Low | 両テーマ同値（機械比較） | 05 Editor | 不要 |
| E32 | 数式（MathJax） | なし（inkdrop-math プラグイン。色トークンなし） | Obsidian-native | — | currentColor 継承（専用変数なし） | 公開 CSS に数式の色トークンはない | Medium | —（比較できる Inkdrop トークンなし） | 05 Editor | 不要 |
| E33 | Mermaid | --mermaid-*（150 変数、probe で SVG に焼き込み） | Direct | `--mermaid-text-color`<br>`--mermaid-line-color`<br>`--mermaid-node-background-color`<br>`--mermaid-node-border-color` | .theme-dark .mermaid > svg の反転フィルタ解除 + SVG 内部要素への直接指定（Obsidian は themeVariables を CSS から受け取らない） | 役割は一致するが、Obsidian 側に配色を渡す経路がなく、CSS で SVG 要素（.node rect, .edgePath 等）を塗る必要がある | Medium | SD 線 cyan・ノード base02 / blue 枠。KD 線 dragonGreen2・ノード waveBlue1 @55% | 01 §4.4, 02 §9, 05 Editor（L11875） | 要: 図種別に実機確認 |
| E34 | 脚注 | プレビュー脚注 | Direct | `--mde-preview-footnote-text-color`<br>`--mde-preview-footnote-border-color` | --footnote-*（未掲載 13 変数） | 役割一致 | Medium | 機械比較: --mde-preview-footnote-text-color: SD #fdf6e299 / KD #c8c092b2; --mde-preview-footnote-border-color: SD #073541 / KD #3a3936 | 02 §7, 05 Editor | 推奨 |
| E35 | kbd | kbd | Direct | `--mde-preview-kbd-background-color`<br>`--mde-preview-kbd-border-color`<br>`--mde-preview-kbd-text-color` | .markdown-rendered kbd（--code-* 参照）、--hotkey-*（設定画面のホットキー表示） | 役割一致 | Medium | 機械比較: --mde-preview-kbd-background-color: SD #07354180 / KD #272626; --mde-preview-kbd-border-color: SD #647a8226 / KD #625e5b66; --mde-preview-kbd-text-color: SD #fdf6e299 / KD #c8c092b2 | 02 §7.1, 05 General UI（L10931） | 推奨 |
| E36 | 埋め込み（transclusion） | なし | Obsidian-native | — | --embed-* | Inkdrop にノート埋め込みはない | High | —（比較できる Inkdrop トークンなし） | 05 Editor | 不要 |
| E37 | 折り畳みプレースホルダ | エディタ fold placeholder | Direct | `--editor-fold-placeholder-color`<br>`--editor-fold-placeholder-background-color`<br>`--editor-fold-placeholder-border` | .cm-foldPlaceholder（--text-faint 固定） | 役割一致 | Medium | 機械比較: --editor-fold-placeholder-color: SD #00141a / KD #0d0c0c; --editor-fold-placeholder-background-color: SD #586e74 / KD #625e5b; --editor-fold-placeholder-border: SD 1px solid #586e74 / KD 1px solid #625e5b | 05 直接セレクタ表 | 推奨 |
| E38 | エディタ内検索の一致 / 現在の一致 | エディタ検索一致 | Direct | `--editor-search-match-background-color`<br>`--editor-search-match-selected-background-color`<br>`--editor-search-match-selected-outline` | .obsidian-search-match-highlight, .search-highlight（--text-selection と --text-accent を流用） | 役割一致。Obsidian に専用変数がない | High | SD yellow @35% / orange @45%。KD waveBlue2 / dragonYellow @40% | 02 §8.1, 05 Editor（L7940-7955） | 推奨 |
| E39 | 対応括弧 | 括弧一致 / 不一致 | Direct | `--editor-matching-bracket-background-color`<br>`--editor-matching-bracket-outline` | --code-bracket-background（未掲載）、.cm-matchingBracket | 役割一致 | High | SD red 系、KD dragonTeal 系 | 02 §8.1, 03 §6.3 | 不要 |
| E40 | 選択一致（同じ語のハイライト） | selection match | Direct | `--editor-selection-match-background-color` | .cm-selectionMatch（変数なし） | 役割一致 | Medium | SD cyan @30%、KD waveAqua1 @35% | 02 §8.1 | 推奨 |
| E41 | 補完ポップアップ | エディタ tooltip / autocomplete | Direct | `--editor-tooltip-background-color`<br>`--editor-tooltip-autocomplete-item-selected-background-color` | .cm-tooltip.cm-tooltip-autocomplete, .suggestion-container（--background-primary を共有） | 役割一致。Obsidian は popover と同じ背景変数 | Medium | SD 背景 base03・選択 base02。KD 背景 Black3・選択 waveBlue2 | 02 §8.1, 05 Editor | 推奨 |
| E42 | インデントガイド | なし | Obsidian-native | — | --indentation-guide-color(-active) | Inkdrop に該当トークンなし | Medium | —（比較できる Inkdrop トークンなし） | 05 Editor | 不要 |

### General UI

| ID | Obsidian の UI 要素 | Inkdrop の対応候補 | 分類 | Inkdrop の CSS 変数 | Obsidian の変数 / セレクタ | 対応付けの根拠 | 確信度 | SD / KD の差 | 根拠ソース | 実画面検証 |
|---|---|---|---|---|---|---|---|---|---|---|
| G01 | アクセントカラー | primary color | Direct | `--primary-color` | --accent-h / --accent-s / --accent-l → --color-accent(-1/-2)、--interactive-accent | アプリ全体の強調色という役割が一致。ユーザーがアクセント色を設定すると inline style で上書きされる | High | SD blue-500 @90%、KD dragonBlue2 | 02 §5, 03 §2.5 | 要: Q-D6（ユーザー設定を尊重するか） |
| G02 | 拡張色（--color-red 等 8 色） | 色名トークン（--red, --orange, ...）/ 各ランプの 500 | Direct | `--red`<br>`--orange`<br>`--yellow`<br>`--green`<br>`--blue`<br>`--violet`<br>`--purple`<br>`--pink` | --color-red / -orange / -yellow / -green / -cyan / -blue / -purple / -pink | 色名の一致ではなく『各テーマが意味色として使っている基準色』を写す。--code-* 既定値や graph / canvas / callout の既定がこれを参照する | High | SD は 500 段が本家 Solarized アクセント。--purple は Tailwind のまま（漏れ）。KD は --blue 等をテーマが再定義 | 02 §2・§13.4, 04 §8 | 推奨 |
| G03 | 意味色（成功 / 警告 / エラー） | positive / warning / negative | Direct | `--positive-color`<br>`--warning-color`<br>`--negative-color` | --text-success / -warning / -error, --background-modifier-success / -error | 役割一致 | High | SD green / yellow / red。KD dragonGreen2 / roninYellow / dragonRed | 02 §5 | 不要 |
| G04 | 境界線（汎用） | border / strong-border / solid-border | Semantic | `--border-color`<br>`--strong-border-color`<br>`--solid-border-color` | --background-modifier-border(-hover/-focus) | Obsidian の border 系は不透明の base 色、Inkdrop は半透明。階層（通常 / 強 / ソリッド）で対応付ける | Medium | SD base00 @15% / @22% / base02。KD Black6 @40% / @60% / Black5 | 02 §10 | 推奨 |
| G05 | hover 背景（汎用） | menu / selection-list hover（白アルファ） | Semantic | `--menu-hover-item-background`<br>`--selection-list-hover-background` | --background-modifier-hover, --background-modifier-active-hover | 汎用 hover。両テーマとも基盤既定の白アルファのまま | Medium | 両テーマ同値（#ffffff05 等） | 02 §6.2, 05 注意点 | 推奨 |
| G06 | Command Palette / Quick Switcher | モーダル + 選択リスト | Semantic | `--modal-box-content-background`<br>`--selection-list-active-background` | --prompt-background（未掲載）、--prompt-border-color、.prompt, .suggestion-item.is-selected（--background-modifier-hover） | 検索付き選択リストのモーダル。Inkdrop の該当 UI（コマンドパレット等）が base-ui-theme のどのコンポーネントで描かれるかは未確認 | Medium | 機械比較: --modal-box-content-background: SD #002129 / KD #1e1d1a | 01 §5.2, 05 General UI | 要 |
| G07 | Settings（設定画面） | 環境設定ウィンドウ | Direct | `--preferences-sidebar-background`<br>`--preferences-sidebar-item-active-background`<br>`--preferences-view-background` | .modal.mod-settings, .vertical-tab-header, .vertical-tab-nav-item.is-active, --setting-*（未掲載） | 設定画面のサイドナビ + 本体という構造が一致 | Medium | SD 側 base04 / 本体 #002129。KD Black0 / Black3 | 02 §4, 05 General UI | 推奨 |
| G08 | Modal / Dialog | モーダル（ヘッダー / 本文 / アクション） | Direct | `--modal-box-header-background`<br>`--modal-box-content-background`<br>`--modal-box-actions-background` | --modal-background（= --background-primary）、--modal-border-color、--modal-radius、.modal-title（ヘッダー帯は変数なし） | 役割一致。Inkdrop はヘッダー帯が 1 段明るいが、Obsidian のモーダルにヘッダー帯の背景はない | High | 本文はエディタと同色（SD #002129 / KD #1e1d1a）で --background-primary と整合。ヘッダーは SD base03 / KD Black4 | 02 §4, 05 General UI | 推奨 |
| G09 | Menu / Context Menu | メニュー（Semantic UI menu） | Semantic | `--menu-background`<br>`--menu-hover-item-background`<br>`--menu-item-text-color` | --menu-background（未掲載）、--menu-border-color、.menu-item.selected（hover は JS 付与クラス） | アプリ内メニューという役割は近い。ただし Inkdrop のコンテキストメニューが OS ネイティブメニューか HTML かは未確認 | Medium | SD base04、KD Black0（最暗色） | 02 §4, 05 General UI（L9219） | 要: Inkdrop の右クリックメニューの実体 |
| G10 | Popover / Page preview | popup | Semantic | `--popup-background` | .popover（--background-primary を共有。差を付けるならセレクタで再代入） | 浮遊パネル。Obsidian の hover preview はノート内容を表示するためエディタ面との一致も妥当 | Medium | **SD** popup = base04（エディタより暗い）。**KD** popup = Black2（エディタより暗い）。どちらも --background-primary と異なる | 02 §4, 05 Workspace | 要: Q-D7 |
| G11 | Tooltip | tooltip | Direct | `--tooltip-background` | --tooltip-background / --tooltip-color（未掲載、1.14 追加） | 役割一致 | Medium | popup 背景を継承 | 02 §4, 03 §0 | 推奨 |
| G12 | Notice（通知トースト） | 通知アイテム | Direct | `--notification-item-background` | --notice-background / --notice-text-color（未掲載、1.14 追加） | 役割一致 | Medium | SD base04 @80%、KD Black0 @80% | 02 §4 | 推奨 |
| G13 | Button（通常） | button | Direct | `--button-background`<br>`--button-hover-background-color`<br>`--button-text-color` | --interactive-normal, --interactive-hover（.theme-dark / .mod-macos が再定義するため詳細度に注意）, button | 役割一致 | High | SD base03 @70% → base02 @70%、文字 base3 @60%。KD Black4 → Black5、文字 dragonWhite @75% | 02 §6.2, 03 §2.4 | 要: .mod-macos との優先度 |
| G14 | Button.mod-cta | primary button | Direct | `--primary-button-background-color`<br>`--primary-button-hover-background-color`<br>`--primary-button-text-color` | --interactive-accent, --interactive-accent-hover, --text-on-accent | 役割一致 | High | SD blue-500 → blue-600。KD dragonBlue2 → dragonTeal | 02 §6.2 | 不要 |
| G15 | Button.mod-warning / 破壊的操作 | negative button | Direct | `--negative-button-background-color`<br>`--negative-button-hover-background-color` | .mod-warning（--background-modifier-error 系） | 役割一致 | Medium | SD red、KD dragonRed | 01 §5.2 | 推奨 |
| G16 | テキスト入力 | input | Direct | `--input-background`<br>`--input-border`<br>`--input-color` | --background-modifier-form-field, --input-shadow(-hover)（枠は box-shadow）, --input-radius | 役割一致。Obsidian は枠を box-shadow で描くため、Inkdrop の border を box-shadow に組み直す | High | SD base04、KD Black0 | 02 §4, 05 General UI（L3076-3077） | 推奨 |
| G17 | フォーカス表示 | focused outline / input focus border / focused form border | Direct | `--focused-outline-color`<br>`--input-focus-border-color`<br>`--focused-form-border-color` | --background-modifier-border-focus、:focus-visible（共通規則なし、Obsidian 部で 47 箇所に分散） | 役割一致。Obsidian は部品ごとに実装が異なり一律適用には直接セレクタが要る | Medium | SD primary @30%・入力枠 blue・フォーム枠 Tailwind sky-300（漏れ）。KD dragonBlue2 系で統一 | 02 §6.2・§13.4, 05 General UI | 要: アクセシビリティ確認 |
| G18 | Dropdown（select） | form select / dropdown | Direct | `--form-select-background`<br>`--dropdown-menu-background` | --dropdown-background(-hover), .dropdown（矢印は SVG background-image） | 役割一致 | Medium | SD base04、KD Black0 | 02 §4, 05 直接セレクタ表 | 推奨 |
| G19 | Checkbox（フォーム） | checkbox | Direct | `--checkbox-background`<br>`--checkbox-active-background`<br>`--checkbox-active-check-color` | --checkbox-color, --checkbox-border-color, --checkbox-marker-color | 役割一致 | High | active は primary（SD blue @90% / KD dragonBlue2） | 02 §6.2 | 不要 |
| G20 | Toggle | toggle | Direct | `--toggle-on-lane-color`<br>`--toggle-lane-background`<br>`--toggle-handle-background` | --interactive-accent（ON レーン）、--toggle-thumb-color、.checkbox-container（OFF は --background-modifier-border-hover） | 役割一致。.mod-macos が toggle 変数を再定義 | Medium | ON は primary | 02 §6.2, 05 General UI | 推奨 |
| G21 | Slider | なし | Obsidian-native | — | --slider-* | Inkdrop に該当なし。アクセント色で代替 | High | —（比較できる Inkdrop トークンなし） | 05 General UI | 不要 |
| G22 | Scrollbar | scrollbar | Direct | `--scrollbar-thumb-background`<br>`--scrollbar-track-background`<br>`--scrollbar-width` | --scrollbar-thumb-bg, --scrollbar-active-thumb-bg, --scrollbar-bg（body.styled-scrollbars 配下で適用。app.js は macOS 以外でのみこのクラスを付与するため、macOS では OS 既定のスクロールバーになる見込み） | 役割は一致するが、最優先の macOS ではスクロールバー変数が効かない可能性が高い（app.js の `Qy.isMacOS\|\|document.body.addClass("styled-scrollbars")` から推測、実機未確認） | Medium | 両テーマとも基盤既定（白 @20% / @2%） | 02 §6.2, 05 未確認事項 | 要 |
| G23 | アイコン（クリック可能アイコン） | サイドバー action / ヘッダーメニュー色 | Semantic | `--sidebar-menu-action-color`<br>`--sidebar-menu-action-hover-color`<br>`--header-note-menu-color` | --icon-color(-hover/-active/-focused), .clickable-icon | 操作アイコンの色という役割が近い | Medium | 機械比較: --sidebar-menu-action-color: SD #fdf6e24c / KD #c5c9c54c; --sidebar-menu-action-hover-color: SD #fdf6e2d9 / KD #7a8583e6; --header-note-menu-color: SD #fdf6e2d9 / KD #7a8583e6 | 01 §5.2 | 要 |
| G24 | 影 | floating / subtle / modal shadow | Semantic | `--floating-shadow`<br>`--subtle-shadow`<br>`--modal-box-shadow` | --shadow-s, --shadow-l（.theme-dark で定義、未掲載） | 浮遊要素の影という役割が一致 | Medium | 基盤既定（黒アルファ多層）。KD は --black を Black2 に再定義しているため subtle-shadow の色が異なる | 02 §10 | 推奨 |
| G25 | 角丸 | default radius / squircle | Semantic | `--default-border-radius`<br>`--absolute-border-radius` | --radius-s / -m / -l, --input-radius, --modal-radius, --corner-shape（.mod-macos が定義） | 形状トークン。Inkdrop は Chromium で squircle を使う（@supports）。Obsidian も macOS で --corner-shape を持つ | Medium | 両テーマ共通（基盤既定） | 02 §10, 03 §2.4 | 要: 両アプリの角丸を実測 |
| G26 | フォント | UI フォントスタック / プレビュー本文サイズ | Semantic | — | --font-interface-theme, --font-text-theme, --font-monospace-theme（ユーザー設定 *-override が優先） | フォントはユーザー設定が優先されるため、テーマで固定すべきかは方針次第 | Medium | 両テーマ共通（基盤既定） | 02 §10, 03 §2.5 | 要: Q-D8 |

### Obsidian 固有

| ID | Obsidian の UI 要素 | Inkdrop の対応候補 | 分類 | Inkdrop の CSS 変数 | Obsidian の変数 / セレクタ | 対応付けの根拠 | 確信度 | SD / KD の差 | 根拠ソース | 実画面検証 |
|---|---|---|---|---|---|---|---|---|---|---|
| O01 | Canvas（背景・ドット・ノード・エッジ・選択） | なし | Obsidian-native | — | --canvas-background, --canvas-dot-pattern, --canvas-color-1..6（body で定義）, --canvas-color（既定ノード色。body.theme-dark で詳細度 0,1,1） | Inkdrop に対応 UI なし。パレットと拡張色から導出する | High | —（比較できる Inkdrop トークンなし） | 05 Obsidian 固有（L18187） | 要: 見た目確認 |
| O02 | Graph View | なし | Obsidian-native | — | --graph-line / -node / -node-focused / -node-tag / -node-attachment / -node-unresolved / -text、.graph-view.color-* | Inkdrop に対応 UI なし。JS が computed color を読む | High | —（比較できる Inkdrop トークンなし） | 05 Obsidian 固有 | 要: oklch 等の解釈 |
| O03 | Bases（テーブル / カード / カンバン） | なし（テーブル配色は Markdown テーブルから類推可能） | Obsidian-native | `--mde-preview-table-head-background-color` | --bases-*（79 変数、うち 33 未掲載） | Inkdrop にデータベースビューはない | High | 機械比較: --mde-preview-table-head-background-color: SD #073541cc / KD #27262699 | 05 Obsidian 固有 | 要 |
| O04 | Slides / PDF viewer / Web viewer | なし | Obsidian-native | — | --r-*（reveal.js）、PDF は対象外 | テーマの配色対象外または限定的 | High | —（比較できる Inkdrop トークンなし） | 05 Obsidian 固有 | 不要 |
| O05 | Sync / Publish の状態表示 | サイドバーの同期状態表示 | Semantic | `--sidebar-sync-status-view-background`<br>`--sidebar-sync-status-view-text-color` | ステータスバーのアイコン等（--status-bar-*） | 同期状態の表示という役割が近い | Low | 機械比較: --sidebar-sync-status-view-background: SD #002d384c / KD #27262666; --sidebar-sync-status-view-text-color: SD #fdf6e299 / KD #c8c092b2 | 01 §5.2 | 不要 |

---

## 5. 逆方向: Obsidian に対応先がない Inkdrop の要素

Inkdrop のトークンのうち、Obsidian 側に写す先が見当たらない、または写しても意味が変わるものである。忠実度の評価では「再現できない差分」として扱う。

| Inkdrop の要素 | 主なトークン | 扱いの候補 | 出典 |
|---|---|---|---|
| ノートリストの抜粋文・日付 | `--note-list-view-item-color`, `--note-list-view-item-date-color` | Obsidian の File Explorer はタイトルしか出さない。対応先なし | 01 §5.2, 02 §5 |
| ノートリストの区切り線・節見出し・pinned 節 | `--note-list-view-item-separator-border`, `--note-list-bar-section-header-*`, `--note-list-bar-pinned-*` | 対応先なし（Bookmarks に近いが構造が違う） | 01 §5.2 |
| ノートステータス（active / onhold / completed / dropped） | `--note-status-*` | Properties の値表示に使う余地はあるが、意味の対応はない | 01 §4.5, 02 §5 |
| タスク進捗表示 | `--task-progress-view-*` | 対応先なし | 01 §4.5 |
| タグの 14 色パレット | `--tag-<color>-*`（336 変数） | Obsidian のタグは 1 色（`--tag-*`）。色分けはタグ名ごとの直接セレクタでしか再現できない | 01 §4.5 |
| 暗号化ボタン | `--header-note-menu-encrypt-button-*` | 対応先なし | 01 §5.2 |
| エディタのフローティング操作 | `--editor-floating-actions-background` | 対応先なし | 02 §4 |
| 末尾空白の可視化 | `--editor-trailing-space-background-color` | Obsidian のコアに同等の表示はない | 02 §8.1 |
| プレビューのコードブロックのメタ行（言語名） | `--mde-preview-codeblock-meta-*` | Obsidian の Reading View には言語名の帯がない | 02 §7.1 |
| モーダルのヘッダー帯 | `--modal-box-header-background`, `--modal-box-header-border` | Obsidian のモーダルにヘッダー帯の背景はない。`.modal-title` 周辺への直接セレクタで近似は可能 | 02 §4 |
| 選択範囲のフォーカス有無の区別 | `--editor-selection-background` と `--editor-focused-selection-background` | Obsidian の `--text-selection` は 1 変数。`.cm-focused` への直接セレクタで近似 | 02 §8.1 |
| Mermaid の図種別の詳細色 | `--mermaid-*`（150 変数） | Obsidian は配色を受け取る経路がない。SVG への直接指定で、主要要素だけ再現できる | 01 §4.4, 05 Editor |
| squircle 角丸 | `--default-corner-shape: squircle` | Obsidian も `.mod-macos` で `--corner-shape` を持つが、適用範囲は未調査 | 02 §10, 03 §2.4 |

---

## 6. このマッピングの限界

- **Inkdrop 側の値は宣言値である。** 02 の解決値は `palette.json`（ブラウザで抽出した computed 値）と 1,638 / 1,638 件一致した。ただし、どの DOM のどのプロパティに適用されるかは、サイドバー、ノートリスト、エディタ外枠などで非公開 CSS 次第である。
- **Obsidian 側の値も宣言値である。** `.mod-macos` など OS クラスによる上書き後の値や、`color-mix()` の最終値は実機で確認していない（03 §2.4、05 凡例）。
- **Inkdrop の画面構成は実機で照合していない。** 「ノートタブがない」「目次 UI がない」「コンテキストメニューが HTML かネイティブか」は未確認である（W06、N11、G09）。
- **配色の最終決定はしていない。** 確信度 Low の行と §3 の論点は、[09](09-open-questions.md) にユーザー判断事項と実機検証項目として転記した。

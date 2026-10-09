# 09. 未解決事項: ユーザー判断と実機検証

- 調査日: 2026-10-09（Phase 1B: 独立レビュー対応で改訂）
- 構成
  - **§1 ユーザーが意思決定すべき項目（Q-D）**: 調査では決められず、方針の選択が必要なもの。各項目で「前提となる技術的事実」と「判断が必要な点」を分けた。推奨がある場合は「暫定推奨」として示すが、**決定ではない**。
  - **§2 アプリ実機で検証すべき項目（V）**: 静的解析では確定できず、Inkdrop または Obsidian を実際に動かして確認する必要があるもの。§2.1 に優先順位を付けた。
  - **§3 調査で確認できなかった事実（U）**: 実機検証以外の手段（作者への問い合わせ、追加の資料）が必要なもの。
- Phase 1B での変更（ID は変えていない。追加した ID は V-16、V-31、U-11、U-12）
  - Q-D1・Q-D13 の選択肢と判断材料を、レビューで訂正した事実（07 R05・R02）に合わせて改めた。
  - Q-D2 は値の正本については既定方針から導けるため「方針から導いた暫定案（決定ではない）」を示し、残る判断点（出力形式。Q-D21 に依存）を書いた。
  - Q-D4・Q-D9・Q-D16 で、技術的事実と判断を分けた。Q-D16 には判断の時期を書いた。
  - V-07・V-12・V-15 の問いを具体化した。§2.1 に優先順位を追加した。
  - 対応の経緯は [10](10-review-remediation.md) にある。

---

## 1. ユーザーが意思決定すべき項目

「判断の時期」は、その判断がないと進められない作業の段階を示す。

- **Phase 2 前半**: 配色仕様の骨格を決める前に必要。
- **Phase 2 後半**: 個別要素の仕様を詰めるときに必要。
- **配布前**: Phase 2 の設計には影響しないか、影響が小さい。

### 1.1 配色・忠実度

| ID | 論点 | 前提となる技術的事実 | 選択肢 | 判断が必要な点 | 時期 | 関連 |
|---|---|---|---|---|---|---|
| Q-D1 | Obsidian の左右サイドドックと周辺の帯に、Inkdrop のどの面の色をどう割り当てるか | Inkdrop の横並び 2 ペイン（サイドバー｜ノートリスト）は構造として再現できない。背景色は、公式変数だけならペイン本体が 2 色（左右ドック共通）。docs 未掲載のクラスへのスコープ再定義を使えば 3 色以上にできる（07 R05） | (a) 左右ドック本体 = サイドバー色（SD `#073541` / KD `#11110e`） (b) 左右ドック本体 = ノートリスト色（SD `#002d38` / KD `#181616`） (c) テーマごとに (a) と (b) を選び分ける (d) 左ドックのタブ帯 = サイドバー色、リスト本体 = ノートリスト色（最上段のタブ帯は `--titlebar-background` に連動するため、実際にはタイトルバーも同じ色になる見込み。`--sidebar-tab-container-background` は 1.14 以降のみ） (e) 左ドック = サイドバー色、右ドック = 別の色（`.mod-left-split` / `.mod-right-split`、または 1.14 以降のみの `.mod-primary-split` / `.mod-secondary-split` のスコープ再定義） (f) File Explorer のビューだけ別色（`[data-type="file-explorer"]`） | 忠実度（Inkdrop の明度構成にどこまで近づけるか）と、docs 未掲載のクラスに依存する保守リスクのどちらを優先するか。(a)〜(c) は公式変数だけで済む。(d)〜(f) は未掲載の変数またはクラスに依存し、一部は 1.14 以降にしかない（Q-D20 に依存） | Phase 2 前半（Q-D20 と同時） | 06 W03・§2・§3, 07 R05, Q-D20, V-03, V-16 |
| Q-D2 | Kanagawa Dragon の色値の扱い | 確定方針は「Inkdrop 版が正本」。Inkdrop の CSS の宣言値は整数 % の HSL（例: dragonBlack3 = `hsl(45deg 7% 11%)`）で、HEX コメントは参照用。dragonBlack2 / 3 の名前は上流 kanagawa.nvim と逆だが、Inkdrop は初版からこの並び | (a) Inkdrop の HSL 宣言をそのまま出力する (b) HSL 宣言を HEX に換算して出力する (c) HEX コメントの値を使う (d) 上流 kanagawa.nvim の値を使う | **方針から導いた暫定案（決定ではない）**: 値の正本は Inkdrop の HSL 宣言とし、(c)・(d) は採らない。(d) は既定方針の変更に当たる。(a) と (b) のどちらにするかは出力形式の問題で、Q-D21 に依存する（Lightning CSS は既定で HEX に変換する。08 §3.5） | Phase 2 前半（Q-D21 と同時） | 02 §2.2・§12, 07 R14, Q-D21 |
| Q-D3 | Solarized Dark の弱い文字色（muted / hover / disabled 等）が base3（クリーム `#fdf6e2`）のアルファになっている点 | 基盤の「neutral-50 のアルファ」をランプ置換で Solarized 化した結果。意図かどうかは不明 | (a) そのまま写す (b) Solarized の base0 / base01 などに置き換える | 正本の表示どおりにするか、意図を推定して直すか | Phase 2 後半 | 02 §5, 06 E03 |
| Q-D4 | リンク色 | Obsidian の `--link-color` は Live Preview と Reading で共通。ただし `.markdown-source-view` / `.markdown-rendered` のスコープで変数を再代入すれば、ビュー別に塗り分けられる（07 R03 案 B）。SD はプレビューとエディタが同じ cyan で、UI だけ blue。KD はプレビューだけ dragonGreen2 で、ファイル冒頭のコメント（「links dragonBlue2」）と実値が食い違う | (a) プレビュー値に統一 (b) エディタ値に統一 (c) ビュー別に塗り分け（Inkdrop の表示どおり） | 技術的にはどれも可能。KD のプレビューのリンク色（コメントと実値の食い違い）を、表示どおり写すか、コメントの意図に合わせるか | Phase 2 後半 | 06 E14・E15, 07 R03 |
| Q-D5 | タグの配色 | Inkdrop のタグはノート属性の 14 色ピルで、本文中の `#tag` とは意味が違う。KD のタグ色は基盤既定（Tailwind 系）を継承している | (a) Obsidian の 1 色方式に Inkdrop の default タグ色を当てる (b) アクセント系の 1 色 (c) タグ名ごとの色分け（直接セレクタ） | 意味の違う要素にどこまで Inkdrop の見た目を持ち込むか | Phase 2 後半 | 06 E30, 02 §13.4 |
| Q-D6 | アクセント色をユーザー設定に委ねるか | アクセント設定は `body` の inline style で注入され、テーマに勝つ（03 §2.5） | (a) `--accent-h/s/l` に Inkdrop の primary を入れる（ユーザーが変えると変わる） (b) Inkdrop の primary を固定値で各変数に入れる（ユーザー設定が効かない） | 忠実度とユーザーの選択の自由のどちらを優先するか | Phase 2 前半 | 03 §2.5, 06 G01, 07 R07 |
| Q-D7 | Popover・補完ポップアップの背景 | Obsidian の popover は `--background-primary` をノート領域と共有する。Inkdrop の popup はエディタより暗い（SD base04 / KD Black2） | (a) `--background-primary`（エディタ面）のまま (b) Inkdrop の popup 色にセレクタで再代入 | 忠実度と、popover にノート内容を表示する Obsidian の用途との兼ね合い | Phase 2 後半 | 06 G10・E41 |
| Q-D8 | フォント | フォントはユーザー設定（`--font-*-override`）が優先される。Inkdrop のガイドもエディタのフォント指定を避けるよう推奨している | (a) 指定しない（Obsidian 既定 + ユーザー設定） (b) Inkdrop の UI フォントスタックを `--font-interface-theme` に入れる | 見た目の再現をフォントまで広げるか | Phase 2 後半 | 01 §4.3, 03 §2.5, 06 G26 |
| Q-D9 | Inkdrop テーマが基盤既定色（Tailwind 系）を継承している箇所の扱い | SD は 94 トークン（info / warning / secondary / GFM important 等）、KD はタグ色・コードブロック枠など。Inkdrop で**実際に表示される色**であり、正本の一部である。意図的かどうかは不明（U-11） | (a) Inkdrop の表示どおり写す（既定方針からの帰結） (b) テーマのパレット内の色へ寄せる (c) 項目ごとに判断する | 既定方針（正本に忠実）を優先するか、テーマとしての色の一貫性を優先するか。(b)・(c) は方針からの意図的な逸脱になる | Phase 2 前半 | 02 §13.4, 07 R13 |
| Q-D13 | シンタックスハイライトの再現度 | 公式変数 `--code-*` だけでは再現できない。`.cm-*` / `.token.*` を直接塗れば一致度は上がるが、上限は Obsidian 側のトークナイザが出すクラスの粒度で決まり、原理的に区別できない例がある（例: 編集時 JS の関数呼び出しと変数参照はどちらも `cm-variable`）。全体の一致度は言語ごとに未検証（03 §6.3、07 R02） | (a) `--code-*` の 10 色に縮約 (b) `.token.*` / `.cm-*` を直接塗って両ビューの意味を揃える (c) (b) に加えて言語別に調整 | 忠実度を上げるために、Obsidian の内部クラス（CM5 モード、Prism）への依存をどこまで許すか。どの言語を対象にするか | Phase 2 前半（方式）、後半（言語） | 07 R02, 06 E21, V-12 |
| Q-D14 | エディタとプレビューで値が違う箇所の扱い | ビュー別のスコープで変数を再代入すれば塗り分けられる（07 R03） | (a) どちらか一方に統一 (b) ビュー別に塗り分け | Q-D4 と同じ考え方を他の要素（KD の本文アルファ、SD の引用線など）にも適用するか | Phase 2 後半 | 07 R03, 06 E01・E02 |
| Q-D15 | コントラスト基準を満たさない組み合わせ | Inkdrop の値のままでは、SD のサイドバー節見出し 2.42、KD のガター文字 2.63 などが WCAG AA に届かない（宣言値からの計算値）。Obsidian 公式にコントラスト要件はない | (a) Inkdrop の値のまま (b) WCAG AA を満たすよう調整 (c) 本文など主要な組だけ調整 | 忠実度とアクセシビリティが直接衝突する。どの組を「主要」とするか | Phase 2 前半 | 07 R15, `data/inkdrop-contrast.csv` |

### 1.2 範囲・配布

| ID | 論点 | 前提となる技術的事実 | 選択肢 | 判断が必要な点 | 時期 | 関連 |
|---|---|---|---|---|---|---|
| Q-D10 | モバイルの扱い | `.is-mobile.theme-dark`（0,2,0）が `--color-base-00/10/20` を上書きする。モバイルのサイドバーは `.workspace-drawer` で、デスクトップ用のスコープ再定義は届かない | (a) 対象外（モバイルでは Obsidian 既定の黒背景が出ることを許容） (b) `.is-mobile.theme-dark` 以上の詳細度で base 色を固定 | 対応範囲。(b) はガイドラインの「低詳細度」と緊張関係 | Phase 2 前半 | 03 §2.4, 07 R05・R11 |
| Q-D11 | Light モード | 2 テーマとも Inkdrop では `themeAppearance: "dark"` | (a) Dark のみ（directory の Supported modes で dark だけを申告） (b) Light も用意する | 対応範囲 | 配布前 | 03 §4 |
| Q-D12 | Mermaid の再現度 | Obsidian は配色を受け取る経路がなく、dark では反転フィルタを掛けるだけ。SVG を直接塗る必要がある | (a) Obsidian 既定（反転フィルタ） (b) 主要図種だけ (c) 全図種 | Mermaid の DOM 変更への脆さをどこまで許すか | Phase 2 後半 | 07 R04, 06 E33, V-10 |
| Q-D16 | Community directory に出すか、リポジトリ構成 | directory は 1 リポジトリの HEAD に 1 つの `manifest.json` を置く前提で、2 テーマを載せるにはリポジトリが 2 つ要ると推測（U-05）。LICENSE 必須。テーマ名は投稿後に変えられない | (a) 出す (b) 出さない（手動インストール等） (c) 当面は決めない | Phase 2 の配色・CSS 設計には影響しない。影響するのはリポジトリ構成、テーマ名、ライセンス表記、`manifest.json`。**Phase 2 では決めずに進め、実装の終盤（配布物を作る前）に決めればよい**（暫定推奨） | 配布前 | 08 §1・§5.3 |
| Q-D17 | コミュニティプラグインと Style Settings への対応範囲 | 確定方針は「コアプラグインが主要範囲、コミュニティは別途分類」 | (a) 公式変数経由の間接対応のみ (b) 主要プラグインに個別対応 (c) Style Settings で調整項目を提供 | 対応範囲。利用プラグインの一覧（U-10）が判断材料になる | Phase 2 後半 | 07 R16 |
| Q-D18 | テーマ名 | "Theme" と "Obsidian" を含められず、投稿後は改名できない。"Kanagawa" 系は既に 5 件登録済み。"Inkdrop" / "Solarized" を含めてよいかは未確認 | — | 名前そのもの | 配布前 | 03 §1.2, 04 §9, 07 §11 |
| Q-D19 | 著作権表示と帰属 | Inkdrop の SD / KD リポジトリは `package.json` で MIT だが LICENSE ファイルがない。パレットの上流は Osaka（Apache-2.0）、kanagawa.nvim（MIT）、本家 Solarized（MIT） | — | 表示の文言。必要なら Inkdrop の作者に確認する（U-03） | 配布前 | 07 §11 |
| Q-D20 | 対象 Obsidian バージョン（`minAppVersion`） | ユーザー環境は 1.13.7、最新安定版は 1.14.4。1.14 で 84 変数追加、`--text-highlight-bg` の既定削除など | (a) 1.14.0 以上（最新の変数体系を前提） (b) 1.13.x も含める | 使える変数の範囲 | Phase 2 前半 | 03 §8・§11.1 |
| Q-D21 | ビルド方式とリポジトリ構成の確定 | ビルド方式で再現範囲は変わらない。Sass は値を丸めない（Phase 1B で実測）。Lightning CSS は既定で HEX に変換する。保守性の評価は試作に基づかない推測（08 §4） | 08 §3 の案 A〜F、§5.3 の R1〜R3 | 08 §6 の暫定推奨は「案 B（素の CSS の連結）または案 C（Sass）を候補とし、小さな試作で決める。パレット層はどちらの場合もデータから生成」。出力形式の選択は Q-D2（HSL 宣言をそのまま出すか）にも影響する | Phase 2 前半（Q-D2 と同時） | 08, Q-D2 |

---

## 2. アプリ実機で検証すべき項目

### 2.1 優先順位

次の 4 つの観点で並べた。

1. 設計を変える可能性の高さ
2. Inkdrop への忠実度への影響
3. Obsidian の実装方式への影響
4. 検証コストと依存関係

| 優先度 | 意味 | 項目 |
|---|---|---|
| **P0（先行）** | 他の検証や判断の前提になる。先に済ませないと他が進まない | **V-30**（Inkdrop の基準スクリーンショット。以降の比較の基準になる）、**V-20**・**V-22**（Inkdrop の変数の実際の適用先。06 の「非公開」29 行と「混在」13 行の前提）、**V-01**（Obsidian でテーマ変数が負けないか。マッピング層の書き方の前提） |
| **P1（高）** | 設計判断を変える可能性が高い | **V-03**・**V-16**（Q-D1 の選択肢の実現性）、**V-12**・**V-31**（Q-D13 の方式選択）、**V-29**（Inkdrop の描画色。HSL 宣言をそのまま使う前提の確認）、**V-10**（Q-D12）、**V-11**（直接セレクタの前提となるクラスの存在） |
| **P2（中）** | 個別要素の仕様に影響する | V-02、V-05、V-06、V-07、V-08、V-21、V-23、V-24、V-25、V-26、V-27 |
| **P3（低）** | 影響が限定的、または対応範囲に含める場合だけ必要 | V-04、V-09、V-13、V-14、V-15、V-28 |

依存関係:

- V-30 → 他のすべての「Inkdrop と並べて比べる」検証
- V-20・V-22 → V-21・V-23・V-24・V-25（同じ DevTools 作業でまとめて確認できる）
- V-01 → V-03・V-16・V-07（どれも Obsidian 側の優先関係を前提にする）
- V-31 → V-12（Inkdrop 側のクラスが分からないと、言語別の対応表を作れない）

### 2.2 Obsidian（macOS、1.14.4 を主対象。1.13.7 でも確認）

| ID | 優先度 | 検証内容 | 理由 | 関連 |
|---|---|---|---|---|
| V-01 | P0 | テーマ変数を `.theme-dark` で定義したとき、`.mod-macos`・`.theme-dark`（app.css 側）・`body.theme-dark`（Canvas）との優先関係で負ける変数がないか。DevTools の computed style で確認 | 読み込み順（app.css < theme.css）は確認済みだが、computed 値は未確認 | 03 §2.3・§2.4, 07 R06 |
| V-02 | P2 | `--accent-h/s/l` と `--font-text-size` の inline 注入が、テーマの値より優先されるか | app.js の静的解析による推測 | 03 §2.5 |
| V-03 | P1 | 左右サイドドックに `.mod-left-split`（1.13.7 / 1.14.4）と `.mod-primary-split`（1.14.4）が実際に付くか。File Explorer の DOM 階層（`.view-header` / `.view-content` / `.nav-header` / `.nav-files-container` の親子関係）。ドックの最上段のタブグループに `.mod-top` が付き、タブ帯が `--titlebar-background` の色になるか | app.js の静的解析では付与を確認済み（RTL で左右反転）。実機は未確認 | 05 Workspace, 06 W03・W04, 07 R05 |
| V-04 | P3 | `.is-translucent` 有効時の背景と、Inkdrop の acrylic 時の見え方の比較 | 透過度は環境依存。translucent では各面が `transparent !important` になる | 06 W11, 07 R05 |
| V-05 | P2 | `color-mix(in oklch, …)` による hover・選択色と、Inkdrop の HSL アルファの見え方の差 | 色空間が違う | 08 §5.2 |
| V-06 | P2 | ハイライト（`==mark==`）に dark で掛かる `mix-blend-mode: lighten` の下で、指定色がどう見えるか | computed 未検証 | 06 E18 |
| V-07 | P2 | `.cm-gutters`（L3726）の 2 つの `!important` について確認する。(1) `color: var(--text-faint) !important` は、`.cm-gutters` 上で `--text-faint` を再定義すれば `!important` なしで変えられるか。(2) `border-right: none !important` を使わずに、`box-shadow` など別のプロパティで KD の右線（1px Black4）を描けるか | (1) は変数参照、(2) は固定値の `!important`。仕様上は (1) は可能、(2) は `!important` か迂回が必要と推論した | 06 E07, 07 R17 |
| V-08 | P2 | macOS で `body.styled-scrollbars` が付かず、スクロールバー変数が効かないこと（効かない場合、Inkdrop のスクロールバー配色を macOS で再現するかは Phase 2 で判断） | app.js の静的解析では「macOS 以外でのみ付与」を確認済み | 03 §2.2, 06 G22 |
| V-09 | P3 | Graph View が `hsl()`、`color-mix()`、`oklch()` を含む色値を正しく解釈するか | app.js の推測 | 05 Obsidian 固有 |
| V-10 | P1 | 同梱の Mermaid のバージョン、図種別の DOM、反転フィルタ解除後の描画。要素にインラインの `style` / `fill` があるか | 静的解析では確認できない | 07 R04 |
| V-11 | P1 | Live Preview・Source mode・Reading View の各要素が、想定したクラスを持つか（特に `.cm-active`、`.HyperMD-list-line-N`、`.cm-formatting-*`） | クラスの存在は app.css のセレクタから推定 | 03 §6, 05 Editor |
| V-12 | P1 | 言語別サンプルで、両ビューのトークンクラスの対応表を作る。最低限 JS / TS / Python / CSS / HTML / JSON / Shell / Go / Rust / YAML / SQL / Markdown。03 §6.3 の例 1〜4 が実機の DOM でも成り立つか、編集時に `(` が別の span になるか、Prism の `method` / `maybe-class-name` が付くか、Rust（`defineSimpleMode`）のトークン名 | 静的解析で一部の例は確認したが、全体の粒度は未確認 | 03 §6.3, 07 R02 |
| V-13 | P3 | ドキュメント記載の `--input-focus-border-color` 等が一般の入力欄に効かないこと | pdf.js 専用の定義と推測 | 03 §11.2 |
| V-14 | P3 | Slides で `--r-*` の上書きが効くか（対応範囲に含める場合のみ） | 推測 | 05 Obsidian 固有 |
| V-15 | P3 | `theme.css` 内の相対 `@import` が、テーマフォルダではなく `index.html` を基準に解決されること | HTML Standard と CSS Values 4 からの推論（08 §1） | 08 §1 |
| V-16 | P1 | `.workspace-split.mod-left-split { --background-secondary: X }`（1.14.4 では `.mod-primary-split` も）のようなスコープ再定義を当て、左ドック本体だけが変わり、タブ帯・Ribbon・ステータスバー・Menu・Modal が変わらないこと。ドック内の Search / Bookmarks / Outline / Graph / Bases の継ぎ目、ドラッグ中のオーバーレイ、モバイルの drawer での挙動 | CSS 仕様と app.css からの推論で、実機は未確認（Phase 1B で追加） | 07 R05, Q-D1 |

### 2.3 Inkdrop（v6、macOS。Development Mode の Inspect Element を使用）

| ID | 優先度 | 検証内容 | 理由 | 関連 |
|---|---|---|---|---|
| V-20 | P0 | サイドバー、ノートリスト、エディタ外枠、ヘッダーメニュー、環境設定、通知の各変数が、どの DOM のどのプロパティに適用されるか | 公開ソースに消費箇所がない（06 の「Inkdrop 適用先」列が非公開・混在の行） | 01 §4.1・§10, 07 R12 |
| V-21 | P2 | `--page-background` が画面のどこに露出するか | Obsidian の titlebar 等との対応の根拠 | 06 W01 |
| V-22 | P0 | `--editor-*` の CodeMirror chrome 変数（アクティブ行、ガター、選択、検索一致など）の実際の適用 | CM 拡張内での消費と推定 | 01 §4.2 |
| V-23 | P2 | サイドバー項目の hover、`--sidebar-menu-item-inactive-background` の意味（hover か、非フォーカス選択か） | 状態の対応付けの根拠 | 06 N05 |
| V-24 | P2 | エディタの見出しサイズ、タイトル入力の文字サイズと色 | トークン化されていない | 06 E09・W08 |
| V-25 | P2 | `.md-header-mark` 等の Markdown 記号の実際の色 | 規則が空 | 06 E10 |
| V-26 | P2 | 右クリックメニューが OS ネイティブか HTML か | `--menu-*` の対応先 | 06 G09 |
| V-27 | P2 | ノートタブ、目次、エディタドロワーの有無と配色 | Obsidian のタブ・Outline・右サイドドックとの対応 | 06 W04・W06・N11 |
| V-28 | P3 | `@layer theme` 直下とサブレイヤーの実効的な優先順位 | 仕様と公式ガイドの記述が食い違う。両テーマとも同名変数を重ねないので結果への影響は小さい | 01 §2, 02 §1.2 |
| V-29 | P1 | 実アプリの computed style と描画色。とくに `hsl()` 宣言がどの sRGB 値で描画されるか（Obsidian 側で同じ宣言を使えば一致するという前提の確認）、squircle 角丸の有効性 | `palette.json` は `hsl()` の文字列のままで、描画色の証拠にならない（Phase 1B で判明） | 02 §1.5, 07 R14 |
| V-30 | P0 | 両テーマの実画面スクリーンショット（Obsidian 側との並置比較用の基準画像） | リポジトリのスクリーンショットは撮影バージョン不明 | 02 §14 |
| V-31 | P1 | エディタとプレビューのコードブロックで、各 Lezer タグがどの `tok-*` クラスになるか（例: `t.function(t.variableName)` が `tok-variable-name tok-function` になるか） | tokenHighlighter（`@inkdropapp/cm6-theme-common`）は npm でも公開されておらず（Phase 1B で確認）、対応は `syntax.css` の構造からの推定（Phase 1B で追加） | 03 §6.3, 07 R02 |

---

## 3. 調査で確認できなかった事実（実機以外の手段が必要）

| ID | 内容 | 必要な手段 | 関連 |
|---|---|---|---|
| U-01 | Kanagawa の dragonBlack2 / 3 の入れ替えが意図的か | Inkdrop の作者への確認 | 02 §12, 07 R14 |
| U-02 | Solarized Dark のシンタックス配色（string = yellow 等）の出典 | 作者への確認、旧リポジトリの履歴 | 02 §8.3 |
| U-03 | SD / KD リポジトリに LICENSE ファイルがない点の扱い（著作権表示の文言） | 作者への確認 | 07 §11 |
| U-04 | Community directory の自動レビューのテーマ固有チェック項目の全体、`legacy: true` の意味 | Obsidian 側の追加資料 | 03 §未確認事項 4・6 |
| U-05 | 1 リポジトリで複数テーマを directory に載せる方法の有無 | Obsidian 側の資料、問い合わせ | 08 §1 |
| U-06 | `versions.json` のフォールバックがテーマにも働くか | Obsidian 側の資料 | 03 §1.1 |
| U-07 | 1.9〜1.14 の changelog の原文照合（WebFetch の要約経由で読んだ部分がある） | 各リリースノートの全文確認 | 03 §8.3 |
| U-08 | 公開版ドキュメントと GitHub 原稿 `c56c7e7` の差分（1.14 の新変数の掲載状況） | 公開サイトの確認 | 05 未確認事項 |
| U-09 | Inkdrop v6 のリリースノート（`version-history@072811f` に v6 の記載がない） | Inkdrop の公開情報 | 01 §10 |
| U-10 | ユーザーが使用しているコミュニティプラグイン | ユーザーへの確認（Vault には触れない方針のため未取得） | 07 R16 |
| U-11 | SD / KD が基盤既定色（Tailwind 系）を継承している箇所が、意図的か見落としか | Inkdrop の作者への確認 | 02 §13.4, 07 R13, Q-D9 |
| U-12 | Inkdrop の tokenHighlighter（`@inkdropapp/cm6-theme-common`）のソース | 作者への確認。npm には公開されていない（Phase 1B で確認）。実機の DOM での確認は V-31 | 03 §6.3 |

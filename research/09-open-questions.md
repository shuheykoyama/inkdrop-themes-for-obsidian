# 09. 未解決事項: ユーザー判断と実機検証

- 調査日: 2026-10-09
- 構成
  - **§1 ユーザーが意思決定すべき項目（Q-D）**: 調査では決められず、方針の選択が必要なもの。各項目に選択肢と判断材料を付けた。推奨がある場合は「暫定推奨」として示すが、決定ではない。
  - **§2 アプリ実機で検証すべき項目（V）**: 静的解析では確定できず、Inkdrop または Obsidian を実際に動かして確認する必要があるもの。
  - **§3 調査で確認できなかった事実（U）**: 実機検証以外の手段（作者への問い合わせ、追加の資料）が必要なもの。

---

## 1. ユーザーが意思決定すべき項目

### 配色・忠実度

| ID | 論点 | 選択肢 | 判断材料 | 関連 |
|---|---|---|---|---|
| Q-D1 | Obsidian の左サイドドック（`--background-secondary`）を、Inkdrop のどの面に合わせるか | (a) サイドバー（SD `#073541` / KD `#11110e`） (b) ノートリスト（SD `#002d38` / KD `#181616`） (c) テーマごとに別の基準 | File Explorer は Inkdrop のサイドバーとノートリストの 2 役を担う。SD で (a) を採ると左ペインが画面で最も明るくなり、Inkdrop と同じ印象になる。右サイドドックも同じ変数を使う | 06 W03・§3, 07 R05 |
| Q-D2 | Kanagawa Dragon の色値の正本 | (a) Inkdrop の HSL 宣言値（エディタ背景 `#1e1d1a`） (b) Inkdrop の HEX コメント（`#1D1C19`） (c) 上流 kanagawa.nvim の名前と値（`ui.bg` = `#181616`） | 確定方針は「Inkdrop 版が正本」。Inkdrop が実際に描画するのは HSL 宣言値で、HEX コメントと最大 2/255 ずれる。dragonBlack2 / 3 の名前は上流と逆だが、Inkdrop は初版からこの並び | 02 §2.2・§12, 07 R14 |
| Q-D3 | Solarized Dark の弱い文字色（muted / hover / disabled 等）が base3（クリーム `#fdf6e2`）のアルファになっている点 | (a) そのまま写す (b) Solarized の base0 / base01 などに置き換える | 基盤の「neutral-50 のアルファ」をランプ置換で Solarized 化した副作用で、意図かどうかは不明 | 02 §5, 06 E03 |
| Q-D4 | リンク色の正本（Obsidian は Live Preview と Reading で同じ変数） | (a) プレビュー値（SD cyan / KD dragonGreen2） (b) エディタ値（SD cyan / KD dragonBlue2） (c) ビュー別に塗り分け | SD はプレビューとエディタが同じ cyan で、UI だけ blue。KD はプレビューだけ dragonGreen2 で、コメント（「links dragonBlue2」）と実値が食い違う | 06 E14・E15, 07 R03 |
| Q-D5 | タグの配色 | (a) Obsidian の 1 色方式に Inkdrop の default タグ色を当てる (b) アクセント系の 1 色 (c) タグ名ごとの色分け（直接セレクタ） | Inkdrop のタグはノート属性の 14 色ピルで、本文中の `#tag` とは意味が違う。KD のタグ色は Tailwind 系のまま（漏れ） | 06 E30, 02 §13.4 |
| Q-D6 | アクセント色をユーザー設定に委ねるか | (a) `--accent-h/s/l` に Inkdrop の primary を入れる（ユーザーが変えると変わる） (b) Inkdrop の primary を固定値で各変数に入れる（ユーザー設定が効かない） | アクセント設定は inline style でテーマに勝つ。KD の primary dragonBlue2、SD は blue-500 @90% | 03 §2.5, 06 G01, 07 R07 |
| Q-D7 | Popover・補完ポップアップの背景 | (a) `--background-primary`（エディタ面）のまま (b) Inkdrop の popup 色（SD base04 / KD Black2）にセレクタで再代入 | Obsidian の popover はノート内容を表示するため、エディタ面と同じ色も自然。Inkdrop の popup はエディタより暗い | 06 G10・E41 |
| Q-D8 | フォント | (a) 指定しない（Obsidian 既定 + ユーザー設定） (b) Inkdrop の UI フォントスタックを `--font-interface-theme` に入れる | フォントはユーザー設定（`--font-*-override`）が優先される。Inkdrop のガイドもエディタのフォント指定を避けるよう推奨している | 01 §4.3, 03 §2.5, 06 G26 |
| Q-D9 | Inkdrop テーマ自体の「漏れ」（Tailwind 既定色の残存） | (a) Inkdrop の実際の表示どおり写す (b) テーマのパレット内の色へ寄せる | SD は 94 トークン（info / warning / secondary / GFM important 等）、KD はタグ色・コードブロック枠など。「正本に忠実」と「テーマとしての一貫性」が衝突する | 02 §13.4, 07 R13 |
| Q-D13 | シンタックスハイライトの再現度 | (a) `--code-*` の 10 色に縮約 (b) `.token.*` / `.cm-*` を直接塗って両ビューの意味を揃える (c) (b) に加えて言語別に調整 | Obsidian は同じ変数が両ビューで別トークンを指す。完全一致は不可能 | 07 R02, 06 E21 |
| Q-D14 | エディタとプレビューで値が違う箇所の扱い | (a) どちらか一方に統一 (b) ビュー別に塗り分け | KD の本文（editor `#c5c9c5` / preview 90%）、SD の引用線など | 07 R03, 06 E01・E02 |
| Q-D15 | コントラスト基準を満たさない組み合わせ | (a) Inkdrop の値のまま (b) WCAG AA を満たすよう調整 (c) 本文など主要な組だけ調整 | SD のサイドバー節見出し 2.42、KD のガター文字 2.63 など。Obsidian 公式にコントラスト要件はない | 07 R15, `data/inkdrop-contrast.csv` |

### 範囲・配布

| ID | 論点 | 選択肢 | 判断材料 | 関連 |
|---|---|---|---|---|
| Q-D10 | モバイルの扱い | (a) 対象外（モバイルでは Obsidian 既定の黒背景が出ることを許容） (b) `.is-mobile.theme-dark` 以上の詳細度で base 色を固定 | `.is-mobile.theme-dark`（0,2,0）が `--color-base-00/10/20` を上書きする。(b) はガイドラインの「低詳細度」と緊張関係 | 03 §2.4, 07 R11 |
| Q-D11 | Light モード | (a) Dark のみ（directory の Supported modes で dark だけを申告） (b) Light も用意する | 2 テーマとも Inkdrop では `themeAppearance: "dark"`。847 テーマ中 223 が dark のみ | 03 §4 |
| Q-D12 | Mermaid の再現度 | (a) Obsidian 既定（反転フィルタ） (b) 主要図種だけ (c) 全図種 | Obsidian は配色を受け取る経路がなく、SVG を直接塗る必要がある。Mermaid の DOM 変更に弱い | 07 R04, 06 E33 |
| Q-D16 | Community directory に出すか、リポジトリ構成 | (a) 出す（テーマごとに配布リポジトリが必要と推測） (b) 出さない（手動インストール等） | directory は 1 リポジトリの HEAD に 1 つの `manifest.json` を置く前提。LICENSE 必須 | 08 §1・§5.3 |
| Q-D17 | コミュニティプラグインと Style Settings への対応範囲 | (a) 公式変数経由の間接対応のみ (b) 主要プラグインに個別対応 (c) Style Settings で調整項目を提供 | 確定方針は「コアプラグインが主要範囲、コミュニティは別途分類」 | 07 R16 |
| Q-D18 | テーマ名 | — | "Theme" と "Obsidian" を含められず、投稿後は改名できない。"Kanagawa" 系は既に 5 件登録済み。"Inkdrop" / "Solarized" を含めてよいかは未確認 | 03 §1.2, 04 §9, 07 §11 |
| Q-D19 | 著作権表示と帰属 | — | Inkdrop の SD / KD リポジトリは `package.json` で MIT だが LICENSE ファイルがない。パレットの上流は Osaka（Apache-2.0）、kanagawa.nvim（MIT）、本家 Solarized（MIT）。必要なら Inkdrop の作者に確認する | 07 §11 |
| Q-D20 | 対象 Obsidian バージョン（`minAppVersion`） | (a) 1.14.0 以上（最新の変数体系を前提） (b) 1.13.x も含める | ユーザー環境は 1.13.7、最新安定版は 1.14.4。1.14 で 84 変数追加、`--text-highlight-bg` の既定削除など | 03 §8・§11.1 |
| Q-D21 | ビルド方式とリポジトリ構成の確定 | 08 §3 の案 A〜F、§5.3 の R1〜R3 | 08 §6 の暫定推奨は「素の CSS の連結 + パレット層のみ生成」 | 08 |

---

## 2. アプリ実機で検証すべき項目

### Obsidian（macOS、1.14.4 を主対象。1.13.7 でも確認）

| ID | 検証内容 | 理由 | 関連 |
|---|---|---|---|
| V-01 | テーマ変数を `.theme-dark` で定義したとき、`.mod-macos`・`.theme-dark`（app.css 側）・`body.theme-dark`（Canvas）との優先関係で負ける変数がないか。DevTools の computed style で確認 | 読み込み順（app.css < theme.css）は確認済みだが、computed 値は未確認 | 03 §2.3・§2.4, 07 R06 |
| V-02 | `--accent-h/s/l` と `--font-text-size` の inline 注入が、テーマの値より優先されるか | app.js の静的解析による推測 | 03 §2.5 |
| V-03 | 左右サイドドックの `.mod-left-split` / `.mod-right-split` が実際の DOM に付き、背景の塗り分けに使えるか | app.js の静的解析では付与を確認済み（RTL で左右反転）。実機は未確認 | 05 Workspace, 06 W03・W04 |
| V-04 | `.is-translucent` 有効時の背景と、Inkdrop の acrylic 時の見え方の比較 | 透過度は環境依存 | 06 W11 |
| V-05 | `color-mix(in oklch, …)` による hover・選択色と、Inkdrop の HSL アルファの見え方の差 | 色空間が違う | 08 §5.2 |
| V-06 | ハイライト（`==mark==`）に dark で掛かる `mix-blend-mode: lighten` の下で、指定色がどう見えるか | computed 未検証 | 06 E18 |
| V-07 | `.cm-gutters` の `!important` 指定を、テーマ側が `!important` なしで上書きできるか | app.css L3726 | 06 E07 |
| V-08 | macOS で `body.styled-scrollbars` が付かず、スクロールバー変数が効かないこと（効かない場合、Inkdrop のスクロールバー配色を macOS で再現するかは Phase 2 で判断） | app.js の静的解析では「macOS 以外でのみ付与」を確認済み | 03 §2.2, 06 G22 |
| V-09 | Graph View が `hsl()`、`color-mix()`、`oklch()` を含む色値を正しく解釈するか | app.js の推測 | 05 Obsidian 固有 |
| V-10 | 同梱の Mermaid のバージョン、図種別の DOM、反転フィルタ解除後の描画 | 静的解析では確認できない | 07 R04 |
| V-11 | Live Preview・Source mode・Reading View の各要素が、想定したクラスを持つか（特に `.cm-active`、`.HyperMD-list-line-N`、`.cm-formatting-*`） | クラスの存在は app.css のセレクタから推定 | 03 §6, 05 Editor |
| V-12 | 言語別サンプル（JS、TS、Python、Rust、CSS、HTML、Markdown、Shell 等）で、`.token.*` / `.cm-*` がどの粒度で出るか | トークン割り当て方針の前提 | 07 R02 |
| V-13 | ドキュメント記載の `--input-focus-border-color` 等が一般の入力欄に効かないこと | pdf.js 専用の定義と推測 | 03 §11.2 |
| V-14 | Slides で `--r-*` の上書きが効くか（対応範囲に含める場合のみ） | 推測 | 05 Obsidian 固有 |
| V-15 | `theme.css` 内の相対 `@import` が解決されないこと | textContent での挿入からの推測 | 08 未確認事項 2 |

### Inkdrop（v6、macOS。Development Mode の Inspect Element を使用）

| ID | 検証内容 | 理由 | 関連 |
|---|---|---|---|
| V-20 | サイドバー、ノートリスト、エディタ外枠、ヘッダーメニュー、環境設定、通知の各変数が、どの DOM のどのプロパティに適用されるか | 公開ソースに消費箇所がない | 01 §4.1・§10, 07 R12 |
| V-21 | `--page-background` が画面のどこに露出するか | Obsidian の titlebar 等との対応の根拠 | 06 W01 |
| V-22 | `--editor-*` の CodeMirror chrome 変数（アクティブ行、ガター、選択、検索一致など）の実際の適用 | CM 拡張内での消費と推定 | 01 §4.2 |
| V-23 | サイドバー項目の hover、`--sidebar-menu-item-inactive-background` の意味（hover か、非フォーカス選択か） | 状態の対応付けの根拠 | 06 N05 |
| V-24 | エディタの見出しサイズ、タイトル入力の文字サイズと色 | トークン化されていない | 06 E09・W08 |
| V-25 | `.md-header-mark` 等の Markdown 記号の実際の色 | 規則が空 | 06 E10 |
| V-26 | 右クリックメニューが OS ネイティブか HTML か | `--menu-*` の対応先 | 06 G09 |
| V-27 | ノートタブ、目次、エディタドロワーの有無と配色 | Obsidian のタブ・Outline・右サイドドックとの対応 | 06 W04・W06・N11 |
| V-28 | `@layer theme` 直下とサブレイヤーの実効的な優先順位 | 仕様と公式ガイドの記述が食い違う | 01 §2, 02 §1.2 |
| V-29 | `palette.json` の値と実アプリの computed style の一致度、squircle 角丸の有効性 | 生成環境と実アプリの差 | 01 §7, 02 §15 |
| V-30 | 両テーマの実画面スクリーンショット（Obsidian 側との並置比較用の基準画像） | リポジトリのスクリーンショットは撮影バージョン不明 | 02 §14 |

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

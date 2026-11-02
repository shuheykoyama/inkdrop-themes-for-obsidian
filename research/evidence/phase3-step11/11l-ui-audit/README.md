# G8 と Obsidian 固有 UI の事前調査（2026-11-02、画面を使わない）

[14](../../../14-implementation-plan.md) §6.168 の証拠。既存の `src/`、`tests/spec/`、`research/04`〜`06`、過去の証跡を読んだだけ。Obsidian・Inkdrop・iPhone・画面は操作していない。製品の CSS、検査の判定、ゲートの入力は変えていない。

## 読んだもの

- 実装: `src/common/components/overlays.css`・`navigation.css`・`markdown.css`（Callout）、`mapping/ui.css`・`states.css`・`borders.css`・`workspace.css`・`accent.css`・`text.css`。
- 検査の仕様: `tests/spec/requirements.json`（85 件）、`tests/spec/runtime/desktop.json`（299 件）・`mobile.json`（18 件）。
- 調査: `research/05-obsidian-ui-inventory.md`、`06-mapping-candidates.md`（G01〜G26、O01〜O05）、`04-obsidian-theme-implementations.md`（Minimal・Catppuccin・Things など）。
- 証跡: `phase3-step5`（オーバーレイの Computed Style）、`phase3-step11/11g-g7/iphone-c3`（ツアー 38 枚）、`phase3-step8` ほかのネイティブ画像。

## 事実の整理

- **G8（V-33）** は、Inkdrop のメニュー・モーダル・コマンドパレット・ポップアップを開いて、影・角・余白の見た目と、ノートリストの hover の色を撮る計画。未実施。色は Inkdrop の一次資料のトークンから引いてあり、Obsidian 側の Computed Style と一致を確かめた（`ui.menu`・`ui.prompt`・`ui.settings`・`qd7.popover`・`ui.tooltip` など）。影・角・余白は Inkdrop の値を調べておらず、テーマは Obsidian の既定のまま（計画 §6.8 判断 8）。
- **オーバーレイを実際の画面で見た証跡**: デスクトップには、メニュー・モーダル・Popover・ツールチップなどの撮影はない。値は CDP の実際のポインタ操作で開いて測った（Computed Style）。iPhone のツアーには、クイックスイッチャー（phone と tablet）、ドロワー、Markdown、コードブロック、Mermaid の画像がある。
- **`src/` に規則も変数もない UI**: Canvas、Graph View、Bases、Slider、`:focus-visible` の共通規則、`--hotkey-*`、`--color-base-*`・`--color-<色名>`。`--color-*` は `src/` にコメントでしか出てこない。Canvas の色（`--canvas-color-1..6`）や Graph の色（`--graph-*`）など、これらを参照する Obsidian の既定の変数が、テーマの色を通っているかは、測っていない。
- **検査が一つもない UI**: Canvas、Graph View、Bases、Slider、Search・Backlinks・Outline・Tags の各パネルの中身、PDF、Slides。`md.properties` は仕様にあるが UNVERIFIED（比べる Inkdrop がない）。

## 棚卸しと優先度

優先度は、日常の使用での見える頻度、色が Obsidian の既定のまま残るおそれ、証跡の有無で付けた。「実測なし」は、見た目が良いとは言えないという意味。

| # | UI・状態 | Inkdrop の対応 | 今の CSS とトークン | 実際の表示の証跡 | 問題・未確認 | SD / KD | 優先度 |
|---|---|---|---|---|---|---|---|
| 1 | Properties（ノート上部のメタデータ） | なし（E31） | 専用の規則なし。`--background-primary-alt`（`ui.surface-alt`）と UI の文字・境界の変数を継承 | なし。`md.properties` は UNVERIFIED。iPhone のドロワーなどの画像には出ない | 毎日見る UI。入力欄・ラベル・アイコンの色が、継承だけで整っているか不明 | 両方 | **高** |
| 2 | Canvas（背景・ドット・ノード・エッジ・選択） | なし（O01） | 規則なし。`--canvas-color`・`--canvas-color-1..6`・`--canvas-background` は Obsidian の既定。`body.theme-dark` に詳細度 (0,1,1) がある（research/05） | なし | `--color-<色名>` を定義していないので、ノードの色の 6 色が各テーマの配色にならない可能性が高い（未測定）。Callout の `.canvas-node` の枠・塗りも | 両方 | 高〜中 |
| 3 | Bases（テーブル・カード・カンバン） | なし（表の見出しの色から類推、O03） | `--background-primary-alt` を継承。`--bases-*`（79 変数）は未設定 | なし | 33 変数が未掲載。見出し・行・hover・カンバンの色が、テーマと合うか不明 | 両方 | 中 |
| 4 | Graph View | なし（O02） | `--graph-*` 未設定。JS が `getComputedStyle` で色を読む（research/05） | なし | ノード・線・フォーカスの色が、継承した `--text-muted` やアクセントで決まる。テーマの配色とのなじみは未確認 | 両方 | 中 |
| 5 | 右ドックのパネル（検索結果・バックリンク・アウトライン・タグ）と検索の一致語 | ノートリストの一部が近い | ナビゲーションの変数（`--nav-item-*`）は File Explorer 用に設定。`--text-highlight-bg` は未設定 | `ed.search` はエディタの検索のみ。パネルの中身はなし | パネルの項目の色、一致語の強調、折り畳みの矢印などは未確認 | 両方 | 中 |
| 6 | Callout の Obsidian 固有の種類（question・quote・example など） | GFM の 5 種類だけ対応 | 5 種類は Inkdrop の色。形（左の 0.25em の帯・角丸 0）は全種類に共通。ほかの種類の色は Obsidian のまま（コメントで明記） | iPhone ツアー、`md.callouts` の計算値 | 5 種類以外の色が、テーマの配色と合うかは未確認。形は共通 | 両方 | 中 |
| 7 | コントロールの形（入力欄の枠、ボタンの角、フォーカスの輪、Slider） | 色は対応（G13〜G20）。Slider は対応なし（G21） | 色は `ui.controls` で一致を確認。入力欄の枠は `box-shadow`。`:focus-visible` の共通規則なし（枠色は `--background-modifier-border-focus`）。Slider はアクセント色 | 計算値のみ | Inkdrop の形（角・影・余白）と比べていない（V-33）。フォーカスの輪の見た目は未確認 | 両方 | 中〜低 |
| 8 | メニュー・モーダル・コマンドパレット・設定の形 | あり（G06〜G09） | 色は一致を確認。影・角・余白は既定のまま | 色は計算値。iPhone のクイックスイッチャーは画像あり。デスクトップは画像なし | G8 の対象。形の比較なし。macOS の既定のメニューは OS の描画で、テーマの色にならない | 両方 | 中〜低（G8） |
| 9 | Popover・ツールチップ・通知 | あり（G10〜G12） | 色は一致を確認 | 計算値のみ。ツールチップは不透明の状態だけ測った。popout の窓は未測定 | translucent と popout の窓での見え方 | 両方 | 低 |
| 10 | ステータスバーの同期の表示、タイトルバー、タブ、Ribbon、File Explorer | あり（O05 は Low。ほかは Direct） | 背景・境界・選択・フォーカスの帯は一致を確認 | ネイティブ画像（工程 4・8・11）、V-38 の比較は未実施 | 同期のアイコン・Publish の状態の色は未確認 | 両方 | 低（V-38 で補う） |
| 11 | Scrollbar | あり（G22） | 変数のみ。`body.styled-scrollbars` の下でだけ効き、macOS では付かない | 値のみ | Windows・Linux では未確認。macOS と iOS には影響しない | 両方 | 低 |
| 12 | PDF・Slides・Web viewer・Publish | なし（O04） | テーマの配色の対象外または限定的 | なし | 対象外としてよい。PDF の注釈の反転フィルタは Obsidian の実装 | 両方 | 対象外 |

## Minimal・Things などを参考にする箇所

`research/04` で読み済みの内容に基づく。新しく取得したものはない。実物のソースは、実際に手を入れる段階で読む。

| 対象 | 参考にする点 | 根拠 |
|---|---|---|
| Properties | 変数の調整（`--metadata-label-width`・`--metadata-label-font-size` など）で整える。規則は最小に | Minimal（research/04 §1） |
| Bases | `--bases-*` の変数で表の罫線や余白を調整。必要な箇所だけ直接セレクタ | Minimal（`root.scss`・`app/bases.scss`）。Catppuccin は対応なし |
| Canvas | ノードの色は `--canvas-color-*` を各テーマの色で定義。themed ノードは `color-mix` で枠と塗りを弱める | Catppuccin の `pages/_canvas.scss`、Minimal の `plugins-core/canvas.scss`（27 行） |
| Graph View | 専用の規則は持たず、`--graph-*` を明示して Inkdrop の配色に置く。Minimal・Catppuccin は規則を持たない | research/04 §1・§2 と「今回の移植への転用」 |
| 未対応 UI のフォールバック | `--color-base-00..100` と `--color-<色名>` を全段割り当てる（Catppuccin 方式）と、Canvas・Graph・Slider などの継承の品質が上がる | research/04 §8・§9 |
| チェックボックス・タスク | Things の `data-task` 別アイコン。Inkdrop に対応がある範囲では Inkdrop が優先 | research/04 §4 |

注意: 配色や装飾は写さない。各テーマの配色とデザイン言語に合わせる。

## 次に行うこと（提案。画面を使わない順）

1. **Computed Style の測定（隔離した Obsidian、撮影なし）**: Properties・Canvas・Graph・Bases・右ドックのパネルを表示する小さな Vault で、`--canvas-color-*`・`--graph-*`・`--bases-*`・`--color-<色名>` の最終的な値を読む。各テーマの配色との関係を数値で分類する。製品の CSS は変えない。
2. **分類の結果で、手を入れる範囲を決める**: 変数 1 つを足せば直るもの（`--color-*` の割り当て、`--graph-*`、`--canvas-color-*`）を優先する。直接セレクタは最後。
3. **画像での確認**: 手を入れる前後を、隔離した Obsidian の画像で見る。画像の撮影は画面を使うので、ユーザーの準備を待つ。
4. **G8**: ユーザーの準備を待つ。本番の Inkdrop を操作する。

## 確かめていないこと

- 上の表の「未確認」の項目は、すべて実測していない。コードから、見た目が良いとは言えない。
- `--color-*` の未定義が、Canvas・Graph の色にどう効くかは、Obsidian 1.14.4・1.14.5 の `app.css` を読んでいない（research/04・05 の記述による）。

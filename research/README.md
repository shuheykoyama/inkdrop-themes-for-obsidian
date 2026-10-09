# Phase 1 調査資料: Inkdrop テーマの Obsidian 移植

Inkdrop の公式テーマ **Solarized Dark** と **Kanagawa Dragon** を Obsidian へ忠実に移植するための技術調査である。テーマの実装は行っていない。

- 調査日: 2026-10-09
- 対象バージョン: Inkdrop v6 系テーマ（`@inkdropapp/css@add48d9`、`solarized-dark@4337f6e` v2.2.1、`kanagawa@f9c14a5` dragon v1.2.1）、Obsidian 1.14.4（最新安定版、主対象）と 1.13.7（ユーザー環境）
- 正本: **Inkdrop 公式テーマのデザイン仕様**。Kanagawa は上流の kanagawa.nvim ではなく Inkdrop 版、Solarized は本家や Solarized Osaka ではなく Inkdrop 版を正とする。

---

## 資料の構成と読み方

| ファイル | 内容 | 主な読者・用途 |
|---|---|---|
| [00-sources.md](00-sources.md) | 参照したリポジトリ（SHA）、アプリの版、Web ページ、生成データ | 出典の確認 |
| [01-inkdrop-theme-system.md](01-inkdrop-theme-system.md) | Inkdrop v6 のテーマシステム（パッケージ構造、Cascade Layers、トークン体系、`light-dark()`、UI / Syntax / Preview / Mermaid、継承） | Inkdrop の仕組みを知る |
| [02-inkdrop-theme-analysis.md](02-inkdrop-theme-analysis.md) | Solarized Dark と Kanagawa Dragon のデザイン仕様（パレット、背景階層、状態色、Markdown、シンタックス、Mermaid、上流との違い、他テーマとの比較） | 移植元の値を知る |
| [03-obsidian-theme-system.md](03-obsidian-theme-system.md) | Obsidian の公式テーマ仕様（manifest、変数の定義場所、詳細度、Light / Dark、モバイル、CM6 / Reading、ガイドライン、非推奨、配布） | Obsidian の仕組みを知る |
| [04-obsidian-theme-implementations.md](04-obsidian-theme-implementations.md) | 既存 Obsidian テーマ 7 件の実装パターン、推奨パターンとアンチパターン | 実装方法の参考 |
| [05-obsidian-ui-inventory.md](05-obsidian-ui-inventory.md) | Obsidian の主要 UI 要素 108 件の棚卸し（変数・セレクタ・状態） | 移植先の全体像 |
| [06-mapping-candidates.md](06-mapping-candidates.md) | Inkdrop ↔ Obsidian の UI 対応候補 97 件（Direct / Semantic / Obsidian-native、確信度、SD / KD の差） | Phase 2 の配色設計の起点 |
| [07-technical-risks.md](07-technical-risks.md) | 技術課題とリスク 21 件（忠実度、互換性、保守性、アクセシビリティ、ライセンス）と選択肢 | 設計判断の材料 |
| [08-architecture-options.md](08-architecture-options.md) | 実装方式の選択肢（手書き CSS、素の CSS の連結、Sass、PostCSS、Lightning CSS、トークン生成）と暫定推奨 | 設計判断の材料 |
| [09-open-questions.md](09-open-questions.md) | ユーザー判断事項 21 件（Q-D）、実機検証項目 26 件（V）、その他の未確認事項 10 件（U） | **次に決めること** |

推奨する読み順:

1. 全体像を掴むなら **README → 09 → 06 §2・§3 → 07 §0**。
2. Inkdrop の値の根拠を確認するなら **02 → 01**。値の一次データは `data/inkdrop-*-tokens.csv`。
3. Obsidian 側の制約を確認するなら **03 §0 → 05 → 04 §8**。

### 主要な技術的発見

詳細と出典は各資料にある。ここでは結論と参照先だけを示す。

1. **背景の奥行きが 2 テーマで逆である。** Solarized Dark はサイドバーが最も明るく、Kanagawa Dragon はエディタが最も明るい。Obsidian の左右サイドドックは同じ `--background-secondary` を共有するため、Inkdrop の 3 面（サイドバー / ノートリスト / エディタ）を 2 段に縮約することになる（02 §4、06 §2・§3、07 R05）。
2. **Kanagawa Dragon の正本値は上流と違う。** Inkdrop 版は kanagawa.nvim の dragonBlack2 / 3 と名前が逆で、エディタ背景は上流の `ui.bg`（`#181616`）ではなく `#1D1C19` 系である。実際に描画されるのは HSL 宣言から計算した `#1e1d1a` で、HEX コメントとは最大 2/255 ずれる（02 §2.2・§12、07 R14）。
3. **Obsidian では詳細度と inline 注入でテーマ変数が負ける箇所がある。** `body` で書いた変数は `.theme-dark` に、`.theme-dark` で書いた変数も `body.theme-dark`（Canvas）や `.is-mobile.theme-dark` に負ける。アクセント色とフォントはユーザー設定が inline style で優先される（03 §2.4・§2.5、07 R06・R07）。
4. **シンタックスハイライトは完全には一致させられない。** Obsidian の `--code-*` は 10 色で、同じ変数が Reading（Prism）と編集時（CM）で別のトークンを指す（03 §6.3、07 R02）。
5. **CSS 変数では表現できない見た目がある。** Mermaid（Obsidian は dark で反転フィルタを掛けるだけ）、アクティブ行、ガター、リストマーカーの階層色、タグの色分けなど（05 直接セレクタ表、07 R01・R04）。macOS ではスクロールバー変数が効かない見込み（`styled-scrollbars` は macOS 以外でのみ付与。06 G22）。
6. **Inkdrop テーマ自体に基盤の Tailwind 既定色が残っている。** Solarized Dark は 94 トークン、Kanagawa Dragon はタグ色など（02 §13.4、07 R13）。
7. **移植元のリポジトリに LICENSE ファイルがない。** 両テーマとも MIT の宣言は `package.json` だけである（07 §11）。

### レビューの重点

外部レビューでは、特に次の資料と論点を確認してほしい。

| 資料 | 確認してほしい点 |
|---|---|
| 05 | Obsidian の UI 要素の網羅性、`variable` / `selector` / `both` の判定の妥当性 |
| 06 | 分類（Direct / Semantic / Obsidian-native）と確信度の妥当性。特に確信度 Low の 13 行と、§3 のテーマ間で判断が分かれる論点。色名の類似で対応付けていないか |
| 07 | リスクの見落とし、重大度の付け方、忠実度とアクセシビリティの衝突（§14）の扱い |
| 08 | 評価軸と比較表の妥当性、暫定推奨（素の CSS の連結 + パレット層のみ生成）の根拠 |
| 09 | Q-D（判断）・V（実機検証）・U（その他）の分類が適切か、漏れがないか |

### Phase 2 で検討すべき事項

1. 09 の Q-D（21 件）の判断。特に Q-D1（左サイドドックの基準面）、Q-D2（Kanagawa の色値の正本）、Q-D4（リンク色）、Q-D9（Tailwind 色の漏れ）、Q-D15（コントラスト）、Q-D16（directory 配布とリポジトリ構成）。
2. 09 V-01（テーマ変数が本体の定義に負けないか）をはじめとする実機検証。結果次第で、マッピング層の書き方と共通化の範囲が変わる。
3. 06 の候補から配色仕様を確定すること。
4. 08 の実装方式の確定。

### 機械可読データ（`data/`）

| ファイル | 件数 | 内容 |
|---|---|---|
| `inkdrop-base-tokens.csv` | 2,372 定義 | 基盤 CSS のトークン（レイヤー、条件、参照、公開ソースでの消費箇所） |
| `inkdrop-solarized-dark-tokens.csv` | 2,356 | SD 適用時の全トークンの宣言値と解決値（`source=theme/base`） |
| `inkdrop-kanagawa-dragon-tokens.csv` | 2,395 | KD 適用時の同上 |
| `inkdrop-palettes.json` | — | 両テーマのパレットと上流（Osaka、本家 Solarized、kanagawa.nvim）との対応 |
| `obsidian-css-variables-1.14.4.csv` | 1,235 | Obsidian の CSS 変数（掲載の有無、既定値、定義セレクタ、1.13.7 との差分） |
| `obsidian-ui-inventory.csv` | 108 | Obsidian の UI 要素の棚卸し |
| `mapping-candidates.csv` | 97 | 対応候補（SD / KD の値は上記トークン CSV から機械抽出） |
| `inkdrop-contrast.csv` | 30 | 主要な文字色・背景色の組のコントラスト比 |

### 表記の約束

- 出典は `repo@SHA7 path:line`。SHA の全桁は 00 にある。Obsidian 本体は `app.css L<行>`（1.14.4）と書く。
- 確度は **確認済み / 推測 / 未確認** を書き分けている（資料によって `[確認済]`、`【確認済】` など括弧の形が異なるが意味は同じ）。
- 値はすべて **宣言値**（ソース上の値を `var()` 展開したもの）である。実アプリの Computed Style は取得していない。例外として、Inkdrop の `palette.json`（ブラウザで抽出した computed 値）との突合は行い、1,638 / 1,638 件一致した。
- SD = Solarized Dark、KD = Kanagawa Dragon。

### 資料間で数値が異なる箇所

| 項目 | 03 | 05 | 理由 |
|---|---|---|---|
| Obsidian の変数の総数 | 1,177（pdf.js 部を含む全体）/ 1,052（Obsidian 部、L1998 以降の全セレクタ） | 961（`body` / `:root` / `.theme-dark` に定義されたもの） | 数える範囲が違う。どちらも 1.14.4 の `app.css` |
| ドキュメント未掲載の変数 | 422 | 333 | 同上（母数の違い） |
| `body` で定義される変数 | 899 宣言（§0） | 876 個（L2020〜2980） | 05 は L2020〜2980 の主ブロックのみ。`body` を単独セレクタとする規則は app.css に 5 つあり、統合時の再計測では合計 893 宣言だった。03 の 899 との差 6 件は数え方の違いと推測するが、特定できていない |
| `:focus-visible` を含む行 | 47 箇所 | 49 箇所 | 49 は `app.css` 全体、47 は Obsidian 部（L1995 以降）の行数（`grep -c` で再計測して確認）。差の 2 件は pdf.js 部 |

---

## 調査範囲と完了状況

| タスク | 状況 | 備考 |
|---|---|---|
| A-1 Inkdrop 公式仕様 | 完了 | api-docs 原稿と公開ページの一致を確認 |
| A-2 基盤 CSS の解析 | 完了（静的解析） | 変数の適用先の多くが非公開 CSS で、確認できない（09 V-20） |
| A-3 移植対象テーマの解析 | 完了（静的解析） | 解決値は `palette.json` と全件一致 |
| A-4 その他の Inkdrop テーマ | 完了 | Default Dark / Light、Solarized Light、Nord Light、Gruvbox、Kanagawa Wave / Lotus、旧 syntax テーマ |
| B-1 Obsidian 公式仕様 | 完了 | changelog は要約経由（09 U-07） |
| B-2 既存テーマの実装 | 完了 | Minimal と Catppuccin は重点、他は特徴的な点 |
| C UI の棚卸し | 完了（デスクトップ） | モバイル固有の上書き、コミュニティプラグイン UI、Publish サイトは対象外 |
| D マッピング候補 | 完了（候補段階） | 確信度 Low 13 件、実機検証が必要な行あり |
| E 技術課題と実装候補 | 完了 | ディレクトリ構造とビルドツールは未確定（意図どおり） |
| 実機検証 | **未実施** | Inkdrop と Obsidian のどちらも起動していない（09 §2） |

### 意図的に行っていないこと

- テーマの実装、`theme.css` などの成果物の生成、ビルドシステムや依存関係の導入
- Obsidian の Vault、設定、CSS スニペット、Inkdrop の設定の変更
- 外部リポジトリへの変更、GitHub への push、PR 作成、git commit

### 未調査の範囲

- Obsidian のモバイル版（`.is-mobile` 系）の詳細
- コミュニティプラグイン個別の UI（ユーザーの利用プラグインも未確認）
- Obsidian Publish の公開サイト（`publish.css`）、PDF 本文、Web viewer の表示ページ
- Inkdrop のモバイルアプリ
- 両アプリの実画面の比較（スクリーンショットの並置）

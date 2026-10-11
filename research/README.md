# Phase 1 調査資料: Inkdrop テーマの Obsidian 移植

Inkdrop の公式テーマ **Solarized Dark** と **Kanagawa Dragon** を Obsidian へ忠実に移植するための技術調査である。テーマの実装は行っていない。

- 調査日: 2026-10-09（Phase 1）。同日に独立レビューへの対応（Phase 1B）を行い、結論の一部を訂正した。経緯は [10-review-remediation.md](10-review-remediation.md)。
- 対象バージョン: Inkdrop v6 系テーマ（`@inkdropapp/css@add48d9`、`solarized-dark@4337f6e` v2.2.1、`kanagawa@f9c14a5` dragon v1.2.1）、Obsidian 1.14.4（最新安定版、主対象）と 1.13.7（ユーザー環境）。Phase 1B でも入力ソースの版は変えていない。
- 正本: **Inkdrop 公式テーマのデザイン仕様**。Kanagawa は上流の kanagawa.nvim ではなく Inkdrop 版、Solarized は本家や Solarized Osaka ではなく Inkdrop 版を正とする。

---

## 資料の構成と読み方

| ファイル | 内容 | 主な読者・用途 |
|---|---|---|
| [00-sources.md](00-sources.md) | 参照したリポジトリ（SHA）、アプリの版、Web ページ、生成データと再現手順 | 出典の確認 |
| [01-inkdrop-theme-system.md](01-inkdrop-theme-system.md) | Inkdrop v6 のテーマシステム（パッケージ構造、Cascade Layers、トークン体系、`light-dark()`、UI / Syntax / Preview / Mermaid、継承） | Inkdrop の仕組みを知る |
| [02-inkdrop-theme-analysis.md](02-inkdrop-theme-analysis.md) | Solarized Dark と Kanagawa Dragon のデザイン仕様（パレット、背景階層、状態色、Markdown、シンタックス、Mermaid、上流との違い、他テーマとの比較） | 移植元の値を知る |
| [03-obsidian-theme-system.md](03-obsidian-theme-system.md) | Obsidian の公式テーマ仕様（manifest、変数の定義場所、詳細度、Light / Dark、モバイル、CM6 / Reading、ガイドライン、非推奨、配布） | Obsidian の仕組みを知る |
| [04-obsidian-theme-implementations.md](04-obsidian-theme-implementations.md) | 既存 Obsidian テーマ 7 件の実装パターン、推奨パターンとアンチパターン | 実装方法の参考 |
| [05-obsidian-ui-inventory.md](05-obsidian-ui-inventory.md) | Obsidian の主要 UI 要素 108 件の棚卸し（変数・セレクタ・状態） | 移植先の全体像 |
| [06-mapping-candidates.md](06-mapping-candidates.md) | Inkdrop ↔ Obsidian の UI 対応候補 97 件（Direct / Semantic / Obsidian-native、確信度、Inkdrop 側の適用先の可視性、SD / KD の差） | Phase 2 の配色設計の起点 |
| [07-technical-risks.md](07-technical-risks.md) | 技術課題とリスク 21 件（忠実度、互換性、保守性、アクセシビリティ、ライセンス）と選択肢 | 設計判断の材料 |
| [08-architecture-options.md](08-architecture-options.md) | 実装方式の選択肢（手書き CSS、素の CSS の連結、Sass、PostCSS、Lightning CSS、トークン生成）と暫定推奨 | 設計判断の材料 |
| [09-open-questions.md](09-open-questions.md) | ユーザー判断事項 23 件（Q-D。2026-10-11 時点で 20 件が確定、§0.1）、実機検証項目（V、優先順位付き）、その他の未確認事項 12 件（U） | **確定した設計判断と残る判断** |
| [10-review-remediation.md](10-review-remediation.md) | 独立レビュー（R-01〜R-12）の判定、根拠、修正内容、残る不確実性、Phase 2 へ進む条件 | 訂正の経緯 |
| [11-runtime-validation.md](11-runtime-validation.md) | Phase 2B の実機検証（Obsidian 1.14.4 の CSS 優先関係・DOM・背景のスコープ再定義、Inkdrop 6.1.5 の背景面・状態色・エディタと基準スクリーンショット、半透明（acrylic）表示のネイティブキャプチャ）と、Inkdrop 配布物の静的解析。Q-D1 の選択肢別の技術評価 | **Q-D1 の判断材料** |
| [12-obsidian-translucency-validation.md](12-obsidian-translucency-validation.md) | V-04: Obsidian 1.14.4 の translucent の仕組み、translucent 時の CSS 優先関係、Inkdrop の acrylic 宣言値を当てた合成結果と V-32 との比較、Q-D22 の各案の技術評価 | **Q-D22 の判断材料** |
| [13-q-d21-build-poc.md](13-q-d21-build-poc.md) | Q-D21: ビルド方式（PostCSS / 素の CSS の連結 / Sass）の比較 PoC。同じ仕様を 3 方式で実装し、値の忠実度・再現性・Obsidian での適用・変更容易性を実測 | **Q-D21 の判断材料** |
| [14-implementation-plan.md](14-implementation-plan.md) | Phase 3 の実装計画（アーキテクチャ、12 工程と完了条件、テスト戦略、リスク管理、実装前の自己レビュー）。確定した設計判断（09 §0.1）が前提 | **次の作業** |
| [poc/q-d21-build/](poc/q-d21-build/README.md) | 13 の PoC（ソース、ビルド、テスト、実行結果）。完成版のテーマではない | 実測の確認 |
| [evidence/phase2-p0/](evidence/phase2-p0/README.md) | 11 の証拠（スクリーンショット、Computed Style の測定値、診断用 CSS / JS、テスト Vault） | 実測の確認 |
| [evidence/phase2-v04/](evidence/phase2-v04/README.md) | 12 の証拠（ネイティブキャプチャ、Computed Style、画素の計測値、診断用 CSS、ツール） | 実測の確認 |
| [tools/](tools/README.md) | `data/` を再生成するスクリプト、入力ソースの取得手順、検証手順 | 再現性の確認 |

推奨する読み順:

1. 全体像を掴むなら **README → 10 §1 → 09 → 06 §2・§3 → 07 §0**。
2. Inkdrop の値の根拠を確認するなら **02 → 01**。値の一次データは `data/inkdrop-*-tokens.csv`。
3. Obsidian 側の制約を確認するなら **03 §0 → 05 → 04 §8**。

### 主要な技術的発見

詳細と出典は各資料にある。ここでは結論と参照先だけを示す。Phase 1B で訂正した項目には（訂正）と書いた。

1. **背景の奥行きが 2 テーマで逆である。** Solarized Dark はサイドバーが最も明るく、Kanagawa Dragon はエディタが最も明るい（02 §4）。
   - （訂正）Obsidian の公式変数だけを使うなら、ペイン本体の地色は 2 色（ノート領域と、左右ドック共通の `--background-secondary`）になる。ただし、docs 未掲載のクラスへのスコープ再定義を使えば、3 段以上の背景を表現できる（例: `.workspace-split.mod-left-split { --background-secondary: … }` で左右のドックを塗り分ける）。制約として、一部の手段（`mod-primary-split`、`--sidebar-tab-container-background`）は 1.14 以降にしかない。ドックの最上段のタブ帯は、公式変数だけではタイトルバーの色と連動するが、限定したセレクタ（`.mod-left-split .workspace-tabs.mod-top`）を使えば分離できる（11 §8.2。docs 未掲載のクラスへの依存が保守上のリスク）。
   - 一方、Inkdrop の横並びの 2 ペイン（サイドバー｜ノートリスト）という**構造**は、テーマ CSS では再現できない（06 §2、07 R05、09 Q-D1）。
2. **Kanagawa Dragon の正本値は上流と違う。** Inkdrop 版は kanagawa.nvim の dragonBlack2 / 3 と名前が逆で、エディタ背景は上流の `ui.bg`（`#181616`）ではなく、HSL 宣言 `hsl(45deg 7% 11%)`（コメントの HEX は `#1D1C19`）である。
   - （訂正）この HSL を 8 ビットの sRGB に換算すると `#1e1d1a` になるが、これは**計算値**で、描画色を測ったものではない。最も厳密なのは、Obsidian 側でも同じ `hsl()` 宣言を書くことである（02 §2.2・§12、07 R14）。
3. **Obsidian では詳細度と inline 注入でテーマ変数が負ける箇所がある。** `body` で書いた変数は `.theme-dark` に、`.theme-dark` で書いた変数も `body.theme-dark`（Canvas）や `.is-mobile.theme-dark` に負ける。アクセント色とフォントはユーザー設定が inline style で優先される（03 §2.4・§2.5、07 R06・R07）。
4. **（訂正）シンタックスハイライトは、公式変数だけでは再現できず、直接セレクタを併用しても上限がある。**
   - Obsidian の `--code-*` は 10 色で、同じ変数が Reading（Prism の `.token.*`）と編集時（CM5 モード由来の `.cm-*`）で別のトークンを指す。ただし、これは `.cm-*` / `.token.*` を直接塗れば回避できる。
   - 上限を決めるのはトークナイザが出すクラスの粒度である。例として、編集時の JS では関数呼び出しと変数参照がどちらも `cm-variable` になり、CSS では区別できない。
   - 全体の一致度は言語ごとに未検証である（03 §6.3、07 R02、09 V-12）。
5. **CSS 変数では表現できない見た目がある。** Mermaid（Obsidian は dark で反転フィルタを掛けるだけ）、アクティブ行、ガター、リストマーカーの階層色、タグの色分けなど（05 直接セレクタ表、07 R01・R04）。macOS ではスクロールバー変数が効かない見込み（`styled-scrollbars` は macOS 以外でのみ付与。06 G22）。
6. **（表現を訂正）Inkdrop テーマの一部は、基盤の既定色（Tailwind 系）を継承している。** Solarized Dark は 94 トークン、Kanagawa Dragon はタグ色など。意図的かどうかは不明で、Inkdrop で実際に表示される色である（02 §13.4、07 R13、09 Q-D9）。
7. **移植元のリポジトリに LICENSE ファイルがない。** 両テーマとも MIT の宣言は `package.json` だけである（07 §11）。
8. **（Phase 1B で追加）`data/` は記録済みの SHA から再現できる。** 入力を取り直して再生成した結果、8 ファイルすべてがコミット済みのデータとバイト単位で一致した（00 §6、[tools/README.md](tools/README.md)）。
9. **（Phase 2B、VERIFIED）Obsidian 1.14.4 の実機で、静的解析の予測どおりのカスケードを確認した。** `.theme-dark` での定義は app.css の `.theme-dark` と `.mod-macos` に勝ち、`body` だけの定義と `body.theme-dark` の規則には負ける。左右ドック、File Explorer の内部、左ドックのタブ帯は、それぞれ別の背景色にできた。モバイル（エミュレーション）ではドロワーの変数 `--mobile-sidebar-background` を使う必要がある（11 §7・§8）。
10. **（Phase 2B、VERIFIED）Inkdrop 6.1.5 の実機で、サイドバー・ノートリスト・エディタが横に並ぶ独立した面であること、選択状態の `*-active-background` が塗りではなくフォーカス時の左 5px のバーであることを確認した。** 主要な背景面・境界線・選択状態の 32 項目で、静的予測と実機の Computed Style が全件一致した。両テーマの基準スクリーンショット（不透明表示）も取得した（11 §14）。
11. **（Phase 2B、VERIFIED）macOS の Inkdrop の既定は半透明（acrylic）表示で、各面の色が不透明時と変わる。** Solarized Dark ではサイドバーが base03 の 50%、ノートリストが neutral-900 の 70% になる。また、アクティブ行とガターは Inkdrop の既定では表示されない。どちらを忠実度の基準にするかは新しい判断事項（09 Q-D22・Q-D23）。
12. **（Phase 2B、V-32、VERIFIED）acrylic 表示の実際の見え方をネイティブの画面キャプチャで確認した。** この環境では、合成結果は背後のウィンドウの柄にもフォーカスの有無にも依存せず、各面がほぼ一定の暗い灰色の下地に重なった見た目になった。Solarized Dark は明度の順（サイドバー > ノートリスト > エディタ）を保ったまま差が縮み、Kanagawa Dragon は 3 面がほぼ同じ明るさになる（不透明時の順は崩れる）。画素値はディスプレイの色空間の合成結果で、CSS の値ではない。壁紙の影響は未確認（11 §15）。
13. **（V-04、VERIFIED）Obsidian の translucent で、Inkdrop の acrylic の見た目をほぼ再現できた（この環境、アクティブ時）。** Obsidian は macOS でだけ `setVibrancy("sidebar")` を使い（Inkdrop は `under-window`）、左右ドック・タブ帯・Ribbon を `transparent !important` にする。テーマは `.workspace-leaf-content` と中央のノート領域なら `!important` なしで半透明の面を描け、Inkdrop の acrylic 宣言値をそのまま置くと、合成後の画素が V-32 と ΔE2000 0.4 未満で一致した。タブ帯・Ribbon まで塗るには `!important` が要り、非アクティブ時は Obsidian だけマテリアルの見た目が変わる。`.is-translucent` の 1 条件で不透明配色と切り替えられる（12）。

### レビューの重点

外部レビューでは、特に次の資料と論点を確認してほしい。

| 資料 | 確認してほしい点 |
|---|---|
| 05 | Obsidian の UI 要素の網羅性、`variable` / `selector` / `both` の判定の妥当性 |
| 06 | 分類（Direct / Semantic / Obsidian-native）と確信度の妥当性。確信度 Low の 13 行、「Inkdrop 適用先」が非公開・混在の 42 行、§3 のテーマ間で判断が分かれる論点。色名の類似で対応付けていないか |
| 07 | リスクの見落とし、重大度の付け方、忠実度とアクセシビリティの衝突（§14）の扱い。Phase 1B で訂正した R02・R05 |
| 08 | 評価軸と比較表の妥当性、暫定推奨の根拠（Phase 1B で根拠が弱まったことを明記） |
| 09 | Q-D（判断）・V（実機検証）・U（その他）の分類、V の優先順位 |
| 10 | レビュー指摘への判定（とくに PARTIAL・REJECT）の妥当性 |

### Phase 2 で検討すべき事項

> **2026-10-11 更新**: Q-D16・Q-D18・Q-D19 を除くすべての Q-D が確定し、Q-D21 は Vanilla CSS + PostCSS（`postcss-import`）で正式確定した。Q-D23 は仕様が変わり、アクティブ行のハイライトと行番号の両方を ON として Inkdrop の配色を再現する（09 §0.1・§0.1.2）。実装計画は [14](14-implementation-plan.md)。以下は Phase 2 時点の記録である。

1. 09 §1 の Q-D のうち「Phase 2 前半」のもの。Q-D2・Q-D6・Q-D9・Q-D10・Q-D13・Q-D15・Q-D20・Q-D21 はユーザーが確定済み（09 §0.1）。未決定で先に必要なのは Q-D22（不透明表示と半透明表示のどちらを基準にするか）と Q-D1（サイドドックと帯への色の割り当て。Q-D22 と同時に判断）。Q-D23（アクティブ行・ガター）は Phase 2 後半。Q-D16（directory 配布）は配布前まで保留できる。
2. 09 §2.1 の P0 の実機検証（V-30、V-20・V-22、V-01）は完了した（11 §7・§14・§15）。V-04（Obsidian の translucent）も P1 として実施した（12）。残る P1 は V-10・V-11（一部）・V-12・V-29（一部）・V-31（一部）。
3. 06 の候補から配色仕様を確定すること。
4. 実装方式の最終確定。Q-D21 で「Vanilla CSS + PostCSS（`postcss-import`）を第一候補とし、小規模な技術検証で最終確定する」ことがユーザーにより決まっている（09 §0.1）。次に必要なのはこの第一候補の小規模な技術検証である（08 の比較表は判断材料として残す）。→ 2026-10-11 に PoC を実施し（13）、独立レビューを経て正式確定した（09 §0.1）。

### 機械可読データ（`data/`）

| ファイル | 件数 | 内容 |
|---|---|---|
| `inkdrop-base-tokens.csv` | 2,372 定義 | 基盤 CSS のトークン（レイヤー、条件、参照、公開ソースでの消費箇所） |
| `inkdrop-solarized-dark-tokens.csv` | 2,356 | SD 適用時の全トークンの宣言値と解決値（`source=theme/base`） |
| `inkdrop-kanagawa-dragon-tokens.csv` | 2,395 | KD 適用時の同上 |
| `inkdrop-palettes.json` | — | 両テーマのパレットと上流（Osaka、本家 Solarized、kanagawa.nvim）との対応 |
| `obsidian-css-variables-1.14.4.csv` | 1,235 | Obsidian の CSS 変数（掲載の有無、既定値、定義セレクタ、1.13.7 との差分） |
| `obsidian-ui-inventory.csv` | 108 | Obsidian の UI 要素の棚卸し |
| `mapping-candidates.csv` | 97 | 対応候補（SD / KD の値と「Inkdrop 適用先」はトークン CSV から機械抽出） |
| `inkdrop-contrast.csv` | 30 | 主要な文字色・背景色の組のコントラスト比 |
| `inkdrop-consumers-6.1.5.csv` | 277 | （Phase 2B）Inkdrop 6.1.5 配布物の本体 CSS / JS で、06 の非公開・混在 42 行のトークンが使われている箇所（STATIC） |

生成と検証の手順は [tools/README.md](tools/README.md) にある。

### 表記の約束

- 出典は `repo@SHA7 path:line`。SHA の全桁は 00 にある。Obsidian 本体は `app.css L<行>`（1.14.4）と書く。
- 確度は **確認済み / 推測 / 未確認** を書き分けている（資料によって `[確認済]`、`【確認済】` など括弧の形が異なるが意味は同じ）。「確認済み」の多くは**静的解析による確認**で、実機の挙動の確認ではない。
- 値はすべて **宣言値**（ソース上の値を `var()` 展開したもの）である。実アプリの Computed Style と描画色は取得していない。
  - Inkdrop の `palette.json`（theme-dev-helpers の harness 上の値）とは 1,638 / 1,638 件一致した。
  - （訂正）`palette.json` は、`var()` の展開をブラウザで、`light-dark()` の分岐をツールの文字列処理で行ったもので、この 2 テーマでは色が `hsl(…)` の文字列のまま記録されている。この一致は本調査の解決結果と harness の結果が一致したことを示すだけで、実アプリ上の値や描画色の裏付けではない（02 §1.5）。
- SD = Solarized Dark、KD = Kanagawa Dragon。

### 資料間で数値が異なる箇所

| 項目 | 03 | 05 | 理由 |
|---|---|---|---|
| Obsidian の変数の総数 | 1,177（pdf.js 部を含む全体）/ 1,052（Obsidian 部、L1998 以降の全セレクタ） | 961（`body` / `:root` / `.theme-dark` に定義されたもの） | 数える範囲が違う。どちらも 1.14.4 の `app.css` |
| ドキュメント未掲載の変数 | 422 | 333 | 同上（母数の違い） |
| `body` で定義される変数 | 899 宣言（§0） | 876 個（L2020〜2980） | （Phase 1B で解消）899 は、セレクタがちょうど `body` で `@media` の外にある宣言の総数。内訳は主ブロック L2020〜2980 の 876、フォント系 L3187〜3202 の 16、L4293〜4296 の 4、L9595〜9596 の 2、L18185 の 1。これに `@media print` 内の 1 件を加えると 900。05 の 876 は主ブロックだけを数えたもの。Phase 1 の README にあった「893」は、統合時の簡易な正規表現による数え漏れで、誤りだった（`tools/cssvars.py` の解析器で再計測） |
| `:focus-visible` を含む行 | 47 箇所 | 49 箇所 | 49 は `app.css` 全体、47 は Obsidian 部（L1995 以降）の行数（`grep -c` で再計測して確認）。差の 2 件は pdf.js 部 |

---

## 調査範囲と完了状況

| タスク | 状況 | 備考 |
|---|---|---|
| A-1 Inkdrop 公式仕様 | 完了 | api-docs 原稿と公開ページの一致を確認 |
| A-2 基盤 CSS の解析 | 完了（静的解析） | 変数の適用先の多くが非公開 CSS で、確認できない（09 V-20） |
| A-3 移植対象テーマの解析 | 完了（静的解析） | 解決値は `palette.json` と全件一致（描画色は未検証） |
| A-4 その他の Inkdrop テーマ | 完了 | Default Dark / Light、Solarized Light、Nord Light、Gruvbox、Kanagawa Wave / Lotus、旧 syntax テーマ |
| B-1 Obsidian 公式仕様 | 完了 | changelog は要約経由（09 U-07） |
| B-2 既存テーマの実装 | 完了 | Minimal と Catppuccin は重点、他は特徴的な点 |
| C UI の棚卸し | 完了（デスクトップ） | モバイル固有の上書き、コミュニティプラグイン UI、Publish サイトは対象外 |
| D マッピング候補 | 完了（候補段階） | 確信度 Low 13 件、Inkdrop 適用先が非公開・混在 42 件 |
| E 技術課題と実装候補 | 完了 | ディレクトリ構造とビルドツールは未確定（意図どおり） |
| 独立レビュー対応（Phase 1B） | 完了 | R-01〜R-12 の判定と修正（10） |
| 再現性 | 完了（スクリプト収録・再生成で一致） | 人手の判断を含む行の内容は再現の対象外（00 §6） |
| 実機検証 | **一部完了**（Phase 2B） | P0（V-01・V-20・V-22・V-30）と V-03・V-16・V-32 は VERIFIED（11）、V-04 は VERIFIED（12）。モバイル実機、V-33 などは未実施（09 §0.2・§2） |

### 意図的に行っていないこと

- テーマの実装、`theme.css` などの成果物の生成、ビルドシステムや依存関係の導入（`tools/` は調査データの再生成用で、テーマのビルドには使わない）
- Obsidian の Vault、設定、CSS スニペット、Inkdrop の設定の変更（Phase 2B の Inkdrop 実機検証では、ユーザーの承認を得て設定を一時的に変更し、元に戻した。11 §14.2・§15.9）
- 外部リポジトリへの変更
- Phase 2 の設計判断の確定（09 の推奨はすべて「暫定推奨」）

### 未調査の範囲

- Obsidian のモバイル版（`.is-mobile` 系）の詳細
- コミュニティプラグイン個別の UI（ユーザーの利用プラグインも未確認）
- Obsidian Publish の公開サイト（`publish.css`）、PDF 本文、Web viewer の表示ページ
- Inkdrop のモバイルアプリ
- 両アプリの実画面の比較（スクリーンショットの並置）

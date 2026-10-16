# 工程 11E（品質: lint・許可リスト・コントラスト・配布物・CI）の証拠（2026-10-16）

[14](../../../14-implementation-plan.md) §6.51 の証拠。Obsidian はすべて隔離インスタンス（専用の `--user-data-dir` とテスト Vault の複製）で、普段の Vault・設定・Inkdrop・実機・macOS の表示設定には触れていない。実験で変えた CSS は隔離 Vault の中のテーマ（`AUDIT …`）だけで、リポジトリのテーマ CSS・期待値・許容差・Q-D の判断は変えていない。E43 を使ったあとは `tests/runtime/current-installer.sh restore` で LaunchServices の既定を戻し、`check` の出力が作業の前と同一であることを確かめた（3 回: 監査と回帰のあと、陰性テストのやり直しのあと、探査のあと）。出力には利用者のパスが入るので、リポジトリには入れていない。

## 1. stylelint と依存の版（`static/`）

- `static-run.txt`: S5（公式設定 `stylelint-config-obsidianmd` で error 0、warning が `tests/static/lint-allowlist.json` の 51 件と完全に一致）を含む全静的テストが PASS。51 件の内訳は `declaration-no-important` 44 件、`plugin/no-unsupported-browser-features` 7 件（11D で 1 件追加）。
- `npm-outdated.txt` と `npm view`（2026-10-16）: `stylelint` 17.16.0、`stylelint-config-obsidianmd` 0.1.0、`stylelint-no-unsupported-browser-features` 8.1.2、`doiuse` 6.0.6、`browserslist` 4.29.3 はどれも最新。最新でないのは `postcss` 8.5.29（最新 8.5.30）、`postcss-import` 17.0.0（最新 17.0.1）、`caniuse-lite` 1.0.30001815（最新 1.0.30001816）。**更新していない**（更新するかはユーザーの判断）。

## 2. `!important` の削除の実験（`audit/`）

`tests/quality/important-audit.mjs` を E43（Obsidian 1.14.4、Electron 43.7.7）で実行した。44 件 × 2 テーマ = 88 件それぞれで、その `!important` だけを外した生成物を隔離 Vault に入れ、実行時のテストと同じ道具で測った。

- Mermaid（40 件）: `mermaid-dump.js` で Reading view と Live Preview を測り、`mm.*` の判定と、全要素の fill・stroke・color・background-color を未変更のテーマと比べた。
- translucent（4 件）: translucent の既定の状態のデスクトップの検査すべてと、その宣言そのものを probe で測った。

`important-audit-e43.json`・`.txt` が結果。`audit-table.md` に 44 件の一覧（判定・変化した要素の数・FAIL した検査）をまとめた。

**結果**: 必要 86（43 件 × 2 テーマ）、検証不足 2（#10 × 2 テーマ）、冗長 0。必要のうち、検査が変化に気づかないもの（coverage gap）は 0。

**SVG テキストラベルのブロック**: テストのノート（`tests/fixtures/vault/Mermaid.md`）の flowchart は HTML のラベルだけなので、SVG テキストラベル用の規則（#11 `.cluster-label text`、#14 `.label text`、#20 `edgeLabel rect`）は何にも当たらず、最初の実験（`fixture-trial/`）では変化 0 だった。`htmlLabels: false` のブロック（`tests/quality/mermaid-svg-labels.md`）を作り、実験のときだけ隔離 Vault のノートの複製に足した。

- `mermaid-dump.js` は図の種類をブロックの先頭の語で決めていたので、`%%{init}%%` で始まるブロックを flowchart と判定できず、フィルタだけを記録していた。これを直した（`%%` の行を読み飛ばす）。コミット済みのノートには `%%` の行がないので、回帰の結果は変わらない（§4）。
- 未変更のテーマでも、このブロックで `mm.reading.flowchart-v2.colours` と `mm.live.flowchart-v2.colours` が FAIL する（両テーマ。`important-audit-e43.json` の `baselineFailing`）。差は 4 種類だけ:
  - エッジラベルの `text` と `tspan` の `color`（SD は Obsidian `rgb(51, 51, 51)`、参照 `rgb(173, 184, 184)`）。
  - エッジラベルの `rect.background` の `background-color`。
  - 非表示（`shown=false`）の cluster ラベルの `rect.background` の `stroke`。
  - 表示に効く fill・stroke・opacity は、表示されている全要素で参照と一致している。SVG の文字は `fill` で描かれ（`fill` は明示されていて `currentColor` ではない）、SVG の `rect` は `background-color` を描かないので、画面上の差はないと考えている。**画素では確かめていない。**
- この FAIL を回帰のノートに入れると FAIL 0 の条件に反し、判定（期待値）か CSS を変えないと消せない。どちらも承認が要るので、ブロックはコミット済みのノートに入れず（試したあと元に戻した）、扱いをレビューで諮る。実験では、未変更のテーマの FAIL を基準として記録し、詳細が変わった FAIL だけを数える。

**#10 `.cluster-label :is(span, p) { color }`**（検証不足）: 外しても変化 0。原因を調べた（`entry10-distinct-token.mjs`・`.json`。隔離 Vault で、両方の生成物の末尾に `.theme-dark { --ink-mermaid-title-color: rgb(255, 0, 0); }` を足して測った）。

- 両テーマとも `--ink-mermaid-title-color` と `--ink-mermaid-primary-text-color` は同じ `--ink-mermaid-text-color` を指す。値を見分けられない。
- 赤にすると、#10 が効くのは `p`（cluster ラベルの文字）だけ。`span.nodeLabel` には、詳細度が同じで後に書かれた #12 `:is(.label, [class~="nodeLabel"], …) { color }` が勝つ。
- `!important` の有無で、両テーマ・Reading view・Live Preview の値はまったく同じ。Mermaid の id 付きの規則には `p` の color を決めるものがない（`svg-label-selectors-probe.json` の Mermaid の `<style>` の抜粋: `#ID .cluster-label span{color:…}`、`#ID .cluster-label span p{background-color:transparent}`）。
- 測った状態では `!important` は効いていない。ただし、モバイル（tablet・phone のエミュレーション）、ホバープレビュー、Canvas、PDF の出力は測っていないので、冗長とは言えない（§6.30.3 の区分）。外すかの提案は 14 §6.51 に書いた（外していない）。

**app.css の根拠**:

- translucent の 4 件: 1.14.4 の `app.css` L6589（L6579〜6591 の規則）の `background-color: transparent !important` が今もあることを、互換性の棚卸しで確かめた（`static/inventory-1.14.4.txt`。引用された規則 22 件すべて有効）。外すと値が `rgba(0, 0, 0, 0)` になり、translucent の検査が FAIL する。
- Mermaid の 40 件: Mermaid 11.13.0 が各図の SVG の中に入れる `<style>` の規則（図のランダムな id 付き。詳細度 1-0-0 以上）が相手。棚卸しで Mermaid が 11.13.0 のままであることを確かめた。

## 3. コントラスト（`contrast.json`・`contrast.txt`）

`tests/quality/contrast.mjs` で、§4 の E43 の実行時の結果（`regress/runtime-electron-43.7.7.json`）の測定値と、V-38 の画素（`evidence/phase3-v38/measurements/v38-compare-gray-active.csv`、2026-10-11、灰色・アクティブ、ディスプレイの色空間）から計算した。組は `tests/quality/contrast-pairs.json`（37 組）で、140 個の比が出た。4.5 未満は 39 個（Q-D15 により調整しない）。11D の回帰の結果から計算した値と同一。

## 4. 回帰（`regress/`）

コミット済みのノート（11D と同じ）と、直した `mermaid-dump.js` で全検査と陰性テストを回した。`run.log` が時刻。

| Electron | 検査 | PASS / PASS (EMULATED) / DIFF / UNSUPPORTED / FAIL | 11D との状態の差 | 陰性テスト |
|---|---|---|---|---|
| 39.5.1 | 3,871 | 2,430 / 805 / 606 / 30 / 0 | 0（片方だけの検査 0） | 693 件すべて宣言どおり |
| 43.7.7 | 3,871 | 2,430 / 805 / 606 / 30 / 0 | 0（片方だけの検査 0） | 1 回目は 1 件が宣言どおりでない（下記）。やり直しで 693 件すべて宣言どおり |

- `compare-11d-*.json` は `tests/integration/lib.mjs` の `compareResults` の出力。状態が同じで詳細だけが違うもの（E39 62 件、E43 46 件）は `runner.environment`（時刻・環境の記録）と `runner.pointer-prepared`（待ち時間）だけ。
- E43 の陰性テストの 1 回目（`self-test-electron-43.7.7-run1.txt`）: 構文の陽性対照（コミットどおりのテーマと基準）が `syn.reading.js.impl block not found or text differs (code element not rendered)` で FAIL した。今回の変更（Mermaid のダンプだけ）とは無関係の、Reading view の描画の遅れとみている。原因は特定していない。新しいインスタンスでのやり直し（`self-test-electron-43.7.7.*`）では全件が宣言どおり。この現象は今回が初めての記録。

## 5. 配布物と CI（`static/`）

- `static-run.txt` の S8（新しく追加）: 各テーマの `dist/` は `manifest.json` と `theme.css` の 2 つだけ。manifest の必須の項目（name・version・minAppVersion・author）は文字列で、テーマの manifest にない項目はない。version は x.y.z。`theme.css` はビルドのヘッダーで始まる。`url()` は `data:` URI だけ。大きさ: SD は theme.css 136,183 B・manifest 115 B、KD は 138,671 B・116 B。
- `static-self-test.txt`: S8 の陰性テスト 4 件（プラグイン用の `id`、author の欠落、version `0.1`、外部 URL）を含む 59 件。
- `quality-self-test.txt`: `tests/quality/lib.mjs` の陰性テスト 20 件。
- `clean-room.txt`: 一時ディレクトリの `npm ci` からのビルドで、4 ファイルともローカルのビルドとバイト単位で同一。静的テスト 214 PASS。`dist-sha256.txt` が 4 ファイルの SHA-256。
- `npm-test.txt`: `npm test`（静的テストと陰性テスト全部）が成功。
- manifest の名前・作者はまだ仮（`DEV … (unnamed)`・`TBD`。Q-D18・Q-D19、工程 12）。

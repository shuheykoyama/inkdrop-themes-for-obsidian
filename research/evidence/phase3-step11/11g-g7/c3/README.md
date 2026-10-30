# 工程 11G C3: Markdown のリストの印（2026-10-30）

[14](../../../../14-implementation-plan.md) §6.141 の証拠。

## 何をしたか

- 隔離した Obsidian 1.14.5（Electron 39.5.1、`tests/runtime/obsidian-isolated.sh`）で、C3 の前と後の CSS を測った。
  - 前: `660bf35` のクローンのビルド（C1-a の CSS。`theme.css` の SHA-256 は KD `0ffa883e…`、SD `0f8e864f…`）
  - 後: `d388397` と同じ作業ツリーのビルド（KD `a2977a35…`、SD `8f2c6b48…`）
- 対象のノート: `C3 probe.md`（調べるためのノート。隔離した Vault のコピーにだけ置いた）、`Code blocks.md`、`Markdown elements.md`。
  - `C3 probe.md` の中身:
    - markdown のブロック: `-`・`*`・`+`・`1.`・`2)`、3 段の入れ子、タスク、引用、強調・コード・リンク
    - md のブロック: `-`・`10.`
    - js のブロック
    - ブロックの外のふつうのリスト（入れ子・番号・タスク）
- 測り方は C1-a と同じ（`c3-probe.mjs` は `../c1a/c1-probe.mjs` の写しで、ノートだけを変えた。比較は `../c1a/c1-compare.mjs`）。
- そのあと、同じ環境で、実行時の検査を 1 回すべて実行した（`targeted/`）。

## ファイル

- `c3-probe.mjs`: 測定の道具。`node c3-probe.mjs <repo> <vault> <out.json>`。
- `before.json`、`after.json`: 測定の結果。
- `c3-compare.txt`: 前と後の比較（`node ../c1a/c1-compare.mjs before.json after.json`）。
- `targeted/runtime-electron-39.5.1.json`、`targeted/run.log`: 実行時の検査の結果（`tests/runtime/run.mjs`）。
- `run-window.txt`: 時刻とビルド。
- `regress/`: `d388397` での 1.14.4・1.14.5 のフル回帰（§6.141.5）。1.14.4 E39.5.1 の自己テストで 2 例が宣言と違った、最初の結果を含む。
- `selftest-rerun/`: 1.14.4 E39.5.1 の自己テストの 1 回のやり直し（§6.141.6）。790 例すべてが宣言どおり。

## 結果

- 変わった要素（前と後の比較）:
  - KD の Reading view の、markdown・md のブロックの `span.token.list.punctuation` だけ。`C3 probe.md` で 10 個（`-` 6、`*`、`+`、`1.`、`10.`）、`Code blocks.md` で 1 個（`-`）。
  - 色は rgb(137, 153, 122)（dragonGreen2）→ rgb(150, 160, 182)（dragonTeal）。Inkdrop 6.2.0 で測った色と同じ。
  - SD: 全ノート・全ビューで、変わった要素は 0。
  - Live Preview と Source mode、ブロックの外のふつうのリスト、ほかのトークン（引用の `>`、強調の `**`、js の記号）は変わらない。
- 実行時の検査（`regress-b` の 1.14.5 E39.5.1 の 1 回目と比べた）:
  - FAIL は 0（前は KD の `syn.reading.classes` の 6 件）。
  - KD の `syn.reading.classes` の要素のグループ: EXACT 125、CONFLICT 27、MISMATCH 0、DOMINATED 0。
  - 状態が変わったのは、KD の `syn.reading.classes` の 6 件（FAIL → PASS・PASS (EMULATED)）だけ。
  - `syn.reading.markdown.fidelity`（KD）は DIFF のまま。Inkdrop の色の範囲が 14/22 → 15/22。DIFF の合計は 594 のまま。
  - そのほかの detail の差は、テーマの CSS の長さ、`is-focused` の有無、ホバーのプレビューが出るまでの時間だけ。

## 合わないまま残るもの

- 入れ子の 2 段目・3 段目の印: Inkdrop は `--md-list-mark-2-color`・`-3-color` にする。Prism のクラスでは深さを分けられないので、1 段目と同じ色になる。
- `2)` の形の番号: Inkdrop は `ListMark` にする。Prism の markdown は `1.` の形だけを list にするので、`2)` はトークンにならず、コードの地の色のまま。

## 確かめていないこと

- 画面のピクセルは比べていない。
- 1.14.4 E39.5.1 の最初の自己テストで、ホバーする内部リンクが見つからなかった原因。

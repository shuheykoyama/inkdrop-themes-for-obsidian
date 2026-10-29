# 工程 11G G7-a: iPhone の結果のオフラインでの判定し直し（2026-10-29）

[14](../../../../../14-implementation-plan.md) §6.139 の証拠。

## 何をしたか

- G1 の iPhone の生の結果（`../../../11g-g1/device/results-2026-10-20T06-17-51-248Z.json`）を、`tests/device/judge.mjs` で判定し直した。
- 判定のコミットは `74f2797`。Q-D13 の参照は、Inkdrop 6.2.0 の描画した色（`tests/fixtures/inkdrop-rendered-6.2.0.json`、G7-1 の実測）。
- 判定は、生の結果に入っているページのダンプ（計算された色）から行った。新しく測っていない。
- 元の結果と旧いレポート（`../../../11g-g1/device/report.json`、静的な期待値で判定したもの）は、変えていない。

| 項目 | 値 |
|---|---|
| 実機の測定 | 2026-10-20T06:10:39Z〜06:17:51Z（iPhone 12 Pro、iOS 27.0、Obsidian 1.14.5 (387)、kit `abfb7c19`） |
| 判定し直し | 2026-10-29T15:39:23Z |
| 生の結果の SHA-256 | `f42f2ada406c0b9fc7b07225f06c03f0799aeb7217161509442b49f1209ad484` |
| 旧いレポートの SHA-256 | `647d2308f23fc0805fd50a841b1991f338b660a310590ec8c366782b0b23309f` |

## CSS が当時と同じこと

- キットの `theme.css`（`../../../11g-g1/kit/inkdrop-device-kit.json` の SHA-256）と、`74f2797` のビルドの `dist/<theme>/theme.css` は、2 テーマとも同じ値。
  - kanagawa-dragon `7a3715ca…a3b885`、solarized-dark `b98da149…70ac`
- 判定の道具は、`dist` の CSS も読む。CSS が同じなので、当時の表示に新しい基準を当てた結果になる。
- C1-a などで CSS を変えた後の結果ではない。CSS を変えた後の iPhone の結果の代わりにはならない。

## ファイル

- `report.json`: 判定し直した結果。
- `judge.txt`: 判定の出力。
- `compare-prediction.txt`: G7-2 の予測（`../../g7-2/reclassify.json` の phone）との照合。テーマ × ビューのすべてが予測どおり。

## 結果

- 916 件。PASS 800、FAIL 1、DIFF 101、UNSUPPORTED 10、N/A 4。
- 旧いレポート（PASS 801、FAIL 0、DIFF 101）との状態の差は 3 件で、どれも予想したもの。
  - `syn.reading.rs.fidelity|solarized-dark`: DIFF → PASS
  - `syn.reading.shell.fidelity|kanagawa-dragon`: PASS → DIFF
  - `syn.reading.classes|kanagawa-dragon`: PASS → FAIL（MISMATCH 4: sh の punctuation、file-descriptor、for-or-select と、markdown の list の punctuation）
- detail だけが違うのは、`syn.*` の 73 件（run の数と、違う文字の内訳）。
- `syn.*` 以外の結果は、状態も detail も同じ。
  - Q-D13 以外の結果は、当時の結果のまま。新しく認め直したものではない。

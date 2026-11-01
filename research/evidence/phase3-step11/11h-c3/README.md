# 工程 11H: C3 の後の入力の差し替えとリリースの判定の集計（2026-11-01）

[14](../../../14-implementation-plan.md) §6.144 の証拠。前回の 11H は [`../11h/`](../11h/)（消していない）。

## ファイル

- `inputs-before.json`、`inputs-after.json`: `tests/release/inputs.json` の差し替えの前と後。
- `inputs-sha256.txt`: 新しい入力の 9 ファイルの SHA-256（先頭 16 桁）。
- `gate-before.txt`、`release-gate-before.json`: 差し替えの前の `node tests/release/gate.mjs`（今のコードと `requirements.json`、前の入力）。
- `gate-after.txt`、`release-gate-after.json`: 差し替えの後。
- `gate-compare.mjs`、`gate-compare.txt`: 単位ごと、部分（検査 × 外観 × ビュー）ごとの比較。
- `negative-tests.txt`、`negative-inputs/`: わざと誤った入力でのゲート（自己テストのファイル、1.14.5 の結果なし、Mac の模擬の結果を iPhone として）。

## 新しい入力の来歴

| 入力 | ファイル | Obsidian・Electron | 測定 | コード | 期待値 |
|---|---|---|---|---|---|
| macOS 1.14.4 | `11g-g7/c3/regress/1.14.4/runtime-electron-39.5.1-{run1,frame}.json` | 1.14.4 app.asar、Electron 39.5.1 | 2026-10-30T03:26Z・04:01Z、隔離した Obsidian、Hidden と custom frame | `d388397`（clean なクローン、`summary.json`） | Inkdrop 6.2.0 の実測（`tests/fixtures/inkdrop-rendered-6.2.0.json`） |
| macOS 1.14.4 | `…/1.14.4/runtime-electron-43.7.7-{run1,frame}.json` | 1.14.4 のインストーラー、Electron 43.7.7 | 04:22Z・04:57Z | 同じ | 同じ |
| macOS 1.14.5 | `…/1.14.5/runtime-electron-39.5.1-{run1,frame}.json` | 1.14.5 app.asar、Electron 39.5.1 | 05:18Z・05:53Z | 同じ | 同じ |
| macOS 1.14.5 | `…/1.14.5/runtime-electron-43.8.3-{run1,frame}.json` | 1.14.5 のインストーラー、Electron 43.8.3 | 06:14Z・06:48Z | 同じ | 同じ |
| iPhone | `11g-g7/iphone-c3/device/report.json` | iPhone 12 Pro、iOS 27.0、Obsidian 1.14.5（実機） | 2026-11-01T03:30Z〜03:49Z | キット `bb2510e4`（`8b719e1` から）。判定は `tests/device/judge.mjs`（`d388397` から変わっていない） | 同じ |

- 両テーマの CSS: 実行時の検査の `runner.theme-applied` と、iPhone の `device.theme-applied` の CSS の長さが、どれも SD 137,175 文字、KD 139,663 文字。`d388397` のビルドの SHA-256 は SD `8f2c6b48…`、KD `a2977a35…`（`../11g-g7/c3/README.md`、`../11g-g7/iphone-c3/kit/`）。
- `src/`・`scripts/`・`tests/`（spec、runtime、device、release、fixtures、lib）は、`d388397` から今まで変わっていない。
- 1.14.4 の run-all では、E39.5.1 の自己テストで 2 例が宣言と違った（§6.141.5）。結果のファイル（run1・frame）は完了していて、自己テストは承認された 1 回のやり直しで 790 例すべてが宣言どおりだった（§6.141.6）。自己テストのファイルは入力に入れていない。
- 前の入力は、どれも 6.2.0 の実測の基準より前の期待値（Inkdrop 6.1.5 の同梱のコードの解析）で判定されていた（11F `d027f61`、1.14.5 `b618637`、G1 のキット `daac8e2`）。新しい入力は、すべて 6.2.0 の実測の基準による。

## 結果

- 単位の状態は 688 単位すべてで同じ。証拠のファイルが替わったのは 310 単位。
- 状態が変わった部分は `qd13.fidelity` の `syn.reading.rs.fidelity` だけで、DIFF → PASS（macOS 1.14.4・1.14.5 の 3 つの外観 × 2 回の実行、iOS phone、両テーマ）。単位は DIFF のまま。
- `qd13.fidelity` の DIFF の検査（言語 × ビュー）: SD 48、KD 51（前は 49、52）。macOS の DIFF の部分は版ごとに 594、iOS は 99。

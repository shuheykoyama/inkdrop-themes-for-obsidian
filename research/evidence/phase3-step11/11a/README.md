# 工程 11A（棚卸しとリリースの判定の集計）の証拠（2026-10-15）

[14](../../../14-implementation-plan.md) §6.33 の証拠。新しい実行はしていない。判定の入力は、コミット済みの結果ファイルだけ（`tests/release/inputs.json`）。

| ファイル | 内容 |
|---|---|
| `release-gate.json` | `node tests/release/gate.mjs --out …` の全単位（必須項目 × テーマ × OS × デバイスの区分 × 版）。各単位に、状態、内訳（検査の ID、外観、状態、方法）、証跡（結果ファイル、コミット、版、Electron、日時）が付く |
| `release-gate.txt` | 同じ実行の要約。リリースの合格条件は NOT MET |
| `release-self-test.txt` | `node tests/release/self-test.mjs` の出力（21 件すべて期待どおり） |

入力の結果ファイル:

- `phase3-step10/rereview/final/runtime-electron-39.5.1.json`・`runtime-electron-43.7.7.json`（デスクトップ、Obsidian 1.14.4、§6.25）
- `phase3-step10/device-run2/report.json`（iPhone 12 Pro、iOS 27.0、Obsidian 1.14.5、§6.23。RV6 の照合を入れる前のキット）

キットの Mac での試運転（`device.environment` が FAIL するもの）は、実機の結果ではないので入力に入れていない。入れた場合、判定はその判定を受け付けない（陰性テストで確認）。

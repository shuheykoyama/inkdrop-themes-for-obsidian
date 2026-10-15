# 工程 11B（統合の回帰）の証拠（2026-10-15）

[14](../../../14-implementation-plan.md) §6.38 の証拠。`node tests/integration/run-all.mjs <新しい出力先>` を 1 回実行した結果（2026-10-15 10:28〜12:37 UTC、`caffeinate -i -m` の下で実行）。Obsidian はすべて隔離インスタンス（Obsidian 1.14.4）で、Vault・Inkdrop・実機・macOS の表示設定には触れていない。

| ファイル | 内容 |
|---|---|
| `summary.json` | 各ステップの終了コードと時間、比較の結果（件数・状態の内訳・状態の差・測定値の差）、キットの試運転の FAIL の分類、リリースの判定 |
| `run-all.log` | 実行の記録（ステップごとの開始と結果） |
| `steps/*.txt` | 各ステップの出力 |
| `runtime-electron-39.5.1-run1.json`・`-run2.json`、`runtime-electron-43.7.7-run1.json`・`-run2.json` | 実行時テスト（各 3859 件）。実行ごとに新しい隔離インスタンス |
| `runtime-electron-*-self-test.json` | ランナーの陰性テスト（各 685 件） |
| `kit-build/`・`kit-plugin/`・`kit-dry-run/` | 実機キットの陰性テストと、Mac のエミュレーションでの試運転（`report-emulated.json` は 910 件） |
| `release-inputs.json`・`release-gate.json` | この実行の run 1（E39・E43）と iPhone の判定でのリリースの判定。`release-inputs.json` のパスは実行時の出力先（リポジトリの外）を指している |

`current-installer.sh check` の出力（この Mac の LaunchServices の記録）は証拠に入れていない。E43 の前後の `obsidian://` の関連付けは `run-all.mjs` が比べ、変わっていなかった（`summary.json` の problems にない）。

# KD の C2 の最終の CSS の検証（2026-11-02）

[14](../../../14-implementation-plan.md) §6.164〜§6.166 の証拠。対象のコミットは `5a9e5b1`。

- `targeted/`: 1.14.5 E39.5.1 での対象限定の検証。`first-run-6fail/` は、`py` と `python` の組分けの誤りで `syn.reading.classes` が 6 件 FAIL した最初の実行（捨てずに残す）。`fixed/` は修正後（FAIL 0、自己テスト 791 件）。
- `regression/`: macOS 4 環境のフル回帰（1.14.4 と 1.14.5）。`summary.json`、各実行のログ、`run-all.log`、`window.txt`。実行時の結果の JSON（1 件 4.6 MB）は載せていない。パスは `<out>`・`<clone>`・`<repo>`・`~` に直した。
- `kit/`: iPhone のキットの記録（kit id、ZIP の SHA-256、テーマの SHA-256）と自己テスト（build・plugin・dry-run）。

確かめていないこと: iPhone、G4、V-38、画面の画素。

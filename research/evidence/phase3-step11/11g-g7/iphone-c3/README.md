# 工程 11G iPhone の実機の検証（C1-a・C3 の後、2026-11-01）

[14](../../../../14-implementation-plan.md) §6.142（準備）と §6.143（結果）の証拠。

## 環境

- iPhone 12 Pro（iPhone13,3）、iOS 27.0（USB の接続の情報）、Obsidian 1.14.5、phone、390×844、倍率 3。端末の識別子は記録していない。
- キット: `8b719e1` から作成。kit id `bb2510e4-ee76-4791-b4b4-fa497cdb0d1f`（`kit/`）。
- Mac: Intel Core i9-9980HK、pymobiledevice3 11.29.0（更新していない）。

## フォルダ

- `kit/`: キットと自己テスト（§6.142.1）。
- `migration/g1-vault-check.txt`: G1 の Vault の照合と控え（読むだけ）、新しい Vault の照合。
- `device/`: 検査（`cable.mjs checks`）の結果と判定。
  - `results-2026-11-01T03-49-03-310Z.json`: iPhone が書いた結果（66 ジョブ）。
  - `judge.txt`、`report.json`: `tests/device/judge.mjs` の判定。
  - `compare-g1-rejudge.txt`: G1 の判定し直し（`../g7-a/iphone-rejudge/`）との比較（`tools/cmp.mjs`）。
  - `c1a-c3-values.txt`: Reading のコードの地の色（C1-a）とリストの印の色（C3）の実測値。
- `tour-run1-aborted/` 〜 `tour-run4/`: 失敗したツアー（下の表）。証跡として残す。判定には使わない。
- `tour-run5/`: 判定に使うツアー。38 枚、`shots.json`、ツアーの記録、`drawer-header.json`、`timing.txt`、`cpu-speed-limit.log`（30 秒ごとの `pmset -g therm`）。
- `latency/results.txt`: 撮影が遅くなった原因の調査。
- `tools/`: この検証で使った、読むだけの小さな道具（`kitid.mjs`、`open-note.mjs`、`poll.mjs`、`latency.sh`、`cmp.mjs`）。`open-note.mjs` はテスト Vault のノートを開き替えるだけ。

## 結果

- 検査: 916 件。PASS 803、FAIL 0、DIFF 99、UNSUPPORTED 10、N/A 4。
  - `device.theme-applied`・`device.environment` はすべての状態で PASS。iPhone で読み込まれた CSS の長さは、キットの `theme.css` と同じ（SD 137,175 文字 `8f2c6b48…`、KD 139,663 文字 `a2977a35…`）。
  - G1 の判定し直しとの差は 3 件だけで、すべて KD: `syn.reading.classes` FAIL → PASS（MISMATCH 4 → 0）、`syn.reading.rs.fidelity` DIFF → PASS、`syn.reading.shell.fidelity` DIFF → PASS（6/7 → 7/7）。ほかの 913 件は同じ。
  - `syn.reading.markdown.fidelity`（KD）は DIFF のまま。Inkdrop の色の範囲が 14/22 → 15/22。
  - C1-a: Reading のコードの地の色は、全言語で SD rgb(131, 148, 149)、KD rgb(200, 192, 146)。
  - C3: markdown のブロックの `-` は SD rgb(133, 153, 0)、KD rgb(150, 160, 182)。Inkdrop 6.2.0 で測った色と同じ。
- ツアー（5 回目）: 38/38 段を撮影。38 枚とも、その段の表示の時間帯の中で撮った（いちばん小さい余裕は 2.0 秒。Mac と iPhone の時計の比較なので、記録で判定ではない）。ドロワーのヘッダー 4 件 PASS（dE2000: SD 左 0.013、右 0.010、KD 左 0.006、右 0.009）。すべての画像を目で確かめ、通知や個人の情報は写っていない。

## ツアーの各回

| 回 | 撮影 | ドロワーのヘッダー | 何が起きたか |
|---|---|---|---|
| 1（`tour-run1-aborted/`） | 35/38（33・36・38 なし） | 判定できない | 撮影が遅く、段を飛ばした。最後の段の合図を待ったまま止まり、私が止めた。`shots.json` がない |
| 2（`tour-run2/`） | 34/38 を保存（1・22・24 なし、17 を除いた） | 4 件 FAIL（撮影の後の測定でドロワーが閉じていた） | 1 段目で中継の接続が一度切れた。17 段目の画像に ChatGPT アプリの通知（本文の一部）が写っていたので、証跡から除いた（コミットしていない） |
| 3（`tour-run3/`） | 37/38（37 なし） | SD 2 件 PASS、KD 2 件 FAIL（同上） | Aside を終了し、中継を起動し直した。Mermaid の段から撮影が遅くなった |
| 4（`tour-run4/`） | 35/38（19・21・24 なし） | SD 2 件 PASS、KD 2 件 FAIL（同上） | 3 回目と同じ形 |
| 5（`tour-run5/`） | 38/38 | 4 件 PASS | 原因を調べ、Mac を冷ましてから実行 |

- 1〜4 回目のドロワーの FAIL は、撮影が遅れて、撮影の後の測定（`geometryAfter`）でドロワーが閉じていたもの。色の FAIL ではない。
- 1〜4 回目の画像には、遅れのため次の段の画面が写っているものがある。

## 撮影が遅くなった原因（`latency/results.txt`）

- iPhone 側のツアーの記録では、段の間隔と表示の時間は G1 と 0.1 秒の単位で同じだった。iPhone の Obsidian は遅くなっていない。
- 1 枚の撮影は、毎回新しく起動する pymobiledevice3（Python）の処理で、その大半は起動の時間。プロファイルでは、遅いときも速いときも同じ量の処理で、iPhone を待つ時間は約 0.3 秒だった。
- Mac の `pmset -g therm` が `CPU_Speed_Limit = 20〜22` だった（熱で CPU が約 20% に制限されていた）。Mac を冷ましたあとの 5 回目は、上限が 38〜100 の間で、撮影は 1.7〜3.2 秒だった。
- 分けられていないこと: Mermaid の段と CDP の中継の負荷が、熱の制限にどれだけ上乗せしたか。1〜4 回目と G1 の間の上限の値は記録していない。

## 確かめていないこと

- 名前を変えたあとの「このiPhone内」→「Obsidian」のフォルダの一覧は、2026-11-01 にユーザーが確かめた（`InkdropThemeTest`、`-g1`、`-step10`。[14](../../../../14-implementation-plan.md) §6.143.6）。
- 画面のピクセルでのテーマの色の比較（ドロワーのヘッダーのほか）。
